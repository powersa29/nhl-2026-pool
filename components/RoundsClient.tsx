'use client';
import { useState } from 'react';
import TeamChip from './TeamChip';
import { TEAMS } from '@/lib/data';

interface Series { a: string; b: string; aw: number; bw: number; status: string; }
interface Round { name: string; active: boolean; series: Series[]; }

export default function RoundsClient({ rounds }: { rounds: Round[] }) {
  const [active, setActive] = useState(0);
  const round = rounds[active];

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2><span className="strike">Round-by-round</span></h2>
          <p style={{ color: 'var(--muted)', marginTop: 8, fontSize: 14 }}>Follow every series as the bracket unfolds.</p>
        </div>
      </div>
      <div className="round-tabs">
        {rounds.map((r, i) => (
          <button
            key={i}
            className={`round-tab ${active === i ? 'active' : ''} ${!r.active && r.series.length === 0 ? 'inactive' : ''}`}
            onClick={() => r.series.length > 0 && setActive(i)}
          >
            {r.name} {r.active && <span style={{ marginLeft: 6, color: 'var(--red)' }}>●</span>}
          </button>
        ))}
      </div>
      {round.series.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontFamily: 'var(--display)', fontSize: 48, fontWeight: 800, color: 'var(--line)' }}>TBD</div>
          <div style={{ marginTop: 10 }}>{round.name} begins once the previous round wraps.</div>
        </div>
      ) : (
        <div className="series-grid">
          {round.series.map((s, i) => {
            const aWin = s.aw > s.bw;
            const bWin = s.bw > s.aw;
            return (
              <div key={i} className="series-card">
                <div className="series-head">Series · Best of 7</div>
                <div className="series-teams">
                  <div className="series-team">
                    <TeamChip abbr={s.a} />
                    <div className="a">{TEAMS.find(t => t.abbr === s.a)?.name}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div className={`series-score ${aWin ? 'w' : ''}`}>{s.aw}</div>
                    <div style={{ color: 'var(--muted)', fontWeight: 700 }}>–</div>
                    <div className={`series-score ${bWin ? 'w' : ''}`}>{s.bw}</div>
                  </div>
                  <div className="series-team" style={{ alignItems: 'flex-end', textAlign: 'right' }}>
                    <TeamChip abbr={s.b} />
                    <div className="a">{TEAMS.find(t => t.abbr === s.b)?.name}</div>
                  </div>
                </div>
                <div className="series-status">{s.status}</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
