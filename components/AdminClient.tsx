'use client';
import { useState, useMemo } from 'react';
import type { Participant } from '@/lib/db';
import { ROUNDS, TEAMS, PLAYERS } from '@/lib/data';

type Series = { a: string; b: string; aw: number; bw: number; status: string };
type Round = { name: string; active: boolean; series: Series[] };
type RosterPick = { team: string; playerName: string; pos: string };

const EMPTY_PICK: RosterPick = { team: '', playerName: '', pos: '' };

function RosterEditor({
  participantId,
  initialRoster,
  secret,
  onSaved,
  onClose,
}: {
  participantId: number;
  initialRoster: RosterPick[];
  secret: string;
  onSaved: (roster: RosterPick[]) => void;
  onClose: () => void;
}) {
  const [picks, setPicks] = useState<RosterPick[]>(() => {
    const base = [...initialRoster];
    while (base.length < 16) base.push({ ...EMPTY_PICK });
    return base.slice(0, 16);
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const updatePick = (i: number, field: keyof RosterPick, val: string) => {
    setPicks(prev => {
      const next = prev.map(p => ({ ...p }));
      next[i] = { ...next[i], [field]: val };
      if (field === 'team') {
        next[i].playerName = '';
        next[i].pos = '';
      }
      if (field === 'playerName') {
        const player = PLAYERS.find(p => p.name === val && p.team === next[i].team);
        if (player) next[i].pos = player.pos;
      }
      return next;
    });
  };

  const playersForTeam = (team: string) => PLAYERS.filter(p => p.team === team);

  const save = async () => {
    const roster = picks.filter(p => p.team && p.playerName && p.pos);
    setSaving(true);
    setMsg('');
    const res = await fetch('/api/admin/participant', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ id: participantId, roster }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.ok) {
      setMsg('✓ Saved');
      onSaved(roster);
    } else {
      setMsg(`Error: ${json.error}`);
    }
  };

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 16, marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 60px', gap: '6px 10px', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Team</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Player</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Pos</div>
        {picks.map((pick, i) => (
          <>
            <select
              key={`team-${i}`}
              className="input"
              style={{ fontSize: 13, padding: '5px 8px' }}
              value={pick.team}
              onChange={e => updatePick(i, 'team', e.target.value)}
            >
              <option value="">— Team —</option>
              {TEAMS.map(t => <option key={t.abbr} value={t.abbr}>{t.abbr} — {t.name}</option>)}
            </select>
            <select
              key={`player-${i}`}
              className="input"
              style={{ fontSize: 13, padding: '5px 8px' }}
              value={pick.playerName}
              onChange={e => updatePick(i, 'playerName', e.target.value)}
              disabled={!pick.team}
            >
              <option value="">— Player —</option>
              {playersForTeam(pick.team).map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
            <div key={`pos-${i}`} style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700, color: pick.pos === 'G' ? 'var(--blue)' : pick.pos === 'D' ? 'var(--yellow)' : 'var(--green)' }}>
              {pick.pos || '—'}
            </div>
          </>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn red" onClick={save} disabled={saving} style={{ opacity: saving ? 0.6 : 1, fontSize: 13 }}>
          {saving ? 'Saving…' : '💾 Save Roster'}
        </button>
        <button className="btn ghost" onClick={onClose} style={{ fontSize: 13 }}>Cancel</button>
        {msg && <span style={{ fontSize: 13, color: msg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{msg}</span>}
      </div>
    </div>
  );
}

export default function AdminClient({
  participants: initial,
  secret,
  savedRounds,
}: {
  participants: Participant[];
  secret: string;
  savedRounds: Round[] | null;
}) {
  const [participants, setParticipants] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [savingTbId, setSavingTbId] = useState<number | null>(null);
  const [tiebreakers, setTiebreakers] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    for (const p of initial) map[p.id] = p.tiebreaker != null ? String(p.tiebreaker) : '';
    return map;
  });

  const defaultRounds: Round[] = (savedRounds ?? ROUNDS).map(r => ({
    name: r.name,
    active: r.active,
    series: r.series.map(s => ({ ...s })),
  }));
  const [rounds, setRounds] = useState<Round[]>(defaultRounds);
  const [savingRounds, setSavingRounds] = useState(false);
  const [roundsMsg, setRoundsMsg] = useState('');

  const refreshStats = async () => {
    setRefreshing(true);
    setRefreshMsg('');
    const res = await fetch('/api/refresh', {
      method: 'POST',
      headers: { 'x-admin-secret': secret },
    });
    const json = await res.json();
    setRefreshing(false);
    setRefreshMsg(json.ok ? `✓ Stats refreshed at ${new Date().toLocaleTimeString()}` : `Error: ${json.error}`);
  };

  const deleteEntry = async (id: number, name: string) => {
    if (!confirm(`Delete ${name}'s entry? This cannot be undone.`)) return;
    setDeletingId(id);
    const res = await fetch('/api/admin/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    if (json.ok) {
      setParticipants(prev => prev.filter(p => p.id !== id));
      setEditingId(prev => prev === id ? null : prev);
    } else {
      alert(`Failed to delete: ${json.error}`);
    }
    setDeletingId(null);
  };

  const saveTiebreaker = async (id: number) => {
    setSavingTbId(id);
    const val = tiebreakers[id];
    const tiebreaker = val === '' ? null : Number(val);
    await fetch('/api/admin/participant', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ id, tiebreaker }),
    });
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, tiebreaker } : p));
    setSavingTbId(null);
  };

  const updateSeries = (ri: number, si: number, field: keyof Series, val: string | number) => {
    setRounds(prev => {
      const next = prev.map(r => ({ ...r, series: r.series.map(s => ({ ...s })) }));
      (next[ri].series[si] as Record<string, unknown>)[field] = val;
      return next;
    });
  };

  const saveRounds = async () => {
    setSavingRounds(true);
    setRoundsMsg('');
    const res = await fetch('/api/admin/rounds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ rounds }),
    });
    const json = await res.json();
    setSavingRounds(false);
    setRoundsMsg(json.ok ? `✓ Saved at ${new Date().toLocaleTimeString()}` : `Error: ${json.error}`);
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>Admin Panel</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>{participants.length} entries</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {refreshMsg && <span style={{ fontSize: 13, color: refreshMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{refreshMsg}</span>}
          <button className="btn red" onClick={refreshStats} disabled={refreshing} style={{ opacity: refreshing ? 0.6 : 1 }}>
            {refreshing ? 'Refreshing…' : '↻ Refresh NHL Stats'}
          </button>
          <a href="/"><button className="btn ghost">← Back to site</button></a>
        </div>
      </div>

      {/* Rounds Editor */}
      <section className="card" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18 }}>Playoff Bracket Editor</h3>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {roundsMsg && <span style={{ fontSize: 13, color: roundsMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{roundsMsg}</span>}
            <button className="btn red" onClick={saveRounds} disabled={savingRounds} style={{ opacity: savingRounds ? 0.6 : 1 }}>
              {savingRounds ? 'Saving…' : '💾 Save Rounds'}
            </button>
          </div>
        </div>
        {rounds.map((round, ri) => (
          <div key={ri} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--muted)' }}>{round.name}</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={round.active}
                  onChange={e => setRounds(prev => {
                    const next = prev.map(r => ({ ...r, series: r.series.map(s => ({ ...s })) }));
                    next[ri].active = e.target.checked;
                    return next;
                  })}
                />
                Active
              </label>
              {ri === 0 && round.series.length === 0 && (
                <button
                  className="btn ghost"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => setRounds(prev => {
                    const next = prev.map(r => ({ ...r, series: r.series.map(s => ({ ...s })) }));
                    next[ri].series = ROUNDS[0].series.map(s => ({ ...s }));
                    return next;
                  })}
                >
                  + Add R1 matchups
                </button>
              )}
            </div>
            {round.series.length === 0 && (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>No series yet.</div>
            )}
            {round.series.map((s, si) => (
              <div key={si} style={{ display: 'grid', gridTemplateColumns: '80px 80px 50px 50px 1fr auto', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input className="input" style={{ fontSize: 13, padding: '6px 8px' }} value={s.a} onChange={e => updateSeries(ri, si, 'a', e.target.value.toUpperCase())} placeholder="Team A" maxLength={3} />
                <input className="input" style={{ fontSize: 13, padding: '6px 8px' }} value={s.b} onChange={e => updateSeries(ri, si, 'b', e.target.value.toUpperCase())} placeholder="Team B" maxLength={3} />
                <input className="input" style={{ fontSize: 13, padding: '6px 8px', textAlign: 'center' }} type="number" min={0} max={4} value={s.aw} onChange={e => updateSeries(ri, si, 'aw', +e.target.value)} title="Team A wins" />
                <input className="input" style={{ fontSize: 13, padding: '6px 8px', textAlign: 'center' }} type="number" min={0} max={4} value={s.bw} onChange={e => updateSeries(ri, si, 'bw', +e.target.value)} title="Team B wins" />
                <input className="input" style={{ fontSize: 13, padding: '6px 8px' }} value={s.status} onChange={e => updateSeries(ri, si, 'status', e.target.value)} placeholder="Status text" />
                <button onClick={() => setRounds(prev => { const next = prev.map(r => ({ ...r, series: r.series.map(s2 => ({ ...s2 })) })); next[ri].series.splice(si, 1); return next; })} style={{ fontSize: 12, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>✕</button>
              </div>
            ))}
            <button className="btn ghost" style={{ fontSize: 12, padding: '4px 10px', marginTop: 4 }} onClick={() => setRounds(prev => { const next = prev.map(r => ({ ...r, series: r.series.map(s => ({ ...s })) })); next[ri].series.push({ a: '', b: '', aw: 0, bw: 0, status: '' }); return next; })}>
              + Add series
            </button>
          </div>
        ))}
      </section>

      {/* Participants Table */}
      <section className="card">
        <h3 style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18, marginBottom: 16 }}>
          Entries ({participants.length})
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>ID</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Name</th>
                <th style={{ textAlign: 'center', padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Picks</th>
                <th style={{ textAlign: 'center', padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Tiebreaker</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Joined</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {participants.map(p => (
                <>
                  <tr key={p.id} style={{ borderBottom: editingId === p.id ? 'none' : '1px solid var(--border)' }}>
                    <td style={{ padding: '10px', color: 'var(--muted)' }}>#{p.id}</td>
                    <td style={{ padding: '10px', fontWeight: 700 }}>{p.name}</td>
                    <td style={{ padding: '10px', textAlign: 'center', color: (p.roster ?? []).length === 16 ? 'var(--green)' : 'var(--red)' }}>
                      {(p.roster ?? []).length}/16
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                        <input
                          type="number"
                          className="input"
                          style={{ width: 70, fontSize: 13, padding: '4px 8px', textAlign: 'center' }}
                          value={tiebreakers[p.id] ?? ''}
                          onChange={e => setTiebreakers(prev => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="—"
                        />
                        <button
                          onClick={() => saveTiebreaker(p.id)}
                          disabled={savingTbId === p.id}
                          style={{ fontSize: 12, padding: '4px 8px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: savingTbId === p.id ? 0.5 : 1 }}
                        >
                          {savingTbId === p.id ? '…' : '✓'}
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '10px', color: 'var(--muted)', fontSize: 12 }}>
                      {new Date(p.created_at ?? p.joined_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setEditingId(prev => prev === p.id ? null : p.id)}
                          style={{ fontSize: 12, fontWeight: 600, color: 'white', background: editingId === p.id ? 'var(--muted)' : 'var(--blue)', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}
                        >
                          {editingId === p.id ? 'Close' : 'Edit Roster'}
                        </button>
                        <button
                          onClick={() => deleteEntry(p.id, p.name)}
                          disabled={deletingId === p.id}
                          style={{ fontSize: 12, fontWeight: 700, color: 'white', background: 'var(--red)', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', opacity: deletingId === p.id ? 0.5 : 1 }}
                        >
                          {deletingId === p.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingId === p.id && (
                    <tr key={`edit-${p.id}`}>
                      <td colSpan={6} style={{ padding: '0 10px 16px', borderBottom: '1px solid var(--border)' }}>
                        <RosterEditor
                          participantId={p.id}
                          initialRoster={p.roster ?? []}
                          secret={secret}
                          onSaved={roster => setParticipants(prev => prev.map(x => x.id === p.id ? { ...x, roster } : x))}
                          onClose={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        {participants.length === 0 && (
          <div className="empty-state">No entries yet.</div>
        )}
      </section>
    </>
  );
}
