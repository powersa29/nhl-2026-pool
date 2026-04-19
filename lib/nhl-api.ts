const NHL_BASE = 'https://api-web.nhle.com/v1';
const SEASON = '20252026';

export interface PlayerStats {
  name: string;
  gp: number;
  g: number;
  a: number;
  pts: number;        // skaters: g+a; goalies: wins*2 + shutouts*3
  wins?: number;
  shutouts?: number;
}

export type TeamStatsMap = Record<string, PlayerStats>;

async function fetchTeamStats(teamAbbr: string): Promise<PlayerStats[]> {
  const url = `${NHL_BASE}/club-stats/${teamAbbr}/${SEASON}/2`;
  const res = await fetch(url, { next: { revalidate: 600 } }); // cache 10 min
  if (!res.ok) return [];
  const json = await res.json();

  const results: PlayerStats[] = [];

  for (const s of json.skaters ?? []) {
    results.push({
      name: `${s.firstName?.default ?? ''} ${s.lastName?.default ?? ''}`.trim(),
      gp: s.gamesPlayed ?? 0,
      g:  s.goals ?? 0,
      a:  s.assists ?? 0,
      pts: (s.goals ?? 0) + (s.assists ?? 0),
    });
  }
  for (const g of json.goalies ?? []) {
    const wins = g.wins ?? 0;
    const shutouts = g.shutouts ?? 0;
    results.push({
      name: `${g.firstName?.default ?? ''} ${g.lastName?.default ?? ''}`.trim(),
      gp: g.gamesPlayed ?? 0,
      g: 0,
      a: 0,
      pts: wins * 2 + shutouts * 3,
      wins,
      shutouts,
    });
  }
  return results;
}

export async function fetchAllTeamStats(abbrs: string[]): Promise<TeamStatsMap> {
  const all = await Promise.allSettled(abbrs.map(fetchTeamStats));
  const map: TeamStatsMap = {};
  all.forEach((result, i) => {
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
  // fallback: match on last name
  const lastName = key.split(' ').pop() ?? '';
  const match = Object.keys(statsMap).find(k => k.endsWith(lastName));
  return match ? statsMap[match] : null;
}
