// The theory section: original explanations in Catalan, with every example (scales, chords, tables)
// generated from the theory core in whatever key the reader picks. Nothing is copied from the book;
// each topic only cites where the book treats the subject.
import { Note, noteCa, noteCaWords, parseNote, parseDegree, transpose, pc } from '../theory/note';
import {
  ScaleDef, SCALES, MAJOR_MODES, getScale, scaleNotes, characteristicNote, parentTonic, isMinorScale,
} from '../theory/scale';
import { CHORDS, Chord, ChordDef, getChord, chordSymbol, spellChord, diatonicChords, chordFitsScale } from '../theory/chord';
import { METERS, meterLabel, counting, accentPattern } from '../theory/meter';
import { FretPos, NeckData, scaleNeck, voicingFor } from '../theory/guitar';
import { PROGRESSIONS, METER_SONGS, SongExample } from './progressions';
import { progressionChords } from '../engine/session';
import { spreadTriad } from '../puzzles/chords';
import { DEGREE_NAME } from '../puzzles/explain';
import { scaleMidi, chordMidi } from '../puzzles/util';
import type { BarCell, ChordHelp, FormVisualBlock, Listen } from '../puzzles/types';
import { FORM_GROUP, FORM_TOPICS } from './form-topics';
import { SONGWRITING_TOPICS } from './songwriting-topics';
import { degreeCa, ORDINALS } from '../i18n/ca';

export type Block =
  | { t: 'p'; text: string }
  | { t: 'h'; text: string; id?: string }
  | { t: 'list'; items: string[] }
  | { t: 'table'; head: string[]; rows: string[][]; mark?: number[] }
  | { t: 'scale'; label: string; notes: string[]; formula: string[]; listen: Listen; mark?: number }
  | { t: 'neck'; neck: NeckData; caption: string }
  | { t: 'chords'; chords: (ChordHelp & { listen: Listen; caption?: string })[] }
  | { t: 'prog'; line: string; listen: Listen }
  | { t: 'rhythm'; groups: number[]; listen: Listen }
  | { t: 'fret'; firstFret: number; dots: FretPos[]; caption: string }
  | { t: 'link'; topic: string; text: string }
  | { t: 'practice'; generatorId: string; concept?: string; text: string }
  | { t: 'ref'; concepts: string[] }
  | { t: 'form'; blocks: FormVisualBlock[] }
  | { t: 'bars'; bars: BarCell[]; perRow: number; listen?: Listen };

export interface Topic {
  id: string;
  group: string;
  title: string;
  summary: string;
  /** True when the examples change with the chosen key. */
  usesKey: boolean;
  defaultKey: string;
  /** True when the page can show another random example ("Un altre esbós"). */
  randomizable?: boolean;
  build(key: Note, seed?: number): Block[];
}

export const GROUPS = ['Fonaments', 'Modes de l\'escala major', 'Menor harmònica, menor melòdica i els seus modes', 'Acords', 'Harmonia', 'Ritme', FORM_GROUP];

const p = (text: string): Block => ({ t: 'p', text });
const h = (text: string, id?: string): Block => ({ t: 'h', text, id });
const list = (ns: Note[]): string => ns.map(noteCa).join(' ');
const songs = (ss: SongExample[]): string =>
  ss.map((s) => `«${s.title}» (${s.artist})${s.note ? `: ${s.note}` : ''}${s.confidence === 'discutida' ? ' — anàlisi discutida' : ''}`).join('; ');
const FEMININE = ['melodic-minor', 'harmonic-minor', 'altered'];
const The = (s: ScaleDef): string => (FEMININE.includes(s.id) ? `L'escala ${s.nameCa}` : `El ${s.nameCa}`);
const parentName = (s: ScaleDef): string => (s.family === 'major' ? 'major' : SCALES.find((x) => x.family === s.family && x.modeIndex === 0)!.nameCa);

const scaleBlock = (tonic: Note, s: ScaleDef, markCharacteristic = false): Block => ({
  t: 'scale', label: `${noteCa(tonic)} ${s.nameCa}`, notes: scaleNotes(tonic, s).map(noteCa), formula: s.formula,
  listen: { type: 'scale', midi: scaleMidi(tonic, s) },
  mark: markCharacteristic ? s.formula.indexOf(s.characteristic) : undefined,
});

const neckBlock = (tonic: Note, s: ScaleDef): Block => {
  const notes = scaleNotes(tonic, s);
  const neck = scaleNeck(notes, notes.map(noteCa), characteristicNote(tonic, s));
  return { t: 'neck', neck, caption: `${noteCa(tonic)} ${s.nameCa}, posició del trast ${neck.firstFret}` };
};

const chordsBlock = (chords: Chord[], caption?: (c: Chord) => string): Block => ({
  t: 'chords',
  chords: chords.filter((c) => voicingFor(c)).map((c) => ({
    symbol: chordSymbol(c), voicing: voicingFor(c)!, listen: { type: 'chord', midi: chordMidi(c) }, caption: caption?.(c),
  })),
});

const progBlock = (chords: (Chord & { roman: string })[]): Block => ({
  t: 'prog', line: chords.map((c) => `${c.roman} = ${chordSymbol(c)}`).join('  →  '),
  listen: { type: 'progression', chords: [...chords, chords[0]].map(chordMidi) },
});

// ---------- Modes ----------

const MODE_TEXT: Record<string, string> = {
  ionian: 'És l\'escala major. Sona estable i resolta: la 7a major (la sensible) estira cap a la tònica i la 4a justa demana baixar a la 3a. Com que és el so de sempre, costa sentir-lo com un mode. El que el separa del lidi és la 4a justa, i del mixolidi, la 7a major.',
  dorian: 'Un menor que no és trist del tot. La 6a major li treu el pes del menor natural i el fa sonar obert, amb un punt de funk o de música celta. És el menor de Santana, del jazz modal i de bona part del rock. L\'acord que el delata és el IV major sobre una tònica menor.',
  phrygian: 'El menor més fosc dels que se senten sovint. La 2a bemoll queda a un semitò de la tònica i hi cau a sobre: és el so del flamenc i de molt metal. L\'acord que el delata és el bII major, un semitò per sobre de la tònica.',
  lydian: 'Un major més brillant que el major. La 4a augmentada treu l\'única nota de l\'escala major que xoca amb l\'acord de tònica, i el resultat flota: és el so de moltes bandes sonores i de guitarristes com Satriani o Vai. L\'acord que el delata és el II major sobre una tònica major.',
  mixolydian: 'Un major amb un punt de blues. La 7a bemoll treu la sensible, i sense sensible la tònica no tanca: per això sona a rock clàssic, a música celta i a funk. L\'acord que el delata és el bVII major. L\'acord de tònica amb 7a és un dominant (I7) que no resol enlloc.',
  aeolian: 'És el menor natural. Fosc i melancòlic, sense la tensió de la menor harmònica: el v és menor i no hi ha sensible. El que el separa del dòric és la 6a bemoll, que apareix als acords bVI i iv.',
  locrian: 'El mode més inestable. La 5a bemoll fa que l\'acord de tònica sigui disminuït i no pugui descansar, i per això gairebé mai és el centre d\'una cançó sencera. Es fa servir en riffs i com a escala sobre acords m7♭5.',
};

const EXOTIC_TEXT: Record<string, string> = {
  'melodic-minor': 'Menor amb la 6a i la 7a majors, o dit d\'una altra manera, una escala major amb la 3a menor. En música moderna es toca igual pujant i baixant. Sona sobre l\'acord menor amb 7a major, m(maj7), i sobre m6.',
  'dorian-b2': 'Dòric amb la 2a bemoll, o frigi amb la 6a major. Es fa servir sobre acords suspesos amb 9a bemoll (7sus♭9) i sobre m7 quan es vol un color més fosc que el dòric.',
  'lydian-augmented': 'Lidi amb la 5a augmentada. És l\'escala de l\'acord maj7♯5.',
  'lydian-dominant': 'Mixolidi amb la 4a augmentada. És l\'escala dels dominants que no resolen una 5a avall: el bVII7, el II7 i el substitut de tritò (bII7). La 4a augmentada evita el xoc de la 4a justa amb la 3a major de l\'acord.',
  'mixolydian-b6': 'Mixolidi amb la 6a bemoll: major a la meitat de baix, menor a la de dalt. Es fa servir sobre el V7 que resol a un acord menor quan es vol conservar la 9a major.',
  'locrian-nat2': 'Locri amb la 2a major. És l\'escala més usada sobre l\'acord m7♭5, perquè la 9a major sona millor que la 9a menor del locri.',
  altered: 'Reuneix totes les tensions alterades d\'un dominant: 9a menor, 9a augmentada, 5a disminuïda i 5a augmentada. La 3a major de l\'acord hi és, escrita com a 4a bemoll. Es fa servir sobre un V7 alterat que resol al seu acord de tònica, sobretot si és menor. Té les notes de la menor melòdica situada un semitò per sobre de la tònica del dominant.',
  'harmonic-minor': 'Menor natural amb la 7a major. La sensible dona un V7 de veritat en to menor, i el salt de to i mig entre la 6a bemoll i la 7a major li dona el seu aire oriental.',
  'locrian-nat6': 'Locri amb la 6a major. Es fa servir sobre el iiø7 d\'una cadència menor quan la melodia porta la 6a major.',
  'ionian-augmented': 'Major amb la 5a augmentada. És l\'escala de l\'acord maj7♯5 quan ve del 3r grau d\'un to menor.',
  'dorian-sharp4': 'Dòric amb la 4a augmentada. Sona sobre un acord m7 amb un gir balcànic; és l\'escala del iv en la menor harmònica.',
  'phrygian-dominant': 'Frigi amb la 3a major. És el so del flamenc i de molta música de l\'Orient Mitjà, i l\'escala natural del V7 que resol a un acord menor.',
  'lydian-sharp2': 'Lidi amb la 2a augmentada. És l\'escala de l\'acord maj7 construït sobre el bVI d\'un to menor; la 2a augmentada sona com una 3a menor contra la 3a major.',
  ultralocrian: 'Locri amb la 4a bemoll i la 7a disminuïda. És l\'escala de l\'acord disminuït amb 7a (°7) construït sobre la sensible d\'un to menor.',
};

/** Side-by-side comparison of a scale with the plain major or natural minor on the same tonic. */
function comparison(tonic: Note, s: ScaleDef): Block {
  const ref = getScale(isMinorScale(s) ? 'aeolian' : 'ionian');
  const refName = isMinorScale(s) ? 'menor natural' : 'major';
  const a = scaleNotes(tonic, s);
  const b = scaleNotes(tonic, ref);
  return {
    t: 'table', head: ['Grau', ...s.formula.map((_, i) => String(i + 1))],
    rows: [
      [`${noteCa(tonic)} ${refName}`, ...b.map(noteCa)],
      [`${noteCa(tonic)} ${s.nameCa}`, ...a.map((n, i) => (s.formula[i] === ref.formula[i] ? noteCa(n) : `${noteCa(n)}\u00a0◂`))],
      ['Fórmula', ...s.formula],
    ],
  };
}

function scaleTopic(s: ScaleDef): Topic {
  const major = s.family === 'major';
  return {
    id: `escala-${s.id}`,
    group: major ? GROUPS[1] : GROUPS[2],
    title: `${The(s).replace(/^El /, 'Mode ').replace(/^L'escala /, 'Escala ')}`,
    summary: s.colourCa.replace(/ \(.*\)/, ''),
    usesKey: true,
    defaultKey: major ? ['C', 'D', 'E', 'F', 'G', 'A', 'B'][s.modeIndex] : 'A',
    build(tonic) {
      const notes = scaleNotes(tonic, s);
      const char = characteristicNote(tonic, s);
      const pt = parentTonic(tonic, s);
      const refName = isMinorScale(s) ? 'menor natural' : 'major';
      const out: Block[] = [
        p(major ? MODE_TEXT[s.id] : EXOTIC_TEXT[s.id]),
        scaleBlock(tonic, s, true),
        neckBlock(tonic, s),
        h('Com es construeix'),
        p(s.modeIndex === 0
          ? `${The(s)} és una escala mare: d'ella en surten set modes, un per cada grau.`
          : `${The(s)} és el ${ORDINALS[s.modeIndex]} mode de l'escala ${parentName(s)}. ${noteCa(tonic)} ${s.nameCa} té les mateixes notes que ${noteCa(pt)} ${parentName(s)}, però el centre és ${noteCa(tonic)}.`),
        p(`Hi ha dues maneres de pensar-lo, i convé tenir-les totes dues. La primera és relativa: "les notes de ${noteCa(pt)} ${parentName(s)} començant per ${noteCa(tonic)}". Va bé per trobar les notes. La segona és paral·lela: "${noteCa(tonic)} ${refName} amb algun grau canviat". Va millor per sentir el color, perquè compares dues escales amb la mateixa tònica.`),
        comparison(tonic, s),
        p('La fletxa marca els graus que canvien respecte de l\'escala de referència.'),
        h('La nota característica'),
        p(`${The(s)} és un ${s.colourCa}. La nota que el defineix és la ${degreeCa(s.characteristic)}: a ${noteCa(tonic)} és ${noteCaWords(char)}. Si la treus, deixes de sentir aquest so; si la fas durar o la poses en un temps fort, el mode queda clar de seguida.`),
      ];
      if (major) {
        const triads = diatonicChords(tonic, s);
        const sevenths = diatonicChords(tonic, s, true);
        const carriers = triads.filter((c) => c.degree !== 0 && spellChord(c).some((n) => pc(n) === pc(char)));
        out.push(
          h('Els acords del mode'),
          p('Apilant terceres sobre cada grau surten aquests acords. Les xifres romanes es llegeixen respecte de l\'escala major: una b al davant vol dir que el grau és un semitò més baix.'),
          { t: 'table', head: ['Grau', 'Tríada', 'Notes', 'Amb 7a'], rows: triads.map((c, i) => [c.roman, chordSymbol(c), list(spellChord(c)), `${sevenths[i].roman} = ${chordSymbol(sevenths[i])}`]), mark: carriers.map((c) => c.degree) },
          p(`Els acords que porten la nota característica (${noteCa(char)}) són els que fan sonar el mode: ${carriers.map((c) => `${c.roman} = ${chordSymbol(c)}`).join(', ')}. Combina'n un amb l'acord de tònica i ja tens el color.`),
          chordsBlock([triads[0], ...carriers.filter((c) => c.def.id !== 'dim').slice(0, 2)]),
          h('Com fer-lo sonar'),
          p('Un mode només se sent si el centre queda clar. Fes durar l\'acord de tònica, torna-hi sovint o mantén la tònica al baix mentre canvien els acords. Si la música descansa en l\'acord de l\'escala mare, l\'orella es reorienta i el mode desapareix.'),
        );
        const progs = PROGRESSIONS.filter((x) => x.scaleId === s.id);
        if (progs.length) {
          out.push(h('Progressions típiques'));
          for (const pr of progs) {
            out.push(progBlock(progressionChords(pr)), p(pr.whyCa));
            if (pr.songs.length) out.push(p(`Se sent a: ${songs(pr.songs)}.`));
          }
        }
        out.push({ t: 'link', topic: 'harmonia-modal', text: 'Harmonia modal: com es munta una progressió en un mode' });
      } else {
        const first = [0, 2, 4, 6].map((i) => notes[i]);
        const parent = SCALES.find((x) => x.family === s.family && x.modeIndex === 0)!;
        out.push(
          h('L\'acord que li correspon'),
          p(`Apilant terceres des de la tònica surten ${list(first)}. Aquest és l'acord sobre el qual l'escala sona "a casa".`),
          h('La família'),
          { t: 'table', head: ['Mode', 'Nom', 'Fórmula'], rows: SCALES.filter((x) => x.family === s.family).map((x) => [ORDINALS[x.modeIndex], x.id === s.id ? `${x.nameCa}\u00a0◂` : x.nameCa, x.formula.join(' ')]) },
          p(`Tots set comparteixen les notes de ${noteCa(pt)} ${parent.nameCa}.`),
          { t: 'link', topic: 'menors', text: 'Menor harmònica i menor melòdica: d\'on surten' },
        );
      }
      out.push(
        { t: 'practice', generatorId: major ? 'mode-from-notes' : 'exotic-scale-from-notes', concept: `mode:${s.id}`, text: `Practica ${s.nameCa}` },
        { t: 'ref', concepts: major ? ['modal-harmony-theory', 'modes-major-scale', 'modes-linear-approach'] : [s.family === 'melodic-minor' ? 'modes-melodic-minor' : 'modes-harmonic-minor', 'chord-scales-major-melodic'] },
      );
      return out;
    },
  };
}

// ---------- Chords ----------

const CHORD_TEXT: Record<string, string> = {
  dim: 'Dues terceres menors apilades. És l\'acord del 7è grau de l\'escala major. Sol, no descansa: vol resoldre un semitò amunt.',
  aug: 'Dues terceres majors apilades. No té 5a justa i per això no descansa: sol fer de pas entre dos acords o de dominant amb la 5a pujada.',
  sus2: 'La 2a ocupa el lloc de la 3a. Sense 3a no és major ni menor: sona obert i net.',
  sus4: 'La 4a ocupa el lloc de la 3a i demana baixar-hi (sus4 → major). Ajornar aquesta resolució és el seu ús més típic.',
  '7sus4': 'Dominant sense 3a: la 4a la substitueix. Fa la funció de V7 però més suau, perquè hi falta el tritò. Molt usat en pop, funk i jazz modal.',
  m7b5: 'Tríada disminuïda amb 7a menor. És l\'acord del 7è grau en major i del 2n en menor, on prepara el V7.',
  dim7: 'Tres terceres menors apilades: totes les notes queden a to i mig l\'una de l\'altra. És simètric, de manera que qualsevol de les quatre notes pot fer de fonamental, i sempre vol resoldre un semitò amunt. Surt del 7è grau de la menor harmònica.',
  mMaj7: 'Tríada menor amb 7a major. És l\'acord de tònica de la menor harmònica i de la melòdica, i apareix com a pas en la línia que baixa per semitons: m, m(maj7), m7, m6.',
  '6': 'Tríada major amb 6a major. Acord de tònica estable, alternativa al maj7. Té les mateixes notes que el m7 del seu relatiu menor.',
  m6: 'Tríada menor amb 6a major: el color dòric en un sol acord. Acord de tònica en menor, típic del swing i la bossa nova.',
  add9: 'Tríada major amb la 9a afegida i sense 7a. Brillant, molt de pop. No és un acord de 9a, perquè no té 7a.',
  maj9: 'Acord maj7 amb la 9a. Fa de tònica o de IV: suau i ampli.',
  '9': 'Dominant amb la 9a major. És el V7 complet, i la base del funk i del blues.',
  m9: 'Acord m7 amb la 9a major. Fa de ii o de tònica menor amb color dòric.',
  '11': 'Dominant amb la 9a i l\'11a. Com que l\'11a xoca amb la 3a major, a la pràctica es toca sense 3a i sona com un 7sus4 amb 9a.',
  '13': 'Dominant amb la 13a, que és la 6a una octava amunt. A la guitarra es toca sense 5a i sense 11a: tònica, 3a, 7a menor, 9a i 13a.',
  '7b9': 'Dominant amb la 9a un semitò avall. Tensió forta que resol sobretot a acords menors. Ve de la menor harmònica.',
  '7#9': 'Dominant amb la 9a augmentada, que sona com una 3a menor contra la 3a major de l\'acord. És el so del blues-rock dur.',
  '7b5': 'Dominant amb la 5a un semitò avall. Conté dos tritons i comparteix les notes principals amb el dominant situat a un tritò de distància.',
  '7#5': 'Dominant amb la 5a augmentada. Empeny amb força cap a la tònica, tant si és major com menor.',
  'maj7#5': 'Acord maj7 amb la 5a augmentada. Surt del 3r grau de les menors harmònica i melòdica.',
};

const chordSection = (root: Note, def: ChordDef): Block[] => {
  const ch = { root, def };
  return [
    h(`${chordSymbol(ch)} · ${def.nameCa}`, def.id),
    p(CHORD_TEXT[def.id] ?? ''),
    { t: 'table', head: ['Grau', ...def.formula], rows: [['Interval', ...def.formula.map((d) => DEGREE_NAME[d])], ['Nota', ...spellChord(ch).map(noteCa)]] },
    chordsBlock([ch]),
  ];
};

function chordFamily(id: string, title: string, summary: string, intro: string[], ids: string[], refs: string[], key = 'C'): Topic {
  return {
    id, group: GROUPS[3], title, summary, usesKey: true, defaultKey: key,
    build: (root) => [
      ...intro.map(p),
      ...ids.flatMap((c) => chordSection(root, getChord(c))),
      { t: 'practice', generatorId: 'chord-from-notes', concept: `chord:${ids[0]}`, text: 'Practica aquests acords' },
      { t: 'link', topic: 'acords-formules', text: 'Totes les fórmules d\'acords en una taula' },
      { t: 'ref', concepts: refs },
    ],
  };
}

// ---------- Topics ----------

const ionian = getScale('ionian');
const aeolian = getScale('aeolian');

const TOPIC_LIST: Topic[] = [
  {
    id: 'graus', group: GROUPS[0], title: 'Graus i intervals', summary: 'Què vol dir b3, #4 o b7, i per què tot es mesura contra l\'escala major',
    usesKey: true, defaultKey: 'C',
    build(tonic) {
      const major = scaleNotes(tonic, ionian);
      const degrees = ['1', 'b2', '2', 'b3', '3', '4', '#4', 'b5', '5', '#5', 'b6', '6', 'bb7', 'b7', '7'];
      const names: Record<string, string> = { ...DEGREE_NAME, b2: '2a menor', '#4': '4a augmentada', b6: '6a menor' };
      return [
        p('Tota la teoria d\'aquesta app fa servir la mateixa regla: les notes d\'una escala o d\'un acord s\'anomenen pel seu grau, i el grau es compara sempre amb l\'escala major de la mateixa tònica.'),
        scaleBlock(tonic, ionian),
        p(`A ${noteCa(tonic)} major, els graus 1 a 7 són ${major.map((n, i) => `${noteCa(n)} (${i + 1})`).join(', ')}. Un número sol vol dir "la nota que hi ha en aquest grau de l'escala major".`),
        h('Què fan la b i el #'),
        p('Una b davant del número baixa aquell grau un semitò; un # el puja un semitò. No parlen de la nota (que pot acabar sent natural, bemoll o sostinguda segons la tonalitat), sinó de la distància respecte de l\'escala major.'),
        p(`Per això "b3" vol dir sempre "3a menor", a qualsevol to. A ${noteCa(tonic)}, la 3 és ${noteCa(major[2])} i la b3 és ${noteCa(transpose(tonic, parseDegree('b3')))}.`),
        h('Taula de graus'),
        { t: 'table', head: ['Grau', 'Nom', 'Semitons', `Des de ${noteCa(tonic)}`], rows: degrees.map((d) => [d, names[d], String(parseDegree(d).semis), noteCa(transpose(tonic, parseDegree(d)))]) },
        p('Fixa\'t que #4 i b5 són el mateix so (6 semitons, el tritò), i també #5 i b6, o 6 i bb7. S\'escriuen diferent perquè ocupen un lloc diferent a l\'escala: cada escala de set notes fa servir cada lletra una sola vegada.'),
        h('Per damunt de l\'octava'),
        p('Als acords, les notes afegides per sobre de la 7a es compten seguint cap amunt: la 9a és la 2a una octava més alta, l\'11a és la 4a i la 13a és la 6a. Resta-hi 7 i tens el grau de sempre.'),
        { t: 'link', topic: 'acords-formules', text: 'Com s\'apliquen els graus als acords' },
        { t: 'link', topic: 'modes', text: 'Com s\'apliquen els graus als modes' },
        { t: 'ref', concepts: ['chord-formulas'] },
      ];
    },
  },
  {
    id: 'modes', group: GROUPS[1], title: 'Què és un mode', summary: 'Set escales amb les mateixes notes i set colors diferents',
    usesKey: true, defaultKey: 'C',
    build(tonic) {
      const major = scaleNotes(tonic, ionian);
      const bright = ['lydian', 'ionian', 'mixolydian', 'dorian', 'aeolian', 'phrygian', 'locrian'].map(getScale);
      return [
        p('Un mode és una escala que surt de començar una altra escala, l\'escala mare, des d\'un grau que no és el primer. Les notes són les mateixes; el que canvia és quina fa de centre. I quan canvia el centre, canvia la distància de cada nota respecte d\'ell, i amb ella el color.'),
        p(`Agafa ${noteCa(tonic)} major: ${list(major)}. Si la toques de ${noteCa(major[1])} a ${noteCa(major[1])} i fas que ${noteCa(major[1])} soni com a casa, ja no sents ${noteCa(tonic)} major: sents ${noteCa(major[1])} dòric.`),
        h('Els set modes de l\'escala major'),
        { t: 'table', head: ['Grau', 'Mode', `A partir de ${noteCa(tonic)} major`, 'Fórmula', 'Nota característica'], rows: MAJOR_MODES.map((m) => [ORDINALS[m.modeIndex], m.nameCa, `${noteCa(major[m.modeIndex])} ${m.nameCa}`, m.formula.join(' '), m.characteristic]) },
        h('Dues maneres de pensar-los'),
        p('Relativa: "dòric és l\'escala major començada pel 2n grau". Serveix per trobar les notes de pressa, perquè ja saps l\'escala major.'),
        p('Paral·lela: "dòric és un menor amb la 6a major". Serveix per sentir i recordar el color, perquè compares escales que comparteixen la tònica. És la que fan servir les fórmules (1 2 b3 4 5 6 b7).'),
        p('L\'error més habitual és quedar-se només amb la primera. Tocar les notes de Do major sobre un acord de Rem ja és Re dòric, però si no saps quina nota fa la diferència, sonarà a Do major mal resolt.'),
        h('Majors i menors'),
        p('La 3a divideix els modes en dos grups. Tenen 3a major el lidi, el jònic i el mixolidi. Tenen 3a menor el dòric, l\'eòlic, el frigi i el locri. Dins de cada grup, cada mode es distingeix per una sola nota respecte del seu veí.'),
        h('De més brillant a més fosc'),
        p('Ordenats així, cada mode baixa un semitò una sola nota del mode anterior. És una bona manera de memoritzar-los: saps que el següent és "l\'anterior amb una nota més baixa".'),
        { t: 'table', head: ['Mode', 'Fórmula', 'Què baixa respecte de l\'anterior'], rows: bright.map((m, i) => [m.nameCa, m.formula.join(' '), i === 0 ? '—' : m.formula.filter((d, k) => d !== bright[i - 1].formula[k]).join(', ')]) },
        h('Cada mode, a fons'),
        ...MAJOR_MODES.map((m): Block => ({ t: 'link', topic: `escala-${m.id}`, text: `${m.nameCa}: ${m.colourCa.replace(/ \(.*\)/, '')}` })),
        { t: 'link', topic: 'harmonia-modal', text: 'Harmonia modal: acords i progressions de cada mode' },
        { t: 'practice', generatorId: 'mode-from-formula', text: 'Practica els modes' },
        { t: 'ref', concepts: ['major-scale-modes-harmonized', 'chord-scales-major-melodic', 'modal-harmony-theory', 'mirror-modal-equivalents'] },
      ];
    },
  },
  ...MAJOR_MODES.map(scaleTopic),
  {
    id: 'harmonia-modal', group: GROUPS[1], title: 'Harmonia modal', summary: 'Com es munta una progressió que soni a un mode i no a l\'escala mare',
    usesKey: true, defaultKey: 'D',
    build(tonic) {
      const rows = MAJOR_MODES.filter((m) => m.id !== 'ionian').map((m) => {
        const char = characteristicNote(tonic, m);
        const all = diatonicChords(tonic, m);
        const carriers = all.filter((c) => c.degree !== 0 && c.def.id !== 'dim' && spellChord(c).some((n) => pc(n) === pc(char)));
        return [`${noteCa(tonic)} ${m.nameCa}`, `${all[0].roman} = ${chordSymbol(all[0])}`, noteCa(char), carriers.map((c) => `${c.roman} = ${chordSymbol(c)}`).join(', ')];
      });
      const out: Block[] = [
        p('En harmonia tonal, els acords empenyen cap a la tònica: el V7 resol al I. En harmonia modal no hi ha aquesta empenta. Els acords hi són per mostrar el color del mode, i la progressió gira al voltant de la tònica sense necessitat de tancar-se.'),
        h('Tres regles pràctiques'),
        { t: 'list', items: [
          'La tònica ha de pesar. Dona-li més temps que als altres acords, posa-la al començament de la frase o mantén-la al baix.',
          'Fes servir un acord amb la nota característica. És el que diu a l\'orella quin mode és. Amb la tònica i aquest acord ja n\'hi ha prou.',
          'Evita la cadència de l\'escala mare. Si a Re dòric fas Sol7 i després Do, l\'orella sent Do major i el mode s\'esvaeix.',
        ] },
        h('Acords característics de cada mode'),
        { t: 'table', head: ['Mode', 'Tònica', 'Nota característica', 'Acords que la porten'], rows },
        p('L\'acord de tònica del locri és disminuït, i per això costa tant fer-lo sonar com a centre.'),
        h('Progressions'),
      ];
      for (const m of MAJOR_MODES.filter((x) => x.id !== 'ionian')) {
        out.push(h(m.nameCa, m.id));
        for (const pr of PROGRESSIONS.filter((x) => x.scaleId === m.id)) {
          out.push(progBlock(progressionChords(pr)), p(pr.whyCa));
          if (pr.songs.length) out.push(p(`Se sent a: ${songs(pr.songs)}.`));
        }
      }
      out.push(
        { t: 'practice', generatorId: 'mode-from-progression', text: 'Practica: quin mode suggereix una progressió' },
        { t: 'ref', concepts: ['modal-harmony-theory', 'modal-resolution-tendencies', 'modal-modulation'] },
      );
      return out;
    },
  },
  {
    id: 'menors', group: GROUPS[2], title: 'Menor harmònica i menor melòdica', summary: 'Dues variants del menor, per què existeixen i quins modes en surten',
    usesKey: true, defaultKey: 'A',
    build(tonic) {
      const hm = getScale('harmonic-minor');
      const mm = getScale('melodic-minor');
      const sev = (s: ScaleDef): string[][] => {
        const notes = scaleNotes(tonic, s);
        return notes.map((root, i) => [ORDINALS[i], noteCa(root), [0, 2, 4, 6].map((k) => noteCa(notes[(i + k) % 7])).join(' ')]);
      };
      const family = (f: string): string[][] => SCALES.filter((x) => x.family === f).map((x) => [ORDINALS[x.modeIndex], x.nameCa, x.formula.join(' '), x.colourCa]);
      return [
        p('El menor natural (el mode eòlic) té un problema si vols harmonia tonal: el seu 5è grau dona un acord menor, sense sensible, i no empeny cap a la tònica. Les dues variants del menor neixen per arreglar-ho.'),
        scaleBlock(tonic, aeolian),
        h('Menor harmònica', 'harmonic-minor'),
        p('Puja la 7a un semitò. Ara hi ha sensible, i el 5è grau dona un acord major amb 7a de dominant: un V7 de veritat que resol al i menor. El preu és el salt de to i mig entre la 6a bemoll i la 7a major, que és justament el que li dona el seu so característic.'),
        scaleBlock(tonic, hm),
        { t: 'table', head: ['Grau', 'Fonamental', 'Acord de 7a (notes)'], rows: sev(hm) },
        h('Menor melòdica', 'melodic-minor'),
        p('Puja també la 6a per eliminar aquell salt. Queda un menor amb 6a i 7a majors: una escala major amb la 3a menor. En música clàssica es tocava així pujant i com a menor natural baixant; en música moderna es fa servir igual en tots dos sentits.'),
        scaleBlock(tonic, mm),
        { t: 'table', head: ['Grau', 'Fonamental', 'Acord de 7a (notes)'], rows: sev(mm) },
        h('Per què interessen els seus modes'),
        p('Igual que l\'escala major, cadascuna d\'aquestes escales té set modes. No s\'usen per fer cançons senceres, sinó com a escala sobre un acord concret: cada acord alterat o poc habitual té un d\'aquests modes que hi encaixa nota per nota.'),
        h('Modes de la menor melòdica'),
        { t: 'table', head: ['Mode', 'Nom', 'Fórmula', 'Què és'], rows: family('melodic-minor') },
        ...SCALES.filter((x) => x.family === 'melodic-minor').map((x): Block => ({ t: 'link', topic: `escala-${x.id}`, text: x.nameCa })),
        h('Modes de la menor harmònica'),
        { t: 'table', head: ['Mode', 'Nom', 'Fórmula', 'Què és'], rows: family('harmonic-minor') },
        ...SCALES.filter((x) => x.family === 'harmonic-minor').map((x): Block => ({ t: 'link', topic: `escala-${x.id}`, text: x.nameCa })),
        { t: 'practice', generatorId: 'exotic-scale-from-notes', text: 'Practica aquestes escales' },
        { t: 'ref', concepts: ['melodic-minor-harmonized', 'harmonic-minor-harmonized', 'modes-melodic-minor', 'modes-harmonic-minor'] },
      ];
    },
  },
  ...SCALES.filter((s) => s.family !== 'major').map(scaleTopic),
  {
    id: 'acords-formules', group: GROUPS[3], title: 'Com es llegeix un acord', summary: 'La fórmula de cada tipus d\'acord i què vol dir cada part del nom',
    usesKey: true, defaultKey: 'C',
    build: (root) => [
      p('Un acord és una tria de graus sobre una fonamental. La fórmula 1 3 5 vol dir "tònica, 3a major i 5a justa"; 1 b3 5 b7 vol dir "tònica, 3a menor, 5a justa i 7a menor". Saber la fórmula és saber l\'acord en qualsevol to.'),
      h('Les quatre preguntes'),
      { t: 'list', items: [
        'La 3a: major (3), menor (b3) o absent. Si en lloc de 3a hi ha 2a o 4a, l\'acord és suspès.',
        'La 5a: justa (5), disminuïda (b5) o augmentada (#5).',
        'La 7a: major (7), menor (b7), disminuïda (bb7) o cap. Si hi ha 6a en lloc de 7a, és un acord de sisena.',
        'Tensions: 9a, 11a o 13a per sobre de la 7a, naturals o alterades.',
      ] },
      h('Què diu el nom'),
      p('"m" vol dir 3a menor. "maj7" vol dir 7a major; un 7 sol vol dir 7a menor, i per tant acord de dominant si la 3a és major. "sus" vol dir que la 3a s\'ha substituït. "add" vol dir que s\'afegeix una nota sense passar per la 7a. Un número alt (9, 11, 13) dona per feta la 7a menor.'),
      h('Totes les fórmules'),
      { t: 'table', head: ['Acord', 'Nom', 'Fórmula', `Notes sobre ${noteCa(root)}`], rows: CHORDS.map((d) => [chordSymbol({ root, def: d }), d.nameCa, d.formula.join(' '), list(spellChord({ root, def: d }))]) },
      h('Per famílies'),
      { t: 'link', topic: 'acords-suspesos', text: 'Suspesos: sus2, sus4, 7sus4' },
      { t: 'link', topic: 'acords-disminuits', text: 'Disminuïts i augmentats' },
      { t: 'link', topic: 'acords-sisena', text: 'Sisenes, add9 i menor amb 7a major' },
      { t: 'link', topic: 'acords-tensions', text: 'Tensions: 9a, 11a i 13a' },
      { t: 'link', topic: 'acords-alterats', text: 'Dominants alterats' },
      { t: 'link', topic: 'triades-obertes', text: 'Tríades obertes' },
      { t: 'practice', generatorId: 'spell-chord', text: 'Practica: completa l\'acord' },
      { t: 'ref', concepts: ['chord-formulas', 'seventh-chords-more', 'chord-families-scales'] },
    ],
  },
  chordFamily('acords-suspesos', 'Acords suspesos', 'sus2, sus4 i 7sus4: acords sense 3a',
    ['En un acord suspès, la 3a se substitueix per la 2a o per la 4a. Com que la 3a és la nota que fa un acord major o menor, el suspès no és ni una cosa ni l\'altra: queda obert, a l\'espera.',
      'Hi ha dues maneres d\'usar-los. Com a retard: toques el sus4 i el resols a l\'acord major, movent un sol dit. O com a color estable: deixes l\'acord suspès sense resoldre, molt habitual en rock i en música modal.'],
    ['sus2', 'sus4', '7sus4'], ['suspended-triads', 'suspended-triad-forms', 'drop2-dom7sus4'], 'D'),
  chordFamily('acords-disminuits', 'Disminuïts i augmentats', 'm7♭5, °7, tríada augmentada i maj7♯5',
    ['Aquests acords tenen la 5a alterada. Sense 5a justa, un acord perd l\'estabilitat i demana moviment: per això gairebé sempre fan de pas o de tensió abans d\'un acord estable.',
      'El semidisminuït (m7♭5) i el disminuït (°7) es confonen sovint. Tots dos tenen 3a menor i 5a disminuïda; la diferència és la 7a. Al semidisminuït és menor (b7); al disminuït baixa un semitò més (bb7, el mateix so que una 6a major).'],
    ['dim', 'm7b5', 'dim7', 'aug', 'maj7#5'], ['drop2-min7b5', 'drop2-dim7', 'diminished-scale-voicings'], 'B'),
  chordFamily('acords-sisena', 'Sisenes, add9 i menor amb 7a major', '6, m6, add9 i m(maj7)',
    ['Quatre acords que afegeixen color a una tríada sense convertir-la en dominant. Tots fan bé de tònica.'],
    ['6', 'm6', 'add9', 'mMaj7'], ['chord-formulas', 'chord-families-scales'], 'C'),
  chordFamily('acords-tensions', 'Tensions: 9a, 11a i 13a', 'Com s\'amplia un acord de 7a sense canviar-ne la funció',
    ['Una tensió és una nota afegida per sobre de la 7a. No canvia la funció de l\'acord: un G9 continua sent un dominant, igual que un G7, però amb més color.',
      'A la guitarra no hi ha prou cordes ni dits per tocar-ho tot. La norma és conservar la 3a i la 7a, que defineixen l\'acord, i treure la 5a i sovint la fonamental si la porta el baix. Per això els diagrames tenen menys notes que la fórmula.',
      'La regla del número: un 13 inclou la 7a menor i pot incloure la 9a; un 9 inclou la 7a menor. Si no vols 7a, escrius add9.'],
    ['maj9', '9', 'm9', '11', '13'], ['chord-families-scales', 'stretch-voicings', 'quartal-voicings'], 'C'),
  chordFamily('acords-alterats', 'Dominants alterats', '7♭9, 7♯9, 7♭5 i 7♯5',
    ['Un dominant alterat és un acord de 7a de dominant amb la 5a o la 9a mogudes un semitò. La 3a major i la 7a menor no es toquen: formen el tritò que fa de l\'acord un dominant.',
      'Les alteracions afegeixen tensió, i la tensió vol resoldre. Per això els alterats sonen millor quan el dominant resol de veritat a la seva tònica, sobretot si és menor. Sobre un dominant que no resol, com el I7 d\'un blues, sonen forçats, tret del 7♯9.',
      'Cada alteració queda a un semitò d\'una nota de l\'acord de destí. Aquest moviment de semitò és el que fa que la resolució soni inevitable.'],
    ['7b9', '7#9', '7b5', '7#5'], ['chordal-scales-altered-dominant', 'chord-families-scales', 'drop2-dom7b5', 'drop2-aug7'], 'E'),
  {
    id: 'triades-obertes', group: GROUPS[3], title: 'Tríades obertes', summary: 'La mateixa tríada, repartida en més d\'una octava',
    usesKey: true, defaultKey: 'C',
    build(root) {
      const major = { root, def: getChord('maj') };
      const minor = { root, def: getChord('m') };
      const tones = spellChord(major);
      const names = ['Estat fonamental', '1a inversió', '2a inversió'];
      const shape = (ch: Chord, inv: number): Block | null => {
        const pos = spreadTriad(ch, inv, 1) ?? spreadTriad(ch, inv, 0) ?? spreadTriad(ch, inv, 2);
        if (!pos) return null;
        const t = spellChord(ch);
        const order = [t[inv], t[(inv + 2) % 3], t[(inv + 1) % 3]];
        return { t: 'fret', firstFret: Math.max(1, Math.min(...pos.map((q) => q.fret))), dots: pos, caption: `${chordSymbol(ch)}, ${names[inv].toLowerCase()}: ${list(order)} de greu a agut` };
      };
      return [
        p('Una tríada tancada té les tres notes tan juntes com es pot: tònica, 3a i 5a dins d\'una octava. Una tríada oberta agafa la nota del mig i la puja una octava. Les notes són les mateixes, però queden separades per cinquenes i sisenes en lloc de terceres.'),
        p(`Amb ${chordSymbol(major)}: tancada és ${list(tones)}. Oberta és ${noteCa(tones[0])}, ${noteCa(tones[2])} i ${noteCa(tones[1])} una octava amunt.`),
        h('Per què sonen diferent'),
        p('Les terceres juntes sonen denses, sobretot al registre greu. Separades, cada nota se sent per separat i l\'acord sona ample, gairebé com un piano o un quartet de corda. Per això funcionen tan bé arpegiades i en acompanyaments nets.'),
        h('Les tres inversions'),
        p('La regla és la mateixa per a totes: parteix de la tríada tancada en aquella inversió i puja la veu del mig una octava. La nota més greu diu quina inversió és.'),
        { t: 'table', head: ['Inversió', 'Tancada', 'Oberta (de greu a agut)', 'Al baix'], rows: [0, 1, 2].map((i) => [names[i], list([tones[i], tones[(i + 1) % 3], tones[(i + 2) % 3]]), list([tones[i], tones[(i + 2) % 3], tones[(i + 1) % 3]]), ['tònica', '3a', '5a'][i]]) },
        h('Al diapasó'),
        ...[0, 1, 2].map((i) => shape(major, i)).filter((b): b is Block => !!b),
        h('En menor'),
        p('Només canvia la 3a, que baixa un semitò. Compara la forma amb la major: es mou una sola nota.'),
        ...[0, 1, 2].map((i) => shape(minor, i)).filter((b): b is Block => !!b),
        h('Com estudiar-les'),
        { t: 'list', items: [
          'Aprèn una inversió i mou-la per l\'escala: toca les tríades obertes de tots els graus d\'una tonalitat.',
          'Toca-les arpegiades, pua a la nota greu i dits a les altres dues, o saltant corda amb la pua.',
          'Digues en veu alta quina nota fa de tònica, de 3a i de 5a a cada forma. És el que et permetrà reconèixer-les.',
        ] },
        { t: 'practice', generatorId: 'spread-triad', text: 'Practica les tríades obertes' },
        { t: 'ref', concepts: ['advanced-triads', 'spread-triads-over-bass', 'spread-triad-arpeggios'] },
      ];
    },
  },
  {
    id: 'xifres-romanes', group: GROUPS[4], title: 'Acords diatònics i xifres romanes', summary: 'Com surten els acords d\'una escala i com s\'anomenen',
    usesKey: true, defaultKey: 'C',
    build(tonic) {
      const table = (s: ScaleDef): Block => {
        const tri = diatonicChords(tonic, s);
        const sev = diatonicChords(tonic, s, true);
        return { t: 'table', head: ['Grau', 'Tríada', 'Notes', 'Amb 7a'], rows: tri.map((c, i) => [c.roman, chordSymbol(c), list(spellChord(c)), `${sev[i].roman} = ${chordSymbol(sev[i])}`]) };
      };
      const maj = diatonicChords(tonic, ionian);
      return [
        p('Els acords d\'una tonalitat surten de la seva escala. Tria una nota, salta\'n una i agafa la següent, salta\'n una altra i agafa la següent: tens una tríada. Fes-ho sobre cada grau i tens els set acords diatònics.'),
        h('Què diu una xifra romana'),
        { t: 'list', items: [
          'El número és el grau de l\'escala on comença l\'acord, comptat sobre l\'escala major de la tònica.',
          'Majúscula vol dir acord major; minúscula, menor.',
          'Un cercle (°) vol dir disminuït; ø7, semidisminuït; un +, augmentat.',
          'Una b o un # al davant vol dir que la fonamental és un semitò per sota o per sobre d\'aquell grau de l\'escala major.',
        ] },
        p('L\'avantatge és que una progressió escrita amb xifres val per a qualsevol to. I – V – vi – IV és la mateixa progressió a Do que a Mi bemoll.'),
        h(`Acords de ${noteCa(tonic)} major`),
        table(ionian),
        chordsBlock(maj.filter((c) => c.def.id !== 'dim')),
        h(`Acords de ${noteCa(tonic)} menor natural`),
        p('En menor, tres graus queden un semitò més baixos que en major, i les seves xifres porten b: bIII, bVI i bVII.'),
        table(aeolian),
        h('Funcions'),
        p(`En harmonia tonal els acords s'agrupen per funció. Tònica: repòs (${maj[0].roman}, ${maj[5].roman}, ${maj[2].roman}). Subdominant: moviment (${maj[3].roman}, ${maj[1].roman}). Dominant: tensió que vol tornar a la tònica (${maj[4].roman}, ${maj[6].roman}). Dos acords de la mateixa funció es poden substituir entre ells.`),
        h('Com analitzar una progressió'),
        { t: 'list', items: [
          'Troba el centre: l\'acord on la música descansa.',
          'Per a cada acord, compta quin grau és la seva fonamental respecte de l\'escala major del centre.',
          'Si queda un semitò per sota d\'un grau de l\'escala major, posa-hi b.',
          'Majúscula o minúscula segons si l\'acord és major o menor.',
        ] },
        { t: 'link', topic: 'dominants-secundaris', text: 'Dominants secundaris' },
        { t: 'link', topic: 'intercanvi-modal', text: 'Intercanvi modal' },
        { t: 'practice', generatorId: 'roman-analysis', text: 'Practica l\'anàlisi amb xifres romanes' },
        { t: 'ref', concepts: ['roman-numeral-analysis', 'scale-degrees-progressions', 'major-scale-modes-harmonized', 'natural-minor-harmonized'] },
      ];
    },
  },
  {
    id: 'dominants-secundaris', group: GROUPS[4], title: 'Dominants secundaris', summary: 'El V7 d\'un acord que no és la tònica',
    usesKey: true, defaultKey: 'C',
    build(tonic) {
      const chords = diatonicChords(tonic, ionian);
      const major = scaleNotes(tonic, ionian);
      const rows = [1, 2, 3, 4, 5].map((d) => {
        const target = chords[d];
        const dom: Chord = { root: transpose(target.root, parseDegree('5')), def: getChord('7') };
        const foreign = spellChord(dom).filter((n) => !major.some((x) => pc(x) === pc(n)));
        return { target, dom, row: [`V7/${target.roman}`, chordSymbol(dom), list(spellChord(dom)), `${target.roman} = ${chordSymbol(target)}`, foreign.length ? list(foreign) : '—'] };
      });
      return [
        p(`A ${noteCa(tonic)} major, el dominant és ${chordSymbol({ root: chords[4].root, def: getChord('7') })} i resol a ${chordSymbol(chords[0])}. Però qualsevol altre acord major o menor de la tonalitat pot tenir, per un moment, el seu propi dominant. Això és un dominant secundari.`),
        h('Com es construeix'),
        { t: 'list', items: [
          'Tria l\'acord de destí.',
          'Puja una 5a justa des de la seva fonamental.',
          'Fes-hi un acord de 7a de dominant: 3a major i 7a menor.',
        ] },
        p('S\'escriu V7/x, que es llegeix "cinc de x". L\'acord quasi sempre porta alguna nota de fora de la tonalitat, i aquesta nota és la sensible de l\'acord de destí: queda un semitò per sota de la seva fonamental.'),
        h(`Els dominants secundaris de ${noteCa(tonic)} major`),
        { t: 'table', head: ['Xifra', 'Acord', 'Notes', 'Resol a', 'Notes de fora'], rows: rows.map((r) => r.row) },
        p('El vii° no en té, perquè un acord disminuït no pot fer de tònica ni un moment.'),
        h('Escolta\'ls'),
        ...rows.slice(0, 3).map((r): Block => ({ t: 'prog', line: `I = ${chordSymbol(chords[0])}  →  V7/${r.target.roman} = ${chordSymbol(r.dom)}  →  ${r.target.roman} = ${chordSymbol(r.target)}`, listen: { type: 'progression', chords: [chords[0], r.dom, r.target].map(chordMidi) } })),
        chordsBlock(rows.map((r) => r.dom)),
        { t: 'practice', generatorId: 'secondary-dominant', text: 'Practica els dominants secundaris' },
        { t: 'ref', concepts: ['secondary-dominants', 'cycle-of-fifths-back-cycling'] },
      ];
    },
  },
  {
    id: 'intercanvi-modal', group: GROUPS[4], title: 'Intercanvi modal', summary: 'Acords manllevats d\'un mode paral·lel',
    usesKey: true, defaultKey: 'C',
    build(tonic) {
      const donors = ['aeolian', 'dorian', 'phrygian', 'mixolydian', 'lydian'].map(getScale);
      const rows = donors.map((m) => {
        const out = diatonicChords(tonic, m).filter((c) => c.degree !== 0 && c.def.id !== 'dim' && !chordFitsScale(c, tonic, ionian));
        return [`${noteCa(tonic)} ${m.nameCa}`, out.map((c) => `${c.roman} = ${chordSymbol(c)}`).join(', ')];
      });
      const home = diatonicChords(tonic, ionian);
      const ae = diatonicChords(tonic, aeolian);
      return [
        p('Dos modes són paral·lels quan comparteixen la tònica: Do major i Do menor, Do major i Do mixolidi. L\'intercanvi modal consisteix a agafar, per un moment, un acord d\'un mode paral·lel sense deixar la tonalitat. La tònica no es mou; el color sí.'),
        p('No és una modulació. Després de l\'acord manllevat, la música torna als acords de sempre.'),
        h(`Què es pot manllevar a ${noteCa(tonic)} major`),
        { t: 'table', head: ['Mode paral·lel', 'Acords que no són a la tonalitat major'], rows },
        p('Un mateix acord pot sortir de més d\'un mode. El bVII, per exemple, és al mixolidi, al dòric i a l\'eòlic. Quan passa, no cal decidir d\'on ve: n\'hi ha prou amb saber que és un acord de fora que comparteix tònica.'),
        h('Els més habituals'),
        { t: 'list', items: [
          `bVII = ${chordSymbol(ae[6])}: rock clàssic. Substitueix el dominant per un acord sense sensible.`,
          `bVI = ${chordSymbol(ae[5])}: fosc i èpic. Sovint va seguit del bVII i torna al I.`,
          `iv = ${chordSymbol(ae[3])}: el IV fet menor. El gest melancòlic per excel·lència abans de tornar a la tònica.`,
          `bIII = ${chordSymbol(ae[2])}: blues i rock; dona un color menor sense canviar l'acord de tònica.`,
        ] },
        h('Escolta\'ls'),
        { t: 'prog', line: `I = ${chordSymbol(home[0])}  →  bVI = ${chordSymbol(ae[5])}  →  bVII = ${chordSymbol(ae[6])}  →  I = ${chordSymbol(home[0])}`, listen: { type: 'progression', chords: [home[0], ae[5], ae[6], home[0]].map(chordMidi) } },
        { t: 'prog', line: `I = ${chordSymbol(home[0])}  →  IV = ${chordSymbol(home[3])}  →  iv = ${chordSymbol(ae[3])}  →  I = ${chordSymbol(home[0])}`, listen: { type: 'progression', chords: [home[0], home[3], ae[3], home[0]].map(chordMidi) } },
        chordsBlock([ae[6], ae[5], ae[3], ae[2]]),
        { t: 'practice', generatorId: 'borrowed-chord', text: 'Practica l\'intercanvi modal' },
        { t: 'ref', concepts: ['modal-mixture-songwriters', 'modal-mixture-linear', 'relative-parallel'] },
      ];
    },
  },
  {
    id: 'compassos', group: GROUPS[5], title: 'Compassos i compassos irregulars', summary: '3/4, 6/8, 5/4, 7/8: com es compten i on cauen els accents',
    usesKey: false, defaultKey: 'C',
    build() {
      const out: Block[] = [
        p('Un compàs diu dues coses: quantes figures hi caben i com s\'agrupen. La segona és la que es nota tocant, perquè l\'agrupament decideix on cauen els accents.'),
        h('Llegir la xifra'),
        p('El número de sota diu quina figura es compta: 4 és la negra, 8 és la corxera. El de dalt diu quantes n\'hi ha. Un 3/4 té tres negres; un 7/8 té set corxeres.'),
        h('3/4 i 6/8 no són el mateix'),
        p('Tots dos tenen sis corxeres. El 3/4 les agrupa de dues en dues: tres temps, cadascun partit en dos. El 6/8 les agrupa de tres en tres: dos temps, cadascun partit en tres. El primer és un vals; el segon balla en dos. Aquesta és la diferència entre compàs simple (temps partits en dos) i compost (temps partits en tres).'),
        { t: 'rhythm', groups: [2, 2, 2], listen: { type: 'clicks', accents: [2, 0, 1, 0, 1, 0], bpm: 200 } },
        p('3/4: «1 i 2 i 3 i».'),
        { t: 'rhythm', groups: [3, 3], listen: { type: 'clicks', accents: [2, 0, 0, 1, 0, 0], bpm: 200 } },
        p('6/8: «1 2 3 · 1 2 3».'),
        h('Compassos irregulars'),
        p('Un compàs és irregular quan barreja grups de dues i de tres corxeres, de manera que els temps no duren tots igual. No es compten d\'u a set: es compten per grups, reiniciant a cada un. Així un 7/8 deixa de ser "set coses" i passa a ser "tres temps, l\'últim una mica més llarg".'),
        p('El mateix compàs es pot agrupar de més d\'una manera, i cada agrupament sona diferent. Per això cal dir-lo: 7/8 (2+2+3) no és 7/8 (3+2+2).'),
      ];
      const seen = new Set<string>();
      for (const m of METERS) {
        const label = meterLabel(m);
        const groups = m.unit === 8 ? m.groups : m.groups.map(() => 2);
        if (!seen.has(label)) {
          out.push(h(label, label));
          seen.add(label);
          const ss = METER_SONGS[label];
          if (ss?.length) out.push(p(`Se sent a: ${songs(ss)}.`));
        }
        if (m.unit === 4 && seen.has(`${label}-drawn`)) continue;
        seen.add(`${label}-drawn`);
        out.push(
          { t: 'rhythm', groups, listen: { type: 'clicks', accents: m.unit === 8 ? accentPattern(m) : groups.flatMap((_, i) => [i === 0 ? 2 : 1, 0]), bpm: 200 } },
          p(m.unit === 8 ? `${label} agrupat ${m.groups.join('+')}: «${counting(m)}».` : `${label}: ${m.beats} temps de negra, «${Array.from({ length: m.beats }, (_, i) => `${i + 1} i`).join(' ')}».`),
        );
      }
      out.push(
        h('Com interioritzar-los'),
        { t: 'list', items: [
          'Pica de mans a cada 1 i digues la resta en veu baixa.',
          'Toca una sola nota o cordes apagades, accentuant només l\'inici de cada grup.',
          'Quan surti sense pensar, posa-hi una escala: els accents no coincidiran amb els canvis de corda, i aquest és l\'exercici.',
          'Fes servir el metrònom de les sessions de pràctica: marca la corxera i accentua els grups.',
        ] },
        { t: 'practice', generatorId: 'accent-positions', text: 'Practica els accents' },
        { t: 'practice', generatorId: 'meter-from-notation', text: 'Practica: reconèixer el compàs' },
        { t: 'ref', concepts: [] },
      );
      return out;
    },
  },
];

const [seccions, ...restForm] = FORM_TOPICS;
const byId = (id: string) => [...SONGWRITING_TOPICS, ...restForm].find((t) => t.id === id)!;
/** Songwriting first, in the order a songwriter needs it; the jazz forms after. */
const SONG_ORDER = ['relacions-harmoniques', 'progressions-per-seccio', 'cadencies', 'melodia-i-lletra', 'esbos-de-canco', 'estructura-formes', 'estructura-frases', 'blues-12', 'aaba-rhythm-changes'];
export const TOPICS: Topic[] = [...TOPIC_LIST, seccions, ...SONG_ORDER.map(byId)];
export const getTopic = (id: string): Topic | undefined => TOPICS.find((t) => t.id === id);

const CHORD_TOPIC: Record<string, string> = {
  sus2: 'acords-suspesos', sus4: 'acords-suspesos', '7sus4': 'acords-suspesos',
  dim: 'acords-disminuits', m7b5: 'acords-disminuits', dim7: 'acords-disminuits', aug: 'acords-disminuits', 'maj7#5': 'acords-disminuits',
  '6': 'acords-sisena', m6: 'acords-sisena', add9: 'acords-sisena', mMaj7: 'acords-sisena',
  maj9: 'acords-tensions', '9': 'acords-tensions', m9: 'acords-tensions', '11': 'acords-tensions', '13': 'acords-tensions',
  '7b9': 'acords-alterats', '7#9': 'acords-alterats', '7b5': 'acords-alterats', '7#5': 'acords-alterats',
};
const GENERATOR_TOPIC: Record<string, string> = {
  'mode-from-progression': 'harmonia-modal', 'roman-to-chord': 'xifres-romanes', 'mode-from-formula': 'modes',
};

/** Where in the theory section a puzzle's subject is explained: topic id plus an optional anchor inside it. */
export function topicFor(generatorId: string, conceptKey: string): { topic: string; anchor?: string } {
  const [kind, id] = [conceptKey.slice(0, conceptKey.indexOf(':')), conceptKey.slice(conceptKey.indexOf(':') + 1)];
  if (GENERATOR_TOPIC[generatorId]) {
    const topic = GENERATOR_TOPIC[generatorId];
    return { topic, anchor: topic === 'harmonia-modal' && id !== 'ionian' ? id : undefined };
  }
  switch (kind) {
    case 'mode': return { topic: `escala-${id}` };
    case 'chord': return CHORD_TOPIC[id] ? { topic: CHORD_TOPIC[id], anchor: id } : { topic: 'acords-formules' };
    case 'spread': return { topic: 'triades-obertes' };
    case 'meter': return { topic: 'compassos', anchor: id };
    case 'roman': return { topic: 'xifres-romanes' };
    case 'borrow': return { topic: 'intercanvi-modal' };
    case 'secdom': return { topic: 'dominants-secundaris' };
    case 'form': return generatorId === 'section-start' ? { topic: 'estructura-frases' } : { topic: 'estructura-formes', anchor: id };
    case 'section': return { topic: 'estructura-seccions', anchor: id };
    case 'blues': return { topic: 'blues-12', anchor: id };
    case 'rc': return { topic: 'aaba-rhythm-changes', anchor: 'rc-bridge' };
    case 'cadence': return { topic: 'cadencies', anchor: id };
    case 'fit': return { topic: 'progressions-per-seccio', anchor: id };
    case 'songwriting': return { topic: 'relacions-harmoniques', anchor: id === 'relative' ? 'relative' : id };
    case 'rhyme': return { topic: 'melodia-i-lletra', anchor: 'rima' };
    default: return { topic: 'graus' };
  }
}

export const defaultKey = (t: Topic): Note => parseNote(t.defaultKey);
