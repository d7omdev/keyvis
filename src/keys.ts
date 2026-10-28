export type Group = readonly string[];

export const MODIFIERS = new Set([
    'leftcontrol', 'rightcontrol',
    'leftshift', 'rightshift',
    'leftalt', 'rightalt',
    'leftmeta', 'rightmeta',
]);

const NAMES: Record<string, string> = {
    leftcontrol: 'Ctrl', rightcontrol: 'Ctrl',
    leftshift: 'Shift', rightshift: 'Shift',
    leftalt: 'Alt', rightalt: 'Alt',
    leftmeta: 'Win', rightmeta: 'Win',
    capslock: 'Caps',
    kpenter: 'Enter',
    esc: 'Esc',
    insert: 'Ins',
    delete: 'Del',
    pageup: 'PgUp',
    pagedown: 'PgDn',
};

// Nerd Font glyphs, so these need a Nerd Font installed to render.
const ICONS: Record<string, string> = {
    backspace: '\u{f030d}',
    enter: '\u{f0311}', kpenter: '\u{f0311}',
    tab: '\u{f0312}',
    capslock: '\u{f0632}',
    space: '\u{f1050}',
    compose: '\u{f0bab}',
    up: '\u{f062}', down: '\u{f063}', left: '\u{f060}', right: '\u{f061}',
};

export function keyIcon(key: string): string | undefined {
    return ICONS[key];
}

export function keyText(key: string): string {
    if (NAMES[key]) return NAMES[key];
    if (key.length === 1) return key.toUpperCase();
    return key[0].toUpperCase() + key.slice(1);
}

export interface KeyEvent {
    key: string;
    down: boolean;
}

export function parseKeydLine(line: string): KeyEvent | null {
    const match = line.match(/keyd virtual keyboard\s+\S+\s+(\S+)\s+(up|down)/);
    return match ? { key: match[1], down: match[2] === 'down' } : null;
}

// A key joins the previous group only while every held modifier belongs to a
// still-open combo (one with no regular key yet). Overlapping regular keys from
// fast typing never form a combo.
export function addKey(groups: readonly Group[], held: readonly string[], key: string, max: number): Group[] {
    const mods = held.filter(k => MODIFIERS.has(k));
    const last = groups[groups.length - 1];
    const extendsCombo = mods.length > 0
        && last !== undefined
        && last.every(k => MODIFIERS.has(k))
        && mods.every(m => last.includes(m));

    const next = extendsCombo
        ? [...groups.slice(0, -1), [...last, key]]
        : [...groups, [...mods, key]];
    return next.slice(-max);
}

export function groupsText(groups: readonly Group[]): string {
    return groups.map(g => g.map(keyText).join('+')).join(' ');
}

function srtTime(ms: number): string {
    const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, '0');
    return `${pad(ms / 3600000)}:${pad(ms / 60000 % 60)}:${pad(ms / 1000 % 60)},${pad(ms % 1000, 3)}`;
}

export function srtCue(index: number, startMs: number, endMs: number, text: string): string {
    return `${index}\n${srtTime(startMs)} --> ${srtTime(endMs)}\n${text}\n\n`;
}
