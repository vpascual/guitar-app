import { useEffect, useState } from 'react';
import { GROUPS, TOPICS, Block, defaultKey, getTopic } from '../content/theory';
import { parseNote, noteCa } from '../theory/note';
import { formatRef } from '../content/refs';
import { ChordDiagram } from '../ui/ChordDiagram';
import { Fretboard } from '../ui/Fretboard';
import { ListenButton } from '../ui/ListenButton';
import { RhythmLine } from '../ui/RhythmLine';
import { Neck } from '../ui/Neck';
import { FormChart } from '../ui/FormChart';
import { BarGrid } from '../ui/BarGrid';

const KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'F#'];

/** Address of a topic, optionally scrolled to a section inside it. */
export const theoryHref = (topic: string, anchor?: string): string =>
  `#/teoria/${topic}${anchor ? `?a=${encodeURIComponent(anchor)}` : ''}`;

function BlockView({ b }: { b: Block }) {
  switch (b.t) {
    case 'p': return <p>{b.text}</p>;
    case 'h': return <h2 id={b.id ? `sec-${b.id}` : undefined}>{b.text}</h2>;
    case 'list': return <ul className="doc-list">{b.items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
    case 'table':
      return (
        <div className="doc-table">
          <table>
            <thead><tr>{b.head.map((x, i) => <th key={i}>{x}</th>)}</tr></thead>
            <tbody>{b.rows.map((r, i) => <tr key={i} className={b.mark?.includes(i) ? 'marked' : undefined}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    case 'scale':
      return (
        <div className="doc-box">
          <strong>{b.label}</strong>
          <div className="scale-row">
            {b.notes.map((n, i) => <span key={i} className={i === b.mark ? 'chip marked' : 'chip'}><small>{b.formula[i]}</small>{n}</span>)}
          </div>
          <ListenButton what={b.listen} />
        </div>
      );
    case 'neck': return <div className="doc-box wide"><Neck neck={b.neck} caption={b.caption} /></div>;
    case 'form': return <div className="doc-box wide"><FormChart blocks={b.blocks} /></div>;
    case 'bars':
      return (
        <div className="doc-box wide">
          <BarGrid bars={b.bars} perRow={b.perRow} />
          {b.listen && <ListenButton what={b.listen} label="Escolta-ho" />}
        </div>
      );
    case 'chords':
      return (
        <div className="doc-chords">
          {b.chords.map((c) => (
            <div key={c.symbol} className="doc-chord">
              <ChordDiagram voicing={c.voicing} name={c.symbol} />
              <ListenButton what={c.listen} />
            </div>
          ))}
        </div>
      );
    case 'prog':
      return <div className="doc-box"><strong>{b.line}</strong><ListenButton what={b.listen} label="Escolta la progressió" /></div>;
    case 'rhythm':
      return <div className="doc-box"><RhythmLine groups={b.groups} /><ListenButton what={b.listen} /></div>;
    case 'fret':
      return (
        <figure className="doc-fret">
          <Fretboard firstFret={b.firstFret} frets={5} dots={b.dots} />
          <figcaption className="muted">{b.caption}</figcaption>
        </figure>
      );
    case 'link': return <a className="doc-link" href={theoryHref(b.topic)}>{b.text}</a>;
    case 'practice':
      return <a className="btn primary" href={`#/reptes?g=${b.generatorId}${b.concept ? `&c=${encodeURIComponent(b.concept)}` : ''}`}>{b.text}</a>;
    case 'ref':
      return (
        <div className="doc-refs">
          <h2>Al llibre</h2>
          {b.concepts.length ? b.concepts.map((c) => <p key={c} className="muted">{formatRef(c)}</p>) : <p className="muted">{formatRef(null)}</p>}
        </div>
      );
  }
}

function Index() {
  return (
    <main className="theory">
      <h1>Teoria</h1>
      <p className="muted lead">
        {TOPICS.length} temes. Tots els exemples es poden canviar de tonalitat i es poden escoltar.
      </p>
      {GROUPS.map((g) => (
        <section key={g}>
          <h2 className="group-title">{g}</h2>
          <div className="rows">
            {TOPICS.filter((t) => t.group === g).map((t) => (
              <a key={t.id} className="row-link" href={theoryHref(t.id)}>
                <span><strong>{t.title}</strong><small>{t.summary}</small></span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

export function Theory({ hash }: { hash: string }) {
  const [path] = hash.replace(/^#\/teoria\/?/, '').split('?');
  const topic = path ? getTopic(decodeURIComponent(path)) : undefined;
  const [key, setKey] = useState(topic ? topic.defaultKey : 'C');

  // Scrolling (to the top, to a section, or back to where the reader was) is handled by the app's navigation.
  useEffect(() => {
    setKey(topic ? topic.defaultKey : 'C');
  }, [topic]);

  if (!topic) return <Index />;
  const tonic = KEYS.includes(key) ? parseNote(key) : defaultKey(topic);
  return (
    <main className="theory" data-testid="topic">
      <h1>{topic.title}</h1>
      <p className="muted lead">{topic.summary}</p>
      {topic.usesKey && (
        <label className="keypick">
          Exemples a
          <select id="theory-key" value={key} onChange={(e) => setKey(e.target.value)}>
            {[...new Set([topic.defaultKey, ...KEYS])].map((k) => <option key={k} value={k}>{noteCa(parseNote(k))}</option>)}
          </select>
        </label>
      )}
      <article className="doc">
        {topic.build(tonic).map((b, i) => <BlockView key={`${key}-${i}`} b={b} />)}
      </article>
    </main>
  );
}
