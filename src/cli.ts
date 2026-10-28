import Gio from 'gi://Gio';
import { exit } from '@girs/gjs/system';

export const VERSION = '0.2.0';

type LogLevel = 'INFO' | 'DEBUG' | 'ERROR';

interface Option {
    alias: string;
    desc: string;
    arg?: string;
}

const OPTIONS: Record<string, Option> = {
    '--help': { alias: '-h', desc: 'Show this help message' },
    '--debug': { alias: '-d', desc: 'Enable debug mode' },
    '--keydlog': { alias: '-l', desc: 'Enable keyd log (requires --debug)' },
    '--kill': { alias: '-k', desc: 'Kill all running keyvis instances' },
    '--position': { alias: '-p', arg: 'POS', desc: 'top-left|top|top-right|left|center|right|bottom-left|bottom|bottom-right' },
    '--record': { alias: '-r', arg: 'FILE', desc: 'Record keystrokes to an .srt subtitle file' },
    '--version': { alias: '-v', desc: 'Show version information' },
};

export function fail(msg: string): never {
    printerr(`keyvis: ${msg}`);
    exit(1);
    throw new Error(msg);
}

function parseArgs(argv: string[]): Record<string, string | true> {
    const args: Record<string, string | true> = {};
    for (let i = 0; i < argv.length; i++) {
        const flag = Object.keys(OPTIONS).find(f => f === argv[i] || OPTIONS[f].alias === argv[i]);
        if (!flag) fail(`unknown option '${argv[i]}' (see --help)`);
        const { arg } = OPTIONS[flag];
        if (!arg) {
            args[flag] = true;
            continue;
        }
        const value = argv[++i];
        if (value === undefined) fail(`${flag} requires ${arg}`);
        args[flag] = value;
    }
    return args;
}

export const ARGS = parseArgs(imports.system.programArgs);
export const DEBUG = Boolean(ARGS['--debug']);
const KEYDLOG = DEBUG && Boolean(ARGS['--keydlog']);

export function debug(level: LogLevel, msg: string): void {
    if (!DEBUG) return;
    const color = { DEBUG: 33, INFO: 32, ERROR: 31 }[level];
    print(`\x1b[${color}m[${level}]\x1b[0m ${msg}`);
}

export function keydlog(msg: string): void {
    if (KEYDLOG) print(`\x1b[34m[KEYDLOG]\x1b[0m ${msg}`);
}

export function showHelp(): never {
    print('');
    print('Key Visualizer - A simple visualizer for key presses');
    print('Usage: keyvis [OPTION]');
    print('');
    print('Options:');
    Object.entries(OPTIONS).forEach(([flag, { alias, arg, desc }]) => {
        print(`  ${`${flag} ${arg ?? ''}`.padEnd(17)} ${alias.padEnd(4)} ${desc}`);
    });
    print('');
    print('Drag the visualizer while it is visible to move it; the spot is remembered.');
    print('');
    exit(0);
    throw new Error('unreachable');
}

export function killInstances(): never {
    try {
        const self = String(new Gio.Credentials().get_unix_pid());
        const pgrep = Gio.Subprocess.new(['pgrep', '-f', 'gjs.*keyvis'], Gio.SubprocessFlags.STDOUT_PIPE);
        const [, out] = pgrep.communicate_utf8(null, null);
        const pids = (out ?? '').split('\n').filter(pid => pid && pid !== self);
        if (pids.length === 0) {
            print('No keyvis instances found');
        } else {
            Gio.Subprocess.new(['kill', ...pids], Gio.SubprocessFlags.NONE).wait(null);
            print('Keyvis killed successfully');
        }
        exit(0);
    } catch (e) {
        logError(e instanceof Error ? e : new Error(String(e)));
        exit(1);
    }
    throw new Error('unreachable');
}
