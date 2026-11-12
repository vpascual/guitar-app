// Catalan glossary: advanced terms are explained the first time they appear in the feed.
export const GLOSSARY: Record<string, string> = {
  mode: 'Mode: una escala que surt de començar una escala mare (per exemple la major) des d\'un altre grau. Mateixes notes, centre diferent, color diferent.',
  'nota característica': 'Nota característica: el grau que distingeix un mode del major o del menor natural. És la nota que fa sonar el mode com ell mateix.',
  'centre tonal': 'Centre tonal: la nota (i l\'acord) on la música descansa. En música modal mana més que no pas l\'armadura.',
  'escala mare': 'Escala mare: l\'escala de la qual surt un mode. Re dòric surt de Do major.',
  'xifra romana': 'Xifra romana: indica sobre quin grau de l\'escala es construeix un acord. Majúscula = major, minúscula = menor, ° = disminuït. Una b al davant vol dir que el grau és un semitò més baix que a l\'escala major.',
  semidisminuït: 'Semidisminuït (m7♭5): tríada disminuïda amb 7a menor.',
  'disminuït amb 7a disminuïda': 'Disminuït (°7): tres terceres menors apilades. La 7a és disminuïda (un to i mig per sota de la tònica).',
  suspès: 'Suspès (sus): la 3a se substitueix per la 2a o la 4a, i l\'acord no és ni major ni menor.',
  tensió: 'Tensió: nota afegida per damunt de la 7a (9a, 11a, 13a). Dona color sense canviar la funció de l\'acord.',
  'dominant alterat': 'Dominant alterat: acord de 7a de dominant amb la 5a o la 9a pujades o baixades un semitò.',
  'intercanvi modal': 'Intercanvi modal: agafar prestat un acord d\'un mode paral·lel (mateixa tònica, altres notes).',
  'tríada oberta': 'Tríada oberta: tríada amb la veu del mig pujada una octava, de manera que les tres notes queden repartides en més d\'una octava.',
  'compàs irregular': 'Compàs irregular: compàs amb temps de durada desigual, format per grups de 2 i de 3 corxeres (5/8, 7/8…).',
  'menor harmònica': 'Menor harmònica: menor natural amb la 7a major. Dona un V7 de veritat en to menor.',
  'menor melòdica': 'Menor melòdica: escala major amb la 3a menor (menor amb 6a i 7a majors).',
  corxera: 'Corxera: figura que val mig temps de negra.',
};

export const ORDINALS = ['1r', '2n', '3r', '4t', '5è', '6è', '7è'];

/** Catalan words for a scale degree, e.g. "b6" -> "6a bemoll". */
export function degreeCa(d: string): string {
  const m = /^([b#]*)(\d+)$/.exec(d)!;
  const acc = m[1] === '' ? '' : m[1] === 'b' ? ' bemoll' : m[1] === '#' ? ' augmentada' : m[1] === 'bb' ? ' disminuïda' : ` ${m[1]}`;
  return `${m[2]}a${acc}`;
}
