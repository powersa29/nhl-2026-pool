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
    const res = await fetch(`${NHL_BASE}/playoff-bracket/2026`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const json = await res.json();
      return parseBracket(json);
    }
  } catch { /* fall through */ }
  return [];
}

function parseBracket(json: Record<string, unknown>): LiveRound[] {
  // API returns a flat `series` array; group by playoffRound
  const allSeries = (json.series ?? []) as Record<string, unknown>[];

  const byRound: Record<number, LiveSeries[]> = {};
  for (const s of allSeries) {
    const round = Number(s.playoffRound ?? 1);
    const topTeam = (s.topSeedTeam ?? {}) as Record<string, unknown>;
    const botTeam = (s.bottomSeedTeam ?? {}) as Record<string, unknown>;
    const a = String(topTeam.abbrev ?? topTeam.triCode ?? '???');
    const b = String(botTeam.abbrev ?? botTeam.triCode ?? '???');
    const aw = Number(s.topSeedWins ?? 0);
    const bw = Number(s.bottomSeedWins ?? 0);
    if (!byRound[round]) byRound[round] = [];
    byRound[round].push({ a, b, aw, bw, status: buildStatus(a, b, aw, bw) });
  }

  const activeRound = Math.min(
    ...Object.keys(byRound).map(Number).filter(r => byRound[r].some(s => s.aw < 4 && s.bw < 4)),
    4
  );

  return [1, 2, 3, 4].map((r, i) => ({
    name: ROUND_NAMES[i],
    active: r === activeRound,
    series: byRound[r] ?? [],
  }));
}

function buildStatus(a: string, b: string, aw: number, bw: number): string {
  if (aw === 4) return `${a} win 4-${bw}`;
  if (bw === 4) return `${b} win 4-${aw}`;
  if (aw === bw) return `Tied ${aw}-${bw}`;
  const leader = aw > bw ? a : b;
  const w = Math.max(aw, bw), l = Math.min(aw, bw);
  return `${leader} leads ${w}-${l}`;
}
