const NHL_BASE = 'https://api-web.nhle.com/v1';
const SEASON = '20252026';

export interface PlayerStats {
  name: string;
  gp: number;
  g: number;
  a: number;
  ppg: number;
  shg: number;
  otg: number;
  pts: number;      // skaters: g+a+ppg+shg+otg; goalies: wins*2 - losses + shutouts*2 + g + a
  wins?: number;
  losses?: number;
  shutouts?: number;
}

export type TeamStatsMap = Record<string, PlayerStats>;

async function fetchTeamStats(teamAbbr: string): Promise<PlayerStats[]> {
  const url = `${NHL_BASE}/club-stats/${teamAbbr}/${SEASON}/3`;
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) return [];
  const json = await res.json();

  const results: PlayerStats[] = [];

  for (const s of json.skaters ?? []) {
    const g   = s.goals ?? 0;
    const a   = s.assists ?? 0;
    const ppg = s.powerPlayGoals ?? 0;
    const shg = s.shorthandedGoals ?? 0;
    const otg = s.overtimeGoals ?? 0;
    results.push({
      name: `${s.firstName?.default ?? ''} ${s.lastName?.default ?? ''}`.trim(),
      gp: s.gamesPlayed ?? 0,
      g, a, ppg, shg, otg,
      pts: g + a + ppg + shg + otg,
    });
  }

  for (const g of json.goalies ?? []) {
    const wins     = g.wins ?? 0;
    const losses   = g.losses ?? 0;
    const shutouts = g.shutouts ?? 0;
    const goals    = g.goals ?? 0;
    const assists  = g.assists ?? 0;
    results.push({
      name: `${g.firstName?.default ?? ''} ${g.lastName?.default ?? ''}`.trim(),
      gp: g.gamesPlayed ?? 0,
      g: goals, a: assists, ppg: 0, shg: 0, otg: 0,
      pts: wins * 2 - losses + shutouts * 2 + goals + assists,
      wins,
      losses,
      shutouts,
    });
  }

  return results;
}

export async function fetchAllTeamStats(abbrs: string[]): Promise<TeamStatsMap> {
  const all = await Promise.allSettled(abbrs.map(fetchTeamStats));
  const map: TeamStatsMap = {};
  all.forEach((result) => {
    if (result.status === 'fulfilled') {
      for (const p of result.value) {
        map[normalizeName(p.name)] = p;
      }
    }
  });
  return map;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, ' ');
}

export function lookupStats(statsMap: TeamStatsMap, playerName: string): PlayerStats | null {
  const key = normalizeName(playerName);
  if (statsMap[key]) return statsMap[key];
  // Fallback: match first initial + last name to handle minor name differences
  // (e.g. "TJ Oshie" vs "T.J. Oshie") but NOT cross-player last-name collisions
  const parts = key.split(' ');
  if (parts.length < 2) return null;
  const firstInitial = parts[0][0];
  const lastName = parts[parts.length - 1];
  const match = Object.keys(statsMap).find(k => {
    const kp = k.split(' ');
    return kp.length >= 2 && kp[0][0] === firstInitial && kp[kp.length - 1] === lastName;
  });
  return match ? statsMap[match] : null;
}
