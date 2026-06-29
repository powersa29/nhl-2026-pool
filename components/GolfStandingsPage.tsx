'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { League, StandingRow, SeasonStandingRow } from '@/lib/golf-db';
import { weekLabel } from '@/lib/golf-scoring';

interface Props {
  currentLeague: League;
  allLeagues: League[];
  initialStandings: StandingRow[];
  initialSeasonStandings: SeasonStandingRow[];
  stats: { playersWithRounds: number; totalRounds: number; totalPlayers: number };
  initialLabel: string;
}

type View = 'season' | number;

export default function GolfStandingsPage({
  currentLeague, allLeagues, initialStandings, initialSeasonStandings, stats, initialLabel,
}: Props) {
  const [view, setView] = useState<View>('season');
  const [weekStandings, setWeekStandings] = useState<StandingRow[]>(initialStandings);
  const [weekLabel_, setWeekLabel] = useState(initialLabel);
  const [seasonStandings, setSeasonStandings] = useState<SeasonStandingRow[]>(initialSeasonStandings);
  const [loading, setLoading] = useState(false);

  async function switchToWeek(leagueId: number) {
    if (view === leagueId) return;
    setLoading(true);
    setView(leagueId);
    const res = await fetch(`/api/standings?leagueId=${leagueId}`);
    const data = await res.json();
    setWeekStandings(data.standings);
    setWeekLabel(data.label);
    setLoading(false);
  }

  async function switchToSeason() {
    if (view === 'season') return;
    setLoading(true);
    setView('season');
    const res = await fetch('/api/standings?season=true');
    const data = await res.json();
    setSeasonStandings(data.standings);
    setLoading(false);
  }

  const isSeason = view === 'season';
  const topSeason = seasonStandings.find(r => r.weeksWon > 0);

  return (
    <>
      <section className="hero">
        <span className="hero-tag"><span className="pulse-dot" /> Live Standings</span>
        <h1 style={{ marginTop: 14 }}>
          Weekly<br /><span className="accent">Golf League</span>
        </h1>
        <p className="hero-sub">
          9-hole stroke play, handicap-adjusted net scoring. Play as many rounds as you
          want — your best net score each week counts.
        </p>
        <div className="hero-stats">
          <div className="stat-pill"><div className="k">{stats.totalPlayers}</div><div className="l">Players</div></div>
          <div className="stat-pill"><div className="k">{stats.totalRounds}</div><div className="l">Rounds this week</div></div>
          {topSeason && <div className="stat-pill"><div className="k">{topSeason.weeksWon}</div><div className="l">Most week wins</div></div>}
        </div>
        <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/record"><button className="btn" style={{ flex: '1 1 auto' }}>+ Record a Round</button></Link>
          <Link href="/join" style={{ flex: '1 1 auto' }}><button className="btn ghost" style={{ width: '100%' }}>Join the League</button></Link>
        </div>
      </section>

      <div className="card">
        <div className="card-header">
          <h2>{isSeason ? 'Season Standings' : weekLabel_}</h2>
          <span className="tag green">{isSeason ? '2026 Season' : 'This Week'}</span>
        </div>

        <div className="week-selector">
          <button className={`week-pill ${isSeason ? 'active' : ''}`} onClick={switchToSeason}>
            Season
          </button>
          {allLeagues.map(l => (
            <button
              key={l.id}
              className={`week-pill ${view === l.id ? 'active' : ''}`}
              onClick={() => switchToWeek(l.id)}
            >
              {weekLabel(l.start_date)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : isSeason ? (
          <SeasonTable standings={seasonStandings} />
        ) : weekStandings.length === 0 ? (
          <div className="empty-state">
            No rounds yet — <Link href="/join" style={{ color: 'var(--green)' }}>join the league</Link> to get started.
          </div>
        ) : (
          <WeekTable standings={weekStandings} />
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>
        Net = Gross − Course Handicap (9 holes)
      </div>
    </>
  );
}

function SeasonTable({ standings }: { standings: SeasonStandingRow[] }) {
  if (standings.every(r => r.weeksPlayed === 0)) {
    return (
      <div className="empty-state">
        No rounds recorded yet — <Link href="/record" style={{ color: 'var(--green)' }}>record a round</Link> to start the season.
      </div>
    );
  }

  return (
    <div className="lb">
      <div className="th">Rank</div>
      <div className="th">Player</div>
      <div className="th">Weeks Won</div>
      <div className="th col-hcp">Played</div>
      <div className="th col-rounds">Rounds</div>
      <div className="th col-course"></div>

      {standings.map((row, i) => (
        <div key={row.player.id} className={`row ${i === 0 && row.weeksWon > 0 ? 'top1' : i === 1 && row.weeksWon > 0 ? 'top2' : i === 2 && row.weeksWon > 0 ? 'top3' : ''}`}>
          <div className="td">
            <div className={`rank-badge ${row.weeksPlayed === 0 ? 'no-score' : i === 0 && row.weeksWon > 0 ? 'rank1' : i === 1 && row.weeksWon > 0 ? 'rank2' : i === 2 && row.weeksWon > 0 ? 'rank3' : ''}`}>
              {row.rank}
            </div>
          </div>
          <div className="td">
            <div className="name-cell">
              <Link href={`/player/${row.player.id}`} className="n" style={{ color: 'inherit' }}>
                {row.player.name}
              </Link>
            </div>
          </div>
          <div className="td">
            {row.weeksWon > 0
              ? <span className="net-score">{row.weeksWon}W</span>
              : <span className="net-score none">{row.weeksPlayed > 0 ? '—' : 'no rounds'}</span>}
          </div>
          <div className="td col-hcp">
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{row.weeksPlayed}</span>
          </div>
          <div className="td col-rounds">
            <span style={{ fontWeight: 600 }}>{row.totalRounds}</span>
          </div>
          <div className="td col-course">
            <Link href={`/player/${row.player.id}`}>
              <button className="btn ghost" style={{ padding: '6px 12px', fontSize: 12 }}>View</button>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

function WeekTable({ standings }: { standings: StandingRow[] }) {
  return (
    <div className="lb">
      <div className="th">Rank</div>
      <div className="th">Player</div>
      <div className="th">Best Net</div>
      <div className="th col-hcp">Handicap</div>
      <div className="th col-rounds">Rounds</div>
      <div className="th col-course"></div>

      {standings.map((row, i) => (
        <div key={row.player.id} className={`row ${i === 0 && row.bestNet !== null ? 'top1' : i === 1 && row.bestNet !== null ? 'top2' : i === 2 && row.bestNet !== null ? 'top3' : ''}`}>
          <div className="td">
            <div className={`rank-badge ${row.bestNet === null ? 'no-score' : i === 0 ? 'rank1' : i === 1 ? 'rank2' : i === 2 ? 'rank3' : ''}`}>
              {row.rank}
            </div>
          </div>
          <div className="td">
            <div className="name-cell">
              <Link href={`/player/${row.player.id}`} className="n" style={{ color: 'inherit' }}>
                {row.player.name}
              </Link>
              {row.rounds.length > 0 && row.rounds[0].golf_courses && (
                <span className="sub">{row.rounds[0].golf_courses.name}</span>
              )}
            </div>
          </div>
          <div className="td">
            {row.bestNet !== null
              ? <span className="net-score">{row.bestNet}</span>
              : <span className="net-score none">no rounds</span>}
          </div>
          <div className="td col-hcp">
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{row.player.handicap_index.toFixed(1)}</span>
          </div>
          <div className="td col-rounds">
            <span style={{ fontWeight: 600 }}>
              {row.roundsPlayed}
            </span>
          </div>
          <div className="td col-course">
            <Link href={`/player/${row.player.id}`}>
              <button className="btn ghost" style={{ padding: '6px 12px', fontSize: 12 }}>View</button>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
