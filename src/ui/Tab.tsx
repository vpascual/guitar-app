import type { TabData } from '../engine/session';

/** Monospaced tab with its practical tip underneath. */
export function Tab({ tab }: { tab: TabData }) {
  return (
    <div className="tab">
      <h4>{tab.title}</h4>
      <pre>{tab.lines.join('\n')}</pre>
      <p className="tip">Consell: {tab.tip}</p>
    </div>
  );
}
