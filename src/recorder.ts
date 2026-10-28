import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { srtCue } from './keys';

// Cues are written as each one ends, straight into the target file (not replace()'s
// temp file), so even a SIGKILL loses at most the cue on screen.
export class SrtRecorder {
    #stream: Gio.OutputStream;
    #startTime = GLib.get_monotonic_time();
    #count = 0;
    #cue: { start: number; text: string } | null = null;

    constructor(path: string) {
        const file = Gio.File.new_for_commandline_arg(path);
        try {
            file.delete(null);
        } catch (e: any) {
            if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) throw e;
        }
        this.#stream = file.create(Gio.FileCreateFlags.NONE, null);
    }

    #elapsedMs(): number {
        return (GLib.get_monotonic_time() - this.#startTime) / 1000;
    }

    show(text: string): void {
        this.end();
        this.#cue = { start: this.#elapsedMs(), text };
    }

    end(): void {
        if (!this.#cue) return;
        const cue = srtCue(++this.#count, this.#cue.start, this.#elapsedMs(), this.#cue.text);
        this.#cue = null;
        try {
            this.#stream.write_all(new TextEncoder().encode(cue), null);
            this.#stream.flush(null);
        } catch (e: any) {
            printerr(`keyvis: failed to write recording: ${e.message}`);
        }
    }

    close(): void {
        this.end();
        this.#stream.close(null);
    }
}
