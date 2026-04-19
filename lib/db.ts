import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

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
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('getParticipants error:', error);
    return [];
  }
  return data ?? [];
}

export async function insertParticipant(name: string, roster: RosterPick[]): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('participants')
    .insert({ name, roster });
  return { error: error?.message ?? null };
}
