// Songwriting quizzes: how the harmony of each section relates to the others, and lyric rhyme schemes.
// Each one applies a stated technique, so there is exactly one right answer.
import type { PuzzleGenerator, Rng } from './types';
import { Note, noteCa, noteName, pc, sameNote, TONIC_CANDIDATES } from '../theory/note';
import { getScale, validTonics } from '../theory/scale';
import { Chord, chordSymbol, chordId, getChord } from '../theory/chord';
import { ChartChord, chartChords, romanIn } from '../theory/form';
import {
  FitRule, fitsRule, RULE_CA, DIATONIC, BORROWED, SECTION_PROGS, progsFor, progChords, dominantOf, relativeOf, keyLift,
  RHYME_FAMILIES, SCHEMES, Scheme, SCHEME_CA, schemeOf, degreeIn,
} from '../theory/songwriting';
import { choice, optionCount, pickTonic, chordMidi } from './util';

const pair = (tonic: Note, c: Chord): string => `${romanIn(tonic, c)} = ${chordSymbol(c)}`;
const line = (cs: Chord[]): string => cs.map(chordSymbol).join(' – ');
const and = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} i ${xs[xs.length - 1]}`);
const MAJOR = getScale('ionian');
const MAJ = (root: Note): Chord => ({ root, def: getChord('maj') });

// ---------- Which progression fits the section? ----------

const RULES: FitRule[] = ['verse', 'prechorus', 'chorus'];

/** A random four-chord progression from the key's chords, with no chord repeated back to back. */
function randomProg(rng: Rng, tonic: Note, pool: [string, string][]): ChartChord[] {
  const out: [string, string][] = [];
  while (out.length < 4) {
    const next = rng.pick(pool);
    if (out.length && out[out.length - 1][0] === next[0]) continue;
    out.push(next);
  }
  return chartChords(tonic, out);
}

function progWith(rng: Rng, tonic: Note, rule: FitRule, wanted: boolean): ChartChord[] {
  const withV7: [string, string][] = [...DIATONIC, ['5', '7']];
  for (;;) {
    const p = randomProg(rng, tonic, rule === 'verse' && wanted ? DIATONIC.filter(([d]) => d !== '1') : withV7);
    // A distractor for the chorus rule still ends somewhere plausible; a correct one is built to close.
    if (rule === 'chorus' && wanted) p.splice(2, 2, ...chartChords(tonic, [rng.pick<[string, string]>([['5', 'maj'], ['5', '7']]), ['1', 'maj']]));
    if (rule === 'prechorus' && wanted && degreeIn(tonic, p[3]) !== '5') p[3] = chartChords(tonic, [['5', 'maj']])[0];
    const repeats = p.some((c, i) => i > 0 && degreeIn(tonic, c) === degreeIn(tonic, p[i - 1]));
    if (fitsRule(rule, tonic, p) === wanted && !repeats) return p;
  }
}

const RULE_PROMPT: Record<FitRule, (key: string) => string> = {
  verse: (k) => `Vols un vers a ${k} major que no arribi mai a la tònica, per guardar aquest moment per a la tornada. Quina progressió ho fa?`,
  prechorus: (k) => `La pre-tornada ha de quedar oberta perquè la tornada arribi amb força. Quina progressió a ${k} major ho fa?`,
  chorus: (k) => `La tornada ha de tancar amb una cadència autèntica. Quina progressió a ${k} major acaba així?`,
};
const RULE_WHY: Record<FitRule, string> = {
  verse: 'Si el vers evita la tònica, la tornada sona com una arribada quan hi aterra.',
  prechorus: 'Acabar en el dominant deixa la frase en suspens: la tornada arriba com la resposta.',
  chorus: 'El dominant que resol a la tònica tanca el cicle: la tornada queda com el centre de la cançó.',
};

export const sectionFit: PuzzleGenerator = {
  id: 'section-fit',
  skill: 'form',
  requiresAudio: false,
  base: 980,
  bookConcepts: ['scale-degrees-progressions'],
  concepts: RULES.map((r) => `fit:${r}`),
  make(rng, level, concept) {
    const rule = RULES.find((r) => `fit:${r}` === concept) ?? rng.pick(RULES);
    const tonic = pickTonic(rng, MAJOR, level);
    const right = progWith(rng, tonic, rule, true);
    const wrong = [0, 1, 2, 3, 4].map(() => progWith(rng, tonic, rule, false));
    const key = chartChords(tonic, DIATONIC);
    return {
      difficulty: this.base + 60 * level,
      conceptKey: `fit:${rule}`,
      bookConcept: 'scale-degrees-progressions',
      prompt: RULE_PROMPT[rule](noteCa(tonic)),
      answer: choice<ChartChord[]>(rng, right, wrong, line, optionCount(level)),
      hint: rule === 'verse' ? 'Busca la progressió on no surt l\'acord de la tònica.' : 'Només compten els dos últims acords. Troba quin grau és cadascun.',
      explanation: `${right.map((c) => pair(tonic, c)).join(', ')}: ${RULE_CA[rule]}. ${RULE_WHY[rule]}`,
      steps: [
        `Els acords de ${noteCa(tonic)} major són ${key.map((c) => pair(tonic, c)).join(', ')}.`,
        `La regla: la progressió ${RULE_CA[rule]}.`,
        `${line(right)} és ${right.map((c) => c.roman).join(' – ')}: és l'única que la compleix.`,
        RULE_WHY[rule],
      ],
      terms: rule === 'verse' ? ['forma'] : ['cadència'],
      listen: { type: 'progression', chords: right.map(chordMidi) },
      truth: { kind: 'section-fit', rule, tonic: noteName(tonic) },
    };
  },
};

// ---------- Preparing the chorus ----------

export const chorusSetup: PuzzleGenerator = {
  id: 'chorus-setup',
  skill: 'form',
  requiresAudio: false,
  base: 1020,
  bookConcepts: ['secondary-dominants'],
  concepts: ['songwriting:chorus-setup'],
  make(rng, level) {
    const tonic = pickTonic(rng, MAJOR, level);
    const starts: [string, string][] = level === 0 ? [['1', 'maj'], ['4', 'maj']] : [['1', 'maj'], ['4', 'maj'], ['6', 'm'], ['2', 'm']];
    const [target] = chartChords(tonic, [rng.pick(starts)]);
    const dom = dominantOf(target);
    const others = DIATONIC.map((d) => chartChords(tonic, [d])[0]).filter((c) => !sameNote(c.root, target.root)).map(dominantOf);
    const wrong: Chord[] = [...others, MAJ(dom.root), { root: target.root, def: getChord('7') }, { root: dom.root, def: getChord('m7') }];
    const inKey = romanIn(tonic, dom) === 'V7';
    return {
      difficulty: this.base + 60 * level + (inKey ? 0 : 50),
      conceptKey: 'songwriting:chorus-setup',
      bookConcept: 'secondary-dominants',
      prompt: `La tornada comença a ${pair(tonic, target)} (tonalitat de ${noteCa(tonic)} major). Amb quin acord acaba la pre-tornada perquè la tornada hi arribi amb més empenta?`,
      answer: choice<Chord>(rng, dom, wrong, chordSymbol, optionCount(level)),
      hint: 'L\'acord que més empeny cap a un altre és el seu dominant.',
      explanation: `${pair(tonic, dom)}: és el dominant de ${chordSymbol(target)}, una 5a justa per sobre amb 7a menor. Acabar la pre-tornada aquí fa que la tornada sigui la resolució.`,
      steps: [
        `La tornada comença a ${pair(tonic, target)}.`,
        'L\'acord que més empeny cap a un acord és el seu dominant: una 5a justa per sobre de la seva fonamental, amb 3a major i 7a menor. La 7a menor hi afegeix un tritò, l\'interval que més demana resoldre.',
        `Una 5a justa per sobre de ${noteCa(target.root)} és ${noteCa(dom.root)}: ${chordSymbol(dom)}.`,
        inKey
          ? `És el dominant de la tonalitat, ${pair(tonic, dom)}: la tornada arriba com una cadència autèntica.`
          : `Dins de ${noteCa(tonic)} major és ${pair(tonic, dom)}, un dominant secundari: la nota de fora que porta crida l'atenció just abans de la tornada.`,
      ],
      terms: ['cadència'],
      listen: { type: 'progression', chords: [dom, target].map(chordMidi) },
      truth: { kind: 'dominant-of', target: chordId(target) },
    };
  },
};

// ---------- A new chord for the bridge ----------

export const bridgeNew: PuzzleGenerator = {
  id: 'bridge-new',
  skill: 'form',
  requiresAudio: false,
  base: 960,
  bookConcepts: ['modal-mixture-songwriters'],
  concepts: ['songwriting:bridge-new'],
  make(rng, level) {
    const tonic = pickTonic(rng, MAJOR, level);
    for (;;) {
      const verse = progChords(tonic, rng.pick(progsFor('verse')));
      const chorus = progChords(tonic, rng.pick(progsFor('chorus')));
      const used = [...verse, ...chorus];
      const key = (c: Chord) => `${pc(c.root)}:${c.def.id}`;
      const usedKeys = new Set(used.map(key));
      const pool = chartChords(tonic, level === 0 ? DIATONIC : [...DIATONIC, ...BORROWED]).filter((c) => !usedKeys.has(key(c)));
      const usedUnique = [...new Map(used.map((c) => [key(c), c])).values()];
      if (!pool.length || usedUnique.length < 3) continue;
      const fresh = rng.pick(pool);
      const borrowed = !DIATONIC.some(([d, c]) => d === degreeIn(tonic, fresh) && c === fresh.def.id);
      return {
        difficulty: this.base + 50 * level + (borrowed ? 40 : 0),
        conceptKey: 'songwriting:bridge-new',
        bookConcept: borrowed ? 'modal-mixture-songwriters' : 'secondary-dominants',
        prompt: `Vers: ${line(verse)}\nTornada: ${line(chorus)}\nPer al pont vols un acord que encara no hagi sonat. Quin d'aquests és nou?`,
        answer: choice<Chord>(rng, fresh, usedUnique, chordSymbol, optionCount(level)),
        hint: 'Fes la llista de tots els acords del vers i de la tornada, i busca el que no hi és.',
        explanation: `${pair(tonic, fresh)} no ha sonat ni al vers ni a la tornada. ${borrowed ? 'Ve del menor paral·lel: al pont canvia el color de cop.' : 'És de la tonalitat però no s\'havia fet servir: el pont sona nou sense sortir-ne.'}`,
        steps: [
          `Acords que ja han sonat: ${and(usedUnique.map((c) => pair(tonic, c)))}.`,
          `${chordSymbol(fresh)} no hi és: és ${pair(tonic, fresh)}.`,
          borrowed
            ? `No és de ${noteCa(tonic)} major: ve de ${noteCa(tonic)} menor. Manllevar acords del menor és la manera més ràpida de fer que el pont soni a un altre lloc.`
            : `És de ${noteCa(tonic)} major, però la cançó encara no l'havia tocat. El pont sona nou sense sortir de la tonalitat.`,
          'El pont sol acabar en el dominant, perquè l\'última tornada arribi com una resolució.',
        ],
        terms: borrowed ? ['pont', 'intercanvi modal'] : ['pont'],
        listen: { type: 'progression', chords: [chorus[0], fresh, chorus[0]].map(chordMidi) },
        truth: { kind: 'not-used', used: usedUnique.map(chordId) },
      };
    }
  },
};

// ---------- Relative key between sections ----------

export const relativeShift: PuzzleGenerator = {
  id: 'relative-shift',
  skill: 'form',
  requiresAudio: false,
  base: 980,
  bookConcepts: ['relative-parallel'],
  concepts: ['songwriting:relative'],
  make(rng, level) {
    const toMajor = rng.next() < 0.6;
    const scale = getScale(toMajor ? 'aeolian' : 'ionian');
    const from = pickTonic(rng, scale, level);
    const to = relativeOf(from, toMajor);
    const fromChord: Chord = { root: from, def: getChord(toMajor ? 'm' : 'maj') };
    const right: Chord = { root: to, def: getChord(toMajor ? 'maj' : 'm') };
    const wrong: Chord[] = [
      { root: from, def: getChord(toMajor ? 'maj' : 'm') },
      { root: to, def: getChord(toMajor ? 'm' : 'maj') },
      { root: relativeOf(from, !toMajor), def: getChord(toMajor ? 'maj' : 'm') },
      MAJ(chartChords(from, [['5', 'maj']])[0].root),
      { root: chartChords(from, [['4', 'maj']])[0].root, def: getChord(toMajor ? 'maj' : 'm') },
    ];
    return {
      difficulty: this.base + 60 * level,
      conceptKey: 'songwriting:relative',
      bookConcept: 'relative-parallel',
      prompt: toMajor
        ? `El vers gira al voltant de ${chordSymbol(fromChord)}. A la tornada vols passar a la relativa major: les mateixes notes, un centre més lluminós. Quin acord és la nova tònica?`
        : `El vers és a ${noteCa(from)} major. Vols un pont més fosc a la relativa menor, amb les mateixes notes. Quin acord és el nou centre?`,
      answer: choice<Chord>(rng, right, wrong, chordSymbol, optionCount(level)),
      hint: toMajor ? 'La relativa major és una 3a menor per sobre.' : 'La relativa menor és una 3a menor per sota.',
      explanation: `${chordSymbol(right)}: ${noteCa(to)} ${toMajor ? 'major' : 'menor'} té les mateixes notes que ${noteCa(from)} ${toMajor ? 'menor' : 'major'}. El canvi de centre ${toMajor ? 'obre el llum a la tornada' : 'enfosqueix el pont'} sense notes noves.`,
      steps: [
        'Dues tonalitats relatives comparteixen totes les notes; només canvia quina fa de casa.',
        toMajor
          ? `La relativa major d'una tonalitat menor és una 3a menor per sobre: de ${noteCa(from)} a ${noteCa(to)}.`
          : `La relativa menor d'una tonalitat major és una 3a menor per sota (o una 6a major per sobre): de ${noteCa(from)} a ${noteCa(to)}.`,
        `El nou centre és ${chordSymbol(right)}.`,
        toMajor
          ? 'Vers en menor i tornada en la relativa major és un contrast clàssic: la tornada sona com sortir al sol.'
          : 'Un pont a la relativa menor canvia el color sense sortir de les notes de la cançó.',
      ],
      terms: ['relativa'],
      listen: { type: 'progression', chords: [fromChord, right].map(chordMidi) },
      truth: { kind: 'relative', from: noteName(from), toMajor },
    };
  },
};

// ---------- Lifting the last chorus ----------

interface Lift { tonic: Note; pivot: Chord; step: 1 | 2 }

export const keyLiftQuiz: PuzzleGenerator = {
  id: 'key-lift',
  skill: 'form',
  requiresAudio: false,
  base: 1040,
  bookConcepts: ['secondary-dominants'],
  concepts: ['songwriting:key-lift'],
  make(rng, level) {
    const ok = validTonics(MAJOR, 4);
    const step: 1 | 2 = rng.next() < 0.5 ? 1 : 2;
    const tonics = ok.filter((t) => ok.some((u) => sameNote(u, keyLift(t, step).tonic)));
    const tonic = rng.pick(tonics.length ? tonics : ok);
    const right: Lift = { ...keyLift(tonic, step), step };
    // The other step can land on awkward spellings (F♭); show those as the usual enharmonic key.
    const plain = (n: Note): Note => TONIC_CANDIDATES.find((c) => pc(c) === pc(n)) ?? n;
    const rawOther = keyLift(tonic, step === 1 ? 2 : 1);
    const other = { tonic: plain(rawOther.tonic), pivot: { ...rawOther.pivot, root: plain(rawOther.pivot.root) } };
    const oldV = dominantOf(MAJ(tonic));
    const wrong: Lift[] = [
      { ...other, step: step === 1 ? 2 : 1 },
      { tonic: right.tonic, pivot: oldV, step },
      { tonic: right.tonic, pivot: { root: chartChords(right.tonic, [['4', 'maj']])[0].root, def: getChord('7') }, step },
      { tonic: other.tonic, pivot: right.pivot, step },
    ];
    const label = (l: Lift) => `${noteCa(l.tonic)} major, preparada per ${chordSymbol(l.pivot)}`;
    const amount = step === 1 ? 'un semitò' : 'un to';
    return {
      difficulty: this.base + 60 * level,
      conceptKey: 'songwriting:key-lift',
      bookConcept: 'secondary-dominants',
      prompt: `La cançó és a ${noteCa(tonic)} major. Vols pujar l'última tornada ${amount}. Quina és la nova tonalitat i amb quin acord la prepares al final del pont?`,
      answer: choice<Lift>(rng, right, wrong, label, optionCount(level)),
      hint: `Puja ${amount} la tònica, i després busca el dominant de la nova tonalitat.`,
      explanation: `${label(right)}. ${chordSymbol(right.pivot)} és el dominant de ${noteCa(right.tonic)}: posat a l'últim compàs del pont, fa que la nova tonalitat soni inevitable.`,
      steps: [
        `${cap(amount)} per sobre de ${noteCa(tonic)} és ${noteCa(right.tonic)}: l'última tornada va a ${noteCa(right.tonic)} major.`,
        `El dominant de ${noteCa(right.tonic)} és una 5a justa per sobre: ${chordSymbol(right.pivot)}.`,
        `Respecte de la tonalitat original és ${pair(tonic, right.pivot)}. No és de ${noteCa(tonic)} major, i per això anuncia el canvi.`,
        'Sense aquest acord, el canvi sona com un salt brusc; és un recurs vàlid, però menys suau.',
      ],
      terms: ['modulació'],
      listen: { type: 'progression', chords: [MAJ(tonic), right.pivot, MAJ(right.tonic)].map(chordMidi) },
      truth: { kind: 'key-lift', tonic: noteName(tonic), step },
    };
  },
};

const cap = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

// ---------- Rhyme schemes ----------

function wordsFor(rng: Rng, scheme: Scheme): string[] {
  const fams = rng.shuffle(Object.keys(RHYME_FAMILIES));
  const take = (fam: string, n: number) => rng.shuffle(RHYME_FAMILIES[fam]).slice(0, n);
  switch (scheme) {
    case 'AABB': { const [a1, a2] = take(fams[0], 2); const [b1, b2] = take(fams[1], 2); return [a1, a2, b1, b2]; }
    case 'ABAB': { const [a1, a2] = take(fams[0], 2); const [b1, b2] = take(fams[1], 2); return [a1, b1, a2, b2]; }
    case 'ABBA': { const [a1, a2] = take(fams[0], 2); const [b1, b2] = take(fams[1], 2); return [a1, b1, b2, a2]; }
    case 'XAXA': { const [a1, a2] = take(fams[0], 2); return [take(fams[1], 1)[0], a1, take(fams[2], 1)[0], a2]; }
  }
}

export const rhymeScheme: PuzzleGenerator = {
  id: 'rhyme-scheme',
  skill: 'form',
  requiresAudio: false,
  base: 880,
  bookConcepts: [],
  concepts: SCHEMES.map((s) => `rhyme:${s}`),
  make(rng, level, concept) {
    const scheme = SCHEMES.find((s) => `rhyme:${s}` === concept) ?? rng.pick(SCHEMES);
    const words = wordsFor(rng, scheme);
    return {
      difficulty: this.base + 50 * level,
      conceptKey: `rhyme:${scheme}`,
      bookConcept: null,
      prompt: 'Aquestes són les últimes paraules de les quatre línies d\'una estrofa. Quin esquema de rima fan?',
      visual: { type: 'notes', notes: words.map((w, i) => `${i + 1} · ${w}`) },
      answer: choice<Scheme>(rng, scheme, SCHEMES.filter((s) => s !== scheme), (s) => s, optionCount(level)),
      hint: 'Dona una lletra a cada so de rima: les línies que rimen comparteixen lletra. La X és una línia que no rima amb cap.',
      explanation: `${scheme}: ${SCHEME_CA[scheme]}`,
      steps: [
        `Agrupa les paraules que rimen: ${groups(words)}.`,
        'El primer so que rima és A, el segon B; una línia que no rima amb cap altra és X.',
        `Línia a línia: ${words.map((w, i) => `${w} = ${schemeOf(words)[i]}`).join(', ')}.`,
        SCHEME_CA[scheme],
      ],
      terms: ['forma'],
      truth: { kind: 'rhyme', words },
    };
  },
};

function groups(words: string[]): string {
  const byFam = new Map<string, string[]>();
  for (const w of words) {
    const f = Object.entries(RHYME_FAMILIES).find(([, ws]) => ws.includes(w))![0];
    byFam.set(f, [...(byFam.get(f) ?? []), w]);
  }
  return and([...byFam.values()].map((ws) => (ws.length > 1 ? `${ws.join(' i ')} rimen` : `${ws[0]} no rima amb cap`)));
}

export const SONGWRITING_GENERATORS = [sectionFit, chorusSetup, bridgeNew, relativeShift, keyLiftQuiz, rhymeScheme];
export { SECTION_PROGS };
