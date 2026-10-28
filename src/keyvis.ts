import "@girs/gjs";
import "@girs/gjs/dom";
import "@girs/gtk-4.0";

import Gtk from "gi://Gtk?version=4.0";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import { exit } from "@girs/gjs/system";
import { ARGS, DEBUG, VERSION, debug, fail, killInstances, showHelp } from "./cli";
import { monitorKeys } from "./keyd";
import { addKey, groupsText, type Group, type KeyEvent } from "./keys";
import { KeyOverlay } from "./overlay";
import { DEFAULT_PLACEMENT, POSITIONS, loadPlacement, type Placement } from "./placement";
import { SrtRecorder } from "./recorder";

const MAX_GROUPS = 8;

// No @girs typings are installed for GLibUnix, hence the untyped dynamic import.
const GLIB_UNIX: string = "gi://GLibUnix";
const GLibUnix = (await import(GLIB_UNIX)).default;

if (ARGS["--help"]) showHelp();
if (ARGS["--version"]) {
    print(`Key Visualizer ${VERSION}`);
    exit(0);
}
if (ARGS["--kill"]) killInstances();
if (ARGS["--keydlog"] && !DEBUG) fail("--keydlog must be used with --debug");

function initialPlacement(): Placement {
    const position = ARGS["--position"];
    if (typeof position !== "string") return loadPlacement();
    if (!POSITIONS.includes(position))
        fail(`invalid position '${position}' (one of ${POSITIONS.join(", ")})`);
    return { ...DEFAULT_PLACEMENT, position };
}

function openRecorder(): SrtRecorder | null {
    const path = ARGS["--record"];
    if (typeof path !== "string") return null;
    try {
        const recorder = new SrtRecorder(path);
        print(`Recording keystrokes to ${path} (00:00:00 = keyvis start)`);
        return recorder;
    } catch (e: any) {
        fail(`cannot write ${path}: ${e.message}`);
    }
}

const KeyVisualizer = GObject.registerClass(
    class KeyVisualizer extends Gtk.Application {
        _overlay: KeyOverlay | null = null;
        _keyd: Gio.Subprocess | null = null;
        _recorder: SrtRecorder | null = null;
        _groups: Group[] = [];
        _held = new Set<string>();
        _closing = false;

        constructor() {
            super({ application_id: "keyvis.d7om.dev", flags: Gio.ApplicationFlags.NON_UNIQUE });
        }

        vfunc_activate(): void {
            debug("DEBUG", "Activating application");
            this.hold();
            // `keyvis --kill` sends SIGTERM; quit cleanly so the recording is finalized and keyd is stopped.
            for (const signal of [2, 15]) {
                GLibUnix.signal_add(GLib.PRIORITY_DEFAULT, signal, () => {
                    this.quit();
                    return GLib.SOURCE_REMOVE;
                });
            }
            this._recorder = openRecorder();
            this._overlay = new KeyOverlay(this, initialPlacement(), () => {
                this._groups = [];
                this._recorder?.end();
            });
            try {
                this._keyd = monitorKeys(
                    (e) => this._onKey(e),
                    (reason) => this._onKeydExit(reason),
                );
            } catch (e: any) {
                this._onKeydExit(e.message);
            }
        }

        vfunc_shutdown(): void {
            this._closing = true;
            this._recorder?.close();
            this._keyd?.force_exit();
            super.vfunc_shutdown();
        }

        _onKey({ key, down }: KeyEvent): void {
            debug("INFO", `Key: ${key} ${down ? "down" : "up"}`);
            if (!down) {
                this._held.delete(key);
                return;
            }
            if (this._held.has(key)) return;

            this._groups = addKey(this._groups, [...this._held], key, MAX_GROUPS);
            this._held.add(key);
            this._overlay?.display(this._groups);
            this._recorder?.show(groupsText(this._groups));
        }

        _onKeydExit(reason: string): void {
            if (this._closing) return;
            printerr(`keyvis: keyd monitor exited${reason ? `: ${reason}` : ""}`);
            printerr("keyvis: is keyd running, and is your user in the 'keyd' group?");
            this.quit();
        }
    },
);

new KeyVisualizer().run([]);
