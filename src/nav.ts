// In-app navigation history on top of the browser's. The installed app on a phone has no browser back
// button, so the app draws its own. Each history entry remembers its index and the address it came from;
// scroll positions are remembered per address so going back lands where the reader was.

export type Tab = 'home' | 'feed' | 'teoria' | 'practica' | 'progres';

interface EntryState {
  navIndex: number;
  prev: string | null;
}

export const tabOf = (hash: string): Tab =>
  hash.startsWith('#/practica') ? 'practica' : hash.startsWith('#/progres') ? 'progres'
    : hash.startsWith('#/reptes') ? 'feed' : hash.startsWith('#/teoria') ? 'teoria' : 'home';

const TAB_NAME: Record<Tab, string> = { home: 'Inici', feed: 'Reptes', teoria: 'Teoria', practica: 'Pràctica', progres: 'Progrés' };

/** Short name of the screen at an address, for the back button. */
export const screenName = (hash: string): string => {
  const tab = tabOf(hash);
  if (tab === 'teoria' && /^#\/teoria\/[^?]/.test(hash)) return 'Tema';
  return TAB_NAME[tab];
};

/** The screen above this one when there is no history to go back to (a topic's parent is the theory index). */
export const parentOf = (hash: string): string | null => (/^#\/teoria\/[^?]/.test(hash) ? '#/teoria' : null);

const current = (): EntryState | null => {
  const s = history.state as Partial<EntryState> | null;
  return s && typeof s.navIndex === 'number' ? (s as EntryState) : null;
};

let lastHash = location.hash;
let index = current()?.navIndex ?? 0;
if (!current()) history.replaceState({ ...(history.state ?? {}), navIndex: 0, prev: null }, '');

/** Call on every hashchange: stamps new entries so back/forward can be told apart from new navigation. */
export function onNavigate(): void {
  // Stop recording scroll until the new screen is in place: the old screen's position must not be saved under the new address.
  tracking = false;
  const s = current();
  if (s) index = s.navIndex;
  else {
    index += 1;
    history.replaceState({ ...(history.state ?? {}), navIndex: index, prev: lastHash }, '');
  }
  lastHash = location.hash;
}

/** Where the back button leads, or null when there is nowhere to go. */
export function backTarget(): { label: string; useHistory: boolean; hash: string } | null {
  const s = current();
  if (s && s.navIndex > 0 && s.prev !== null) return { label: screenName(s.prev), useHistory: true, hash: s.prev };
  const parent = parentOf(location.hash);
  return parent ? { label: screenName(parent), useHistory: false, hash: parent } : null;
}

export function goBack(): void {
  const t = backTarget();
  if (!t) return;
  if (t.useHistory) history.back();
  else location.hash = t.hash;
}

// ---- Scroll memory ----

const scrolls = new Map<string, number>();
let tracking = true;
/** The address whose screen is on display; scroll positions are recorded under it. */
let shown = location.hash;
window.addEventListener('scroll', () => {
  if (tracking) scrolls.set(shown, window.scrollY);
}, { passive: true });

/**
 * After a screen change: return to the remembered position for this address; otherwise go to the
 * section named by `?a=`, or to the top. Content may still be loading, so it retries for a few frames.
 */
export function restoreScroll(hash: string): void {
  tracking = false;
  shown = hash;
  const saved = scrolls.get(hash);
  const anchor = new URLSearchParams(hash.split('?')[1] ?? '').get('a');
  let tries = 0;
  const step = () => {
    tries++;
    if (saved !== undefined) {
      window.scrollTo(0, saved);
      const reached = Math.abs(window.scrollY - saved) < 2;
      if (!reached && tries < 30) return void requestAnimationFrame(step);
    } else if (anchor) {
      const el = document.getElementById(`sec-${anchor}`);
      if (el) el.scrollIntoView();
      else if (tries < 30) return void requestAnimationFrame(step);
    } else window.scrollTo(0, 0);
    tracking = true;
    scrolls.set(hash, window.scrollY);
  };
  requestAnimationFrame(step);
}

// ---- Edge swipe ----
// A swipe from the left edge goes back, as in iOS apps. The installed web app does not get this from the system.
let swipe: { x: number; y: number } | null = null;
window.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  swipe = e.touches.length === 1 && t.clientX < 24 ? { x: t.clientX, y: t.clientY } : null;
}, { passive: true });
window.addEventListener('touchend', (e) => {
  if (!swipe) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - swipe.x;
  const dy = Math.abs(t.clientY - swipe.y);
  swipe = null;
  if (dx > 80 && dy < dx / 2) goBack();
}, { passive: true });
