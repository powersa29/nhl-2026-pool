'use client';
import { useState } from 'react';
import type { Participant } from '@/lib/db';

export default function AdminClient({
  participants: initial,
  secret,
}: {
  participants: Participant[];
  secret: string;
}) {
  const [participants, setParticipants] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>Admin Panel</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>{participants.length} entries</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {refreshMsg && <span style={{ fontSize: 13, color: 'var(--green)' }}>{refreshMsg}</span>}
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
