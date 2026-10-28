import GLib from 'gi://GLib';
import { debug } from './cli';

export const POSITIONS = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];

export interface Placement {
    position: string;
    marginX: number;
    marginY: number;
}

export interface Anchors {
    left: boolean;
    right: boolean;
    top: boolean;
    bottom: boolean;
}

export const DEFAULT_PLACEMENT: Placement = { position: 'bottom-right', marginX: 20, marginY: 20 };

const CONFIG_DIR = GLib.build_filenamev([GLib.get_user_config_dir(), 'keyvis']);
const CONFIG_FILE = GLib.build_filenamev([CONFIG_DIR, 'config.json']);

export function anchorsOf(position: string): Anchors {
    return {
        left: position.endsWith('left'),
        right: position.endsWith('right'),
        top: position.startsWith('top'),
        bottom: position.startsWith('bottom'),
    };
}

export function loadPlacement(): Placement {
    try {
        const [, bytes] = GLib.file_get_contents(CONFIG_FILE);
        const saved = JSON.parse(new TextDecoder().decode(bytes));
        const isMargin = (n: unknown) => typeof n === 'number' && n >= 0;
        if (POSITIONS.includes(saved.position) && isMargin(saved.marginX) && isMargin(saved.marginY)) {
            return { position: saved.position, marginX: saved.marginX, marginY: saved.marginY };
        }
        debug('ERROR', `Ignoring invalid ${CONFIG_FILE}`);
    } catch (e: any) {
        debug('INFO', `No saved placement: ${e.message}`);
    }
    return DEFAULT_PLACEMENT;
}

export function savePlacement(placement: Placement): void {
    try {
        GLib.mkdir_with_parents(CONFIG_DIR, 0o755);
        GLib.file_set_contents(CONFIG_FILE, JSON.stringify(placement, null, 4));
    } catch (e: any) {
        printerr(`keyvis: failed to save ${CONFIG_FILE}: ${e.message}`);
    }
}
