'use client';
import { useState } from 'react';
import type { Participant } from '@/lib/db';
import { ROUNDS } from '@/lib/data';

type Series = { a: string; b: string; aw: number; bw: number; status: string };
type Round = { name: string; active: boolean; series: Series[] };

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
    } else {
      alert(`Failed to delete: ${json.error}`);
    }
    setDeletingId(null);
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
          <button
            className="btn red"
            onClick={refreshStats}
            disabled={refreshing}
            style={{ opacity: refreshing ? 0.6 : 1 }}
          >
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
                <input
                  className="input"
                  style={{ fontSize: 13, padding: '6px 8px' }}
                  value={s.a}
                  onChange={e => updateSeries(ri, si, 'a', e.target.value.toUpperCase())}
                  placeholder="Team A"
                  maxLength={3}
                />
                <input
                  className="input"
                  style={{ fontSize: 13, padding: '6px 8px' }}
                  value={s.b}
                  onChange={e => updateSeries(ri, si, 'b', e.target.value.toUpperCase())}
                  placeholder="Team B"
                  maxLength={3}
                />
                <input
                  className="input"
                  style={{ fontSize: 13, padding: '6px 8px', textAlign: 'center' }}
                  type="number"
                  min={0}
                  max={4}
                  value={s.aw}
                  onChange={e => updateSeries(ri, si, 'aw', +e.target.value)}
                  title="Team A wins"
                />
                <input
                  className="input"
                  style={{ fontSize: 13, padding: '6px 8px', textAlign: 'center' }}
                  type="number"
                  min={0}
                  max={4}
                  value={s.bw}
                  onChange={e => updateSeries(ri, si, 'bw', +e.target.value)}
                  title="Team B wins"
                />
                <input
                  className="input"
                  style={{ fontSize: 13, padding: '6px 8px' }}
                  value={s.status}
                  onChange={e => updateSeries(ri, si, 'status', e.target.value)}
                  placeholder="Status text"
                />
                <button
                  onClick={() => setRounds(prev => {
                    const next = prev.map(r => ({ ...r, series: r.series.map(s2 => ({ ...s2 })) }));
                    next[ri].series.splice(si, 1);
                    return next;
                  })}
                  style={{ fontSize: 12, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              className="btn ghost"
              style={{ fontSize: 12, padding: '4px 10px', marginTop: 4 }}
              onClick={() => setRounds(prev => {
                const next = prev.map(r => ({ ...r, series: r.series.map(s => ({ ...s })) }));
                next[ri].series.push({ a: '', b: '', aw: 0, bw: 0, status: '' });
                return next;
              })}
            >
              + Add series
            </button>
          </div>
        ))}
      </section>

      {/* Participants Table */}
      <section className="card">
        <div className="lb" style={{ gridTemplateColumns: '60px 1fr 80px 80px 80px' }}>
          <div className="th">ID</div>
          <div className="th">Name</div>
          <div className="th">Picks</div>
          <div className="th">Joined</div>
          <div className="th">Action</div>

          {participants.map(p => (
            <div key={p.id} className="row" style={{ display: 'contents' }}>
              <div className="td" style={{ color: 'var(--muted)', fontSize: 13 }}>#{p.id}</div>
              <div className="td">
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {(p.roster ?? []).map((r: {playerName: string}) => r.playerName).slice(0, 3).join(', ')}{(p.roster ?? []).length > 3 ? '…' : ''}
                </div>
              </div>
              <div className="td" style={{ fontSize: 13, color: 'var(--muted)' }}>
                {(p.roster ?? []).length}/16
              </div>
              <div className="td" style={{ fontSize: 12, color: 'var(--muted)' }}>
                {new Date(p.joined_at).toLocaleDateString()}
              </div>
              <div className="td">
                <button
                  onClick={() => deleteEntry(p.id, p.name)}
                  disabled={deletingId === p.id}
                  style={{
                    fontSize: 12, fontWeight: 700, color: 'white',
                    background: 'var(--red)', border: 'none', borderRadius: 8,
                    padding: '5px 10px', cursor: 'pointer', opacity: deletingId === p.id ? 0.5 : 1
                  }}
                >
                  {deletingId === p.id ? '…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
        {participants.length === 0 && (
          <div className="empty-state">No entries yet.</div>
        )}
      </section>
    </>
  );
}
