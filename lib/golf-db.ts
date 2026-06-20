import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { weekBounds, toDateStr, netScore } from './golf-scoring';

let _client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars not set');
  _client = createClient(url, key);
  return _client;
}

export interface Player {
  id: number;
  name: string;
  handicap_index: number;
  created_at: string;
}

export interface Course {
  id: number;
  name: string;
  city: string;
  state: string;
  lat?: number | null;
  lng?: number | null;
}

export interface Tee {
  id: number;
  course_id: number;
  tee_name: string;
  slope_rating: number;
  course_rating: number;
  yards_9: number | null;
}

export interface League {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
}

export interface Round {
  id: number;
  player_id: number;
  course_id: number;
  tee_id: number;
  league_id: number;
  gross_score: number;
  played_at: string;
  created_at: string;
  golf_players?: { name: string; handicap_index: number };
  golf_courses?: { name: string; city: string; state: string };
  golf_tees?: { tee_name: string; slope_rating: number; course_rating: number };
}

export interface StandingRow {
  player: Player;
  rounds: Round[];
  bestNet: number | null;
  roundsPlayed: number;
  rank: number;
}

export interface SeasonStandingRow {
  player: Player;
  weeksWon: number;
  weeksPlayed: number;
  totalRounds: number;
  rank: number;
}

// ── Players ──────────────────────────────────────────────────────────────────────────────

export async function getPlayers(): Promise<Player[]> {
  const { data, error } = await db()
    .from('golf_players')
    .select('*')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createPlayer(name: string, handicap_index: number): Promise<Player> {
  const { data, error } = await db()
    .from('golf_players')
    .insert({ name: name.trim(), handicap_index })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateHandicap(id: number, handicap_index: number): Promise<void> {
  const { error } = await db()
    .from('golf_players')
    .update({ handicap_index })
    .eq('id', id);
  if (error) throw error;
}

export async function getPlayer(id: number): Promise<Player | null> {
  const { data, error } = await db()
    .from('golf_players')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

// ── Courses & Tees ────────────────────────────────────────────────────────────────────────

export async function getCourses(): Promise<Course[]> {
  const { data, error } = await db()
    .from('golf_courses')
    .select('*')
    .order('state')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getTees(courseId: number): Promise<Tee[]> {
  const { data, error } = await db()
    .from('golf_tees')
    .select('*')
    .eq('course_id', courseId)
    .order('slope_rating');
  if (error) throw error;
  return data ?? [];
}

export async function getAllTees(): Promise<Tee[]> {
  const { data, error } = await db()
    .from('golf_tees')
    .select('*');
  if (error) throw error;
  return data ?? [];
}

export async function createCourse(name: string, city: string, state: string): Promise<Course> {
  const { data, error } = await db()
    .from('golf_courses')
    .insert({ name, city, state })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createTee(courseId: number, tee: {
  tee_name: string; slope_rating: number; course_rating: number; yards_9: number | null;
}): Promise<Tee> {
  const { data, error } = await db()
    .from('golf_tees')
    .insert({ course_id: courseId, ...tee })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Leagues ─────────────────────────────────────────────────────────────────────────────

export async function getOrCreateCurrentLeague(): Promise<League> {
  const { start, end } = weekBounds();
  const startStr = toDateStr(start);
  const endStr = toDateStr(end);

  const { data: existing } = await db()
    .from('golf_leagues')
    .select('*')
    .eq('start_date', startStr)
    .single();

  if (existing) return existing;

  const label = start.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
  const { data, error } = await db()
    .from('golf_leagues')
    .insert({ name: `Week of ${label}`, start_date: startStr, end_date: endStr })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getLeagues(): Promise<League[]> {
  const { data, error } = await db()
    .from('golf_leagues')
    .select('*')
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ── Rounds ──────────────────────────────────────────────────────────────────────────────

export async function getRoundsForLeague(leagueId: number): Promise<Round[]> {
  const { data, error } = await db()
    .from('golf_rounds')
    .select('*, golf_players(name, handicap_index), golf_courses(name, city, state), golf_tees(tee_name, slope_rating, course_rating)')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getRoundsForPlayer(playerId: number): Promise<Round[]> {
  const { data, error } = await db()
    .from('golf_rounds')
    .select('*, golf_courses(name, city, state), golf_tees(tee_name, slope_rating, course_rating), golf_leagues(name, start_date)')
    .eq('player_id', playerId)
    .order('played_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function countPlayerRoundsThisWeek(playerId: number, leagueId: number): Promise<number> {
  const { count, error } = await db()
    .from('golf_rounds')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', playerId)
    .eq('league_id', leagueId);
  if (error) throw error;
  return count ?? 0;
}

export async function insertRound(payload: {
  player_id: number;
  course_id: number;
  tee_id: number;
  league_id: number;
  gross_score: number;
  played_at: string;
}): Promise<Round> {
  const { data, error } = await db()
    .from('golf_rounds')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRound(id: number): Promise<void> {
  const { error } = await db().from('golf_rounds').delete().eq('id', id);
  if (error) throw error;
}

export async function getAllRounds(): Promise<Round[]> {
  const { data, error } = await db()
    .from('golf_rounds')
    .select('*, golf_players(name, handicap_index), golf_courses(name, city, state), golf_tees(tee_name, slope_rating, course_rating), golf_leagues(name, start_date)')
    .order('played_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ── Standings ─────────────────────────────────────────────────────────────────────────────

export async function getStandings(leagueId: number): Promise<StandingRow[]> {
  const [players, rounds] = await Promise.all([
    getPlayers(),
    getRoundsForLeague(leagueId),
  ]);

  const byPlayer = new Map<number, Round[]>();
  for (const r of rounds) {
    if (!byPlayer.has(r.player_id)) byPlayer.set(r.player_id, []);
    byPlayer.get(r.player_id)!.push(r);
  }

  const rows: StandingRow[] = players.map(player => {
    const playerRounds = byPlayer.get(player.id) ?? [];
    const nets = playerRounds.map(r =>
      netScore(r.gross_score, player.handicap_index, r.golf_tees?.slope_rating ?? 113)
    );
    const bestNet = nets.length ? Math.min(...nets) : null;
    return { player, rounds: playerRounds, bestNet, roundsPlayed: playerRounds.length, rank: 0 };
  });

  // Sort: players with scores first (ascending net), then no-scores alphabetically
  rows.sort((a, b) => {
    if (a.bestNet !== null && b.bestNet !== null) return a.bestNet - b.bestNet;
    if (a.bestNet !== null) return -1;
    if (b.bestNet !== null) return 1;
    return a.player.name.localeCompare(b.player.name);
  });

  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

// ── Season Standings ────────────────────────────────────────────────────────────────────────

export async function getSeasonStandings(): Promise<SeasonStandingRow[]> {
  const [players, leagues] = await Promise.all([getPlayers(), getLeagues()]);

  const wins = new Map<number, number>();
  const weeks = new Map<number, number>();
  const rounds = new Map<number, number>();
  for (const p of players) { wins.set(p.id, 0); weeks.set(p.id, 0); rounds.set(p.id, 0); }

  await Promise.all(
    leagues.map(async l => {
      const standing = await getStandings(l.id);
      const active = standing.filter(r => r.bestNet !== null);
      if (active.length > 0) {
        const winnerId = active[0].player.id;
        wins.set(winnerId, (wins.get(winnerId) ?? 0) + 1);
      }
      active.forEach(row => {
        weeks.set(row.player.id, (weeks.get(row.player.id) ?? 0) + 1);
        rounds.set(row.player.id, (rounds.get(row.player.id) ?? 0) + row.roundsPlayed);
      });
    })
  );

  const rows: SeasonStandingRow[] = players.map(player => ({
    player,
    weeksWon: wins.get(player.id) ?? 0,
    weeksPlayed: weeks.get(player.id) ?? 0,
    totalRounds: rounds.get(player.id) ?? 0,
    rank: 0,
  }));

  rows.sort((a, b) => {
    if (b.weeksWon !== a.weeksWon) return b.weeksWon - a.weeksWon;
    if (b.weeksPlayed !== a.weeksPlayed) return b.weeksPlayed - a.weeksPlayed;
    return a.player.name.localeCompare(b.player.name);
  });

  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}
