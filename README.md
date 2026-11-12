# Guitarra: teoria i pràctica

Personal PWA for guitar theory puzzles (phone) and practice sessions (tablet or laptop). UI in Catalan.

```bash
npm install
npm run dev        # development server
npm run verify     # typecheck, lint, unit tests, build, headless end-to-end checks
npm run preview    # serve the production build on http://localhost:4173
```

- `PLAN.md` — plan, book index summary, backlog status
- `DECISIONS.md`, `CHANGELOG.md`, `QUESTIONS.md`
- `src/theory` — pure music-theory core; `src/puzzles` — generators and the independent audit solver;
  `src/engine` — Elo, feed scheduler, session builder; `src/storage` — repository interface and IndexedDB

The book PDF belongs in `./reference/` (gitignored). Only `src/content/book-index.json` is committed.
