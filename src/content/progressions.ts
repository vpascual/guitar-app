// Progression library for practice sessions. Chords are derived from the mode by the theory core;
// only degrees, keys, commentary and song examples are stored here. No I-IV-V or ii-V-I.

export interface SongExample {
  title: string;
  artist: string;
  /** 'segura' = widely documented; 'discutida' = the modal reading is debated. */
  confidence: 'segura' | 'discutida';
  note?: string;
}

export interface ProgressionDef {
  id: string;
  /** Scale id of the mode the progression comes from. */
  scaleId: string;
  tonic: string;
  /** 0-based diatonic degrees. */
  degrees: number[];
  sevenths?: boolean;
  whyCa: string;
  songs: SongExample[];
  bookConcept: string;
}

export const PROGRESSIONS: ProgressionDef[] = [
  {
    id: 'dor-i-IV', scaleId: 'dorian', tonic: 'A', degrees: [0, 3],
    whyCa: 'Un acord major sobre el 4t grau d\'un to menor. La seva 3a és la 6a major del mode: aclareix el menor sense deixar de ser menor.',
    songs: [
      { title: 'Oye como va', artist: 'Santana', confidence: 'segura', note: 'Lam7 – Re9 tota la cançó' },
      { title: 'Breathe', artist: 'Pink Floyd', confidence: 'segura', note: 'Mim – La' },
    ],
    bookConcept: 'modal-harmony-theory',
  },
  {
    id: 'dor-i-bIII-bVII-IV', scaleId: 'dorian', tonic: 'E', degrees: [0, 2, 6, 3],
    whyCa: 'Baixa per acords majors i acaba en el IV major, que porta la 6a major. El final queda obert, sense dominant que tanqui.',
    songs: [
      { title: 'Mad World', artist: 'Tears for Fears', confidence: 'segura', note: 'en Fa dòric' },
      { title: 'Wonderwall', artist: 'Oasis', confidence: 'segura', note: 'amb celleta al 2n trast' },
    ],
    bookConcept: 'modal-resolution-tendencies',
  },
  {
    id: 'dor-i-ii', scaleId: 'dorian', tonic: 'D', degrees: [0, 1], sevenths: true,
    whyCa: 'Dos acords menors a un to de distància. El segon conté la 6a major, i el vaivé no resol mai: és el so del jazz modal.',
    songs: [{ title: 'So What', artist: 'Miles Davis', confidence: 'segura', note: 'vamp en Re dòric' }],
    bookConcept: 'modal-harmony-theory',
  },
  {
    id: 'mix-I-bVII-IV', scaleId: 'mixolydian', tonic: 'D', degrees: [0, 6, 3],
    whyCa: 'El bVII major substitueix el dominant: la 7a bemoll treu la sensible i la progressió rodola en lloc de resoldre.',
    songs: [
      { title: 'Sweet Child o\' Mine', artist: 'Guns N\' Roses', confidence: 'segura', note: 'estrofa; afinada mig to avall' },
      { title: 'Sympathy for the Devil', artist: 'The Rolling Stones', confidence: 'segura', note: 'Mi – Re – La' },
      { title: 'Sweet Home Alabama', artist: 'Lynyrd Skynyrd', confidence: 'discutida', note: 'Re mixolidi o Sol major, segons qui escolta' },
    ],
    bookConcept: 'modal-harmony-theory',
  },
  {
    id: 'mix-I-IV-v-IV', scaleId: 'mixolydian', tonic: 'A', degrees: [0, 3, 4, 3],
    whyCa: 'El v és menor perquè la 7a del mode és bemoll. Sense sensible, el retorn a la tònica és tou i circular.',
    songs: [{ title: 'Louie Louie', artist: 'The Kingsmen', confidence: 'segura', note: 'La – Re – Mim – Re' }],
    bookConcept: 'modal-resolution-tendencies',
  },
  {
    id: 'mix-I-bVII', scaleId: 'mixolydian', tonic: 'E', degrees: [0, 6],
    whyCa: 'Tònica major i l\'acord major un to per sota. Dos acords n\'hi ha prou per fixar la 7a bemoll.',
    songs: [{ title: 'Tomorrow Never Knows', artist: 'The Beatles', confidence: 'segura', note: 'Do amb Si♭ a sobre' }],
    bookConcept: 'modal-harmony-theory',
  },
  {
    id: 'phr-i-bII', scaleId: 'phrygian', tonic: 'E', degrees: [0, 1],
    whyCa: 'L\'acord major a un semitò de la tònica. La 2a bemoll cau sobre la tònica des de dalt: fosc, tens, d\'aire flamenc.',
    songs: [
      { title: 'Wherever I May Roam', artist: 'Metallica', confidence: 'segura', note: 'riff en Mi frigi' },
      { title: 'Set the Controls for the Heart of the Sun', artist: 'Pink Floyd', confidence: 'segura' },
    ],
    bookConcept: 'modal-harmony-theory',
  },
  {
    id: 'phr-i-bII-bIII-bII', scaleId: 'phrygian', tonic: 'E', degrees: [0, 1, 2, 1],
    whyCa: 'Tres acords veïns que pugen i tornen. El bII pesa més que cap dominant: tot gravita un semitò per sobre de la tònica.',
    songs: [{ title: 'White Rabbit', artist: 'Jefferson Airplane', confidence: 'discutida', note: 'Fa♯ – Sol: tònica major, és frigi dominant' }],
    bookConcept: 'modal-resolution-tendencies',
  },
  {
    id: 'lyd-I-II', scaleId: 'lydian', tonic: 'F', degrees: [0, 1],
    whyCa: 'Dos acords majors a un to. El segon porta la 4a augmentada: l\'acord de tònica flota en lloc d\'assentar-se.',
    songs: [
      { title: 'Flying in a Blue Dream', artist: 'Joe Satriani', confidence: 'segura', note: 'Do lidi' },
      { title: 'Dreams', artist: 'Fleetwood Mac', confidence: 'discutida', note: 'Fa – Sol; també es pot sentir com IV – V de Do' },
    ],
    bookConcept: 'modal-harmony-theory',
  },
  {
    id: 'lyd-I-II-vii', scaleId: 'lydian', tonic: 'G', degrees: [0, 1, 6, 1],
    whyCa: 'El II major i el vii menor contenen tots dos la 4a augmentada. La tònica queda envoltada pel color lidi.',
    songs: [],
    bookConcept: 'modal-resolution-tendencies',
  },
  {
    id: 'aeo-i-bVII-bVI-bVII', scaleId: 'aeolian', tonic: 'A', degrees: [0, 6, 5, 6],
    whyCa: 'Baixada per tons sencers des de la tònica menor. El bVI porta la 6a bemoll i el v és menor: no hi ha dominant.',
    songs: [
      { title: 'All Along the Watchtower', artist: 'Bob Dylan / Jimi Hendrix', confidence: 'segura' },
      { title: 'Stairway to Heaven', artist: 'Led Zeppelin', confidence: 'segura', note: 'secció final: Lam – Sol – Fa' },
    ],
    bookConcept: 'natural-minor-harmonized',
  },
  {
    id: 'aeo-i-bVI-bIII-bVII', scaleId: 'aeolian', tonic: 'E', degrees: [0, 5, 2, 6],
    whyCa: 'Comença en menor i passa pels tres acords majors del mode. Sona èpic i trist alhora perquè mai no arriba un V major.',
    songs: [{ title: 'Zombie', artist: 'The Cranberries', confidence: 'segura', note: 'Mim – Do – Sol – Re' }],
    bookConcept: 'natural-minor-harmonized',
  },
  {
    id: 'loc-i-bII', scaleId: 'locrian', tonic: 'B', degrees: [0, 1], sevenths: true,
    whyCa: 'La tònica és un acord semidisminuït: la 5a bemoll li treu l\'estabilitat. El bII major estira cap avall i el centre sempre trontolla.',
    songs: [{ title: 'Army of Me', artist: 'Björk', confidence: 'segura', note: 'riff en locri' }],
    bookConcept: 'modal-harmony-theory',
  },
  {
    id: 'loc-i-bV-bII', scaleId: 'locrian', tonic: 'B', degrees: [0, 4, 1], sevenths: true,
    whyCa: 'El bV és a un tritò de la tònica. Passar-hi i tornar pel bII fa sentir les dues notes que defineixen el locri.',
    songs: [],
    bookConcept: 'modal-resolution-tendencies',
  },
];
