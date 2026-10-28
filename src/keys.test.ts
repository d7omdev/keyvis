import { expect, test } from 'bun:test';
import { addKey, groupsText, parseKeydLine, srtCue, type Group } from './keys';

test('parses keyd monitor lines', () => {
    expect(parseKeydLine('keyd virtual keyboard\t0fac:0ade\tleftcontrol down')).toEqual({ key: 'leftcontrol', down: true });
    expect(parseKeydLine('keyd virtual keyboard\t0fac:0ade\t[ up')).toEqual({ key: '[', down: false });
    expect(parseKeydLine('device added: 0fac:0ade keyd virtual keyboard')).toBeNull();
});

const press = (seq: [string, string[]][]): Group[] =>
    seq.reduce<Group[]>((groups, [key, held]) => addKey(groups, held, key, 10), []);

test('fast overlapping typing stays separate', () => {
    expect(groupsText(press([['h', []], ['e', ['h']], ['y', ['e']]]))).toBe('H E Y');
});

test('modifier combos join, held long or not', () => {
    expect(groupsText(press([['leftcontrol', []], ['c', ['leftcontrol']]]))).toBe('Ctrl+C');
    expect(groupsText(press([['leftcontrol', []], ['leftshift', ['leftcontrol']], ['t', ['leftcontrol', 'leftshift']]])))
        .toBe('Ctrl+Shift+T');
});

test('repeating a combo while holding the modifier starts a new group', () => {
    expect(groupsText(press([['leftcontrol', []], ['c', ['leftcontrol']], ['v', ['leftcontrol']]]))).toBe('Ctrl+C Ctrl+V');
});

test('released modifier does not swallow next key', () => {
    expect(groupsText(press([['leftalt', []], ['a', []]]))).toBe('Alt A');
});

test('caps at max groups', () => {
    const groups = 'abcdef'.split('').reduce<Group[]>((g, k) => addKey(g, [], k, 3), []);
    expect(groupsText(groups)).toBe('D E F');
});

test('pageup is not an arrow', () => {
    expect(groupsText(press([['pageup', []]]))).toBe('PgUp');
});

test('srt cue format', () => {
    expect(srtCue(1, 3723004, 3724500, 'Ctrl+C')).toBe('1\n01:02:03,004 --> 01:02:04,500\nCtrl+C\n\n');
});
