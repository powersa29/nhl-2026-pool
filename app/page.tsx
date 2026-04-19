import { getParticipants } from '@/lib/db';
import { fetchAllTeamStats, lookupStats } from '@/lib/nhl-api';
import { TEAMS, PLAYERS, ROUNDS } from '@/lib/data';
import StandingsClient from '@/components/StandingsClient';
import Ticker from '@/components/Ticker';
import type { Participant } from '@/lib/db';

export const revalidate = 600; // revalidate every 10 min

function buildTicker(statsMap: Record<string, ReturnType<typeof lookupStats>>) {
  const scorers = PLAYERS.filter(p => {
    const s = lookupStats(statsMap as never, p.name);
    return s && s.pts > 0;
  }).slice(0, 40);

  return scorers.slice(0, 20).map((p, i) => {
    const s = lookupStats(statsMap as never, p.name);
    return {
      id: i,
      player: p.name,
      team: p.team,
      kind: (i % 2 === 0 ? 'GOAL' : 'ASSIST') as 'GOAL' | 'ASSIST',
      opp: TEAMS[(TEAMS.findIndex(t => t.abbr === p.team) + 1) % TEAMS.length].abbr,
      time: `${Math.floor(i / 7) + 1}P ${i % 20}:${String(30 + i).padStart(2, '0')}`,
    };
  });
}

export default async function Home() {
  const [rawParticipants, statsMap] = await Promise.all([
    getParticipants().catch(() => [] as Participant[]),
    fetchAllTeamStats(TEAMS.map(t => t.abbr)).catch(() => ({})),
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
  const ticker = buildTicker(statsMap as never);

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

      {ticker.length > 0 && <Ticker items={ticker} />}

      <StandingsClient participants={participants} id="standings" />
    </>
  );
}
