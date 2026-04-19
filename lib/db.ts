import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars not set');
  _client = createClient(url, key);
  return _client;
}

export interface RosterPick {
  team: string;
  playerName: string;
  pos: string;
}

export interface Participant {
  id: number;
  name: string;
  joined_at: string;
  roster: RosterPick[];
  total?: number;
  rank?: number;
}

export async function getParticipants(): Promise<Participant[]> {
  try {
    const { data, error } = await getClient()
      .from('participants')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      console.error('getParticipants error:', error);
      return [];
    }
    return data ?? [];
  } catch (e) {
    console.error('getParticipants error:', e);
    return [];
  }
}

export async function insertParticipant(name: string, roster: RosterPick[]): Promise<{ error: string | null }> {
  try {
    const { error } = await getClient()
      .from('participants')
      .insert({ name, roster });
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: String(e) };
  }
}
