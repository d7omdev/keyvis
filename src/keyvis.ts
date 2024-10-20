import '@girs/gjs';
import '@girs/gjs/dom';
import '@girs/gtk-4.0';
import '@girs/pango-1.0';

import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import { exit } from '@girs/gjs/system';

const ARGV = imports.system.programArgs;

interface Config {
    WINDOW_WIDTH: number;
    WINDOW_HEIGHT: number;
    MARGIN: number;
    CLEAR_TIMEOUT: number;
    FADE_TIMEOUT: number;
    KEY_COMBO_THRESHOLD: number;
    MAX_KEYS: number;
}

let DEBUG: boolean = false;
let ISKEYDLOG: boolean = false;


if (ARGV.includes('--help') || ARGV.includes('-h')) {
    print(`Key Visualizer - A simple visualizer for key presses`);
    print(`Usage: keyvis [OPTION]`);
    print(``);
    print(`Options:`);
    print(`  --debug,    -d      Enable debug mode`);
    print(`  --keydlog,  -k      Enable keyd log`);
    print(`  --help,     -h      Show this help message`);
    print(`  --version,  -v      Show version information`);
    print(``);
    exit(0);
}

if (ARGV.includes('--version') || ARGV.includes('-v')) {
    print(`Key Visualizer 0.1.0`);
    exit(0);
}

if (ARGV.includes('--debug') || ARGV.includes('-d')) {
    DEBUG = true;
}
if (ARGV.includes('--keydlog') || ARGV.includes('-k')) {
    ISKEYDLOG = true;
}

function keydlog(msg: string): void {
    if (DEBUG && ISKEYDLOG) {
        print(`\x1b[34m[KEYDLOG]\x1b[0m ${msg} `);
    }
}

type STATE = 'INFO' | 'DEBUG' | 'ERROR';

function debug(state: STATE, msg: string): void {
    if (!state) {
        state = 'INFO';
    }
    let log

    if (!DEBUG) return;
    if (state === 'DEBUG') log = `\x1b[33m[DEBUG]\x1b[0m ${msg} `
    if (state === 'INFO') log = `\x1b[32m[INFO]\x1b[0m ${msg} `
    if (state === 'ERROR') log = `\x1b[31m[ERROR]\x1b[0m ${msg} `

    print(log);
}

const CONFIG: Config = {
    WINDOW_WIDTH: 500,
    WINDOW_HEIGHT: 50,
    MARGIN: 20,
    CLEAR_TIMEOUT: 1500,
    FADE_TIMEOUT: 500,
    KEY_COMBO_THRESHOLD: 300,
    MAX_KEYS: 10,
};

const specialKeysMap: Record<string, string> = {
    'SHIFT': '󰘶',
    'CAPS': '󰘲',
    'TAB': '󰌒',
    'ENTER': '󰌑',
    'COMPOSE': '󰮫',
    'BACKSPACE': '󰌍',
    'SPACE': '󱁐',
    'CONTROL': 'Ctrl',
    'ALT': 'Alt',
    'META': 'Win',
    'ESC': 'Esc',
    'INSERT': 'Insert',
    'DELETE': 'Del',
    'END': 'End',
    'HOME': 'Home',
    'UP': '',
    'DOWN': '',
};

let deviceMessagesIgnored = true;

function processKeyName(keyName: string) {
    const specialKeysPattern = /[\\|\/.,=\-]/;

    if (specialKeysPattern.test(keyName)) {
        return keyName;
    }
    for (const key in specialKeysMap) {
        if (keyName.toUpperCase() === 'LEFT') return '';
        if (keyName.toUpperCase() === 'RIGHT') return '';
        if (keyName.toUpperCase().includes(key.toUpperCase())) {
            return specialKeysMap[key];
        }
    }

    return keyName;
}

// Check if running in Hyprland and set up rules
function setupHyprlandRules() {
    const isHyprland = GLib.getenv('HYPRLAND_INSTANCE_SIGNATURE') !== null;
    if (!isHyprland) {
        debug('INFO', 'Not running in Hyprland');
        return false;
    }

    const rules = [
        'windowrulev2 float,class:(d7om.dev.keyvis)',
        'windowrulev2 pin,class:(d7om.dev.keyvis)',
        'windowrulev2 noblur,class:(d7om.dev.keyvis)',
        'windowrulev2 noshadow,class:(d7om.dev.keyvis)',
        'windowrulev2 size 200 50,class:(d7om.dev.keyvis)',
        'windowrulev2 animation slide bottom,class:(d7om.dev.keyvis)',
        'windowrulev2 nofocus,class:(d7om.dev.keyvis)',
        'windowrule move 80% 92%,^(d7om.dev.keyvis)$',
        'windowrule noborder,class:(d7om.dev.keyvis)',
    ];

    try {
        for (const rule of rules) {
            const hyprctl = Gio.Subprocess.new(
                ['hyprctl', 'keyword'].concat(rule.split(' ')),
                Gio.SubprocessFlags.NONE
            );
            hyprctl.wait(null);
        }
        debug('DEBUG', 'Hyprland rules set successfully');
        return true;
    } catch (e: any) {
        debug('ERROR', `Error setting Hyprland rules: ${e.message}`);
        return false;
    }
}

interface KeyVisualizerProperties {
    _window?: Gtk.Window;
    _label?: Gtk.Label;
    keyBuffer: string[];
    activeKeys: Set<string>;
    clearTimeout: number | null;
    fadeTimeout: number | null;
}

const KeyVisualizer = GObject.registerClass(
    class KeyVisualizer extends Gtk.Application implements KeyVisualizerProperties {
        _window!: Gtk.Window;
        _label!: Gtk.Label;
        keyBuffer: string[];
        activeKeys: Set<string>;
        clearTimeout: number | null;
        fadeTimeout: number | null;
        lastKeyTime: number;

        constructor() {
            super({
                application_id: 'd7om.dev.keyvis',
                flags: Gio.ApplicationFlags.NON_UNIQUE,
            });
            this.keyBuffer = [];
            this.activeKeys = new Set();
            this.clearTimeout = null;
            this.fadeTimeout = null;
            this.lastKeyTime = 0;
        }

        vfunc_activate(): void {
            debug('DEBUG', 'Activating application');
            setupHyprlandRules();
            this._createUI();
            this._startKeyMonitor();
        }

        _createUI(): void {
            const display = Gdk.Display.get_default();
            if (!display) {
                debug('ERROR', 'Failed to get display');
                return;
            }

            const window = new Gtk.Window({
                application: this,
                title: 'Key Visualizer',
                resizable: false,
                halign: Gtk.Align.END
            });

            window.set_decorated(false);
            window.set_default_size(CONFIG.WINDOW_WIDTH, CONFIG.WINDOW_HEIGHT);
            window.set_resizable(false);
            window.set_size_request(CONFIG.WINDOW_WIDTH, CONFIG.WINDOW_HEIGHT);
            window.set_modal(true);

            const box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                halign: Gtk.Align.END,
                hexpand: true,
            });

            this._label = new Gtk.Label({
                label: '',
                wrap_mode: Pango.WrapMode.WORD_CHAR,
                justify: Gtk.Justification.RIGHT,
                halign: Gtk.Align.END,
                hexpand: true,
                margin_start: 10,
                margin_end: 2,
                width_request: CONFIG.WINDOW_WIDTH - 20,
                max_width_chars: 30,
                ellipsize: Pango.EllipsizeMode.START
            });

            box.append(this._label);

            const cssProvider = new Gtk.CssProvider();
            let backgroundColor = DEBUG ? '#BDAC89' : 'rgba(0, 0, 0, 0.8)';
            let textColor = DEBUG ? '#000000' : '#ffffff';
            cssProvider.load_from_data(`
                    window {
                    color: ${textColor};
                    padding: 10px;
                    border-radius: 5px;
                    background-color: ${backgroundColor};
                    transition: opacity 0.5s;
                    opacity: 0;
                    }

                    label {
                    font-size: 1.8rem;
                    letter-spacing: 6px;
                    font-family: "Rubik", "Geist", "AR One Sans", "Reddit Sans", "Inter";
                    }
                    `, -1);

            Gtk.StyleContext.add_provider_for_display(
                display,
                cssProvider,
                Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
            );

            window.set_child(box);
            this._window = window;

            window.show();
            debug('DEBUG', 'Window created and shown');
            this._setWindowOpacity(0);
        }

        _setWindowOpacity(opacity: number): void {
            const css = new Gtk.CssProvider();
            css.load_from_data(`
                        window {
    opacity: ${opacity};
    transition: opacity 0.5s;
}
`, -1);

            const display = Gdk.Display.get_default();
            if (!display) {
                debug('ERROR', 'Failed to get display');
                return;
            }
            Gtk.StyleContext.add_provider_for_display(
                display,
                css,
                Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
            );
        }

        _startKeyMonitor(): void {
            debug('DEBUG', 'Starting key monitor');
            try {
                const keydMonitor = Gio.Subprocess.new(
                    ['keyd', 'monitor'],
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                );

                const stdout = keydMonitor.get_stdout_pipe();
                if (!stdout) {
                    throw new Error('Failed to get stdout pipe');
                }
                this._readOutput(stdout);
                debug('DEBUG', 'Key monitor started successfully');
            } catch (e: any) {
                debug('ERROR', `Error starting keyd monitor: ${e.message} `);
                this.quit();
            }
        }

        _readOutput(stream: Gio.InputStream): void {
            const reader = new Gio.DataInputStream({
                base_stream: stream,
                close_base_stream: true,
            });

            const readLine = (): void => {
                reader.read_line_async(GLib.PRIORITY_DEFAULT, null, (stream, result) => {
                    if (!stream) {
                        throw new Error('Stream is null');
                    }
                    try {
                        const [line] = stream.read_line_finish(result);

                        if (line) {
                            const output = new TextDecoder().decode(line).trim();
                            keydlog(`Raw output from keyd: ${output} `);

                            if (!output || output.includes('device added:')) {
                                readLine();
                                return;
                            }

                            if (deviceMessagesIgnored) {
                                if (output.startsWith('device added:')) {
                                    debug('DEBUG', 'Skipping device added message');
                                    readLine();
                                    return;
                                } else {
                                    deviceMessagesIgnored = false;
                                }
                            }

                            this._handleKeyEvent(output);
                        }
                        readLine();
                    } catch (e: any) {
                        debug('ERROR', `Error reading keyd output: ${e.message} `);
                        readLine();
                    }
                });
            };

            readLine();
        }

        _handleKeyEvent(output: string) {
            keydlog(`Handling key event: ${output} `);
            const match = output.match(/keyd virtual keyboard\s+(\S+)\s+(\S+)\s+(up|down)/);
            if (!match) {
                debug('DEBUG', 'No match found in output');
                return;
            }

            const keyName = match[2];
            const keyState = match[3];

            debug('INFO', `Processed key: ${keyName}, State: ${keyState} `);

            if (keyState === 'down') {
                const currentTime = Date.now();

                if (this.activeKeys.size > 0) {
                    const timeSinceLastKey = currentTime - this.lastKeyTime;

                    if (timeSinceLastKey < CONFIG.KEY_COMBO_THRESHOLD) {
                        if (this.keyBuffer.length > 0) {
                            const lastKeyIndex = this.keyBuffer.length - 1;
                            const currentCombo = this.keyBuffer[lastKeyIndex].split(' + ');

                            if (currentCombo.length < 4) {
                                this.keyBuffer[lastKeyIndex] += ' + ' + processKeyName(keyName);
                            }
                        }
                    } else {
                        if (this.keyBuffer.length >= CONFIG.MAX_KEYS) {
                            this.keyBuffer.shift();
                        }
                        this.keyBuffer.push(processKeyName(keyName));
                    }
                } else {
                    if (this.keyBuffer.length >= CONFIG.MAX_KEYS) {
                        this.keyBuffer.shift();
                    }
                    this.keyBuffer.push(processKeyName(keyName));
                }

                this.activeKeys.add(keyName);
                this.lastKeyTime = currentTime;
                this._updateLabel();
                this._startClearTimeout();
                this._window.show();
                this._setWindowOpacity(1);
                keydlog(`Active keys updated: ${Array.from(this.activeKeys).join(', ')} `);
            } else if (keyState === 'up') {
                this.activeKeys.delete(keyName);
                keydlog(`Key released: ${keyName} `);
                if (this.activeKeys.size === 0) {
                    this.lastKeyTime = 0;
                }
            }
        }

        _startClearTimeout() {
            if (this.clearTimeout) {
                GLib.source_remove(this.clearTimeout);
                this.clearTimeout = null;
            }

            this.clearTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, CONFIG.CLEAR_TIMEOUT, () => {
                this.keyBuffer = [];
                this._updateLabel();
                this._startFadeTimeout();
                this.clearTimeout = null;
                return GLib.SOURCE_REMOVE;
            });
        }

        _startFadeTimeout() {
            if (this.fadeTimeout) {
                GLib.source_remove(this.fadeTimeout);
                this.fadeTimeout = null;
            }

            this.fadeTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, CONFIG.FADE_TIMEOUT, () => {
                this._setWindowOpacity(0);
                this._window.hide();
                this.fadeTimeout = null;
                return GLib.SOURCE_REMOVE;
            });
        }


        _addKeyToBuffer(keyName: string): void {
            if (this.keyBuffer.length >= CONFIG.MAX_KEYS) {
                this.keyBuffer.shift();
            }
            this.keyBuffer.push(keyName);
            debug('DEBUG', `Active keys: ${this.keyBuffer.join(' ')} `);
            this._updateLabel();
        }

        _removeKeyFromBuffer(keyName: string): void {
            const index = this.keyBuffer.indexOf(processKeyName(keyName));
            if (index !== -1) {
                this.keyBuffer.splice(index, 1);
            }
            this._updateLabel();
        }

        _updateLabel(): void {
            const text = this.keyBuffer.join(' ');
            this._label.set_text(text);
        }

    }
);

const app = new KeyVisualizer();
app.run([]);

