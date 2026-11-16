import { backTarget, goBack } from '../nav';

/** iOS-style back control at the top of a screen. Shown only when there is somewhere to go back to. */
export function BackBar({ hash }: { hash: string }) {
  void hash; // re-render on every navigation
  const t = backTarget();
  if (!t) return null;
  return (
    <nav className="backbar" aria-label="Navegació">
      <button className="btn ghost back-btn" onClick={goBack} data-testid="back">
        <svg viewBox="0 0 12 20" width="11" height="18" aria-hidden="true"><path d="M10 2 2 10l8 8" /></svg>
        {t.label}
      </button>
    </nav>
  );
}
