<script>
  import { onMount } from 'svelte';
  import { fetchFamilyReport, fetchFamilyStreak, fetchMemberStreak } from '$lib/database.js';
  import { getFamilyMembers as fetchFamilyMembers } from '$lib/family.js';
  import { goto } from '$app/navigation';

  let family = $state(null);
  let members = $state([]);
  let entries = $state([]);
  let streaks = $state({ current: 0, longest: 0, totalDays: 0 });
  let memberStreaks = $state({});
  let isLoading = $state(true);
  let viewStart = $state('');
  let viewEnd = $state('');

  // Derived: overall summary for the entire period
  const overallStats = $derived(() => {
    let productive = 0;
    let leisure = 0;
    const byMember = {};
    for (const e of entries) {
      const mins = e.minutes || 0;
      if (e.productive) productive += mins;
      else leisure += mins;
      byMember[e.member_id] = (byMember[e.member_id] || 0) + mins;
    }
    return { productive, leisure, total: productive + leisure, byMember };
  });
  const byDate = $derived(() => {
    const map = {};
    for (const e of entries) {
      if (!map[e.logged_date]) map[e.logged_date] = [];
      map[e.logged_date].push(e);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  });

  // Per-date stats
  function dateStats(dateEntries) {
    let productive = 0;
    let leisure = 0;
    const byTask = {};
    const byMember = {};
    for (const e of dateEntries) {
      const mins = e.minutes || 0;
      if (e.productive) productive += mins;
      else leisure += mins;
      const key = e.task_name;
      byTask[key] = (byTask[key] || 0) + mins;
      const mkey = e.member_id;
      byMember[mkey] = (byMember[mkey] || 0) + mins;
    }
    return { productive, leisure, total: productive + leisure, byTask, byMember };
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function formatMins(mins) {
    if (mins === 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  function memberById(id) {
    return members.find(m => m.id === id);
  }

  function taskColor(taskName) {
    // Deterministic color from task name
    const colors = ['#7C3AED', '#2563EB', '#059669', '#DB2777', '#EA580C', '#CA8A04', '#0891B2', '#4F46E5', '#BE185D', '#65A30D'];
    let hash = 0;
    for (let i = 0; i < taskName.length; i++) hash = taskName.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  async function loadStreaks() {
    try {
      streaks = await fetchFamilyStreak(family.id);
      const memberData = {};
      for (const m of members) {
        memberData[m.id] = await fetchMemberStreak(m.id);
      }
      memberStreaks = memberData;
    } catch (err) {
      console.error('Failed to load streaks:', err);
    }
  }

  async function loadReport() {
    if (!viewStart || !viewEnd) return;
    isLoading = true;
    try {
      entries = await fetchFamilyReport(family.id, viewStart, viewEnd);
      await loadStreaks();
    } catch (err) {
      console.error('Failed to load report:', err);
    }
    isLoading = false;
  }

  onMount(async () => {
    const familyData = localStorage.getItem('selectedFamily');
    const membersData = localStorage.getItem('familyMembers');
    if (!familyData || !membersData) {
      goto('/family');
      return;
    }
    family = JSON.parse(familyData);
    members = JSON.parse(membersData);

    // Default to last 7 days
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    viewEnd = today.toISOString().slice(0, 10);
    viewStart = weekAgo.toISOString().slice(0, 10);

    await loadReport();
    isLoading = false;
  });

  function goBack() { goto('/'); }
</script>

<div class="report-page">
  <header>
    <div class="top">
      <button class="back-btn" onclick={goBack}>← Back</button>
      <h1>📊 Family Report</h1>
      <span></span>
    </div>
    {#if family}<p class="family-name">{family.name}</p>{/if}
    <div class="date-range">
      <label for="viewStart">From</label>
      <input id="viewStart" type="date" bind:value={viewStart} />
      <label for="viewEnd">To</label>
      <input id="viewEnd" type="date" bind:value={viewEnd} />
      <button class="btn-primary" onclick={loadReport}>Update</button>
    </div>
  </header>

  {#if isLoading}
    <div class="loading">Loading...</div>
  {:else if entries.length === 0}
    <div class="empty">No time entries found for this period.</div>
  {:else}
    {@const stats = overallStats()}
    <div class="overall-summary">
      <h2>Period Summary</h2>
      <div class="summary-bars">
        <div class="summary-row">
          <span class="label">✅ Productive</span>
          <div class="bar-bg">
            <div class="bar-fill productive" style="width: {(stats.productive / stats.total * 100)}%"></div>
          </div>
          <span class="value">{formatMins(stats.productive)}</span>
        </div>
        <div class="summary-row">
          <span class="label">⏸ Leisure</span>
          <div class="bar-bg">
            <div class="bar-fill leisure" style="width: {(stats.leisure / stats.total * 100)}%"></div>
          </div>
          <span class="value">{formatMins(stats.leisure)}</span>
        </div>
      </div>
      <div class="summary-percent">
        <span class="percent">{stats.productive > 0 ? Math.round(stats.productive / stats.total * 100) : 0}% productive</span>
      </div>
    </div>

    <div class="report-content">
      {#each byDate() as [date, dateEntries]}
        {@const stats = dateStats(dateEntries)}
        <div class="day-card">
          <div class="day-header">
            <span class="day-date">{formatDate(date)}</span>
            <span class="day-total">{formatMins(stats.total)}</span>
          </div>

          <div class="bar-container">
            {#if stats.productive > 0}
              <div class="bar-segment productive" style="width: {(stats.productive / stats.total * 100)}%"></div>
            {/if}
            {#if stats.leisure > 0}
              <div class="bar-segment leisure" style="width: {(stats.leisure / stats.total * 100)}%"></div>
            {/if}
          </div>
          <div class="bar-labels">
            <span class="label productive">✅ {formatMins(stats.productive)}</span>
            <span class="label leisure">⏸ {formatMins(stats.leisure)}</span>
          </div>

          <div class="task-breakdown">
            {#each Object.entries(stats.byTask).sort((a, b) => b[1] - a[1]) as [task, mins]}
              <div class="task-row">
                <div class="task-bar-bg">
                  <div class="task-bar" style="width: {(mins / stats.total * 100)}%; background: {taskColor(task)}"></div>
                </div>
                <span class="task-name">{task}</span>
                <span class="task-mins">{formatMins(mins)}</span>
              </div>
            {/each}
          </div>

          {#if Object.keys(stats.byMember).length > 1}
            <div class="member-breakdown">
              <h4>By Member</h4>
              {#each Object.entries(stats.byMember).sort((a, b) => b[1] - a[1]) as [memberId, mins]}
                {@const member = memberById(memberId)}
                <div class="member-row">
                  <span class="member-emoji">{member?.emoji || '🧑'}</span>
                  <span class="member-name">{member?.display_name || 'Unknown'}</span>
                  <div class="member-bar-bg">
                    <div class="member-bar" style="width: {(mins / stats.total * 100)}%; background: {member?.color || '#6B7280'}"></div>
                  </div>
                  <span class="member-mins">{formatMins(mins)}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .report-page { max-width: 800px; margin: 0 auto; padding: 16px; min-height: 100vh; }
  header { margin-bottom: 24px; }
  .top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .back-btn { background: none; border: 2px solid #e5e7eb; padding: 8px 14px; border-radius: 10px; cursor: pointer; font-family: inherit; font-weight: 600; color: #6b7280; }
  h1 { font-size: 1.4rem; font-weight: 800; margin: 0; color: #4c1d95; }
  .family-name { color: #6b7280; margin: 0 0 16px; font-size: 0.9rem; }
  .date-range { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .date-range label { font-size: 0.85rem; font-weight: 600; color: #374151; }
  .date-range input { padding: 8px 12px; border: 2px solid #e5e7eb; border-radius: 10px; font-family: inherit; font-size: 0.9rem; }
  .btn-primary { padding: 8px 16px; border: none; border-radius: 10px; background: #7C3AED; color: white; font-family: inherit; font-weight: 700; cursor: pointer; font-size: 0.9rem; }

  .report-content { display: flex; flex-direction: column; gap: 16px; }

  .overall-summary { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); border: 1px solid #f3f4f6; margin-bottom: 8px; }
  .overall-summary h2 { font-size: 1rem; font-weight: 700; color: #374151; margin: 0 0 16px; }
  .summary-bars { display: flex; flex-direction: column; gap: 12px; }
  .summary-row { display: flex; align-items: center; gap: 12px; }
  .summary-row .label { font-size: 0.85rem; font-weight: 600; color: #374151; min-width: 100px; }
  .bar-bg { flex: 1; height: 20px; background: #f3f4f6; border-radius: 10px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 10px; transition: width 0.3s; }
  .bar-fill.productive { background: linear-gradient(90deg, #22C55E, #16A34A); }
  .bar-fill.leisure { background: linear-gradient(90deg, #F59E0B, #D97706); }
  .summary-row .value { font-size: 0.9rem; font-weight: 700; color: #374151; min-width: 60px; text-align: right; }
  .summary-percent { text-align: center; margin-top: 12px; }
  .percent { font-size: 1.5rem; font-weight: 800; color: #7C3AED; }
  .day-card { background: white; border-radius: 16px; padding: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); border: 1px solid #f3f4f6; }
  .day-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .day-date { font-weight: 700; color: #374151; }
  .day-total { font-size: 1.2rem; font-weight: 800; color: #7C3AED; }

  .bar-container { display: flex; height: 24px; border-radius: 12px; overflow: hidden; background: #f3f4f6; margin-bottom: 8px; }
  .bar-segment { height: 100%; transition: width 0.3s; }
  .bar-segment.productive { background: linear-gradient(90deg, #22C55E, #16A34A); }
  .bar-segment.leisure { background: linear-gradient(90deg, #F59E0B, #D97706); }

  .bar-labels { display: flex; gap: 16px; margin-bottom: 12px; }
  .label { font-size: 0.8rem; font-weight: 600; }
  .label.productive { color: #16A34A; }
  .label.leisure { color: #D97706; }

  .task-breakdown { display: flex; flex-direction: column; gap: 6px; }
  .task-row { display: flex; align-items: center; gap: 8px; }
  .task-bar-bg { flex: 1; height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden; }
  .task-bar { height: 100%; border-radius: 4px; }
  .task-name { font-size: 0.8rem; color: #374151; min-width: 80px; }
  .task-mins { font-size: 0.8rem; font-weight: 700; color: #6b7280; min-width: 40px; text-align: right; }

  .member-breakdown { margin-top: 12px; padding-top: 12px; border-top: 1px solid #f3f4f6; }
  .member-breakdown h4 { font-size: 0.8rem; font-weight: 700; color: #6b7280; text-transform: uppercase; margin: 0 0 8px; }
  .member-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .member-emoji { font-size: 1.1rem; }
  .member-name { font-size: 0.8rem; color: #374151; min-width: 60px; }
  .member-bar-bg { flex: 1; height: 6px; background: #f3f4f6; border-radius: 3px; overflow: hidden; }
  .member-bar { height: 100%; border-radius: 3px; }
  .member-mins { font-size: 0.75rem; font-weight: 600; color: #6b7280; min-width: 36px; text-align: right; }

  .loading { text-align: center; padding: 40px; color: #9ca3af; }
  .empty { text-align: center; padding: 40px; color: #6b7280; background: white; border-radius: 16px; }
</style>
