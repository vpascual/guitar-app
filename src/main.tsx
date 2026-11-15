import { StrictMode, useEffect, useState, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Feed } from './screens/Feed';
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
  if (hash.startsWith('#/practica')) return <Suspense fallback={null}><Practice /></Suspense>;
  if (hash.startsWith('#/progres')) return <Suspense fallback={null}><Progress /></Suspense>;
  return <Feed />;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
