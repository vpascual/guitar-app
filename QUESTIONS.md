# QUESTIONS

## Q1 — The book PDF is in the repository's git history
You uploaded the PDF to `main` (commit a26899c). This branch deletes it from the tree and keeps a local copy in
`./reference/` (gitignored), but the file stays in history, and the repository answers unauthenticated requests,
so it is probably public. Removing it for real means rewriting `main` (force-push) or recreating the repo.
That is your call; I will not rewrite `main`.

## Q2 — Static hosting (blocks installing the PWA on the phone)
Service workers and home-screen install require HTTPS. Without hosting the static bundle somewhere, Mode 1 cannot
be used on a phone. Static hosting sends no user data anywhere (all data stays in IndexedDB on the device), but it is
"deployment", which is out of scope without approval. Options: Vercel (connector available), GitHub Pages, or none.

## Q3 — Song attributions for progressions
I will only list songs I am confident about and mark the rest "per confirmar". Acceptable?

## Q4 — Odd meters have no source in the book
The book contains no odd-meter section. Options: (a) odd-meter content ships without a book reference, marked
"sense referència al llibre"; (b) you name another source; (c) drop odd meters. Default if unanswered: (a).

## Q5 — GitHub push is refused (403)
Claude has no write access to `vpascual/guitar-app`. All commits exist only in the session container. Install the
Claude GitHub App on the repository or reconnect GitHub in claude.ai settings, then ask me to push.

## Q6 — JSON Schema files
The brief asks for JSON schemas. The TypeScript types are the schemas today; emitting `.schema.json` files needs a
generator dependency (`ts-json-schema-generator`). Add it, or keep types only?

## Q7 — Microphone input (v2 proposal)
Pitch and onset detection could grade timing and notes automatically instead of the clean/sloppy/failed buttons.
It needs microphone permission, which is out of scope without your approval.
