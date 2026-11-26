// Songwriting: how the harmony of each section relates to the others. Progressions typical of each section,
// the rules that make sections contrast and connect, rhyme schemes, and a song-sketch builder.
// Pure data and functions, shared by the quizzes, the theory pages and the audit.
import { Note, parseDegree, transpose, intervalBetween, degreeName, pc, mod, noteCa } from './note';
import { Chord, getChord, chordSymbol } from './chord';
import { ChartChord, chartChords, classifyCadence, CadenceId, romanIn, FormBlock } from './form';
import { SectionId } from './form';

export type Role = 'verse' | 'prechorus' | 'chorus' | 'bridge';

export interface ProgDef {
  id: string;
  role: Role;
  degrees: [string, string][];
  /** Why it suits the section. No Roman numerals: the page pairs them with chords. */
  whyCa: string;
}

export const SECTION_PROGS: ProgDef[] = [
  { id: 'v-relative', role: 'verse', degrees: [['6', 'm'], ['4', 'maj'], ['1', 'maj'], ['5', 'maj']],
    whyCa: 'Comença a la relativa menor: el vers sona més reservat que la tornada que vindrà, i acaba obert.' },
  { id: 'v-circle', role: 'verse', degrees: [['6', 'm'], ['5', 'maj'], ['4', 'maj'], ['5', 'maj']],
    whyCa: 'No toca mai la tònica: gira sense arribar a casa i guarda aquest moment per a la tornada.' },
  { id: 'v-static', role: 'verse', degrees: [['1', 'maj'], ['1', 'maj'], ['4', 'maj'], ['1', 'maj']],
    whyCa: 'Quiet i estable, gairebé sense moviment: deixa tot l\'espai a la lletra. El moviment vindrà després.' },
  { id: 'v-away', role: 'verse', degrees: [['2', 'm'], ['4', 'maj'], ['2', 'm'], ['5', 'maj']],
    whyCa: 'Comença lluny de la tònica i no hi arriba: quan la tornada hi aterri, sonarà com una arribada.' },
  { id: 'p-climb', role: 'prechorus', degrees: [['2', 'm'], ['3', 'm'], ['4', 'maj'], ['5', 'maj']],
    whyCa: 'Puja grau a grau fins al dominant: la tensió creix a cada compàs i la tornada la resol.' },
  { id: 'p-open', role: 'prechorus', degrees: [['4', 'maj'], ['5', 'maj']],
    whyCa: 'Dos acords i la frase queda oberta en el dominant, que demana la tornada.' },
  { id: 'p-dark', role: 'prechorus', degrees: [['4', 'maj'], ['4', 'm'], ['5', 'maj']],
    whyCa: 'L\'acord de la 4a es fa menor un moment: una ombra just abans que la tornada obri el llum.' },
  { id: 'p-borrowed', role: 'prechorus', degrees: [['b6', 'maj'], ['b7', 'maj']],
    whyCa: 'Dos acords manllevats del menor que pugen per tons fins a la tònica: la tornada hi arriba amb força de rock.' },
  { id: 'c-axis', role: 'chorus', degrees: [['1', 'maj'], ['5', 'maj'], ['6', 'm'], ['4', 'maj']],
    whyCa: 'Comença a la tònica i recorre els acords més forts de la tonalitat: directa, cantable i fàcil de recordar.' },
  { id: 'c-rock', role: 'chorus', degrees: [['1', 'maj'], ['b7', 'maj'], ['4', 'maj'], ['1', 'maj']],
    whyCa: 'Arriba a la tònica i hi torna passant per la 7a bemoll: so de rock, sense sensible.' },
  { id: 'c-close', role: 'chorus', degrees: [['6', 'm'], ['4', 'maj'], ['5', '7'], ['1', 'maj']],
    whyCa: 'Acaba amb una cadència autèntica: la tornada tanca i deixa clar que és el centre de la cançó.' },
  { id: 'b-relative', role: 'bridge', degrees: [['6', 'm'], ['3', 'm'], ['4', 'maj'], ['5', 'maj']],
    whyCa: 'Se\'n va cap als acords menors que encara no havien pesat, i acaba en el dominant per tornar a la tornada.' },
  { id: 'b-borrowed', role: 'bridge', degrees: [['b6', 'maj'], ['b7', 'maj'], ['4', 'maj'], ['5', 'maj']],
    whyCa: 'Dos acords manllevats del menor: el color canvia de cop, i el dominant final torna a casa.' },
  { id: 'b-minor-four', role: 'bridge', degrees: [['4', 'maj'], ['4', 'm'], ['1', 'maj'], ['5', 'maj']],
    whyCa: 'L\'acord de la 4a en menor dona un moment de nostàlgia abans del dominant que porta a l\'última tornada.' },
];

export const ROLE_CA: Record<Role, string> = { verse: 'vers', prechorus: 'pre-tornada', chorus: 'tornada', bridge: 'pont' };

export const progsFor = (role: Role): ProgDef[] => SECTION_PROGS.filter((p) => p.role === role);
export const progChords = (tonic: Note, p: ProgDef): ChartChord[] => chartChords(tonic, p.degrees);

/** Degree of a chord's root in a key, e.g. "5", "b7". */
export const degreeIn = (tonic: Note, c: Chord): string => degreeName(intervalBetween(tonic, c.root));
const isMajor = (c: Chord): boolean => c.def.formula[1] === '3';

// ---------- Section rules ----------

export type FitRule = 'verse' | 'prechorus' | 'chorus';

/**
 * The harmonic rule each section role is tested on:
 * a verse that never reaches the tonic, a pre-chorus that ends open on the dominant,
 * a chorus that closes with an authentic cadence.
 */
export function fitsRule(rule: FitRule, tonic: Note, chords: Chord[]): boolean {
  const degs = chords.map((c) => degreeIn(tonic, c));
  const last = chords[chords.length - 1];
  const prev = chords[chords.length - 2];
  switch (rule) {
    case 'verse': return !degs.includes('1');
    case 'prechorus': return degs[degs.length - 1] === '5' && isMajor(last);
    case 'chorus': return classifyCadence(tonic, prev, last) === 'authentic';
  }
}

export const RULE_CA: Record<FitRule, string> = {
  verse: 'no arriba mai a la tònica',
  prechorus: 'acaba oberta, en l\'acord de dominant',
  chorus: 'acaba tancant amb una cadència autèntica (dominant → tònica)',
};

/** The dominant seventh that leads into a chord: a perfect fifth above its root. */
export const dominantOf = (target: Chord): Chord => ({ root: transpose(target.root, parseDegree('5')), def: getChord('7') });

/** Relative key: minor tonic + minor third = major tonic; major tonic + major sixth = minor tonic. */
export const relativeOf = (tonic: Note, minor: boolean): Note => transpose(tonic, parseDegree(minor ? 'b3' : '6'));

/** A key a semitone or a tone higher, and the dominant seventh that prepares it. */
export function keyLift(tonic: Note, semitones: 1 | 2): { tonic: Note; pivot: Chord } {
  const up = transpose(tonic, parseDegree(semitones === 1 ? 'b2' : '2'));
  return { tonic: up, pivot: dominantOf({ root: up, def: getChord('maj') }) };
}

/** Borrowed chords a bridge can bring in: from the parallel minor. */
export const BORROWED: [string, string][] = [['b7', 'maj'], ['b6', 'maj'], ['b3', 'maj'], ['4', 'm']];
export const DIATONIC: [string, string][] = [['1', 'maj'], ['2', 'm'], ['3', 'm'], ['4', 'maj'], ['5', 'maj'], ['6', 'm']];

/** How one section's last chord leads into the next section's first chord, in words. */
export function joinCa(tonic: Note, a: Chord, b: Chord): string {
  const kind: CadenceId | null = classifyCadence(tonic, a, b);
  const pair = (c: Chord) => `${romanIn(tonic, c)} = ${chordSymbol(c)}`;
  const text: Record<CadenceId, string> = {
    authentic: 'una cadència autèntica: arriba a casa amb tota la força',
    plagal: 'una cadència plagal: arriba a casa suaument',
    half: 'una semicadència: queda en suspens',
    deceptive: 'una cadència trencada: sorprèn amb l\'acord menor de la 6a',
    modal: 'una cadència modal: arriba a casa des d\'un to per sota',
  };
  if (pc(a.root) === pc(b.root) && a.def.id === b.def.id) return `${pair(a)} es manté: la nova secció arrenca sobre el mateix acord, i el canvi el fan la melodia i l'energia.`;
  return `${pair(a)} → ${pair(b)} és ${kind ? text[kind] : 'un pas sense cadència clàssica, que enllaça les seccions per moviment'}.`;
}

// ---------- Rhymes ----------

export const RHYME_FAMILIES: Record<string, string[]> = {
  or: ['cor', 'amor', 'dolor', 'color', 'calor', 'flor', 'por'],
  ar: ['mar', 'cantar', 'tornar', 'somiar', 'esperar', 'parlar', 'ballar'],
  it: ['nit', 'crit', 'oblit', 'llit', 'infinit', 'sentit'],
  ent: ['gent', 'vent', 'moment', 'present', 'lent', 'torrent'],
  ell: ['vell', 'ocell', 'castell', 'aquell', 'anell', 'cabell'],
  ura: ['pura', 'dura', 'altura', 'figura', 'aventura', 'cura'],
  ia: ['dia', 'alegria', 'melodia', 'poesia', 'fantasia', 'companyia'],
};

const FAMILY_OF = new Map(Object.entries(RHYME_FAMILIES).flatMap(([f, ws]) => ws.map((w) => [w, f] as const)));
export const rhymeFamily = (word: string): string | undefined => FAMILY_OF.get(word);

export type Scheme = 'AABB' | 'ABAB' | 'ABBA' | 'XAXA';
export const SCHEMES: Scheme[] = ['AABB', 'ABAB', 'ABBA', 'XAXA'];

export const SCHEME_CA: Record<Scheme, string> = {
  AABB: 'Rima de dos en dos: directa i fàcil de recordar, a vegades massa previsible.',
  ABAB: 'Rima encreuada: flueix, i cada parella tanca una idea.',
  ABBA: 'Rima abraçada: les línies del mig queden tancades per les dels extrems.',
  XAXA: 'Només rimen les línies parelles: és la més habitual en pop, perquè deixa llibertat a les senars.',
};

/** Rhyme scheme of four line endings: rhyming families get letters in order of appearance; lone lines are X. */
export function schemeOf(words: string[]): string {
  const fams = words.map((w) => rhymeFamily(w) ?? w);
  const letters = new Map<string, string>();
  const out: string[] = [];
  for (const f of fams) {
    if (fams.filter((x) => x === f).length === 1) out.push('X');
    else {
      if (!letters.has(f)) letters.set(f, 'AB'[letters.size] ?? 'C');
      out.push(letters.get(f)!);
    }
  }
  return out.join('');
}

// ---------- Song sketch ----------

export interface SketchSection {
  id: SectionId;
  role: Role | 'intro' | 'final';
  title: string;
  /** Chords per bar. */
  bars: ChartChord[][];
  tonic: Note;
  notes: string[];
}

export interface Sketch {
  tonic: Note;
  form: FormBlock[];
  sections: SketchSection[];
}

const spread = (chords: ChartChord[], barsEach: number): ChartChord[][] => chords.flatMap((c) => Array.from({ length: barsEach }, () => [c]));
const pairOf = (tonic: Note, c: Chord) => `${romanIn(tonic, c)} = ${chordSymbol(c)}`;
const andCa = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} i ${xs[xs.length - 1]}`);

/**
 * A complete song plan: verse, pre-chorus, chorus, bridge and a final chorus, with the harmony of each section
 * chosen so the sections contrast and connect. `rand` returns floats in [0, 1).
 */
export function songSketch(tonic: Note, rand: () => number): Sketch {
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];
  const key = (c: Chord) => `${pc(c.root)}:${c.def.id}`;
  let verse: ProgDef;
  let chorus: ProgDef;
  do {
    verse = pick(progsFor('verse'));
    chorus = pick(progsFor('chorus'));
    // Contrast: the chorus must not start on the verse's first chord.
  } while (verse.degrees[0].join() === chorus.degrees[0].join());
  // A pre-chorus that climbs to the flat seventh only makes sense if the chorus lands on the tonic.
  const chorusOnTonic = chorus.degrees[0][0] === '1';
  const pre = pick(progsFor('prechorus').filter((p) => chorusOnTonic || p.degrees[p.degrees.length - 1][0] !== 'b7'));
  const vc = progChords(tonic, verse);
  const cc = progChords(tonic, chorus);
  const pc2 = progChords(tonic, pre);
  const used = new Set([...vc, ...cc, ...pc2].map(key));
  const bridges = progsFor('bridge').filter((b) => progChords(tonic, b).some((c) => !used.has(key(c))));
  const bridge = pick(bridges.length ? bridges : progsFor('bridge'));
  const bc = progChords(tonic, bridge);
  const lift = rand() < 0.5;
  const up = keyLift(tonic, rand() < 0.5 ? 1 : 2);
  const finalTonic = lift ? up.tonic : tonic;
  const fc = progChords(finalTonic, chorus);
  const bridgeBars = spread(bc, 2);
  if (lift) bridgeBars[bridgeBars.length - 1] = [{ ...up.pivot, roman: romanIn(tonic, up.pivot) }];
  // Always four bars: two chords get two bars each; with three, the last one is held so it lands on the chorus.
  const preBars = pc2.length === 2 ? spread(pc2, 2) : pc2.length === 3 ? [[pc2[0]], [pc2[1]], [pc2[2]], [pc2[2]]] : pc2.map((c) => [c]);
  const newInBridge = bc.filter((c) => !used.has(key(c)));

  const sections: SketchSection[] = [
    { id: 'intro', role: 'intro', title: 'Introducció', bars: cc.map((c) => [c]), tonic, notes: [
      'Quatre compassos amb els acords de la tornada: avancen el ganxo sense cantar-lo.',
    ] },
    { id: 'verse', role: 'verse', title: 'Vers', bars: spread(vc, 2), tonic, notes: [
      `Comença a ${pairOf(tonic, vc[0])}${degreeIn(tonic, vc[0]) === '1' ? '' : ', lluny de la tònica'}. ${verse.whyCa}`,
      'Un acord cada dos compassos: el ritme harmònic lent deixa espai a la lletra.',
      'Melodia: registre mitjà o baix, moltes síl·labes, frases que expliquen la història.',
    ] },
    { id: 'prechorus', role: 'prechorus', title: 'Pre-tornada', bars: preBars, tonic, notes: [
      pre.whyCa,
      `Enllaç amb la tornada: ${joinCa(tonic, pc2[pc2.length - 1], cc[0])}`,
      'Melodia: comença a pujar i les frases s\'escurcen.',
    ] },
    { id: 'chorus', role: 'chorus', title: 'Tornada', bars: [...cc, ...cc].map((c) => [c]), tonic, notes: [
      chorusOnTonic
        ? `Arriba a ${pairOf(tonic, cc[0])}. ${chorus.whyCa}`
        : `Comença a ${pairOf(tonic, cc[0])} i arriba a la tònica al final. ${chorus.whyCa}`,
      'Un acord per compàs, dues vegades: el ritme harmònic s\'accelera respecte del vers.',
      'Melodia: la nota més alta de la cançó, notes llargues i el títol al primer o a l\'últim vers.',
    ] },
    { id: 'bridge', role: 'bridge', title: 'Pont', bars: bridgeBars, tonic, notes: [
      newInBridge.length ? `Acords que encara no havien sonat: ${andCa(newInBridge.map((c) => pairOf(tonic, c)))}. ${bridge.whyCa}` : bridge.whyCa,
      lift
        ? `L'últim compàs canvia a ${pairOf(tonic, up.pivot)}: és el dominant de ${noteCa(up.tonic)} major, la tonalitat de l'última tornada.`
        : `Acaba a ${pairOf(tonic, bc[bc.length - 1])} per tornar a la tornada: ${joinCa(tonic, bc[bc.length - 1], cc[0])}`,
      'Lletra: un altre punt de vista o un gir a la història. Melodia: una zona del mànec que encara no has fet servir.',
    ] },
    { id: 'chorus', role: 'final', title: lift ? `Última tornada, ${mod(pc(up.tonic) - pc(tonic), 12) === 1 ? 'un semitò' : 'un to'} amunt` : 'Última tornada', bars: [...fc, ...fc].map((c) => [c]), tonic: finalTonic, notes: [
      lift
        ? `Els mateixos acords a la nova tonalitat: ${fc.map((c) => pairOf(finalTonic, c)).join(', ')}. La pujada dona energia al tram final.`
        : 'La mateixa tornada. Per donar-li més pes, dobla-la o allarga l\'últim acord.',
    ] },
  ];

  const form: FormBlock[] = [
    { label: 'I', bars: 4, section: 'intro' }, { label: 'A', bars: 8, section: 'verse' }, { label: 'B', bars: preBars.length, section: 'prechorus' },
    { label: 'C', bars: 8, section: 'chorus' }, { label: 'A', bars: 8, section: 'verse' }, { label: 'B', bars: preBars.length, section: 'prechorus' },
    { label: 'C', bars: 8, section: 'chorus' }, { label: 'D', bars: 8, section: 'bridge' }, { label: 'C', bars: 8, section: 'chorus' },
  ];
  return { tonic, form, sections };
}
