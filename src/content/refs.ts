// Resolves book references from the committed index. The index holds titles, pages and example numbers only.
import index from './book-index.json';

export interface ResolvedRef {
  conceptId: string;
  chapter: string;
  chapterTitle: string;
  title: string;
  pageStart: number;
  pageEnd: number;
  example?: string;
}

const byId = new Map<string, ResolvedRef>();
for (const ch of index.chapters) {
  for (const c of ch.concepts) {
    byId.set(c.id, {
      conceptId: c.id,
      chapter: ch.id.replace('ch', ''),
      chapterTitle: ch.title,
      title: c.title,
      pageStart: c.pageStart,
      pageEnd: c.pageEnd,
      example: c.examples[0]?.example,
    });
  }
}

export const hasRef = (conceptId: string): boolean => byId.has(conceptId);

export function resolveRef(conceptId: string): ResolvedRef {
  const r = byId.get(conceptId);
  if (!r) throw new Error(`Unknown book concept: ${conceptId}`);
  return r;
}

/** Catalan citation, e.g. "Beato Book 4.0, cap. 1 — Modal Harmony and Theory, p. 88–89, ex. 116". */
export function formatRef(conceptId: string | null): string {
  if (!conceptId) return 'Sense referència al llibre: el Beato Book 4.0 no tracta els compassos irregulars.';
  const r = resolveRef(conceptId);
  const pages = r.pageStart === r.pageEnd ? `p. ${r.pageStart}` : `p. ${r.pageStart}–${r.pageEnd}`;
  return `Beato Book 4.0, cap. ${r.chapter} «${r.chapterTitle}» — ${r.title}, ${pages}${r.example ? `, ex. ${r.example}` : ''}`;
}
