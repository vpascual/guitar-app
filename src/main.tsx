import { StrictMode, useEffect, useState, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Home } from './screens/Home';
import { TabBar } from './ui/TabBar';
import './styles.css';

// The practice screen is loaded on demand so it never delays the first puzzle.
// Only the home screen is in the first bundle; the other screens load when opened.
const loadFeed = () => import('./screens/Feed');
const Feed = lazy(() => loadFeed().then((m) => ({ default: m.Feed })));
const Progress = lazy(() => import('./screens/Progress').then((m) => ({ default: m.Progress })));
const Practice = lazy(() => import('./screens/Practice').then((m) => ({ default: m.Practice })));

function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const tab = hash.startsWith('#/practica') ? 'practica' : hash.startsWith('#/progres') ? 'progres'
    : hash.startsWith('#/teoria') ? 'feed' : 'home';
  return (
    <>
      {tab === 'home' ? <Home /> : (
        <Suspense fallback={null}>
          {tab === 'feed' ? <Feed key={hash} /> : tab === 'practica' ? <Practice /> : <Progress />}
        </Suspense>
      )}
      <TabBar current={tab} />
    </>
  );
}

// Fetch the puzzle screen as soon as the home screen is up, so the first tap opens it without a wait.
setTimeout(() => void loadFeed(), 0);

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
