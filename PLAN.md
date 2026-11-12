# PLAN — Guitar theory & practice app

Status: **awaiting approval** (Phase 0 gate). Nothing but this plan and `.gitignore` exists yet.

## 0. Blockers found before planning

| # | Blocker | Impact | Needs |
|---|---------|--------|-------|
| B1 | `./reference/beato-book-4.pdf` is **not in this environment**. The repo was empty and the PDF is (correctly) never committed, so a cloud session cannot see it. | The book index (section 1) cannot be built. Page/example numbers cannot be invented. | You supply the PDF to the session (see QUESTIONS.md Q1). |
| B2 | A PWA only installs and works offline from an **HTTPS origin**. "Deployment" is out of scope without approval. | Without static hosting, Mode 1 cannot reach your phone's home screen at all. | A yes/no on static hosting (QUESTIONS.md Q2). |

Neither blocks writing code. B1 blocks real references; B2 blocks real-world use of Mode 1.

## 1. Book index (weak areas only)

**Not built — see B1.** What is fixed now is the method and the shape.

Method once the PDF is available:
1. `pdftotext -layout` per page into the scratchpad (never into the repo).
2. Parse the table of contents; compute the offset between printed page and PDF page.
3. Keyword pass per weak area (modes, spread/open triads, sus/add/extended/altered chords, m7b5, dim7,
   harmonic and melodic minor and their modes, odd meters, modal/functional harmony).
4. Record chapter > concept > example number > page. Titles and numbers only, no book text, no tab.
5. Spot-check 20 random entries against the rendered page; fix the offset if any miss.
6. Commit `src/content/book-index.json` (references only), so later sessions do not need the PDF.

Shape:

```jsonc
{
  "book": "The Beato Book 4.0",
  "pageOffset": 0,                // pdfPage - printedPage
  "chapters": [{
    "id": "ch-modes", "title": "…", "pageStart": 0, "pageEnd": 0,
    "weakArea": "modes",          // one of the six areas
    "concepts": [{
      "id": "dorian-characteristic-note", "title": "…",
      "refs": [{ "example": "…", "page": 0 }]
    }]
  }]
}
```

Until the index exists, content points at a `conceptId` and the reference renders as
"referència pendent". No generator ships to the feed as "done" without a resolved reference.

## 2. Stack proposal

**Vite + React 18 + TypeScript + vite-plugin-pwa (Workbox), Vitest, ESLint, Playwright for the load-time check.**
Boring and well supported; a static bundle with no server, so it runs fully offline and hosts anywhere.
The theory core is plain TypeScript with no React import, so the framework stays replaceable.

- Storage: IndexedDB through the small `idb` wrapper (about 1 kB), behind a repository interface.
- Routing: none as a library. Two screens (`/` feed, `/practica`) switched by a hash; the feed is the root.
- Styling: plain CSS with custom properties. No UI kit.
- Notation: own small SVG renderers (fretboard, chord diagram, rhythm line). No VexFlow (heavy dependency).
- Audio: Web Audio API directly (metronome scheduler with lookahead, plucked-string synth for notes/chords). No samples.

Budget: initial JS under 80 kB gzip; first puzzle rendered from cached shell in under 1 s on a mid-range phone
(target is 2 s). The first puzzle is generated synchronously and does not wait for IndexedDB;
ratings load afterwards and affect puzzle two onwards.

## 3. Architecture

```
src/
  theory/      pure TS: note, interval, scale, mode, chord, roman, meter, fretboard, voicing
  content/     JSON: book-index, concepts, progressions, block templates
  puzzles/     generators (pure functions of seed + difficulty), registry, checker
  engine/      elo, spaced repetition queue, feed scheduler, session builder, bpm progression
  storage/     Repository interface, IndexedDbRepository, InMemoryRepository (tests)
  audio/       metronome, synth, timer bell
  ui/          components: Fretboard, ChordDiagram, Tab, RhythmLine, Metronome, Timer, …
  screens/     Feed, Practice
  i18n/        ca.ts (all user-facing strings, note names, glossary of advanced terms)
```

Rules: `theory/` imports nothing; `puzzles/` and `engine/` import `theory/` only; `ui/` never touches IndexedDB directly.

## 4. Data schemas

TypeScript types are the source of truth; JSON Schemas are generated from them and validated in tests.

```ts
type SkillArea = 'modes' | 'chords' | 'harmony' | 'rhythm';
type WeakArea  = 'modes' | 'spread-triads' | 'chord-types' | 'scales' | 'odd-meters' | 'harmony';

interface BookReference { chapterId: string; conceptId: string; example?: string; page?: number; }

interface Concept {
  id: string; weakArea: WeakArea; skill: SkillArea;
  titleCa: string; glossaryCa?: string;          // shown the first time the term appears
  refs: BookReference[];
}

interface PuzzleGenerator {                       // registry entry; the function lives in code
  id: string; conceptIds: string[]; skill: SkillArea;
  kind: 'choice' | 'fretboard-tap';
  requiresAudio: boolean;                         // true => only with the audio filter on
  difficultyRange: [number, number];              // Elo-scale
  paramSpace: Record<string, unknown>;            // keys, modes, chord types it may draw from
}

interface Puzzle {                                // fully determined by generatorId + seed + difficulty
  id: string; generatorId: string; seed: number; difficulty: number;
  conceptId: string; skill: SkillArea;
  promptCa: string;
  visual?: { type: 'fretboard' | 'chord-diagram' | 'rhythm' | 'notes'; data: unknown };
  answer: { type: 'choice'; options: string[]; correctIndex: number }
        | { type: 'fretboard-tap'; accept: { string: number; fret: number }[] };
  hintCa?: string; explanationCa: string; ref: BookReference;
}

interface Attempt {
  id: string; at: number;                         // epoch ms
  kind: 'puzzle' | 'block';
  puzzle?: { generatorId: string; seed: number; conceptId: string; skill: SkillArea;
             correct: boolean; ms: number; usedHint: boolean; ratingBefore: number; ratingAfter: number };
  block?:  { sessionId: string; blockId: string; materialId: string;
             result: 'clean' | 'sloppy' | 'failed'; bpm: number };
}

interface PracticeBlock {
  id: string; phase: 'warmup' | 'technique' | 'chords' | 'integration';
  goalCa: string; minutes: number; materialId: string;
  meter: { beats: number; unit: 4 | 8; accents: number[] };
  startBpm: number; targetBpm: number;
  tab?: { lines: string[]; tipCa: string };       // original material, six labeled strings
  diagrams?: { name: string; frets: (number | 'x')[]; barre?: { fret: number; from: number; to: number } }[];
  chordTones?: { chord: string; roman: string; bestNotes: string[] }[];   // integration block
  detailCa: string; refs: BookReference[];
}

interface Session {
  id: string; createdAt: number; minutes: 30 | 45 | 60;
  focus: { type: 'mode' | 'chord-type' | 'meter'; id: string; key: string };
  progressionId: string; blocks: PracticeBlock[];
  status: 'planned' | 'in-progress' | 'completed' | 'abandoned';
}

interface Repository {                            // IndexedDB now, Supabase-shaped later
  getRatings(): Promise<Record<SkillArea, number>>;
  saveRating(skill: SkillArea, rating: number): Promise<void>;
  addAttempt(a: Attempt): Promise<void>;
  listAttempts(q: { since?: number; kind?: Attempt['kind'] }): Promise<Attempt[]>;
  getReviewQueue(): Promise<ReviewItem[]>; putReviewItem(i: ReviewItem): Promise<void>;
  saveSession(s: Session): Promise<void>; listSessions(): Promise<Session[]>;
  getMaterialState(id: string): Promise<MaterialState | undefined>;      // bpm, last results
  putMaterialState(m: MaterialState): Promise<void>;
  exportAll(): Promise<unknown>; importAll(dump: unknown): Promise<void>;
}
```

## 5. Mode 1 — puzzle generators

All are pure functions `(seed, difficulty) => Puzzle`. The audit re-derives every answer from `theory/`.

| Id | Puzzle | Input | Skill | Phase |
|----|--------|-------|-------|-------|
| G1 | Name the mode from its characteristic note (e.g. "major scale with #4") | choice | modes | MVP |
| G2 | Name the mode from a set of notes / a fretboard pattern | choice | modes | MVP |
| G3 | Tap the characteristic note of mode X in key Y | fretboard tap | modes | MVP |
| G4 | Chord for a Roman numeral in a mode ("bVII in Re dòric = ?") | choice | modes | MVP |
| G5 | Which mode does this progression belong to | choice | modes | MVP |
| G6 | Identify a chord from notes | choice | chords | 2 |
| G7 | Identify a chord from an SVG diagram | choice | chords | 2 |
| G8 | Spell a chord (pick the missing note / tap it) | choice, tap | chords | 2 |
| G9 | Roman numeral analysis of a progression | choice | harmony | 2 |
| G10 | Identify a meter from a rhythm line | choice | rhythm | 2 |
| G11 | Parent scale / mode of harmonic and melodic minor | choice | modes | 2 |
| G12 | Spread triad: name it, or tap the missing voice on a string set | choice, tap | chords | 2 |
| A1 | Meter by listening | choice | rhythm | audio filter |
| A2 | Mode by listening (drone + phrase) | choice | modes | audio filter |

Distractors are generated from near-miss theory (neighbour modes, enharmonic traps, chord with one note changed)
and always checked so that exactly one option is correct.

Feed mechanics:
- **Elo**: each skill starts at 1000; each puzzle carries a difficulty from its parameters (key signature size,
  mode rarity, number of options, hint used). K = 32 for the first 20 attempts in a skill, then 16.
  The scheduler draws difficulty near rating + 50, so the expected success rate sits around 70 %.
- **Spaced repetition**: a failed puzzle re-enters the feed after 3 puzzles, then 10, then next day, then 3 days.
  The repeat is the **same concept in a different key**, not the identical puzzle, so the answer cannot be memorized.
- **Mix**: 70 % weakest-rating skill among enabled generators, 30 % others; due reviews take priority.
- **Counter**: "avui: N" in a corner. No streaks, no notifications.
- **Metric**: opens and opens-with-at-least-one-solve per day, stored locally, shown on a small stats sheet.

## 6. Mode 2 — practice sessions

Block minutes by duration:

| Phase | 30 | 45 | 60 |
|-------|----|----|----|
| Warm-up | 4 | 6 | 8 |
| Technique (scale / arpeggio of the focus) | 10 | 14 | 18 |
| Chords and theory (the progression, voicings) | 9 | 13 | 17 |
| Integration (improvise over the progression) | 7 | 12 | 17 |

- **Focus selection**: weak-area priority weighted by low puzzle rating for the matching skill; MVP offers modes only.
- **Progression library** (`content/progressions.json`): each entry has mode or scale of origin, why it sounds the
  way it does, known songs, Roman numerals paired with real chords, and a `usedInSessionIds` check so no
  progression repeats until the library for that focus is exhausted. No I-IV-V, no ii-V-I.
  Song attributions will be marked as needing your confirmation; I will not present uncertain ones as fact.
- **BPM progression** per material: two consecutive `clean` => start BPM +4 (capped at target, then target +4);
  `sloppy` => hold; `failed` => −8 and the material is scheduled into the next session's technique block.
- **Block UI**: goal, duration badge, collapsible detail, tab and/or diagrams, metronome with accent pattern,
  countdown with a bell, then clean / sloppy / failed.
- **Integration block**: per chord, the chord tones plus the characteristic mode note to aim at, and the note to avoid resting on.
- **v2 proposal (not built)**: microphone pitch/onset detection to grade timing and correct notes automatically.

## 7. Display conventions (enforced by tests where possible)

- UI and explanations in Catalan. Notes: Do Re Mi Fa Sol La Si, "bemoll" / "sostingut". Chords: Sol, Rem7, La7sus4.
- Advanced term explained the first time it appears (glossary flag stored per term).
- Roman numerals always rendered through one helper that outputs `bVII = Sol`; a lint test rejects bare numerals in content.
- Chord diagram: SVG, nut on top, 6 strings, 4 frets, × and ○ above, numeric line below (`x 0 2 2 1 0`), barre as rounded rect.
- Tab: monospace, six lines labeled `e B G D A E`, picking marks where relevant, a practical tip after each tab.

## 8. MVP scope (Phase 1)

In: theory core (notes, intervals, scales, the seven modes, diatonic chords per mode, Roman mapping, fretboard),
generators G1–G5, feed with Elo + review queue + daily counter, IndexedDB repository, PWA shell with icon and
offline cache, one mode-focused session template for 30/45/60, six modal progressions, metronome, timers, block rating.

Out: audio puzzles, chord/harmony/rhythm generators, stats sheet, backup export, visual polish.

## 9. Backlog (priority: friction > correctness > coverage > practice quality > polish)

1. Load-time check in CI script: headless mobile viewport, time to first puzzle, fail above 2 s. *(friction)*
2. One-thumb audit: all targets at least 48 px and in the lower 60 % of the screen; "next" under the thumb. *(friction)*
3. Offline audit: second load with network disabled. *(friction)*
4. 50-puzzle audit script against the theory core, plus single-correct-answer check on distractors. *(correctness)*
5. Book index and reference resolution — **blocked by B1**. *(correctness)*
6. G12 spread triads + practice focus "spread triads". *(coverage, weak area 2)*
7. G6–G8 chord types beyond 7ths + practice focus per chord type. *(coverage, 3)*
8. G11 harmonic / melodic minor and their modes; theory core extension. *(coverage, 4)*
9. G10 meters from a rhythm line + practice focus per odd meter with accent patterns. *(coverage, 5)*
10. G9 Roman numeral analysis, modal interchange. *(coverage, 6)*
11. Audio filter: A1, A2, chord/note playback in explanations. *(coverage)*
12. BPM history view per material; failed material resurfacing. *(practice)*
13. Progression library to 20+ entries across all focuses. *(practice)*
14. JSON export / import backup. *(practice, data safety)*
15. Stats sheet: opens, opens with a solve, rating per skill. *(polish)*
16. Visual pass: typography, dark theme, transitions under 150 ms. *(polish)*

## 10. Decisions already taken (will move to DECISIONS.md)

- Reviews repeat the concept in a new key, not the identical puzzle.
- First puzzle renders before storage is read.
- No notation or UI libraries; own SVG.
- Catalan solfège names for notes and chords; tab string labels stay `e B G D A E` as specified.
- No page numbers are ever written from memory; unresolved references are shown as pending.
