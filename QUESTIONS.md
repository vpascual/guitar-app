# QUESTIONS

## Q1 — The book PDF is not available in this environment (blocks the book index)
`./reference/beato-book-4.pdf` does not exist here. The session runs in a cloud container that only has what
is in the git repo, and the PDF must never be committed.
Options: (a) attach the PDF in the chat; (b) point me to it in Google Drive (the connector is available) by name;
(c) run the indexing step on your own machine. Once indexed, only `book-index.json` (references, no text) is committed.

## Q2 — Static hosting (blocks installing the PWA on the phone)
Service workers and home-screen install require HTTPS. Without hosting the static bundle somewhere, Mode 1 cannot
be used on a phone. Static hosting sends no user data anywhere (all data stays in IndexedDB on the device), but it is
"deployment", which is out of scope without approval. Options: Vercel (connector available), GitHub Pages, or none.

## Q3 — Song attributions for progressions
I will only list songs I am confident about and mark the rest "per confirmar". Acceptable?
