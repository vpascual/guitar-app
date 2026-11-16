// Step-by-step reasoning shown after each puzzle. Every step is computed from the theory core,
// so the worked solution always matches the puzzle that was asked.
import { Note, noteCa, pc, mod, intervalBetween, degreeName, sameNote } from '../theory/note';
import { ScaleDef, SCALES, MAJOR_MODES, getScale, scaleNotes, characteristicNote, parentTonic, isMinorScale } from '../theory/scale';
import { Chord, DiatonicChord, chordSymbol, spellChord, chordFitsScale } from '../theory/chord';
import { FretPos, Voicing, fretMidi } from '../theory/guitar';
import { degreeCa, ORDINALS } from '../i18n/ca';

/** Name of a chord degree in words, e.g. "b7" -> "7a menor". */
export const DEGREE_NAME: Record<string, string> = {
  '1': 'tònica', '2': '2a major', b3: '3a menor', '3': '3a major', '4': '4a justa', b5: '5a disminuïda',
  '5': '5a justa', '#5': '5a augmentada', '6': '6a major', bb7: '7a disminuïda', b7: '7a menor', '7': '7a major',
  b9: '9a menor', '9': '9a major', '#9': '9a augmentada', '11': '11a justa', '13': '13a major',
};

const FEMININE = ['melodic-minor', 'harmonic-minor', 'altered'];
const the = (s: ScaleDef): string => (FEMININE.includes(s.id) ? `l'escala ${s.nameCa}` : `el ${s.nameCa}`);
/** "del dòric", "de l'escala menor harmònica". */
const ofThe = (s: ScaleDef): string => (FEMININE.includes(s.id) ? `de l'escala ${s.nameCa}` : `del ${s.nameCa}`);
const cap = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);
const list = (ns: Note[]): string => ns.map(noteCa).join(' ');
const and = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} i ${xs[xs.length - 1]}`);

/** The plain scale a mode is compared with: major for major-type modes, natural minor for minor-type ones. */
const reference = (s: ScaleDef) => (isMinorScale(s)
  ? { scale: getScale('aeolian'), name: 'menor natural' }
  : { scale: getScale('ionian'), name: 'major' });

const familyStep = (s: ScaleDef): string => {
  const minor = isMinorScale(s);
  const members = MAJOR_MODES.filter((m) => isMinorScale(m) === minor).map((m) => m.nameCa);
  return `Comença per la 3a: és ${minor ? 'menor (b3)' : 'major (3)'}. Això deixa només els modes ${minor ? 'menors' : 'majors'}: ${and(members)}.`;
};

/** Which degrees differ from the reference scale, in words. */
function diffStep(s: ScaleDef): string {
  const ref = reference(s);
  const diffs = s.formula.map((d, i) => (d === ref.scale.formula[i] ? null : `la ${i + 1}a (${ref.scale.formula[i]} → ${d})`)).filter((x): x is string => !!x);
  return diffs.length
    ? `Compara amb l'escala ${ref.name} (${ref.scale.formula.join(' ')}): canvia ${and(diffs)}.`
    : `Compara amb l'escala ${ref.name} (${ref.scale.formula.join(' ')}): no canvia cap grau.`;
}

const signatureStep = (s: ScaleDef): string => {
  if (s.id === 'ionian') return 'Sense cap canvi, és l\'escala major mateixa. Com a mode es diu jònic.';
  if (s.id === 'aeolian') return 'Sense cap canvi, és el menor natural mateix. Com a mode es diu eòlic.';
  const others = MAJOR_MODES.filter((m) => m.id !== s.id && isMinorScale(m) === isMinorScale(s) && !['ionian', 'aeolian'].includes(m.id))
    .map((m) => `${m.nameCa}: ${m.characteristic}`);
  return s.family === 'major'
    ? `Aquesta és la signatura ${ofThe(s)}: la ${degreeCa(s.characteristic)}. Els altres de la família es reconeixen per una nota diferent (${others.join('; ')}).`
    : `Aquesta combinació només la té ${the(s)}.`;
};

export const modeFormulaSteps = (s: ScaleDef): string[] => [familyStep(s), diffStep(s), signatureStep(s)];

export function charNoteSteps(tonic: Note, s: ScaleDef): string[] {
  const ref = reference(s);
  const refNotes = scaleNotes(tonic, ref.scale);
  const notes = scaleNotes(tonic, s);
  const i = s.formula.indexOf(s.characteristic);
  return [
    `Recorda el color: ${the(s)} és un ${s.colourCa}. La nota que el defineix és la ${degreeCa(s.characteristic)}.`,
    `Escriu ${noteCa(tonic)} ${ref.name}: ${list(refNotes)}.`,
    sameNote(refNotes[i], notes[i])
      ? `La ${i + 1}a d'aquesta escala ja és ${noteCa(notes[i])}: no cal tocar res, és la nota que busques.`
      : `Canvia-hi la ${i + 1}a: ${noteCa(refNotes[i])} passa a ser ${noteCa(notes[i])}.`,
    `Resultat, ${noteCa(tonic)} ${s.nameCa}: ${list(notes)}.`,
  ];
}

export function modeNotesSteps(tonic: Note, s: ScaleDef): string[] {
  const notes = scaleNotes(tonic, s);
  const steps = [
    `Numera les notes des de ${noteCa(tonic)} i compara cada una amb ${noteCa(tonic)} major: ${notes.map((n, i) => `${noteCa(n)} = ${s.formula[i]}`).join(', ')}.`,
    s.family === 'major' ? familyStep(s) : `La 3a és ${isMinorScale(s) ? 'menor (b3)' : 'major (3)'}.`,
    diffStep(s),
  ];
  if (s.family === 'major') steps.push(signatureStep(s));
  else {
    const parent = SCALES.find((x) => x.family === s.family && x.modeIndex === 0)!;
    steps.push(s.modeIndex === 0
      ? `Aquesta fórmula és la ${ofThe(s)}: un ${s.colourCa}.`
      : `Aquesta fórmula és la ${ofThe(s)}, el ${ORDINALS[s.modeIndex]} mode de ${noteCa(parentTonic(tonic, s))} ${parent.nameCa}: un ${s.colourCa}.`);
  }
  return steps;
}

export function parentSteps(tonic: Note, s: ScaleDef): string[] {
  const parent = SCALES.find((x) => x.family === s.family && x.modeIndex === 0)!;
  const label = s.family === 'major' ? 'major' : parent.nameCa;
  const pt = parentTonic(tonic, s);
  const parentNotes = scaleNotes(pt, parent);
  return [
    `Un mode és una escala mare començada des d'un altre grau. ${cap(the(s))} comença al ${ORDINALS[s.modeIndex]} grau de l'escala ${label}.`,
    `Per tant ${noteCa(tonic)} ha de ser el ${ORDINALS[s.modeIndex]} grau de l'escala que busques.`,
    `${noteCa(pt)} ${label}: ${parentNotes.map((n, i) => (i === s.modeIndex ? `[${noteCa(n)}]` : noteCa(n))).join(' ')}. El ${ORDINALS[s.modeIndex]} grau és ${noteCa(tonic)}.`,
    `Comprovació: ${noteCa(tonic)} ${s.nameCa} = ${list(scaleNotes(tonic, s))}. Són les mateixes notes, començant per ${noteCa(tonic)}.`,
  ];
}

const qualityWords = (c: Chord): string => {
  const f = c.def.formula;
  const third = f.includes('3') ? '3a major' : f.includes('b3') ? '3a menor' : 'sense 3a';
  const fifth = f.includes('b5') ? '5a disminuïda' : f.includes('#5') ? '5a augmentada' : '5a justa';
  const seventh = f.includes('7') ? ' i 7a major' : f.includes('b7') ? ' i 7a menor' : f.includes('bb7') ? ' i 7a disminuïda' : '';
  return `${third}, ${fifth}${seventh}`;
};

export function romanToChordSteps(tonic: Note, s: ScaleDef, target: DiatonicChord): string[] {
  const notes = scaleNotes(tonic, s);
  const degree = s.formula[target.degree];
  const flat = /^[b#]/.test(degree);
  return [
    `Escriu l'escala: ${noteCa(tonic)} ${s.nameCa} = ${list(notes)}.`,
    `${target.roman} és l'acord sobre el ${ORDINALS[target.degree]} grau.${flat ? ` La ${degree[0]} al davant diu que aquest grau és un semitò ${degree[0] === 'b' ? 'més baix' : 'més alt'} que a ${noteCa(tonic)} major.` : ''} La fonamental és ${noteCa(target.root)}.`,
    `Apila terceres dins de l'escala, saltant una nota cada cop: ${list(spellChord(target))}.`,
    `Mesura-ho des de ${noteCa(target.root)}: ${qualityWords(target)}. És un acord ${target.def.nameCa}: ${chordSymbol(target)}.`,
    `La xifra ja ho deia: ${/^[b#]*[iv]/.test(target.roman) ? 'en minúscula, acord menor o disminuït' : 'en majúscula, acord major'}.`,
  ];
}

export function progressionSteps(tonic: Note, s: ScaleDef, prog: DiatonicChord[]): string[] {
  const used = new Map<number, Note>();
  for (const c of prog) for (const n of spellChord(c)) used.set(pc(n), n);
  const ordered = [...used.values()].sort((a, b) => mod(pc(a) - pc(tonic), 12) - mod(pc(b) - pc(tonic), 12));
  const rivals = MAJOR_MODES.filter((m) => m.id !== s.id && isMinorScale(m) === isMinorScale(s)).map((m) => {
    const bad = prog.find((c) => !chordFitsScale(c, tonic, m));
    if (!bad) return null;
    const pcs = scaleNotes(tonic, m).map(pc);
    const note = spellChord(bad).find((n) => !pcs.includes(pc(n)))!;
    return `${m.nameCa} no, perquè ${chordSymbol(bad)} demana ${noteCa(note)}`;
  }).filter((x): x is string => !!x);
  return [
    `L'acord de tònica és ${chordSymbol(prog[0])}, ${isMinorScale(s) ? 'menor' : 'major'}: el mode és de la família ${isMinorScale(s) ? 'menor' : 'major'}.`,
    `Desplega cada acord: ${prog.map((c) => `${chordSymbol(c)} = ${list(spellChord(c))}`).join('; ')}.`,
    `Ajunta totes les notes i ordena-les des de ${noteCa(tonic)}: ${list(ordered)}.`,
    `Busca el mode que les conté totes. ${rivals.length ? `${cap(and(rivals))}.` : ''} Només queda ${noteCa(tonic)} ${s.nameCa} (${list(scaleNotes(tonic, s))}).`,
  ];
}

export function chordNotesSteps(ch: Chord): string[] {
  const notes = spellChord(ch);
  return [
    `Pren ${noteCa(ch.root)} com a tònica i mesura la distància fins a cada nota: ${notes.slice(1).map((n, i) => `${noteCa(n)} és la ${DEGREE_NAME[ch.def.formula[i + 1]]}`).join('; ')}.`,
    `Escriu-ho com a fórmula: ${ch.def.formula.join(' ')}.`,
    `Llegeix la fórmula per parts: ${qualityWords(ch)}${ch.def.formula.some((d) => ['2', '4'].includes(d)) ? '; la 2a o la 4a ocupa el lloc de la 3a, per això és suspès' : ''}${ch.def.formula.some((d) => /9|11|13/.test(d)) ? `; a sobre hi ha ${and(ch.def.formula.filter((d) => /9|11|13/.test(d)).map((d) => `la ${DEGREE_NAME[d]}`))}` : ''}.`,
    `Aquesta combinació és l'acord ${ch.def.nameCa}: ${chordSymbol(ch)}.`,
  ];
}

const stringName = (s: number): string => `${6 - s}a corda`;

export function diagramSteps(ch: Chord, voicing: Voicing): string[] {
  const tones = spellChord(ch);
  const sounded = voicing.map((f, s) => (f === null ? null : { s, f, i: tones.findIndex((n) => pc(n) === mod(fretMidi(s, f), 12)) }))
    .filter((x): x is { s: number; f: number; i: number } => !!x);
  const present = [...new Set(sounded.map((x) => ch.def.formula[x.i]))];
  const missing = ch.def.formula.filter((d) => !present.includes(d));
  return [
    `Anomena cada nota de greu a agut: ${sounded.map((x) => `${stringName(x.s)}, ${x.f === 0 ? 'a l\'aire' : `trast ${x.f}`}: ${noteCa(tones[x.i])}`).join('; ')}.`,
    `Mesura cada nota des de ${noteCa(ch.root)}: ${sounded.map((x) => `${noteCa(tones[x.i])} = ${DEGREE_NAME[ch.def.formula[x.i]]}`).filter((v, i, a) => a.indexOf(v) === i).join('; ')}.`,
    `Graus presents: ${present.join(' ')}.${missing.length ? ` Hi falta ${and(missing.map((d) => `la ${DEGREE_NAME[d]}`))}: a la guitarra sovint s'omet alguna nota i l'acord es reconeix igualment.` : ''}`,
    `La fórmula completa de l'acord ${ch.def.nameCa} és ${ch.def.formula.join(' ')}: ${chordSymbol(ch)}.`,
  ];
}

export function missingSteps(ch: Chord, hole: number): string[] {
  const notes = spellChord(ch);
  const d = ch.def.formula[hole];
  return [
    `La fórmula de l'acord ${ch.def.nameCa} és ${ch.def.formula.join(' ')}: ${ch.def.formula.map((x) => DEGREE_NAME[x]).join(', ')}.`,
    `Posa-hi notes des de ${noteCa(ch.root)}: ${notes.map((n, i) => `${ch.def.formula[i]} = ${i === hole ? '?' : noteCa(n)}`).join(', ')}.`,
    `Falta el grau ${d}, la ${DEGREE_NAME[d]}. Compta ${parseInt(d.replace(/\D/g, ''), 10)} lletres des de ${noteCa(ch.root)} i ajusta l'alteració: ${noteCa(notes[hole])}.`,
  ];
}

export function spreadSteps(ch: Chord, inversion: number, pos: FretPos[]): string[] {
  const tones = spellChord(ch);
  const names = pos.map((p) => tones.find((n) => pc(n) === mod(fretMidi(p.string, p.fret), 12))!);
  const role = ['la tònica', 'la 3a', 'la 5a'];
  const idx = (n: Note) => tones.findIndex((t) => sameNote(t, n));
  return [
    `Anomena les tres notes de greu a agut: ${pos.map((p, i) => `${stringName(p.string)}, trast ${p.fret}: ${noteCa(names[i])}`).join('; ')}.`,
    `Ordena-les per terceres fins que encaixin: ${list(tones)}. Això és ${chordSymbol(ch)}, un acord ${ch.def.nameCa}.`,
    `Mira quina és la més greu: ${noteCa(names[0])}, ${role[idx(names[0])]} de l'acord. Per tant és ${['l\'estat fonamental', 'la 1a inversió', 'la 2a inversió'][inversion]}.`,
    `En una tríada tancada, per sobre de ${noteCa(names[0])} vindrien ${noteCa(names[2])} i ${noteCa(names[1])} seguides. Aquí ${noteCa(names[2])} ha pujat una octava i ha quedat a dalt: per això les notes estan tan separades.`,
  ];
}

export function romanSeqSteps(tonic: Note, prog: DiatonicChord[]): string[] {
  const major = scaleNotes(tonic, getScale('ionian'));
  return [
    `La referència és sempre l'escala major del centre: ${noteCa(tonic)} major = ${major.map((n, i) => `${noteCa(n)} (${i + 1})`).join(', ')}.`,
    ...prog.map((c) => {
      const d = degreeName(intervalBetween(tonic, c.root));
      const n = Number(d.replace(/\D/g, ''));
      const acc = d.replace(/\d/g, '');
      const where = acc ? `un semitò ${acc === 'b' ? 'per sota' : 'per sobre'} del ${ORDINALS[n - 1]} grau (${noteCa(major[n - 1])}): porta ${acc}` : `el ${ORDINALS[n - 1]} grau`;
      const kase = /^[b#]*[iv]/.test(c.roman) ? 'minúscula' : 'majúscula';
      return `${chordSymbol(c)}: la fonamental ${noteCa(c.root)} és ${where}. L'acord és ${c.def.nameCa}, o sigui ${kase}: ${c.roman}.`;
    }),
    `Tot junt: ${prog.map((c) => c.roman).join(' – ')}.`,
  ];
}

export function borrowedSteps(tonic: Note, borrowed: DiatonicChord, donors: ScaleDef[]): string[] {
  const major = scaleNotes(tonic, getScale('ionian'));
  const foreign = spellChord(borrowed).filter((n) => !major.some((x) => pc(x) === pc(n)));
  return [
    `${noteCa(tonic)} major té aquestes notes: ${list(major)}.`,
    `${chordSymbol(borrowed)} = ${list(spellChord(borrowed))}. ${and(foreign.map(noteCa))} no ${foreign.length > 1 ? 'són' : 'és'} a l'escala: l'acord ve de fora.`,
    `Un mode paral·lel té la mateixa tònica i altres notes. Mira quins contenen l'acord sencer: ${donors.map((m) => `${m.nameCa} (${list(scaleNotes(tonic, m))}): ${chordFitsScale(borrowed, tonic, m) ? 'sí' : 'no'}`).join('; ')}.`,
    `Agafar un acord d'un mode paral·lel se'n diu intercanvi modal: la tònica no es mou, però el color canvia un moment.`,
  ];
}

export function secDomSteps(tonic: Note, target: DiatonicChord, dom: Chord): string[] {
  const major = scaleNotes(tonic, getScale('ionian'));
  const foreign = spellChord(dom).filter((n) => !major.some((x) => pc(x) === pc(n)));
  return [
    `V7/${target.roman} vol dir "el dominant de ${target.roman}". L'acord de destí és ${target.roman} = ${chordSymbol(target)}.`,
    `Un dominant és sempre una 5a justa per sobre de l'acord on resol. Una 5a justa per sobre de ${noteCa(target.root)} és ${noteCa(dom.root)}.`,
    `Sobre ${noteCa(dom.root)}, construeix un acord de 7a de dominant (1 3 5 b7): ${list(spellChord(dom))}.`,
    foreign.length
      ? `${and(foreign.map(noteCa))} no ${foreign.length > 1 ? 'són' : 'és'} a ${noteCa(tonic)} major. Aquesta nota de fora és la que empeny cap a ${chordSymbol(target)}.`
      : `Totes les notes són a ${noteCa(tonic)} major: el dominant de ${target.roman} coincideix amb un acord de la tonalitat.`,
  ];
}

export function meterSteps(groups: number[], label: string, byEar = false): string[] {
  const total = groups.reduce((a, b) => a + b, 0);
  const allTwos = groups.every((g) => g === 2);
  return [
    byEar ? `Compta els clics des d'un accent fort fins al següent: ${total} corxeres.` : `Compta les corxeres del compàs: ${total}.`,
    byEar
      ? `Escolta on cauen els accents més suaus: parteixen el compàs en grups de ${groups.join(' + ')}. Cada grup és un temps.`
      : `Mira com les agrupen les barres: ${groups.join(' + ')}. Cada grup és un temps.`,
    allTwos
      ? `Tots els grups són de dues corxeres, i dues corxeres fan una negra. Hi ha ${groups.length} temps de negra: ${label}.`
      : `Hi ha grups de tres corxeres, i llavors el compàs es compta en corxeres: ${total} corxeres, ${label}.`,
    allTwos
      ? 'Si les mateixes corxeres anessin agrupades de tres en tres, el denominador seria 8.'
      : groups.every((g) => g === 3)
        ? 'Tots els grups són iguals (de tres): és un compàs compost, regular.'
        : 'Els grups són desiguals (de dues i de tres): és un compàs irregular.',
  ];
}

export function accentSteps(groups: number[]): string[] {
  let at = 1;
  const lines = groups.map((g, i) => {
    const s = `el grup ${i + 1} (${g} corxeres) comença a la corxera ${at}`;
    at += g;
    return s;
  });
  return [
    'L\'accent cau a la primera corxera de cada grup.',
    `Suma la mida dels grups anteriors i afegeix-hi 1: ${lines.join('; ')}.`,
    `Compta-ho en veu alta reiniciant a cada grup: «${groups.map((g) => Array.from({ length: g }, (_, i) => i + 1).join(' ')).join(' · ')}». Cada 1 és un accent.`,
  ];
}

export const earSteps = (tonic: Note, s: ScaleDef): string[] => [
  `Primer escolta la 3a nota: aquí és ${isMinorScale(s) ? 'menor' : 'major'}. Això ja descarta la meitat dels modes.`,
  `Després busca la nota que sona diferent de l'escala ${reference(s).name} de sempre: és la ${degreeCa(s.characteristic)}, ${noteCa(characteristicNote(tonic, s))}.`,
  `Era ${noteCa(tonic)} ${s.nameCa}: ${list(scaleNotes(tonic, s))}.`,
];
