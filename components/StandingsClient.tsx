'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Participant } from '@/lib/db';

type SortKey = 'rank' | 'name' | 'total';

export default function StandingsClient({ participants, rankSnapshot, id }: { participants: Participant[]; rankSnapshot?: Record<number, number> | null; id?: string }) {
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState(1);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'top10'>('all');

  const sorted = useMemo(() => {
    let list = [...participants];
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
    if (filter === 'top10') list = list.slice(0, 10);
    return list.sort((a, b) => {
      if (sortKey === 'name') return sortDir * a.name.localeCompare(b.name);
      if (sortKey === 'total') return sortDir * ((a.total ?? 0) - (b.total ?? 0));
      return sortDir * ((a.rank ?? 0) - (b.rank ?? 0));
    });
  }, [participants, sortKey, sortDir, q, filter]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(-sortDir);
    else { setSortKey(k); setSortDir(k === 'rank' || k === 'name' ? 1 : -1); }
  };

  const arrow = (k: SortKey) => sortKey === k ? (sortDir > 0 ? '▲' : '▼') : '▲';

  return (
    <section className="card" id={id}>
      <div className="card-header">
        <div>
          <h2><span className="strike">Leaderboard</span></h2>
          <p style={{ color: 'var(--muted)', marginTop: 8, fontSize: 14 }}>Updated live from NHL.com · tap any row to see their roster</p>
        </div>
        <div className="lb-controls">
          <input className="input" placeholder="Search name…" value={q} onChange={e => setQ(e.target.value)} />
          <div className="seg">
            <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button>
            <button className={filter === 'top10' ? 'on' : ''} onClick={() => setFilter('top10')}>Top 10</button>
          </div>
        </div>
      </div>

      <div className="lb">
        <div className={`th ${sortKey === 'rank' ? 'active' : ''}`} onClick={() => toggleSort('rank')}>Rank <span className="arrow">{arrow('rank')}</span></div>
        <div className={`th ${sortKey === 'name' ? 'active' : ''}`} onClick={() => toggleSort('name')}>Participant <span className="arrow">{arrow('name')}</span></div>
        <div className={`th ${sortKey === 'total' ? 'active' : ''}`} onClick={() => toggleSort('total')}>Points <span className="arrow">{arrow('total')}</span></div>
        <div className="th col-gp">Picks</div>
        <div className="th col-move">Move</div>

        {sorted.map(p => {
          const prevRank = rankSnapshot?.[p.id];
          const move = prevRank != null ? prevRank - (p.rank ?? 0) : null;
          return (
            <Link key={p.id} href={`/participant/${p.id}`} style={{ display: 'contents' }}>
              <div className={`row ${p.rank === 1 ? 'top1' : ''}`} style={{ display: 'contents', cursor: 'pointer' }}>
                <div className="td">
                  <div className={`rank-badge ${p.rank! <= 3 ? 'rank' + p.rank : ''}`}>{p.rank}</div>
                </div>
                <div className="td">
                  <div className="name-cell">
                    <div className="n">{p.name}</div>
                    <div className="sub">Joined {new Date(p.created_at ?? p.joined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · Entry #{p.id}</div>
                  </div>
                </div>
                <div className="td" style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 22 }}>{p.total ?? 0}</div>
                <div className="td col-gp" style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {(p.roster ?? []).length}/16
                </div>
                <div className="td col-move">
                  {move === null ? (
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>—</span>
                  ) : move === 0 ? (
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>—</span>
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 700, color: move > 0 ? 'var(--green)' : 'var(--red)' }}>
                      {move > 0 ? '▲' : '▼'} {Math.abs(move)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      {sorted.length === 0 && (
        participants.length === 0
          ? <div className="empty-state">No entries yet — be the first! <a href="/signup" style={{ color: 'var(--red)', fontWeight: 700 }}>Join the pool →</a></div>
          : <div className="empty-state">No entries match.</div>
      )}
    </section>
  );
}
