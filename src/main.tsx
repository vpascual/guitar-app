import { StrictMode, useEffect, useState, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Feed } from './screens/Feed';
import { TabBar } from './ui/TabBar';
import './styles.css';

// The practice screen is loaded on demand so it never delays the first puzzle.
const Progress = lazy(() => import('./screens/Progress').then((m) => ({ default: m.Progress })));
const Practice = lazy(() => import('./screens/Practice').then((m) => ({ default: m.Practice })));

function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const tab = hash.startsWith('#/practica') ? 'practica' : hash.startsWith('#/progres') ? 'progres' : 'feed';
  return (
    <>
      {tab === 'feed' ? <Feed /> : (
        <Suspense fallback={null}>{tab === 'practica' ? <Practice /> : <Progress />}</Suspense>
      )}
      <TabBar current={tab} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
