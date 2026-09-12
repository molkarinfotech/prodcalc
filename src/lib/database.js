import { supabase } from './supabase.js';

// =============================================
// TASKS
// =============================================

export async function fetchTasks(familyId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .or(`family_id.is.null,family_id.eq.${familyId}`)
    .order('sort_order', { ascending: true });
  if (error) { console.warn('fetchTasks error:', error); return []; }
  return data || [];
}

export async function insertTask(task) {
  if (!supabase) return;
  const { error } = await supabase.from('tasks').insert(task);
  if (error) throw error;
}

export async function deleteTask(id) {
  if (!supabase) return;
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

// =============================================
// TIME ENTRIES
// =============================================

export async function fetchEntries(familyId, memberId, date) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('family_id', familyId)
    .eq('member_id', memberId)
    .eq('logged_date', date)
    .order('logged_at', { ascending: false });
  if (error) { console.warn('fetchEntries error:', error); return []; }
  return data || [];
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

// =============================================
// FAMILY REPORT (all members, all days)
// =============================================

export async function fetchFamilyReport(familyId, startDate, endDate) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('family_id', familyId)
    .gte('logged_date', startDate)
    .lte('logged_date', endDate)
    .order('logged_date', { ascending: false });
  if (error) { console.warn('fetchFamilyReport error:', error); return []; }
  return data || [];
}
