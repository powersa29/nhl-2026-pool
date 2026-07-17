'use client';

import { useState, useEffect, use, useMemo } from 'react';
import Link from 'next/link';
import type { Player, Round } from '@/lib/golf-db';
import { courseHandicap9, netScore, weekLabel, scoreDifferential, calcHandicapIndex } from '@/lib/golf-scoring';

interface Props {
  params: Promise<{ id: string }>;
}

const ADMIN_TOKEN = 'GlizzyAdmin2026';

export default function PlayerPage({ params }: Props) {
  const { id } = use(params);

  const [player, setPlayer] = useState<Player | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [editHcp, setEditHcp] = useState(false);
  const [hcpInput, setHcpInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [hcpError, setHcpError] = useState('');

  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAdminAuthed, setIsAdminAuthed] = useState(false);
  const [authUser, setAuthUser] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authError, setAuthError] = useState('');

  async function load() {
    const [pRes, rRes] = await Promise.all([
      fetch(`/api/players`),
      fetch(`/api/rounds/player?playerId=${id}`),
    ]);
    const players: Player[] = await pRes.json();
    const p = players.find(x => x.id === Number(id));
    setPlayer(p ?? null);
    if (p) setHcpInput(p.handicap_index.toFixed(1));
    const r: Round[] = await rRes.json();
    setRounds(r);
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (sessionStorage.getItem('golf-admin') === '1') setIsAdminAuthed(true);
  }, []);

  function handleRemoveClick(roundId: number) {
    setPendingDeleteId(roundId);
    if (isAdminAuthed) {
      execDelete(roundId);
    } else {
      setShowAuthModal(true);
    }
  }

  async function execDelete(roundId: number) {
    setDeletingId(roundId);
    await fetch(`/api/admin/rounds?id=${roundId}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': ADMIN_TOKEN },
    });
    setDeletingId(null);
    setPendingDeleteId(null);
    load();
  }

  function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (authUser.trim() === 'admin' && authPass === 'Glizzy') {
      sessionStorage.setItem('golf-admin', '1');
      setIsAdminAuthed(true);
      setShowAuthModal(false);
      setAuthUser(''); setAuthPass(''); setAuthError('');
      if (pendingDeleteId !== null) execDelete(pendingDeleteId);
    } else {
      setAuthError('Incorrect username or password.');
      setAuthPass('');
    }
  }

  async function saveHandicap() {
    setHcpError('');
    const v = parseFloat(hcpInput);
    if (isNaN(v) || v < 0 || v > 54) { setHcpError('Must be 0.0 – 54.0'); return; }
    setSaving(true);
    const res = await fetch(`/api/players/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handicap_index: v }),
    });
    setSaving(false);
    if (res.ok) { const p = await res.json(); setPlayer(p); setEditHcp(false); }
    else { setHcpError('Failed to save'); }
  }

  // ── Handicap tracker computation ─────────────────────────
  const { diffRows, hcpCalc, usedIds } = useMemo(() => {
    const rows = rounds.map(r => {
      const tee = r.golf_tees;
      const course = r.golf_courses;
      if (!tee) return null;
      const cr9 = Number(tee.course_rating);
      if (isNaN(cr9)) return null;
      const h = (r.holes ?? 9) as 9 | 18;
      return {
        id: r.id,
        date: r.played_at,
        course: course?.name ?? '—',
        gross: r.gross_score,
        tee: tee.tee_name,
        slope: tee.slope_rating,
        holes: h,
        isHandicapOnly: !r.league_id,
        differential: scoreDifferential(r.gross_score, cr9, tee.slope_rating, h),
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    const calc = calcHandicapIndex(rows.map(r => r.differential));

    const used = new Set<number>();
    if (calc) {
      const working = rows.slice(0, 20);
      const sorted = [...working].sort((a, b) => a.differential - b.differential);
      sorted.slice(0, calc.diffsUsed).forEach(r => used.add(r.id));
    }

    return { diffRows: rows, hcpCalc: calc, usedIds: used };
  }, [rounds]);

  // Rolling HI history for sparkline (oldest → newest)
  const hiHistory = useMemo(() => {
    if (diffRows.length < 2) return [];
    const n = diffRows.length;
    const history: number[] = [];
    for (let k = 0; k < n; k++) {
      const subset = diffRows.slice(n - 1 - k).map(r => r.differential);
      const calc = calcHandicapIndex(subset);
      history.push(calc?.calculatedHI ?? 0);
    }
    return history;
  }, [diffRows]);

  if (!player) {
    return (
      <div className="empty-state">
        Player not found. <Link href="/join" style={{ color: 'var(--green)' }}>Join the league?</Link>
      </div>
    );
  }

  // Group competition rounds by league week
  const byLeague = new Map<number, { leagueId: number; label: string; rounds: Round[] }>();
  for (const r of rounds) {
    if (!r.league_id) continue;
    const league = (r as Round & { golf_leagues?: { name: string; start_date: string } }).golf_leagues;
    if (!league) continue;
    if (!byLeague.has(r.league_id)) {
      byLeague.set(r.league_id, {
        leagueId: r.league_id,
        label: weekLabel(league.start_date),
        rounds: [],
      });
    }
    byLeague.get(r.league_id)!.rounds.push(r);
  }

  const weeks = Array.from(byLeague.values());
  const handicapOnlyRounds = rounds.filter(r => !r.league_id);

  const hiDelta = hcpCalc ? hcpCalc.calculatedHI - player.handicap_index : null;

  return (
    <div>
      {/* Profile Header */}
      <div style={{
        background: 'var(--paper)', border: '2px solid var(--green-dark)',
        borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow)',
        marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        <div style={{
          width: 70, height: 70, borderRadius: 20, background: 'var(--green-dark)',
          color: 'white', display: 'grid', placeItems: 'center',
          fontFamily: 'var(--display)', fontSize: 30, fontWeight: 800,
          transform: 'rotate(-4deg)', boxShadow: '0 4px 0 var(--green-deep)',
        }}>
          {player.name.slice(0, 1).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ marginBottom: 4 }}>{player.name}</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {editHcp ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  className="input"
                  type="number" min="0" max="54" step="0.1"
                  value={hcpInput}
                  onChange={e => setHcpInput(e.target.value)}
                  style={{ maxWidth: 120 }}
                />
                <button className="btn" onClick={saveHandicap} disabled={saving} style={{ padding: '8px 14px', fontSize: 13 }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button className="btn ghost" onClick={() => { setEditHcp(false); setHcpError(''); }} style={{ padding: '8px 14px', fontSize: 13 }}>
                  Cancel
                </button>
                {hcpError && <span style={{ color: 'var(--red)', fontSize: 13 }}>{hcpError}</span>}
              </div>
            ) : (
              <>
                <span className="tag green">HCP {player.handicap_index.toFixed(1)}</span>
                <button
                  className="btn ghost"
                  onClick={() => setEditHcp(true)}
                  style={{ padding: '6px 12px', fontSize: 12 }}
                >
                  Edit Handicap
                </button>
              </>
            )}
            <span className="tag gray">{rounds.length} total rounds</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/record"><button className="btn dark">+ Record Round</button></Link>
          <Link href="/"><button className="btn ghost">Standings</button></Link>
        </div>
      </div>

      {/* Handicap Tracker */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 style={{ fontSize: 16, margin: 0 }}>Handicap Tracker</h3>
          <span className="tag gray">WHS formula</span>
        </div>

        {diffRows.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            Record rounds to start tracking your handicap. Use <strong>Handicap Only</strong> rounds to log casual play.
          </div>
        ) : (
          <>
            {/* Summary pills */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
              <div className="stat-pill">
                <div className="k">{player.handicap_index.toFixed(1)}</div>
                <div className="l">Current Index</div>
              </div>
              {hcpCalc && (
                <div className="stat-pill">
                  <div className="k" style={{
                    color: hiDelta !== null && hiDelta < -0.05 ? 'var(--green)'
                         : hiDelta !== null && hiDelta > 0.05 ? 'var(--red, #dc2626)'
                         : 'inherit'
                  }}>
                    {hcpCalc.calculatedHI.toFixed(1)}
                    {hiDelta !== null && Math.abs(hiDelta) > 0.05
                      ? (hiDelta < 0 ? ' ↓' : ' ↑')
                      : ''}
                  </div>
                  <div className="l">Calculated Index</div>
                </div>
              )}
              <div className="stat-pill">
                <div className="k">{diffRows.length}</div>
                <div className="l">Rounds in system</div>
              </div>
            </div>

            {hcpCalc && (
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
                Using best {hcpCalc.diffsUsed} differential{hcpCalc.diffsUsed !== 1 ? 's' : ''} of {Math.min(hcpCalc.totalRounds, 20)} rounds · ×0.96 multiplier (WHS)
                {hiDelta !== null && Math.abs(hiDelta) > 0.05 && (
                  <> · {hiDelta < 0
                    ? <span style={{ color: 'var(--green)' }}>Playing better than your current index</span>
                    : <span>Playing slightly above your current index</span>
                  }</>
                )}
              </p>
            )}

            {/* HI trend sparkline */}
            {hiHistory.length >= 2 && <HiSparkline history={hiHistory} />}

            {/* Per-round differential table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--line)' }}>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Course</th>
                    <th style={thStyle}>Tees</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Gross</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Holes</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Differential</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Used</th>
                  </tr>
                </thead>
                <tbody>
                  {diffRows.map(row => {
                    const used = usedIds.has(row.id);
                    return (
                      <tr key={row.id} style={{
                        borderBottom: '1px solid var(--line)',
                        background: used
                          ? 'color-mix(in oklab, var(--green) 7%, transparent)'
                          : 'transparent',
                      }}>
                        <td style={tdStyle}>{new Date(row.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td style={tdStyle}>
                          {row.course}
                          {row.isHandicapOnly && (
                            <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--ice-2)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 5px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                              HCP only
                            </span>
                          )}
                        </td>
                        <td style={tdStyle}>{row.tee}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{row.gross}</td>
                        <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>{row.holes}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: used ? 700 : 400, color: used ? 'var(--green-dark)' : 'inherit' }}>
                          {row.differential.toFixed(1)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {used ? <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span> : <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12, lineHeight: 1.6 }}>
              9-hole differential = (Gross − Course Rating) × 113 ÷ Slope × 2 &nbsp;·&nbsp;
              18-hole differential = (Gross − Course Rating × 2) × 113 ÷ Slope &nbsp;·&nbsp;
              Index = avg of best differentials × 0.96, truncated to 1 decimal.
              For an official USGA Handicap Index, visit <strong>GHIN.com</strong>.
            </p>
          </>
        )}
      </div>

      {/* Competition rounds by week */}
      {weeks.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Competition Rounds</h3>
          {weeks.map(week => {
            const nets = week.rounds.map(r => {
              const slope = (r as Round & { golf_tees?: { slope_rating: number } }).golf_tees?.slope_rating ?? 113;
              return netScore(r.gross_score, player.handicap_index, slope);
            });
            const bestNet = Math.min(...nets);

            return (
              <div key={week.leagueId} style={{ marginBottom: 24 }}>
                <div className="section-header" style={{ marginBottom: 12 }}>
                  <h3 style={{ fontSize: 16 }}>{week.label}</h3>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="tag gray">{week.rounds.length} round{week.rounds.length !== 1 ? 's' : ''}</span>
                    <span className="tag green">Best net: {bestNet}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {week.rounds.map((r) => {
                    const slope = (r as Round & { golf_tees?: { slope_rating: number; tee_name: string } }).golf_tees?.slope_rating ?? 113;
                    const teeName = (r as Round & { golf_tees?: { tee_name: string } }).golf_tees?.tee_name ?? '';
                    const net = netScore(r.gross_score, player.handicap_index, slope);
                    const isBest = net === bestNet && week.rounds.length > 0;
                    const course = (r as Round & { golf_courses?: { name: string; city: string; state: string } }).golf_courses;

                    return (
                      <div key={r.id} className="round-tile" style={isBest ? { borderColor: 'var(--green)', background: 'color-mix(in oklab, var(--green) 6%, var(--chip))' } : {}}>
                        <div className="rt-left">
                          <div className="rt-course">{course?.name ?? '—'}</div>
                          <div className="rt-meta">
                            {course?.city}, {course?.state} · {teeName} tees (slope {slope}) · {new Date(r.played_at + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          {isBest && <span className="best-badge" style={{ marginTop: 4, alignSelf: 'flex-start' }}>Best this week</span>}
                        </div>
                        <div className="rt-scores">
                          <div className="rt-gross">
                            <div className="v">{r.gross_score}</div>
                            <div className="l">Gross</div>
                          </div>
                          <div className="rt-net">
                            <div className="v">{net}</div>
                            <div className="l">Net</div>
                          </div>
                          <button
                            className="btn ghost"
                            style={{ padding: '6px 10px', fontSize: 11, color: 'var(--red,#dc2626)', borderColor: 'var(--red,#dc2626)' }}
                            onClick={() => handleRemoveClick(r.id)}
                            disabled={deletingId === r.id}
                          >
                            {deletingId === r.id ? '…' : 'Remove'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Handicap-only rounds */}
      {handicapOnlyRounds.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Handicap-Only Rounds</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {handicapOnlyRounds.map(r => {
              const tee = (r as Round & { golf_tees?: { slope_rating: number; tee_name: string; course_rating: number } }).golf_tees;
              const course = (r as Round & { golf_courses?: { name: string; city: string; state: string } }).golf_courses;
              const h = r.holes ?? 9;
              return (
                <div key={r.id} className="round-tile">
                  <div className="rt-left">
                    <div className="rt-course">{course?.name ?? '—'}</div>
                    <div className="rt-meta">
                      {course?.city}, {course?.state} · {tee?.tee_name ?? ''} tees · {h} holes · {new Date(r.played_at + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <span style={{ marginTop: 4, display: 'inline-block', fontSize: 11, background: 'var(--ice-2)', border: '1px solid var(--line)', borderRadius: 4, padding: '2px 7px', color: 'var(--muted)' }}>
                      Handicap only
                    </span>
                  </div>
                  <div className="rt-scores">
                    <div className="rt-gross">
                      <div className="v">{r.gross_score}</div>
                      <div className="l">Gross</div>
                    </div>
                    <button
                      className="btn ghost"
                      style={{ padding: '6px 10px', fontSize: 11, color: 'var(--red,#dc2626)', borderColor: 'var(--red,#dc2626)' }}
                      onClick={() => handleRemoveClick(r.id)}
                      disabled={deletingId === r.id}
                    >
                      {deletingId === r.id ? '…' : 'Remove'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {rounds.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
          No rounds recorded yet.{' '}
          <Link href="/record" style={{ color: 'var(--green)' }}>Record your first round →</Link>
        </div>
      )}

      {/* Admin login modal */}
      {showAuthModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) { setShowAuthModal(false); setPendingDeleteId(null); } }}
        >
          <div style={{ background: 'var(--paper)', borderRadius: 'var(--radius-lg)', padding: '28px', maxWidth: 360, width: '100%', boxShadow: 'var(--shadow)' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>🔒</div>
              <h3 style={{ margin: 0, fontSize: 18 }}>Admin required</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>Sign in to delete this round.</p>
            </div>
            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                className="input" type="text" placeholder="Username"
                value={authUser} onChange={e => { setAuthUser(e.target.value); setAuthError(''); }}
                autoComplete="username" autoFocus
              />
              <input
                className="input" type="password" placeholder="Password"
                value={authPass} onChange={e => { setAuthPass(e.target.value); setAuthError(''); }}
                autoComplete="current-password"
              />
              {authError && <div className="error-banner" style={{ marginTop: 0 }}>⚠️ {authError}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn ghost" onClick={() => { setShowAuthModal(false); setPendingDeleteId(null); }}>Cancel</button>
                <button type="submit" className="btn danger">Delete Round</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function HiSparkline({ history }: { history: number[] }) {
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = Math.max(max - min, 1);
  const W = 400, H = 64, PAD = 8;

  const pts = history.map((v, i) => {
    const x = PAD + (i / (history.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const first = history[0];
  const last = history[history.length - 1];
  const delta = last - first;
  const improved = delta < -0.05;
  const worsened = delta > 0.05;

  const lastX = PAD + (W - PAD * 2);
  const lastY = H - PAD - ((last - min) / range) * (H - PAD * 2);
  const firstY = H - PAD - ((first - min) / range) * (H - PAD * 2);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
        <span>HI trend — {history.length} rounds</span>
        {improved && <span style={{ color: 'var(--green)' }}>↓ {Math.abs(delta).toFixed(1)} improvement</span>}
        {worsened && <span style={{ color: 'var(--muted)' }}>↑ {delta.toFixed(1)}</span>}
        {!improved && !worsened && <span style={{ color: 'var(--muted)' }}>Stable</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }} preserveAspectRatio="none">
        <polyline
          points={pts}
          fill="none"
          stroke="var(--green)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={PAD.toFixed(1)} cy={firstY.toFixed(1)} r="3.5" fill="var(--green)" opacity="0.4" />
        <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r="4.5" fill="var(--green)" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
        <span>First round · {first.toFixed(1)}</span>
        <span>Now · {last.toFixed(1)}</span>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '6px 10px',
  color: 'var(--muted)', fontWeight: 600, fontSize: 12,
};
const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
};
