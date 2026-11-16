import { StrictMode, useEffect, useLayoutEffect, useState, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Home } from './screens/Home';
import { TabBar } from './ui/TabBar';
import { BackBar } from './ui/BackBar';
import { Tab, tabOf, onNavigate, restoreScroll } from './nav';
import './styles.css';

// Only the home screen is in the first bundle; the other screens load when opened.
const loadFeed = () => import('./screens/Feed');
const Feed = lazy(() => loadFeed().then((m) => ({ default: m.Feed })));
const Theory = lazy(() => import('./screens/Theory').then((m) => ({ default: m.Theory })));
const Progress = lazy(() => import('./screens/Progress').then((m) => ({ default: m.Progress })));
const Practice = lazy(() => import('./screens/Practice').then((m) => ({ default: m.Practice })));

const TABS: Tab[] = ['home', 'feed', 'teoria', 'practica', 'progres'];

/**
 * Screens stay mounted once opened and are only hidden when another tab is shown, as in an iOS tab bar:
 * a half-answered puzzle, an open practice block or a theory page are still there when you come back.
 */
function App() {
  const [hash, setHash] = useState(location.hash);
  // Last address shown in each tab; a tab that has never been opened is not mounted.
  const [tabHash, setTabHash] = useState<Partial<Record<Tab, string>>>({ [tabOf(location.hash)]: location.hash });
  // A puzzle opened from a link ("#/reptes?g=…") gets a fresh puzzle screen; plain "#/reptes" keeps the current one.
  const [feedKey, setFeedKey] = useState(location.hash.includes('?g=') ? location.hash : 'feed');

  useEffect(() => {
    const on = () => {
      onNavigate();
      const h = location.hash;
      setHash(h);
      setTabHash((t) => ({ ...t, [tabOf(h)]: h }));
      if (tabOf(h) === 'feed' && h.includes('?g=')) setFeedKey((k) => (k === h ? k : h));
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useLayoutEffect(() => restoreScroll(hash), [hash]);

  const tab = tabOf(hash);
  const screen = (t: Tab) => {
    const h = tabHash[t]!;
    switch (t) {
      case 'home': return <Home active={tab === 'home'} />;
      case 'feed': return <Feed key={feedKey} />;
      case 'teoria': return <Theory hash={h} />;
      case 'practica': return <Practice />;
      case 'progres': return <Progress active={tab === 'progres'} />;
    }
  };

  return (
    <>
      <BackBar hash={hash} />
      {TABS.filter((t) => tabHash[t] !== undefined).map((t) => (
        <div key={t} hidden={t !== tab} className="screen">
          {t === 'home' ? screen(t) : <Suspense fallback={null}>{screen(t)}</Suspense>}
        </div>
      ))}
      <TabBar current={tab} />
    </>
  );
}

// Fetch the puzzle screen as soon as the home screen is up, so the first tap opens it without a wait.
setTimeout(() => void loadFeed(), 0);

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
