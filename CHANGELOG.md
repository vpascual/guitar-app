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

## 0.3.0 — progress, sound, chord notation

- New "Progrés" screen: weekly rhythm, mastery map of 68 concepts by weak area, rating per skill, tempo history per exercise.
- Feed: rating change shown after each answer; "setmana: N/7" next to the daily counter.
- Practice: each rated block says what the rating did to its tempo and flags a new best clean tempo.
- Sound engine rewritten around a plucked-string model with body tone, room and limiter; new metronome click and bell.
- Chord symbols in American notation.
- Checks: 99 unit tests, end-to-end run with 22 assertions.

## 0.4.0 — Apple look

- Restyled after Apple's Human Interface Guidelines: system type and colours, light and dark appearance, bottom tab bar,
  grouped surfaces, iOS switches, options sheet with a grabber, safe-area handling.

## 0.5.0 — sync between devices

- Optional background sync through Supabase, protected by a per-user sync key instead of a login (`supabase/schema.sql`).
- Options sheet: turn sync on, copy the key, connect a second device, sync now, turn it off.
- Daily counter and weekly rhythm now include puzzles solved on other devices.
- Checks: 105 unit tests, including two simulated devices converging through a fake server.

## 0.6.0 — home screen

- New Inici tab and opening screen: weekly rhythm, key figures, a menu of where to start, and a generated quick tip
  with diagram, listen button and a shortcut to a puzzle on the same concept.
- Puzzles moved to `#/teoria`; the tab bar has four sections.
- Checks: 107 unit tests, end-to-end run with 30 assertions.

## 0.7.0 — worked solutions, "No ho sé" and a theory section

- Step-by-step solution under every answer, generated for the exact puzzle.
- "No ho sé" button next to the hint: shows the answer and the solution and leads to the theory topic.
- New Teoria section with 36 topics; examples in any key, with diagrams, tables and sound.
- Hints and explanations link to the matching topic. The puzzle tab is renamed Reptes.
- Checks: 109 unit tests, end-to-end run with 37 assertions.
