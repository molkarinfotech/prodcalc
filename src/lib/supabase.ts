import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getTasks() {
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

export async function getEntries(memberName: string, date: string) {
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

export async function logEntry(entry: {
	member_name: string;
	task_name: string;
	task_emoji: string;
	productive: boolean;
	minutes: number;
	logged_date: string;
	logged_at: string;
}) {
	const { error } = await supabase.from('time_entries').insert(entry);
	if (error) throw error;
}

export async function deleteEntry(id: string) {
	const { error } = await supabase.from('time_entries').delete().eq('id', id);
	if (error) throw error;
}
