const NHL_BASE = 'https://api-web.nhle.com/v1';

export interface GameScore {
  id: number;
  away: string;
  home: string;
  awayScore: number;
  homeScore: number;
  state: 'LIVE' | 'FINAL' | 'PRE' | 'FUT' | string;
  period?: string;
  clock?: string;
}

export async function fetchScores(date: string): Promise<GameScore[]> {
  try {
    const res = await fetch(`${NHL_BASE}/score/${date}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.games ?? []).map((g: Record<string, unknown>) => {
      const away = (g.awayTeam ?? {}) as Record<string, unknown>;
      const home = (g.homeTeam ?? {}) as Record<string, unknown>;
      const period = (g.periodDescriptor ?? {}) as Record<string, unknown>;
      const clock = (g.clock ?? {}) as Record<string, unknown>;
      const state = String(g.gameState ?? 'FUT');
      return {
        id: Number(g.id ?? 0),
        away: String(away.abbrev ?? '???'),
        home: String(home.abbrev ?? '???'),
        awayScore: Number(away.score ?? 0),
        homeScore: Number(home.score ?? 0),
        state,
        period: period.periodType === 'OT' ? 'OT' : period.number ? `P${period.number}` : undefined,
        clock: state === 'LIVE' ? String(clock.timeRemaining ?? '') : undefined,
      } as GameScore;
    });
  } catch {
    return [];
  }
}

export function todayDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

export function yesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
}
