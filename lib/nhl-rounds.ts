const NHL_BASE = 'https://api-web.nhle.com/v1';

export interface LiveSeries {
  a: string;
  b: string;
  aw: number;
  bw: number;
  status: string;
}

export interface LiveRound {
  name: string;
  active: boolean;
  series: LiveSeries[];
}

const ROUND_NAMES = ['First Round', 'Second Round', 'Conf. Finals', 'Stanley Cup Finals'];

export async function fetchPlayoffRounds(): Promise<LiveRound[]> {
  try {
    // Try the bracket endpoint for current season
    const res = await fetch(`${NHL_BASE}/playoff-bracket/2025`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const json = await res.json();
      return parseBracket(json);
    }
  } catch { /* fall through */ }

  try {
    // Alternative: series endpoint
    const res = await fetch(`${NHL_BASE}/series/playoffs`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const json = await res.json();
      return parseSeries(json);
    }
  } catch { /* fall through */ }

  // Final fallback: pull from schedule to find active playoff games
  return fetchRoundsFromSchedule();
}

function parseBracket(json: Record<string, unknown>): LiveRound[] {
  const rounds: LiveRound[] = [];
  const roundsData = (json.rounds ?? json.bracket ?? []) as Record<string, unknown>[];
  for (let i = 0; i < 4; i++) {
    const r = roundsData[i] as Record<string, unknown> | undefined;
    const seriesArr = (r?.series ?? r?.matchups ?? []) as Record<string, unknown>[];
    const series: LiveSeries[] = seriesArr.map((s: Record<string, unknown>) => {
      const topTeam = (s.topSeedTeam ?? s.team1 ?? {}) as Record<string, unknown>;
      const botTeam = (s.bottomSeedTeam ?? s.team2 ?? {}) as Record<string, unknown>;
      const aAbbr = String(topTeam.abbrev ?? topTeam.triCode ?? '???');
      const bAbbr = String(botTeam.abbrev ?? botTeam.triCode ?? '???');
      const aw = Number(s.topSeedWins ?? s.team1Wins ?? 0);
      const bw = Number(s.bottomSeedWins ?? s.team2Wins ?? 0);
      return {
        a: aAbbr, b: bAbbr, aw, bw,
        status: buildStatus(aAbbr, bAbbr, aw, bw),
      };
    });
    rounds.push({ name: ROUND_NAMES[i] ?? `Round ${i + 1}`, active: i === 0, series });
  }
  return rounds;
}

function parseSeries(json: Record<string, unknown>): LiveRound[] {
  const allSeries = (json.series ?? json.data ?? []) as Record<string, unknown>[];
  const byRound: Record<number, LiveSeries[]> = {};
  for (const s of allSeries) {
    const round = Number(s.playoffRound ?? s.round ?? 1);
    const a = String((s.topSeedTeam as Record<string, unknown>)?.abbrev ?? '???');
    const b = String((s.bottomSeedTeam as Record<string, unknown>)?.abbrev ?? '???');
    const aw = Number(s.topSeedWins ?? 0);
    const bw = Number(s.bottomSeedWins ?? 0);
    if (!byRound[round]) byRound[round] = [];
    byRound[round].push({ a, b, aw, bw, status: buildStatus(a, b, aw, bw) });
  }
  return [1, 2, 3, 4].map((r, i) => ({
    name: ROUND_NAMES[i],
    active: r === Math.min(...Object.keys(byRound).map(Number).filter(k => byRound[k].some(s => s.aw + s.bw < 8))),
    series: byRound[r] ?? [],
  }));
}

async function fetchRoundsFromSchedule(): Promise<LiveRound[]> {
  // Return static fallback — rounds data is updated manually in lib/data.ts
  return [];
}

function buildStatus(a: string, b: string, aw: number, bw: number): string {
  if (aw === 4) return `${a} win 4-${bw}`;
  if (bw === 4) return `${b} win 4-${aw}`;
  if (aw === bw) return `Tied ${aw}-${bw}`;
  const leader = aw > bw ? a : b;
  const w = Math.max(aw, bw), l = Math.min(aw, bw);
  return `${leader} leads ${w}-${l}`;
}
