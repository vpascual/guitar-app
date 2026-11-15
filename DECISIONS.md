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
18. **Practice focuses cover all weak areas**, not only modes: 6 modes, 5 chord-type focuses (spread triads, sus, half-diminished/diminished, tensions, altered dominants) and 4 meters (3/4, 6/8, 5/4, 7/8). Every focus resolves to the same ingredients (scale, key, progression, meter), so one builder serves all.
19. **Focus choice** = puzzle failure rate for the focus's concepts + failed practice material + never-practised bonus − recency − weak-area order. The last three focuses are penalised so sessions rotate.
20. **Meter sessions borrow a dark modal progression** (aeolian, dorian or phrygian) from the library and play it in the meter; the metronome clicks every eighth (or quarter) with accents at group starts, and tabs mark accents with `>` instead of pick direction.
21. **The borrowed-chord puzzle asks "which of these modes contains the chord"**, not "where does it come from": many borrowed chords belong to several parallel modes, and the explanation lists the others.
22. **Spread-triad puzzles skip chords spelled with Fa♭, Do♭, Mi♯ or Si♯.**
23. **Answer options go in two columns when all labels are short**, so the fretboard or diagram is not covered on a phone.
24. **`?g=<generator>&seed=&level=` pins the first puzzle.** Used by `npm run shots` for visual audits; harmless otherwise.
25. **JS bundle is 90 kB gzip against my own 80 kB budget.** Load-to-puzzle is 150 ms cold and 50 ms offline in headless Chromium, so I did not trade React for something smaller.
26. **Gamification shows progress; it does not reward volume.** Built: a mastery map of 68 concepts (new / learning / solid), the rating change after every answer, a weekly rhythm ("4 of 7 days") and tempo history with the best clean tempo. Not built, on purpose: daily streaks with loss, XP, badges, levels, notifications. The brief rules out streak guilt and decorative XP, and those mechanics reward tapping easy puzzles.
27. **A concept is solid after three right answers in a row with no repeat pending**; one miss returns it to learning. The map shows what needs work now, not lifetime totals. It is recomputed from the attempt log, so the rule can change without migrating data.
28. **The week runs Monday to Sunday and a missed day costs nothing.** Only days with at least one solved puzzle count, matching the success criterion.
29. **Chord symbols use American letters (Am7, B♭, F♯m7♭5); note names, keys and scale names stay in Catalan solfège** ("La dòric: i = Am, IV = D"). The request was for chords only.
30. **Sound: Karplus-Strong plucked strings** rendered into buffers, with body EQ, a short generated room reverb and a limiter; strums alternate down and up; the metronome is a short sine knock and the bell a soft chime. Still no downloaded samples, so it works offline. Pitch, level and decay are unit tested; how it sounds is not something a test can judge.
31. **The interface follows Apple's Human Interface Guidelines.** System font and text styles (Large Title on Pràctica and Progrés, 17 px body), semantic system colours with light and dark appearances that follow the device, grouped inset surfaces, a translucent bottom tab bar (Teoria, Pràctica, Progrés) replacing the text links, iOS switches and a sheet with a grabber for options, 44 pt minimum touch targets, safe-area insets, reduced motion respected. The tint is system blue; orange marks tonics on the fretboard. Status colours use tinted fills with coloured text instead of solid blocks.
32. **The app is no longer dark-only.** It follows the device appearance; there is no in-app theme switch.
33. **Sync through Supabase, local first.** IndexedDB stays what the screens read, so the first puzzle and offline use are unchanged; a sync engine copies documents to one Supabase table in the background. No `supabase-js` dependency: plain `fetch` against the REST endpoint.
34. **No login screen, but not unprotected.** The app's Supabase key is public by design, so without protection anyone with the address could read or overwrite the data. Each device holds a random sync key (28 characters), created on the first device and pasted once on the second. Row-level security only exposes rows whose owner is the SHA-256 of the key sent with the request. This is the lightest protection that is still real.
35. **What syncs:** puzzle and practice attempts (append-only, deduplicated by a unique id), sessions, feed state (ratings and review queue) and tempo state, the last three with last-write-wins and unsent local changes taking priority. **What does not:** per-device settings (audio filter, seen glossary terms) and open counts.
36. **The daily counter and weekly rhythm are computed from the attempt log**, which syncs, so puzzles solved on the phone count on the desktop.
37. **The old tables in the `guitar-lab` Supabase project were left in place.** They hold 20 exercises and 56 book-progress rows from an earlier project; the sync table sits next to them. Deleting them is the owner's call.
