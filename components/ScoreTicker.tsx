'use client';
import { useEffect, useState, useRef } from 'react';

interface GameScore {
  id: number;
  away: string;
  home: string;
  awayScore: number;
  homeScore: number;
  state: string;
  period?: string;
  clock?: string;
}

interface ScoreData {
  games: GameScore[];
  date: string;
  live: boolean;
}

function GameChip({ g }: { g: GameScore }) {
  const isLive = g.state === 'LIVE';
  const isFinal = g.state === 'FINAL';
  const isPre = g.state === 'FUT' || g.state === 'PRE';

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: 'var(--chip)', borderRadius: 10, padding: '6px 14px',
      fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      <span style={{ opacity: 0.8 }}>{g.away}</span>
      {isPre ? (
        <span style={{ color: 'var(--muted)', fontSize: 11 }}>vs</span>
      ) : (
        <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 15 }}>
          {g.awayScore}–{g.homeScore}
        </span>
      )}
      <span style={{ opacity: 0.8 }}>{g.home}</span>
      {isLive && (
        <span style={{ color: 'var(--red)', fontSize: 11, fontWeight: 700 }}>
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', marginRight: 3, verticalAlign: 'middle' }} />
          {g.period} {g.clock}
        </span>
      )}
      {isFinal && <span style={{ color: 'var(--muted)', fontSize: 11 }}>FINAL{g.period === 'OT' ? '/OT' : ''}</span>}
    </div>
  );
}

export default function ScoreTicker() {
  const [data, setData] = useState<ScoreData | null>(null);
  const animRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/scores');
      if (res.ok) setData(await res.json());
    } catch {}
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!data || data.games.length === 0) return null;

  const label = data.live
    ? '🔴 LIVE'
    : data.date === new Date().toISOString().slice(0, 10)
      ? "TODAY'S GAMES"
      : 'LAST NIGHT';

  return (
    <div style={{
      borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
      background: 'var(--paper)', overflow: 'hidden', position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{
          padding: '8px 14px', fontSize: 11, fontWeight: 800, letterSpacing: 1,
          color: data.live ? 'var(--red)' : 'var(--muted)',
          borderRight: '1px solid var(--line)', whiteSpace: 'nowrap', flexShrink: 0,
          background: 'var(--paper)',
        }}>
          {label}
        </div>
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div
            ref={animRef}
            style={{
              display: 'flex', gap: 10, padding: '8px 14px',
              animation: data.games.length > 3 ? 'ticker-scroll 30s linear infinite' : undefined,
              width: 'max-content',
            }}
          >
            {data.games.map(g => <GameChip key={g.id} g={g} />)}
            {data.games.length > 3 && data.games.map(g => <GameChip key={`r-${g.id}`} g={g} />)}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
