import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.startsWith('https://')
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export async function getTasks() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, name, emoji, productive, color, sort_order')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getEntries(memberName, date) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('time_entries')
      .select('id, task_name, task_emoji, productive, minutes, logged_at')
      .eq('member_name', memberName)
      .eq('logged_date', date)
      .order('logged_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch {
    return [];
  }
}

export async function insertEntry(entry) {
  if (!supabase) return;
  const { error } = await supabase.from('time_entries').insert(entry);
  if (error) throw error;
}

export async function deleteEntry(id) {
  if (!supabase) return;
  const { error } = await supabase.from('time_entries').delete().eq('id', id);
  if (error) throw error;
}
