# DECISIONS

Newest last. Each entry: what was decided and why.

1. **Stack: Vite + React + TypeScript + vite-plugin-pwa, Vitest, ESLint, Playwright.** Boring, static, no server. The theory core imports nothing from React.
2. **No runtime dependencies besides React.** IndexedDB is wrapped by hand (about 90 lines) instead of adding `idb`; SVG notation is drawn by hand instead of adding VexFlow.
3. **The first puzzle renders before storage is read.** It is generated synchronously from default ratings; saved ratings apply from the second puzzle. This is what keeps load-to-puzzle far under 2 s.
4. **A failed puzzle returns as the same concept in a new key**, not as the identical puzzle, so the answer cannot be memorized. Ladder: after 3 puzzles, after 10, next day, three days.
5. **At most every other puzzle is a review.** Found in the end-to-end run: after a bad streak the feed served nothing but reviews.
6. **Catalan solfège for notes and chords** (Si♭m7); "bemoll", "sostingut" and "augmentada" in prose. Tab string labels stay `e B G D A E` as specified. Roman numerals keep a plain `b` (bVII), as in the brief.
7. **Roman numerals are always paired with the chord, except as answer options** in the Roman-analysis puzzle, where pairing would give the answer away. The explanation pairs them.
8. **Every puzzle carries a structured `truth`** and an independent solver (`src/puzzles/audit.ts`) decides which options are correct without reading the answer key. Exactly one option must be correct.
9. **Book references are stored per concept** (section, pages, first example number). Generators and practice blocks point at concept ids; a test fails if any id does not resolve.
10. **Odd meters ship without a book reference** (QUESTIONS.md Q4, default a): the book has no such material. The "more" link says so.
11. **Chord help.** Any puzzle or block that names chords offers SVG diagrams ("Com es toca?"). Voicings come from movable E- and A-shapes plus a small open-chord table; a test checks every voicing against the chord's spelling and a four-fret span.
12. **Listening is always opt-in.** A "listen" button plays scales, chords, progressions and accent patterns through a Web Audio synth; nothing sounds by itself and no puzzle needs it unless the audio filter is on.
13. **One new glossary term per puzzle**, so explanations stay readable in under 30 seconds.
14. **Songs are tagged `segura` or `discutida`**; debated modal readings are labelled as such in the session (QUESTIONS.md Q3).
15. **BPM rule:** two clean runs in a row raise the tempo by 4; a failed run lowers it by 8 and biases the next session towards that focus; the target moves up by 8 once reached.
16. **JSON Schema files are not generated.** The TypeScript types in `src/puzzles/types.ts`, `src/engine/session.ts` and `src/storage/repository.ts` are the schemas; generating JSON Schema needs an extra dependency and nothing consumes it yet.
17. **The PDF is never read at runtime or committed.** It lives in `./reference/` (gitignored); only `src/content/book-index.json` is committed.
