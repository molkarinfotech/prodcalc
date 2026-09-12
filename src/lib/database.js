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

// =============================================
// STREAK CALCULATIONS
// =============================================

export async function fetchMemberStreak(memberId) {
  if (!supabase) return { current: 0, longest: 0, totalDays: 0 };
  const { data, error } = await supabase
    .from('time_entries')
    .select('logged_date')
    .eq('member_id', memberId)
    .order('logged_date', { ascending: false });
  if (error || !data || data.length === 0) return { current: 0, longest: 0, totalDays: 0 };

  const uniqueDays = [...new Set(data.map(d => d.logged_date))].sort().reverse();

  // Current streak: consecutive days from today backwards
  let current = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let checkDate = new Date(today);

  for (const dayStr of uniqueDays) {
    const day = new Date(dayStr + 'T00:00:00');
    const diff = Math.floor((checkDate - day) / (1000 * 60 * 60 * 24));
    if (diff === 0 || diff === 1) {
      current++;
      checkDate = new Date(day);
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Longest streak
  let longest = 0;
  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1] + 'T00:00:00');
    const curr = new Date(uniqueDays[i] + 'T00:00:00');
    const diff = Math.floor((prev - curr) / (1000 * 60 * 60 * 24));
    if (diff === 1) {
      streak++;
    } else {
      longest = Math.max(longest, streak);
      streak = 1;
    }
  }
  longest = Math.max(longest, streak);

  return { current, longest, totalDays: uniqueDays.length };
}

export async function fetchFamilyStreak(familyId) {
  if (!supabase) return { current: 0, longest: 0, totalDays: 0 };
  const { data, error } = await supabase
    .from('time_entries')
    .select('logged_date')
    .eq('family_id', familyId)
    .order('logged_date', { ascending: false });
  if (error || !data || data.length === 0) return { current: 0, longest: 0, totalDays: 0 };

  const uniqueDays = [...new Set(data.map(d => d.logged_date))].sort().reverse();

  let current = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let checkDate = new Date(today);

  for (const dayStr of uniqueDays) {
    const day = new Date(dayStr + 'T00:00:00');
    const diff = Math.floor((checkDate - day) / (1000 * 60 * 60 * 24));
    if (diff === 0 || diff === 1) {
      current++;
      checkDate = new Date(day);
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  let longest = 0;
  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1] + 'T00:00:00');
    const curr = new Date(uniqueDays[i] + 'T00:00:00');
    const diff = Math.floor((prev - curr) / (1000 * 60 * 60 * 24));
    if (diff === 1) {
      streak++;
    } else {
      longest = Math.max(longest, streak);
      streak = 1;
    }
  }
  longest = Math.max(longest, streak);

  return { current, longest, totalDays: uniqueDays.length };
}
