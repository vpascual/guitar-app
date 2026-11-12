# CHANGELOG

## 0.1.0 — MVP and first iterations

- Book index for the six weak areas (`src/content/book-index.json`), 76 sections.
- Theory core: notes, intervals, 21 scales and modes (major, melodic minor, harmonic minor) derived by rotation,
  26 chord types, diatonic harmony, Roman numerals, fretboard, chord voicings, scale positions, meters.
- Puzzle feed: 19 generators across modes, chords, harmony and rhythm (2 of them audio, opt-in), Elo rating per
  skill, spaced repetition, daily counter, hints, explanations, glossary, book references.
- Chord diagrams under "Com es toca?" and an optional "listen" button for scales, chords, progressions and meters.
- Practice sessions of 30/45/60 minutes around one mode: warm-up, technique, chords, integration; generated tabs,
  chord diagrams, metronome with accents, block timers with a bell, clean/sloppy/failed rating that drives BPM.
- 14 modal progressions with origin, reason and song examples; no repeats until a mode's list is used up.
- IndexedDB behind a repository interface; installable PWA, works offline.
- Checks: typecheck, lint, 89 unit tests, production build, headless end-to-end run at a phone viewport.

## 0.2.0 — coverage of all weak areas

- Practice sessions for chord types (spread triads, sus, half-diminished and diminished, tensions, altered dominants)
  and meters (3/4, 6/8, 5/4, 7/8) in addition to the six modes; accented metronome and accent marks in tabs.
- 5 chord-focus progressions and per-meter song examples.
- Feed: reviews capped at every other puzzle; one new glossary term per puzzle; two-column answers; string names
  under the fretboard; backup export and import.
- Fixes found by the audits: endless loop in the borrowed-chord generator, misleading borrowed-chord wording,
  feminine scale names ("L'escala menor harmònica"), clipped fret label in chord diagrams, add9 voicing wider than four frets.
- Checks: 91 unit tests, end-to-end run with 15 assertions.
