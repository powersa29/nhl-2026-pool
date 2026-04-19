'use client';

interface TickerItem {
  id: number;
  player: string;
  team: string;
  kind: 'GOAL' | 'ASSIST';
  opp: string;
  time: string;
}

export default function Ticker({ items }: { items: TickerItem[] }) {
  const doubled = [...items, ...items];
  return (
    <div className="ticker" aria-label="Live scoring ticker">
      <div className="ticker-track">
        {doubled.map((it, i) => (
          <div className="ticker-item" key={i}>
            <span className={`kind ${it.kind}`}>{it.kind}</span>
            <span style={{ fontWeight: 700 }}>{it.player}</span>
            <span className="team">{it.team}</span>
            <span style={{ opacity: 0.5 }}>vs {it.opp}</span>
            <span className="time">{it.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
