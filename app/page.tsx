import { getParticipants, getRankingsSnapshot } from '@/lib/db';
import { fetchAllTeamStats, lookupStats } from '@/lib/nhl-api';
import { TEAMS } from '@/lib/data';
import StandingsClient from '@/components/StandingsClient';
import ScoreTicker from '@/components/ScoreTicker';
import type { Participant } from '@/lib/db';

export const revalidate = 60; // revalidate every 1 min


export default async function Home() {
  const [rawParticipants, statsMap, rankSnapshot] = await Promise.all([
    getParticipants().catch(() => [] as Participant[]),
    fetchAllTeamStats(TEAMS.map(t => t.abbr)).catch(() => ({})),
    getRankingsSnapshot().catch(() => null),
  ]);

  // Augment participants with live scores
  const participants = rawParticipants.map((p, idx) => {
    const total = (p.roster ?? []).reduce((sum: number, pick: { playerName: string; pos: string }) => {
      const s = lookupStats(statsMap as never, pick.playerName);
      return sum + (s?.pts ?? 0);
    }, 0);
    return { ...p, total, rank: 0 };
  });
  participants.sort((a, b) => b.total - a.total);
  participants.forEach((p, i) => { p.rank = i + 1; });

  const topScore = participants[0]?.total ?? 0;

  return (
    <>
      <section className="hero">
        <div className="hero-grid">
          <div>
            <span className="hero-tag"><span className="pulse-dot" /> Round 1 · Live now</span>
            <h1>The Cup chase<br />is <span className="accent">on.</span></h1>
            <p className="hero-sub">Build your 16-team roster. One goalie, six d-men, nine forwards — one pick per team. Points roll in live from every playoff game.</p>
            <div className="hero-stats">
              <div className="stat-pill"><div className="k">{participants.length}</div><div className="l">Pool entries</div></div>
              <div className="stat-pill"><div className="k">{topScore}</div><div className="l">Top score</div></div>
            </div>
            <div style={{ marginTop: 22, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href="/signup"><button className="btn">Build my roster →</button></a>
              <a href="#standings"><button className="btn ghost">See standings</button></a>
            </div>
          </div>
          <div className="puck">
            <div className="puck-content">
              <div className="puck-number">16</div>
              <div className="puck-label">Teams · One pick each</div>
            </div>
          </div>
        </div>
      </section>

      <ScoreTicker />
      <StandingsClient participants={participants} rankSnapshot={rankSnapshot} id="standings" />
    </>
  );
}
