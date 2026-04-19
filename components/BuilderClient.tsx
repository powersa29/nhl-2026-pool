'use client';
import { useState, useMemo } from 'react';
import type { Player, Team, Pos } from '@/lib/data';

interface Pick { team: string; playerName: string; pos: string; }

const NEEDS = { G: 1, D: 6, F: 9 } as const;

function jersey(seed: number) { return ((seed * 17 + 3) % 96) + 2; }

export default function BuilderClient({ teams, players }: { teams: Team[]; players: Player[] }) {
  const [picks, setPicks] = useState<Record<string, Player>>({});
  const [activeTeam, setActiveTeam] = useState(teams[0].abbr);
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const counts: Record<Pos, number> = { G: 0, D: 0, F: 0 };
  Object.values(picks).forEach(p => { counts[p.pos as Pos]++; });
  const filled = Object.keys(picks).length;
  const currentPick = picks[activeTeam];

  const activeTeamPlayers = useMemo(() =>
    players.filter(p => p.team === activeTeam)
      .sort((a, b) => {
        const posOrder = { G: 0, D: 1, F: 2 };
        return posOrder[a.pos] - posOrder[b.pos];
      }),
    [activeTeam, players]
  );

  const pickPlayer = (p: Player) => {
    const currentPos = currentPick?.pos as Pos | undefined;
    const effectiveCount = counts[p.pos as Pos] - (currentPos === p.pos ? 1 : 0);
    if (effectiveCount >= NEEDS[p.pos as Pos]) {
      alert(`You already have ${NEEDS[p.pos as Pos]} ${p.pos === 'G' ? 'goalie' : p.pos === 'D' ? 'defensemen' : 'forwards'}. Clear one first.`);
      return;
    }
    setPicks(prev => ({ ...prev, [activeTeam]: p }));
  };

  const clearTeam = (abbr: string) => {
    setPicks(prev => { const n = { ...prev }; delete n[abbr]; return n; });
  };

  const canSubmit = filled === 16 && counts.G === 1 && counts.D === 6 && counts.F === 9 && name.trim().length > 1;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');
    const roster: Pick[] = Object.entries(picks).map(([team, p]) => ({
      team, playerName: p.name, pos: p.pos,
    }));
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), roster }),
    });
    const json = await res.json();
    if (json.error) { setError(json.error); setSubmitting(false); return; }
    setSubmitted(true);
    setSubmitting(false);
  };

  const byPos = { G: [] as Player[], D: [] as Player[], F: [] as Player[] };
  Object.values(picks).forEach(p => byPos[p.pos as Pos].push(p));

  if (submitted) {
    return (
      <section className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
        <div style={{ fontSize: 64 }}>🎉</div>
        <h2 style={{ marginTop: 16 }}>You&apos;re in!</h2>
        <p style={{ color: 'var(--muted)', marginTop: 12 }}>Your roster has been locked in. Check the standings to see where you rank.</p>
        <a href="/" style={{ display: 'inline-block', marginTop: 24 }}>
          <button className="btn red">View standings →</button>
        </a>
      </section>
    );
  }

  return (
    <div className="builder-grid">
      <section className="card">
        <div className="card-header">
          <div>
            <h2><span className="strike">Build your roster</span></h2>
            <p style={{ color: 'var(--muted)', marginTop: 8, fontSize: 14 }}>
              Pick one player from each of the 16 playoff teams. One goalie, six defensemen, nine forwards.
            </p>
          </div>
        </div>

        <div className="team-grid">
          {teams.map(t => {
            const pick = picks[t.abbr];
            const isActive = activeTeam === t.abbr;
            return (
              <button
                key={t.abbr}
                className={`team-btn ${pick ? 'picked' : ''}`}
                onClick={() => setActiveTeam(t.abbr)}
                style={isActive ? { outline: '3px solid var(--red)', outlineOffset: '2px' } : {}}
              >
                <div className={`team-btn-status ${pick ? 'picked-s' : 'open'}`}>{pick ? 'Picked' : 'Open'}</div>
                <div>
                  <div className="team-btn-abbr">{t.abbr}</div>
                  <div className="team-btn-name">{t.name}</div>
                </div>
                {pick && (
                  <div style={{ fontSize: 11, marginTop: 4, opacity: 0.9 }}>
                    <span className={`pos-tag ${pick.pos}`}>{pick.pos}</span>{' '}{pick.name}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 22, borderTop: '2px dashed var(--line)', paddingTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
            <h3>{teams.find(t => t.abbr === activeTeam)?.name} players</h3>
            {currentPick && (
              <button className="btn ghost" style={{ padding: '7px 14px', fontSize: 12 }} onClick={() => clearTeam(activeTeam)}>
                Clear {activeTeam} pick
              </button>
            )}
          </div>
          <div className="player-list">
            {activeTeamPlayers.map((p, idx) => {
              const chosen = currentPick?.name === p.name;
              const effectiveCount = counts[p.pos as Pos] - (currentPick?.pos === p.pos ? 1 : 0);
              const disabled = !chosen && effectiveCount >= NEEDS[p.pos as Pos];
              const jNo = jersey(players.indexOf(p));
              return (
                <div
                  key={p.name}
                  className={`player-row ${chosen ? 'chosen' : ''} ${disabled ? 'disabled' : ''}`}
                  onClick={() => !disabled && pickPlayer(p)}
                >
                  <div className="player-jersey">{jNo}</div>
                  <div>
                    <div className="player-name">{p.name}</div>
                    <div className="player-meta">{p.pos === 'G' ? 'Goalie' : p.pos === 'D' ? 'Defenseman' : 'Forward'}</div>
                  </div>
                  <span className={`pos-tag ${p.pos}`}>{p.pos}</span>
                  <span className="pts-pill">—</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="rail">
        <h3>Your roster</h3>
        <div className="rail-sub">{filled}/16 teams picked</div>

        <div className="rail-progress">
          {(['G', 'D', 'F'] as Pos[]).map(pos => (
            <div key={pos} className={`rail-prog ${counts[pos] === NEEDS[pos] ? 'full' : ''}`}>
              <div className="n">{counts[pos]}<span className="target">/{NEEDS[pos]}</span></div>
              <div className="l">{pos === 'G' ? 'Goalie' : pos === 'D' ? 'Defense' : 'Forward'}</div>
            </div>
          ))}
        </div>

        {(['G', 'D', 'F'] as Pos[]).map(pos =>
          Array.from({ length: NEEDS[pos] }, (_, i) => {
            const player = byPos[pos][i];
            return (
              <div key={`${pos}-${i}`} className={`roster-slot ${player ? 'filled' : 'empty'}`}>
                <div className={`slot-pos ${pos}`}>{pos}</div>
                {player ? (
                  <>
                    <div>
                      <div className="slot-name">{player.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{player.team}</div>
                    </div>
                    <button className="slot-clear" onClick={() => {
                      const teamEntry = Object.entries(picks).find(([, p]) => p.name === player.name);
                      if (teamEntry) clearTeam(teamEntry[0]);
                    }}>✕</button>
                  </>
                ) : (
                  <div className="slot-name empty" style={{ gridColumn: 'span 2' }}>Empty · choose a team</div>
                )}
              </div>
            );
          })
        )}

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px dashed var(--line)' }}>
          <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.08em' }}>Your name</label>
          <input
            className="input"
            placeholder="e.g. Sam Whitfield"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%', marginTop: 8 }}
          />
          {error && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{error}</p>}
          <button
            className="btn red"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            style={{ width: '100%', marginTop: 12, padding: '14px', fontSize: 15 }}
          >
            {submitting ? 'Locking in…' : canSubmit ? 'Lock in my picks 🔒' : `Pick ${16 - filled} more`}
          </button>
        </div>
      </aside>
    </div>
  );
}
