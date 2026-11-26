// Songwriting pages: how sections relate harmonically, progressions for each section, melody and lyrics,
// and a song-sketch builder. Original prose; every example is generated in the reader's key.
import { Note, noteCa } from '../theory/note';
import { Chord, chordSymbol, getChord } from '../theory/chord';
import { ChartChord, chartChords, romanIn, startBars } from '../theory/form';
import {
  ROLE_CA, Role, progsFor, progChords, dominantOf, relativeOf, keyLift, BORROWED, DIATONIC, SCHEMES, SCHEME_CA,
  songSketch, RULE_CA,
} from '../theory/songwriting';
import { SECTIONS } from '../theory/form';
import { chordMidi, makeRng } from '../puzzles/util';
import type { BarCell, FormVisualBlock, Listen } from '../puzzles/types';
import type { Block, Topic } from './theory';
import { FORM_GROUP } from './form-topics';

const p = (text: string): Block => ({ t: 'p', text });
const h = (text: string, id?: string): Block => ({ t: 'h', text, id });
const pair = (c: ChartChord): string => `${c.roman} = ${chordSymbol(c)}`;
const pairIn = (tonic: Note, c: Chord): string => `${romanIn(tonic, c)} = ${chordSymbol(c)}`;
const and = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} i ${xs[xs.length - 1]}`);
const listenOf = (cs: Chord[]): Listen => ({ type: 'progression', chords: cs.map(chordMidi) });
const prog = (cs: ChartChord[], label?: string): Block => ({ t: 'prog', line: `${label ? `${label}: ` : ''}${cs.map(pair).join('  →  ')}`, listen: listenOf(cs) });
const cells = (bars: ChartChord[][]): BarCell[] => bars.map((bar) => ({ chords: bar.map((c) => ({ roman: c.roman, symbol: chordSymbol(c) })) }));
const MAJ = (root: Note): Chord => ({ root, def: getChord('maj') });

export const SONGWRITING_TOPICS: Topic[] = [
  {
    id: 'relacions-harmoniques', group: FORM_GROUP, title: 'Com es relacionen les seccions', summary: 'Contrast i connexió: on comença cada secció, com es prepara la tornada i què aporta el pont',
    usesKey: true, defaultKey: 'C',
    build(tonic: Note) {
      const d = (spec: [string, string][]) => chartChords(tonic, spec);
      const verse = d([['6', 'm'], ['4', 'maj'], ['1', 'maj'], ['5', 'maj']]);
      const chorus = d([['1', 'maj'], ['5', 'maj'], ['6', 'm'], ['4', 'maj']]);
      const targets = d([['1', 'maj'], ['4', 'maj'], ['6', 'm'], ['2', 'm']]);
      const borrowed = d(BORROWED);
      const unusedDiatonic = d(DIATONIC).filter((c) => ![...verse, ...chorus].some((u) => u.roman === c.roman));
      const rel = relativeOf(tonic, false);
      const up1 = keyLift(tonic, 1);
      const up2 = keyLift(tonic, 2);
      return [
        p('Una cançó no és una sola progressió repetida: cada secció té la seva harmonia, i el que fa que l\'estructura funcioni és com es relacionen. Dues forces treballen alhora. El contrast fa que cada secció soni diferent de l\'anterior. La connexió fa que el pas d\'una a l\'altra sembli inevitable.'),
        h('Cinc eines de contrast'),
        { t: 'list', items: [
          'Començar en un altre acord: si el vers comença lluny de la tònica, la tornada pot començar-hi.',
          'Canviar el ritme harmònic: acords lents al vers, més ràpids a la tornada.',
          'Canviar de centre: vers a la relativa menor, tornada a la major.',
          'Portar acords nous al pont, de la tonalitat o manllevats del menor.',
          'Canviar de registre i energia: la melodia de la tornada més aguda, la banda més plena.',
        ] },
        h('On comença cada secció', 'start'),
        p(`El contrast més simple és que el vers i la tornada comencin en acords diferents. Un vers que comença a ${pair(verse[0])} sona reservat; una tornada que comença a ${pair(chorus[0])} sona com arribar a casa.`),
        prog(verse, 'Vers'),
        prog(chorus, 'Tornada'),
        p('Els dos fan servir els mateixos quatre acords, però en un altre ordre. Només canviar quin va primer ja canvia el paper de la secció.'),
        h('La pre-tornada prepara la tornada', 'chorus-setup'),
        p(`L'acord que més empeny cap a un altre és el seu dominant. Si la pre-tornada acaba en el dominant del primer acord de la tornada, la tornada arriba com una resolució. Quan la tornada comença a la tònica, això és el ${pairIn(tonic, dominantOf(targets[0]))}; si comença en un altre acord, és un dominant secundari, amb una nota de fora que crida l'atenció.`),
        { t: 'table', head: ['La tornada comença a', 'La pre-tornada acaba a'], rows: targets.map((t) => [pair(t), pairIn(tonic, dominantOf(t))]) },
        prog([...d([['4', 'maj']]), { ...dominantOf(targets[1]), roman: romanIn(tonic, dominantOf(targets[1])) }, targets[1]], 'Pre-tornada → tornada al IV'),
        h('El pont porta un acord nou', 'bridge-new'),
        p(`Arribat el pont, l'oient ja coneix els acords del vers i de la tornada. El pont sona a un altre lloc si porta un acord que encara no ha sonat. Amb el vers i la tornada d'aquesta pàgina, de la tonalitat queden ${and(unusedDiatonic.map(pair)) || 'pocs acords'}. Del menor paral·lel es poden manllevar ${and(borrowed.map(pair))}.`),
        prog(d([['b6', 'maj'], ['b7', 'maj'], ['4', 'maj'], ['5', 'maj']]), 'Pont amb acords manllevats'),
        p('El pont sol acabar en el dominant: deixa la frase oberta i fa que l\'última tornada arribi amb més força que les anteriors.'),
        h('Canviar de centre: la relativa', 'relative'),
        p(`${noteCa(tonic)} major i ${noteCa(rel)} menor tenen les mateixes notes. Un vers que gira al voltant de ${chordSymbol({ root: rel, def: getChord('m') })} i una tornada que es queda a ${chordSymbol(MAJ(tonic))} canvien de color sense ni una nota nova: el vers fosc, la tornada lluminosa. També funciona al revés, amb un pont a la relativa menor.`),
        prog(d([['6', 'm'], ['3', 'm'], ['6', 'm'], ['5', 'maj']]), 'Vers a la relativa menor'),
        prog(d([['1', 'maj'], ['4', 'maj'], ['1', 'maj'], ['5', 'maj']]), 'Tornada a la major'),
        h('El ritme harmònic', 'harmonic-rhythm'),
        p('El ritme harmònic és cada quant canvia l\'acord. Un vers amb un acord cada dos compassos sona tranquil i deixa espai a la lletra; una tornada amb un acord per compàs sona més activa, encara que els acords siguin els mateixos.'),
        { t: 'bars', bars: cells(verse.flatMap((c) => [[c], [c]])), perRow: 4, listen: listenOf(verse.flatMap((c) => [c, c])) },
        p('Vers: un acord cada dos compassos.'),
        { t: 'bars', bars: cells([...chorus, ...chorus].map((c) => [c])), perRow: 4, listen: listenOf([...chorus, ...chorus]) },
        p('Tornada: un acord per compàs.'),
        h('Pujar l\'última tornada', 'key-lift'),
        p(`Un recurs clàssic del pop per al tram final: l'última tornada puja un semitò o un to. A ${noteCa(tonic)} major, un semitò amunt és ${noteCa(up1.tonic)} major i un to amunt, ${noteCa(up2.tonic)} major. El canvi sona natural si l'últim compàs del pont fa el dominant de la nova tonalitat: ${pairIn(tonic, up1.pivot)} o ${pairIn(tonic, up2.pivot)}.`),
        prog([{ ...MAJ(tonic), roman: 'I' }, { ...up2.pivot, roman: romanIn(tonic, up2.pivot) }, { ...MAJ(up2.tonic), roman: romanIn(tonic, MAJ(up2.tonic)) }], 'Un to amunt'),
        p('Fes-lo servir una sola vegada i al final: com més tard arriba, més efecte fa.'),
        { t: 'link', topic: 'progressions-per-seccio', text: 'Progressions per a cada secció' },
        { t: 'link', topic: 'esbos-de-canco', text: 'Fes un esbós de cançó' },
        { t: 'link', topic: 'dominants-secundaris', text: 'Dominants secundaris' },
        { t: 'link', topic: 'intercanvi-modal', text: 'Intercanvi modal' },
        { t: 'practice', generatorId: 'chorus-setup', text: 'Practica: preparar la tornada' },
        { t: 'practice', generatorId: 'bridge-new', text: 'Practica: un acord nou per al pont' },
        { t: 'practice', generatorId: 'key-lift', text: 'Practica: pujar l\'última tornada' },
        { t: 'ref', concepts: ['secondary-dominants', 'modal-mixture-songwriters', 'relative-parallel'] },
      ];
    },
  },
  {
    id: 'progressions-per-seccio', group: FORM_GROUP, title: 'Progressions per a cada secció', summary: 'Què demana harmònicament un vers, una pre-tornada, una tornada i un pont, amb exemples',
    usesKey: true, defaultKey: 'G',
    build(tonic: Note) {
      const roles: [Role, string, string | null][] = [
        ['verse', 'El vers explica. Harmònicament, sol evitar la cadència forta cap a la tònica, o fins i tot la tònica mateixa: guarda l\'arribada per a la tornada.', RULE_CA.verse],
        ['prechorus', 'La pre-tornada fa pujar la tensió i acaba oberta. L\'acord final gairebé sempre és el dominant, o un acord manllevat que porta a la tònica.', RULE_CA.prechorus],
        ['chorus', 'La tornada és el centre: arriba a la tònica o hi gira al voltant, i sovint acaba tancant amb una cadència.', RULE_CA.chorus],
        ['bridge', 'El pont aporta contrast: acords que encara no han sonat i, al final, el dominant per tornar a la tornada.', null],
      ];
      return [
        p('Cada secció té una feina, i l\'harmonia l\'ajuda a fer-la. Aquestes són progressions típiques de cada secció, amb el que fan. No són regles: són punts de partida que funcionen i que pots combinar.'),
        ...roles.flatMap(([role, text, rule]): Block[] => [
          h(ROLE_CA[role].charAt(0).toUpperCase() + ROLE_CA[role].slice(1), role),
          p(text),
          ...(rule ? [p(`Regla pràctica: la progressió ${rule}.`)] : []),
          ...progsFor(role).flatMap((pr): Block[] => [prog(progChords(tonic, pr)), p(pr.whyCa)]),
        ]),
        h('Com combinar-les'),
        { t: 'list', items: [
          'Tria primer la tornada: és el que l\'oient recordarà.',
          'Després tria un vers que comenci en un altre acord, o que no toqui la tònica.',
          'Si hi ha pre-tornada, fes que acabi en el dominant del primer acord de la tornada.',
          'Per al pont, busca un acord que encara no hagi sonat, i acaba en el dominant.',
        ] },
        { t: 'link', topic: 'relacions-harmoniques', text: 'Com es relacionen les seccions' },
        { t: 'link', topic: 'esbos-de-canco', text: 'Fes un esbós de cançó' },
        { t: 'practice', generatorId: 'section-fit', text: 'Practica: quina progressió va a cada secció' },
        { t: 'ref', concepts: ['scale-degrees-progressions', 'modal-mixture-songwriters'] },
      ];
    },
  },
  {
    id: 'melodia-i-lletra', group: FORM_GROUP, title: 'Melodia i lletra a cada secció', summary: 'Registre, ritme, el títol, la rima i com fer que la lletra soni bé',
    usesKey: false, defaultKey: 'C',
    build: () => [
      p('L\'harmonia diu on és cada secció; la melodia i la lletra fan que l\'oient la recordi. Cada secció tendeix a tractar la melodia d\'una manera diferent, i aquest contrast és tan important com el dels acords.'),
      { t: 'table', head: ['Secció', 'Melodia', 'Lletra'], rows: [
        ['Vers', 'Registre mitjà o baix. Moltes notes curtes, a prop de la parla.', 'Explica: detalls, imatges, coses que passen. Canvia a cada vers.'],
        ['Pre-tornada', 'Puja. Frases més curtes, sovint repetides.', 'Anuncia la idea de la tornada sense dir-la encara.'],
        ['Tornada', 'La nota més alta. Notes més llargues i ritme més simple.', 'La idea central i el títol, al primer o a l\'últim vers. Igual cada vegada.'],
        ['Pont', 'Una zona nova: un altre registre o un altre ritme.', 'Un altre punt de vista o un gir a la història.'],
      ] },
      h('El ganxo i el títol'),
      p('El ganxo és la frase que se t\'enganxa. Sol ser a la tornada, sol coincidir amb el títol i es repeteix més d\'una vegada. Posa\'l on més es nota: al començament o al final de la tornada, en un temps fort i en una nota llarga.'),
      h('Prosòdia: que les paraules sonin bé'),
      p('La síl·laba tònica de cada paraula ha de caure en un temps fort o en una nota llarga. Si cau en una nota feble, la paraula sona estranya, com si estigués mal pronunciada. Diu la lletra en veu alta amb el ritme de la melodia: on fas l\'accent parlant, hi ha d\'anar l\'accent musical.'),
      h('Esquemes de rima', 'rima'),
      p('La rima organitza la lletra i ajuda a recordar-la. S\'escriu amb lletres, com la forma: les línies que rimen comparteixen lletra, i una X marca una línia que no rima amb cap altra.'),
      { t: 'table', head: ['Esquema', 'Exemple de finals', 'Efecte'], rows: SCHEMES.map((s) => {
        const ex: Record<string, string> = { AABB: 'cor · amor · mar · cantar', ABAB: 'cor · mar · amor · cantar', ABBA: 'cor · mar · cantar · amor', XAXA: 'nit · cor · gent · amor' };
        return [s, ex[s], SCHEME_CA[s]];
      }) },
      h('Repetició i variació'),
      { t: 'list', items: [
        'La tornada es repeteix igual: l\'oient l\'ha de poder cantar a la tercera vegada.',
        'Els versos repeteixen la melodia però canvien la lletra: la mateixa forma, contingut nou.',
        'A l\'última tornada, un petit canvi (una paraula, una nota més alta, una línia doblada) fa que soni com un final.',
      ] },
      { t: 'link', topic: 'estructura-seccions', text: 'Les parts d\'una cançó' },
      { t: 'link', topic: 'esbos-de-canco', text: 'Fes un esbós de cançó' },
      { t: 'practice', generatorId: 'rhyme-scheme', text: 'Practica els esquemes de rima' },
      { t: 'ref', concepts: [] },
    ],
  },
  {
    id: 'esbos-de-canco', group: FORM_GROUP, title: 'Esbós de cançó', summary: 'Un esquelet complet per escriure-hi a sobre: forma, acords de cada secció i per què',
    usesKey: true, defaultKey: 'G', randomizable: true,
    build(tonic: Note, seed = 1) {
      const sk = songSketch(tonic, makeRng(seed).next);
      const SECTION_NAME = Object.fromEntries(SECTIONS.map((s) => [s.id, s.nameCa]));
      const starts = startBars(sk.form);
      const blocks: FormVisualBlock[] = sk.form.map((b, i) => ({ label: b.label, bars: b.bars, start: starts[i], name: b.section ? SECTION_NAME[b.section] : undefined }));
      return [
        p('Aquí tens l\'esquelet d\'una cançó: la forma i els acords de cada secció, triats perquè les seccions contrastin i s\'enllacin. Toca\'l amb la guitarra, canta-hi a sobre i escriu-hi la lletra. Si no t\'agrada, demana\'n un altre.'),
        { t: 'form', blocks },
        ...sk.sections.flatMap((sec): Block[] => [
          h(sec.title),
          { t: 'bars', bars: cells(sec.bars), perRow: 4, listen: listenOf(sec.bars.flat()) },
          ...sec.notes.map(p),
        ]),
        h('Com fer-lo servir'),
        { t: 'list', items: [
          'Comença per la tornada: toca-la en bucle i taral·leja fins que surti una melodia que t\'agradi. Hi va el títol.',
          'Després el vers: més baix i més parlat, amb la mateixa estructura de frases cada vegada.',
          'Grava\'t amb el mòbil cada idea, encara que sigui dolenta. Es tria després.',
          'Canvia el que vulguis: un acord, la durada d\'una secció, l\'ordre. L\'esbós és un punt de partida.',
        ] },
        { t: 'link', topic: 'relacions-harmoniques', text: 'Per què aquests acords: com es relacionen les seccions' },
        { t: 'link', topic: 'melodia-i-lletra', text: 'Melodia i lletra a cada secció' },
        { t: 'practice', generatorId: 'section-fit', text: 'Practica: quina progressió va a cada secció' },
        { t: 'ref', concepts: ['modal-mixture-songwriters', 'secondary-dominants'] },
      ];
    },
  },
];
