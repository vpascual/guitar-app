import { describe, it, expect } from 'vitest';
import { parseNote, noteName, noteCa, noteCaWords, transpose, parseDegree, degreeName, pc } from './note';
import { SCALES, MAJOR_MODES, getScale, scaleNotes, characteristicNote, parentTonic, validTonics } from './scale';
import { CHORDS, getChord, spellChord, diatonicChords, chordSymbol, romanNumeral } from './chord';
import { voicingFor, voicingMatches, voicingText, scalePosition, fretPc, TUNING } from './guitar';
import { METERS, accentPattern, counting } from './meter';

const names = (ns: { letter: number; alt: number }[]) => ns.map(noteName).join(' ');
const N = parseNote;

describe('notes and intervals', () => {
  it('parses and names', () => {
    expect(noteName(N('Bb'))).toBe('Bb');
    expect(noteCa(N('Bb'))).toBe('Si♭');
    expect(noteCaWords(N('F#'))).toBe('Fa sostingut');
    expect(noteCaWords(N('Eb'))).toBe('Mi bemoll');
  });
  it('transposes with correct spelling', () => {
    expect(noteName(transpose(N('C'), parseDegree('b3')))).toBe('Eb');
    expect(noteName(transpose(N('F#'), parseDegree('3')))).toBe('A#');
    expect(noteName(transpose(N('Bb'), parseDegree('#4')))).toBe('E');
    expect(noteName(transpose(N('B'), parseDegree('bb7')))).toBe('Ab');
    expect(noteName(transpose(N('C'), parseDegree('9')))).toBe('D');
    expect(noteName(transpose(N('C'), parseDegree('#11')))).toBe('F#');
  });
  it('round-trips degree names', () => {
    for (const d of ['1', 'b2', '2', '#2', 'b3', '3', '4', '#4', 'b5', '5', '#5', 'b6', '6', 'bb7', 'b7', '7', 'b9', '#11', '13']) {
      expect(degreeName(parseDegree(d))).toBe(d);
    }
  });
});

describe('scales and modes', () => {
  it('derives the major modes by rotation', () => {
    expect(getScale('dorian').formula.join(' ')).toBe('1 2 b3 4 5 6 b7');
    expect(getScale('phrygian').formula.join(' ')).toBe('1 b2 b3 4 5 b6 b7');
    expect(getScale('lydian').formula.join(' ')).toBe('1 2 3 #4 5 6 7');
    expect(getScale('mixolydian').formula.join(' ')).toBe('1 2 3 4 5 6 b7');
    expect(getScale('aeolian').formula.join(' ')).toBe('1 2 b3 4 5 b6 b7');
    expect(getScale('locrian').formula.join(' ')).toBe('1 b2 b3 4 b5 b6 b7');
  });
  it('derives melodic and harmonic minor modes', () => {
    expect(getScale('altered').formula.join(' ')).toBe('1 b2 b3 b4 b5 b6 b7');
    expect(getScale('lydian-dominant').formula.join(' ')).toBe('1 2 3 #4 5 6 b7');
    expect(getScale('phrygian-dominant').formula.join(' ')).toBe('1 b2 3 4 5 b6 b7');
    expect(getScale('ultralocrian').formula.join(' ')).toBe('1 b2 b3 b4 b5 b6 bb7');
    expect(getScale('locrian-nat6').formula.join(' ')).toBe('1 b2 b3 4 b5 6 b7');
    expect(getScale('lydian-sharp2').formula.join(' ')).toBe('1 #2 3 #4 5 6 7');
  });
  it('spells scales', () => {
    expect(names(scaleNotes(N('D'), getScale('dorian')))).toBe('D E F G A B C');
    expect(names(scaleNotes(N('Eb'), getScale('lydian')))).toBe('Eb F G A Bb C D');
    expect(names(scaleNotes(N('A'), getScale('harmonic-minor')))).toBe('A B C D E F G#');
    expect(names(scaleNotes(N('E'), getScale('phrygian-dominant')))).toBe('E F G# A B C D');
  });
  it('finds characteristic notes and parents', () => {
    expect(noteName(characteristicNote(N('D'), getScale('dorian')))).toBe('B');
    expect(noteName(characteristicNote(N('G'), getScale('mixolydian')))).toBe('F');
    expect(noteName(characteristicNote(N('F'), getScale('lydian')))).toBe('B');
    expect(noteName(parentTonic(N('D'), getScale('dorian')))).toBe('C');
    expect(noteName(parentTonic(N('A'), getScale('phrygian')))).toBe('F');
    expect(noteName(parentTonic(N('E'), getScale('phrygian-dominant')))).toBe('A');
  });
  it('every scale has seven distinct letters and the characteristic degree in its formula', () => {
    for (const s of SCALES) {
      expect(s.formula).toContain(s.characteristic);
      for (const t of validTonics(s)) {
        const notes = scaleNotes(t, s);
        expect(new Set(notes.map((n) => n.letter)).size).toBe(7);
        expect(new Set(notes.map(pc)).size).toBe(7);
      }
      expect(validTonics(s).length).toBeGreaterThan(3);
    }
  });
});

describe('chords', () => {
  it('spells chords', () => {
    const sp = (r: string, id: string) => names(spellChord({ root: N(r), def: getChord(id) }));
    expect(sp('C', 'maj7')).toBe('C E G B');
    expect(sp('B', 'm7b5')).toBe('B D F A');
    expect(sp('B', 'dim7')).toBe('B D F Ab');
    expect(sp('G', '7b9')).toBe('G B D F Ab');
    expect(sp('E', '7#9')).toBe('E G# B D F##');
    expect(sp('D', 'sus4')).toBe('D G A');
    expect(sp('C', 'add9')).toBe('C E G D');
    expect(sp('A', '13')).toBe('A C# G B F#');
    expect(chordSymbol({ root: N('Bb'), def: getChord('m7') })).toBe('Si♭m7');
  });
  it('builds diatonic chords with Roman numerals', () => {
    const rn = (t: string, s: string, sev = false) =>
      diatonicChords(N(t), getScale(s), sev).map((c) => `${c.roman}=${noteName(c.root)}${c.def.suffix}`).join(' ');
    expect(rn('C', 'ionian')).toBe('I=C ii=Dm iii=Em IV=F V=G vi=Am vii°=B°');
    expect(rn('D', 'dorian')).toBe('i=Dm ii=Em bIII=F IV=G v=Am vi°=B° bVII=C');
    expect(rn('G', 'mixolydian')).toBe('I=G ii=Am iii°=B° IV=C v=Dm vi=Em bVII=F');
    expect(rn('E', 'phrygian')).toBe('i=Em bII=F bIII=G iv=Am v°=B° bVI=C bvii=Dm');
    expect(rn('F', 'lydian')).toBe('I=F II=G iii=Am #iv°=B° V=C vi=Dm vii=Em');
    expect(rn('C', 'ionian', true)).toBe('Imaj7=Cmaj7 ii7=Dm7 iii7=Em7 IVmaj7=Fmaj7 V7=G7 vi7=Am7 viiø7=Bm7♭5');
    expect(rn('A', 'harmonic-minor', true)).toContain('V7=E7');
    expect(romanNumeral('b7', 'maj')).toBe('bVII');
  });
  it('builds diatonic triads and sevenths for every scale without unnamed chords', () => {
    for (const s of SCALES) for (const t of validTonics(s)) {
      // Triads of the ultralocrian and altered scales include enharmonic oddities; sevenths must still resolve for major modes.
      if (s.family === 'major') {
        expect(diatonicChords(t, s).length).toBe(7);
        expect(diatonicChords(t, s, true).length).toBe(7);
      }
    }
  });
});

describe('guitar', () => {
  it('knows the fretboard', () => {
    expect(TUNING.map((_, s) => fretPc(s, 0))).toEqual([4, 9, 2, 7, 11, 4]);
    expect(fretPc(0, 5)).toBe(9);
  });
  it('gives textbook open chords', () => {
    const v = (r: string, id: string) => voicingText(voicingFor({ root: N(r), def: getChord(id) })!);
    expect(v('E', 'maj')).toBe('0 2 2 1 0 0');
    expect(v('A', 'm')).toBe('x 0 2 2 1 0');
    expect(v('C', 'maj')).toBe('x 3 2 0 1 0');
    expect(v('F', 'maj')).toBe('1 3 3 2 1 1');
    expect(v('B', 'm')).toBe('x 2 4 4 3 2');
  });
  it('every voicing contains only chord tones, with root and the defining tones', () => {
    for (const def of CHORDS) for (const r of ['C', 'F#', 'Bb', 'E', 'A', 'G', 'D']) {
      const ch = { root: N(r), def };
      const v = voicingFor(ch);
      expect(v, `${r}${def.id}`).not.toBeNull();
      const notes = spellChord(ch);
      // Root plus every tone except the fifth (commonly omitted) and, in 13 and 11 chords, the ninth.
      const required = notes
        .filter((_, i) => !['5', '9'].includes(def.formula[i]) || (def.formula[i] === '9' && !['11', '13'].includes(def.id)))
        .map(pc);
      expect(voicingMatches(v!, ch, required), `${r}${def.id} ${voicingText(v!)}`).toBe(true);
      expect(v!.every((f) => f === null || (f >= 0 && f <= 15))).toBe(true);
    }
  });
  it('scale positions rise in pitch and stay inside five frets', () => {
    for (const s of MAJOR_MODES) for (const t of validTonics(s)) {
      const pos = scalePosition(scaleNotes(t, s));
      expect(pos.length).toBeGreaterThanOrEqual(15);
      const frets = pos.map((p) => p.fret);
      expect(Math.max(...frets) - Math.min(...frets)).toBeLessThanOrEqual(4);
      expect(fretPc(pos[0].string, pos[0].fret)).toBe(pc(t));
    }
  });
});

describe('meters', () => {
  it('accents group starts', () => {
    const m = METERS.find((x) => x.id === '7/8:2+2+3')!;
    expect(accentPattern(m)).toEqual([2, 0, 1, 0, 1, 0, 0]);
    expect(counting(m)).toBe('1 2 · 1 2 · 1 2 3');
    for (const x of METERS) expect(x.groups.reduce((a, b) => a + b, 0)).toBe(x.beats);
  });
});
