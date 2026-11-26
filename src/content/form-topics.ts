// Theory pages on song structure. Prose is original; every chart, table and example is generated
// from the form module in the key the reader picks. The book covers blues, rhythm changes and turnarounds;
// it does not cover pop sections, so those pages cite nothing.
import { Note, noteCa } from '../theory/note';
import { Chord, chordSymbol } from '../theory/chord';
import {
  SECTIONS, TRAIT_CA, FORMS, FormBlock, getForm, formPattern, totalBars, startBars, barsToSeconds, BLUES, bluesChords,
  RHYTHM_A, rhythmBars, rhythmBridge, CADENCES, cadenceChords, ChartChord,
} from '../theory/form';
import { chordMidi } from '../puzzles/util';
import type { BarCell, FormVisualBlock, Listen } from '../puzzles/types';
import type { Block, Topic } from './theory';
import { SongExample } from './progressions';

export const FORM_GROUP = 'Estructura de les cançons';

const p = (text: string): Block => ({ t: 'p', text });
const h = (text: string, id?: string): Block => ({ t: 'h', text, id });
const pair = (c: ChartChord): string => `${c.roman} = ${chordSymbol(c)}`;
const and = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} i ${xs[xs.length - 1]}`);
const songs = (ss: SongExample[]): Block =>
  p(`Per escoltar-ho: ${ss.map((s) => `«${s.title}» (${s.artist})${s.note ? `, ${s.note}` : ''}`).join('; ')}.`);

const formBlock = (blocks: FormBlock[], named = true): Block => {
  const starts = startBars(blocks);
  const SECTION_NAME = Object.fromEntries(SECTIONS.map((s) => [s.id, s.nameCa]));
  return {
    t: 'form',
    blocks: blocks.map((b, i): FormVisualBlock => ({ label: b.label, bars: b.bars, start: starts[i], name: named && b.section ? SECTION_NAME[b.section] : undefined })),
  };
};

const cells = (bars: ChartChord[][]): BarCell[] => bars.map((bar) => ({ chords: bar.map((c) => ({ roman: c.roman, symbol: chordSymbol(c) })) }));
const barsBlock = (bars: ChartChord[][], perRow = 4): Block => ({
  t: 'bars', bars: cells(bars), perRow, listen: { type: 'progression', chords: bars.flat().map((c: Chord) => chordMidi(c)) } as Listen,
});

/** A typical pop arrangement, used to show the sections in context. */
const POP_EXAMPLE: FormBlock[] = [
  { label: 'I', bars: 4, section: 'intro' }, { label: 'A', bars: 8, section: 'verse' }, { label: 'B', bars: 4, section: 'prechorus' },
  { label: 'C', bars: 8, section: 'chorus' }, { label: 'A', bars: 8, section: 'verse' }, { label: 'B', bars: 4, section: 'prechorus' },
  { label: 'C', bars: 8, section: 'chorus' }, { label: 'D', bars: 8, section: 'bridge' }, { label: 'C', bars: 8, section: 'chorus' },
  { label: 'C', bars: 4, section: 'outro' },
];

const FORM_SONGS: Record<string, SongExample[]> = {
  blues12: [
    { title: 'Johnny B. Goode', artist: 'Chuck Berry', confidence: 'segura' },
    { title: 'Pride and Joy', artist: 'Stevie Ray Vaughan', confidence: 'segura' },
  ],
  aaba32: [
    { title: 'Over the Rainbow', artist: 'Harold Arlen', confidence: 'segura' },
    { title: 'Blue Moon', artist: 'Rodgers i Hart', confidence: 'segura' },
  ],
  'verse-pre-chorus': [{ title: 'Smells Like Teen Spirit', artist: 'Nirvana', confidence: 'segura', note: 'vers fluix, pre-tornada que creix, tornada a tot volum' }],
};

export const FORM_TOPICS: Topic[] = [
  {
    id: 'estructura-seccions', group: FORM_GROUP, title: 'Les seccions d\'una cançó', summary: 'Vers, pre-tornada, tornada, pont i la resta: què fa cadascuna i com reconèixer-la',
    usesKey: false, defaultKey: 'C',
    build: () => [
      p('Una cançó és una seqüència de seccions. Cada secció té una música pròpia i un paper: presentar, explicar, preparar, arribar al punt culminant, contrastar, tancar. Saber en quina secció ets et diu què vindrà després, i això és el que permet tocar una cançó sense perdre\'s.'),
      p('Les seccions s\'anomenen de dues maneres. Pel seu paper (vers, tornada, pont), que és com en parla el pop. O amb lletres (A, B, C), on la mateixa lletra vol dir la mateixa música; és com s\'escriu la forma del jazz i de la música clàssica.'),
      h('Una estructura pop típica'),
      formBlock(POP_EXAMPLE),
      p(`En total, ${totalBars(POP_EXAMPLE)} compassos. Els números de sobre indiquen el compàs on comença cada secció.`),
      h('Cada secció i el seu paper'),
      { t: 'table', head: ['Secció', 'Paper', 'Com la reconeixes'], rows: SECTIONS.map((s) => [s.nameCa, s.roleCa, s.traits.map((t) => TRAIT_CA[t].replace(/\.$/, '')).join('. ') + '.']) },
      ...SECTIONS.flatMap((s): Block[] => [h(s.nameCa.charAt(0).toUpperCase() + s.nameCa.slice(1), s.id), p(s.roleCa)]),
      h('Com escoltar l\'estructura d\'una cançó'),
      { t: 'list', items: [
        'Busca primer la tornada: és la part que torna igual i que sol dur el títol. A partir d\'aquí, la resta s\'ordena sola.',
        'Compta els compassos per grups de quatre. Quan canvia la secció, apunta en quin compàs ha passat.',
        'Escolta l\'energia: el vers sol ser més fluix, la pre-tornada creix i la tornada és el punt més alt.',
        'Escriu la forma amb lletres mentre escoltes (A A B A, o V T V T P T). Després compara-la amb les formes habituals.',
        'Recorda que són tendències: moltes cançons no tenen pre-tornada, o comencen per la tornada, o no tenen pont.',
      ] },
      { t: 'link', topic: 'estructura-formes', text: 'Les formes habituals' },
      { t: 'link', topic: 'estructura-frases', text: 'Frases i compassos: com comptar una secció' },
      { t: 'practice', generatorId: 'section-role', text: 'Practica: reconèixer les seccions' },
      { t: 'ref', concepts: [] },
    ],
  },
  {
    id: 'estructura-frases', group: FORM_GROUP, title: 'Frases i compassos', summary: 'Per què les seccions duren 4, 8 o 16 compassos, i com comptar-les tocant',
    usesKey: false, defaultKey: 'C',
    build: () => {
      const tempos = [70, 90, 120];
      const ex = getForm('verse-chorus-bridge').blocks.map((b) => (b.section === 'verse' ? { ...b, bars: 16 } : b));
      return [
        p('La música popular s\'organitza en frases de dos o quatre compassos, que s\'agrupen en seccions de vuit o setze. Aquesta regularitat fa que l\'oient sàpiga, sense pensar-hi, quan s\'acaba una secció: després de quatre frases curtes o dues de llargues, espera un canvi.'),
        p('Per això, quan toques, el que cal comptar no són els temps sinó els compassos, en grups de quatre. Un mètode habitual és dir el número de compàs en el primer temps: «1-2-3-4, 2-2-3-4, 3-2-3-4, 4-2-3-4». Al cinquè compàs tornes a començar: «1-2-3-4».'),
        h('Quant dura una secció'),
        { t: 'table', head: ['Compassos de 4/4', ...tempos.map((b) => `${b} bpm`)], rows: [4, 8, 12, 16, 32].map((n) => [String(n), ...tempos.map((b) => `${barsToSeconds(n, b).toFixed(1).replace('.', ',')} s`)]) },
        p('Una cançó pop de tres minuts a 120 bpm té uns 90 compassos: una desena de seccions de vuit compassos.'),
        h('On comença cada secció'),
        formBlock(ex),
        p(`Amb versos de 16 compassos i tornades de 8, la segona tornada comença al compàs ${startBars(ex)[3]}. Comptar la forma així et deixa preparar el canvi d'acord abans que arribi.`),
        h('Quan la regla es trenca'),
        { t: 'list', items: [
          'Anacrusi: la melodia comença abans del compàs 1 de la secció, en l\'últim temps de l\'anterior. La secció comença igualment al compàs 1.',
          'Extensió: un compàs o dos de més al final d\'una secció, per respirar o per crear sorpresa. Sovint al final de la tornada abans del pont.',
          'Turnaround: els dos últims compassos d\'una secció de vuit sovint fan una petita cadència que torna a portar a l\'inici.',
          'Frases de tres o cinc compassos: són rares en pop i es noten molt; quan hi són, compta-les a part.',
        ] },
        { t: 'link', topic: 'compassos', text: 'Compassos i compassos irregulars' },
        { t: 'link', topic: 'estructura-formes', text: 'Les formes habituals' },
        { t: 'practice', generatorId: 'section-start', text: 'Practica: a quin compàs comença cada secció' },
        { t: 'ref', concepts: ['comping-rhythms', 'turnarounds'] },
      ];
    },
  },
  {
    id: 'estructura-formes', group: FORM_GROUP, title: 'Les formes habituals', summary: 'AABA, blues, vers-tornada i les altres: com s\'escriuen i on s\'usen',
    usesKey: false, defaultKey: 'C',
    build: () => [
      p('Una forma és el patró de seccions d\'una cançó. S\'escriu amb lletres: la primera música és A, la següent que és diferent és B, i així successivament. Una lletra que torna vol dir que torna la mateixa música, encara que la lletra de la cançó canviï.'),
      { t: 'table', head: ['Forma', 'Lletres', 'Compassos', 'On s\'usa'], rows: FORMS.map((f) => [f.nameCa, formPattern(f.blocks).split('').join(' '), String(totalBars(f.blocks)), f.useCa]) },
      p('Les durades de la taula són les habituals. Una mateixa forma pot tenir seccions de setze compassos, o repetir el darrer cicle; el que la defineix és l\'ordre de les lletres.'),
      ...FORMS.flatMap((f): Block[] => [
        h(f.nameCa, f.id),
        formBlock(f.blocks),
        p(f.useCa),
        ...(FORM_SONGS[f.id] ? [songs(FORM_SONGS[f.id])] : []),
      ]),
      { t: 'link', topic: 'blues-12', text: 'El blues de 12 compassos, compàs a compàs' },
      { t: 'link', topic: 'aaba-rhythm-changes', text: 'L\'AABA i les rhythm changes' },
      { t: 'practice', generatorId: 'form-chart', text: 'Practica: reconèixer la forma' },
      { t: 'ref', concepts: ['standard-forms-solos', 'rhythm-changes', 'blues-forms'] },
    ],
  },
  {
    id: 'blues-12', group: FORM_GROUP, title: 'El blues de 12 compassos', summary: 'Tres frases de quatre compassos, tres acords i les seves variants',
    usesKey: true, defaultKey: 'E',
    build(tonic: Note) {
      const [std, quick, minor] = BLUES.map((b) => bluesChords(b, tonic));
      const uniq = (cs: ChartChord[]) => [...new Map(cs.map((c) => [c.roman, c])).values()];
      return [
        p(`El blues de 12 compassos és la forma més tocada del rock, el blues i el jazz. Són tres frases de quatre compassos amb tres acords, tots de 7a de dominant: a ${noteCa(tonic)}, ${and(uniq(std).map(pair))}.`),
        p('La lletra segueix la mateixa forma, AAB: la primera frase planteja, la segona la repeteix (sovint amb un petit canvi) i la tercera respon. Cada frase de la lletra ocupa uns dos compassos i deixa els altres dos perquè la guitarra respongui.'),
        h('Blues estàndard', 'standard'),
        barsBlock(std.map((c) => [c])),
        p(`Quatre compassos al ${pair(std[0])}, dos al ${pair(std[4])}, dos més al ${pair(std[0])}, i la frase final ${std.slice(8).map(pair).join(' → ')}.`),
        h('Amb canvi ràpid (quick change)', 'quick'),
        barsBlock(quick.map((c) => [c])),
        p(`Igual que l'estàndard, però al compàs 2 ja es va al ${pair(quick[1])} i al 3 es torna al ${pair(quick[2])}. Dona moviment al començament i és molt habitual en el blues de Chicago i en el rock.`),
        h('Blues menor', 'minor'),
        barsBlock(minor.map((c) => [c])),
        p(`Els acords del i i del iv són menors: ${pair(minor[0])} i ${pair(minor[4])}. La tercera frase canvia: ${minor.slice(8).map(pair).join(' → ')}. El ${pair(minor[8])} baixa un semitò fins al ${pair(minor[9])}.`),
        h('El turnaround'),
        p(`El compàs 12 no descansa: el ${pair(std[11])} torna a portar a l'inici. En jazz, els compassos 11 i 12 sovint es fan més moguts, amb un acord per temps o per mig compàs, i aquest gir es diu turnaround.`),
        songs(FORM_SONGS.blues12),
        { t: 'link', topic: 'estructura-formes', text: 'Les altres formes' },
        { t: 'practice', generatorId: 'blues-bar', concept: 'blues:standard', text: 'Practica el blues compàs a compàs' },
        { t: 'ref', concepts: ['blues-forms', 'turnarounds'] },
      ];
    },
  },
  {
    id: 'aaba-rhythm-changes', group: FORM_GROUP, title: 'L\'AABA i les rhythm changes', summary: 'La forma de 32 compassos dels estàndards i la progressió de Gershwin',
    usesKey: true, defaultKey: 'Bb',
    build(tonic: Note) {
      const a = rhythmBars(tonic, RHYTHM_A);
      const bridge = rhythmBridge(tonic);
      const bridgeBars = bridge.flatMap((c) => [[c], [c]]);
      return [
        p('L\'AABA de 32 compassos és la forma de la cançó americana dels anys 30 a 60, i per això de la majoria d\'estàndards de jazz. Una secció A de vuit compassos sona dues vegades, ve un pont B de vuit amb música nova, i torna l\'A per tancar.'),
        formBlock(getForm('aaba32').blocks),
        p('La primera A sol acabar amb un turnaround que porta a la segona. La segona i l\'última acaben tancant a la tònica. El pont sovint comença en una altra regió de la tonalitat i acaba en el dominant, que fa tornar a l\'A.'),
        songs(FORM_SONGS.aaba32),
        h('Les rhythm changes'),
        p('Rhythm changes és el nom de la progressió de «I Got Rhythm», de George Gershwin. Els músics de bebop hi van escriure desenes de temes nous, de manera que avui és, després del blues, la forma més tocada a les jam sessions. La cançó original allarga l\'última A dos compassos; la versió de jazz la deixa en 32.'),
        h('La secció A'),
        barsBlock(a),
        p(`Dos acords per compàs. Els quatre primers compassos repeteixen un cicle ${a[0].map(pair).join(', ')}, ${a[1].map(pair).join(', ')}. Al compàs 6 passa del ${pair(a[5][0])} al ${pair(a[5][1])}, i els dos últims tornen a la tònica. És una versió habitual; n'hi ha moltes variants.`),
        h('El pont', 'rc-bridge'),
        barsBlock(bridgeBars),
        p(`Quatre acords de 7a de dominant, dos compassos cadascun: ${bridge.map(pair).join(' → ')}. Cada un és el dominant del següent, una cadena de dominants secundaris que acaba en el dominant de la tonalitat i fa tornar a l'última A.`),
        { t: 'link', topic: 'dominants-secundaris', text: 'Dominants secundaris' },
        { t: 'link', topic: 'estructura-formes', text: 'Les altres formes' },
        { t: 'practice', generatorId: 'rc-bridge', text: 'Practica el pont de les rhythm changes' },
        { t: 'ref', concepts: ['rhythm-changes', 'turnarounds', 'comping-rhythms'] },
      ];
    },
  },
  {
    id: 'cadencies', group: FORM_GROUP, title: 'Cadències: com acaben les seccions', summary: 'Autèntica, plagal, semicadència, trencada i modal',
    usesKey: true, defaultKey: 'C',
    build(tonic: Note) {
      const lead = cadenceChords(tonic, [['1', 'maj']]);
      return [
        p('Una cadència és la manera com acaba una frase. A les fronteres entre seccions, la cadència diu a l\'orella si la secció tanca o si queda oberta i en vol una altra. Per això reconèixer cadències ajuda a sentir la forma.'),
        { t: 'table', head: ['Cadència', `Exemple a ${noteCa(tonic)}`, 'Efecte'], rows: CADENCES.map((c) => [c.nameCa, cadenceChords(tonic, c.examples[0]).map(pair).join(' → '), c.effectCa]) },
        ...CADENCES.flatMap((c): Block[] => {
          const end = cadenceChords(tonic, c.examples[0]);
          const prog = c.id === 'half' ? end : [...lead, ...end];
          return [
            h(c.nameCa.charAt(0).toUpperCase() + c.nameCa.slice(1), c.id),
            p(`${c.effectCa} ${c.whereCa}`),
            { t: 'prog', line: prog.map(pair).join('  →  '), listen: { type: 'progression', chords: prog.map(chordMidi) } },
          ];
        }),
        h('Les cadències i la forma'),
        { t: 'list', items: [
          'El vers o la pre-tornada acaben sovint en semicadència: queden suspesos en el dominant i la tornada arriba com una resolució.',
          'La tornada acaba en cadència autèntica: tanca el cicle.',
          'La cadència trencada allarga l\'última tornada: quan esperes el final, la frase continua.',
          'En rock, la cadència modal substitueix l\'autèntica i evita el so «de manual».',
        ] },
        { t: 'link', topic: 'xifres-romanes', text: 'Acords diatònics i xifres romanes' },
        { t: 'practice', generatorId: 'cadence', text: 'Practica les cadències' },
        { t: 'ref', concepts: ['scale-degrees-progressions'] },
      ];
    },
  },
];
