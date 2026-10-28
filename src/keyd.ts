import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { debug, keydlog } from './cli';
import { parseKeydLine, type KeyEvent } from './keys';

export function monitorKeys(onKey: (event: KeyEvent) => void, onExit: (reason: string) => void): Gio.Subprocess {
    const proc = Gio.Subprocess.new(
        ['keyd', 'monitor'],
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
    );
    const reader = new Gio.DataInputStream({ base_stream: proc.get_stdout_pipe()!, close_base_stream: true });
    const decoder = new TextDecoder();

    // force_exit guarantees stderr reaches EOF, so the read below can't hang.
    const exited = (): void => {
        proc.force_exit();
        const stderr = proc.get_stderr_pipe();
        if (!stderr) {
            onExit('');
            return;
        }
        stderr.read_bytes_async(4096, GLib.PRIORITY_DEFAULT, null, (_source, result) => {
            let reason = '';
            try {
                reason = decoder.decode(stderr.read_bytes_finish(result).toArray()).trim();
            } catch (e: any) {
                debug('ERROR', `Error reading keyd stderr: ${e.message}`);
            }
            onExit(reason);
        });
    };

    const readLine = (): void => {
        reader.read_line_async(GLib.PRIORITY_DEFAULT, null, (_source, result) => {
            let line: Uint8Array | null;
            try {
                [line] = reader.read_line_finish(result);
            } catch (e: any) {
                debug('ERROR', `Error reading keyd output: ${e.message}`);
                exited();
                return;
            }
            if (line === null) {
                exited();
                return;
            }

            const output = decoder.decode(line).trim();
            keydlog(output);
            const event = parseKeydLine(output);
            if (event) onKey(event);
            readLine();
        });
    };

    readLine();
    return proc;
}
