<script>
  import { onMount } from 'svelte';
  import { supabase, insertEntry, deleteEntry } from '$lib/supabase.js';
  import { fetchTasks, fetchEntries } from '$lib/database.js';
  import { goto } from '$app/navigation';
  import StreakWidget from '$lib/components/StreakWidget.svelte';

  let tasks = $state([]);
  let entries = $state([]);
  let members = $state([]);
  let selectedMember = $state(null);
  let family = $state(null);
  let today = $state(new Date().toISOString().slice(0, 10));
  let selectedDate = $state(today);
  let viewEnd = $state(today);
  let isLoading = $state(true);
  let connected = $state(false);

  let activeTimer = $state(null);
  let timerSeconds = $state(0);
  let timerInterval = $state(null);

  let showQuickEntry = $state(false);
  let quickTask = $state('');
  let quickTaskEmoji = $state('');
  let quickMinutes = $state(15);
  let quickProductive = $state(true);
  let quickNote = $state('');

  onMount(async () => {
    const familyData = localStorage.getItem('selectedFamily');
    const membersData = localStorage.getItem('familyMembers');
    if (!familyData || !membersData) {
      goto('/family');
      return;
    }
    family = JSON.parse(familyData);
    members = JSON.parse(membersData);
    selectedMember = members[0] || null;
    await refresh();
    isLoading = false;
  });

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function startTimer(taskId, taskName, taskEmoji, productive, color) {
    if (activeTimer) stopTimer(false);
    activeTimer = { taskId, taskName, taskEmoji, productive, color, startTime: Date.now() };
    timerSeconds = 0;
    timerInterval = setInterval(() => {
      timerSeconds = Math.floor((Date.now() - activeTimer.startTime) / 1000);
    }, 1000);
  }

  function stopTimer(save = true) {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (activeTimer && save && selectedMember) {
      const minutes = Math.round(timerSeconds / 60);
      if (minutes > 0) {
        const entry = {
          family_id: family.id,
          member_id: selectedMember.id,
          task_id: activeTimer.taskId,
          task_name: activeTimer.taskName,
          task_emoji: activeTimer.taskEmoji,
          productive: activeTimer.productive,
          minutes,
          logged_date: selectedDate,
          logged_at: new Date().toISOString(),
        };
        insertEntry(entry).then(() => refresh()).catch(() => {});
      }
    }
    activeTimer = null;
    timerSeconds = 0;
  }

  async function refresh() {
    isLoading = true;
    try {
      const [t, e] = await Promise.all([
        fetchTasks(family.id),
        selectedMember ? fetchEntries(family.id, selectedMember.id, selectedDate) : Promise.resolve([])
      ]);
      tasks = t;
      entries = e;
      connected = !!supabase;
    } catch {
      tasks = [];
      entries = [];
    }
    isLoading = false;
  }

  async function handleQuickSave() {
    if (!quickTask || !selectedMember) return;
    const minutes = parseInt(quickMinutes) || 15;
    const task = tasks.find(t => t.name === quickTask);
    const entry = {
      family_id: family.id,
      member_id: selectedMember.id,
      task_id: task?.id || null,
      task_name: quickTask,
      task_emoji: quickTaskEmoji || task?.emoji || '',
      productive: quickProductive,
      minutes,
      logged_date: selectedDate,
      logged_at: new Date().toISOString(),
      note: quickNote || null,
    };
    try {
      await insertEntry(entry);
      quickTask = ''; quickMinutes = 15; quickNote = '';
      showQuickEntry = false;
      await refresh();
    } catch {}
  }

  function formatClock(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  function weekDays() {
    const arr = [];
    const d = new Date(viewEnd + 'T00:00:00');
    for (let i = 6; i >= 0; i--) {
      const dd = new Date(d);
      dd.setDate(dd.getDate() - i);
      arr.push(dd.toISOString().slice(0, 10));
    }
    return arr;
  }

  function prevWeek() {
    const d = new Date(viewEnd + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    viewEnd = d.toISOString().slice(0, 10);
  }

  function nextWeek() {
    const d = new Date(viewEnd + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    const todayStr = new Date().toISOString().slice(0, 10);
    viewEnd = d.toISOString().slice(0, 10) > todayStr ? todayStr : d.toISOString().slice(0, 10);
  }

  function goToday() {
    viewEnd = new Date().toISOString().slice(0, 10);
    selectedDate = viewEnd;
    entries = [];
    refresh();
  }

  function setDate(d) {
    selectedDate = d;
    entries = [];
    refresh();
  }

  function formatSelectedDate(dateStr) {
    if (dateStr === today) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === yesterday.toISOString().slice(0, 10)) return 'Yesterday';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function selectQuickTask(task) {
    quickTask = task.name;
    quickTaskEmoji = task.emoji;
  }

  const totalMinutes = $derived(entries.reduce((s, e) => s + (e.minutes || 0), 0));
  const productiveMinutes = $derived(entries.filter(e => e.productive).reduce((s, e) => s + (e.minutes || 0), 0));
  const nonProductiveMinutes = $derived(entries.filter(e => !e.productive).reduce((s, e) => s + (e.minutes || 0), 0));
</script>

<div class="app">
  <header class="header">
    <div class="header-top">
      <select class="member-select" bind:value={selectedMember}>
        {#each members as m}
          <option value={m}>{m.emoji} {m.display_name}</option>
        {/each}
      </select>
      <h1 class="title">⏱ {family?.name || 'Time Log'}</h1>
      <button class="icon-btn" onclick={() => showQuickEntry = !showQuickEntry}>➕</button>
    </div>
    <div class="header-actions">
      <button class="back-btn" onclick={() => goto('/family')}>👨‍👧 Families</button>
    </div>

    {#if connected}
      <div class="connected-badge">💾 Connected to Supabase</div>
    {:else}
      <div class="offline-badge">📱 Offline mode</div>
    {/if}

    <StreakWidget />

    <div class="week-nav">
      <button class="nav-btn" onclick={prevWeek} title="Previous week">◀</button>
      <button class="today-btn" onclick={goToday}>📅 Today</button>
      <button class="nav-btn" onclick={nextWeek} title="Next week" disabled={viewEnd >= today}>▶</button>
      <div class="day-strip">
        {#each weekDays() as d}
          <button class="day-btn" class:active={d === selectedDate} class:today={d === today} onclick={() => setDate(d)}>
            <span class="day-name">{new Date(d + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' })}</span>
            <span class="day-date">{new Date(d + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
          </button>
        {/each}
      </div>
    </div>
  </header>

  {#if isLoading}
    <div class="loading">Loading…</div>
  {:else if tasks.length === 0}
    <div class="empty">No tasks set up yet.</div>
  {:else}
    <div class="main-grid">
      <section class="tasks-panel">
        <h2 class="panel-title">🏷 Tasks</h2>
        <div class="tasks-list">
          {#each tasks as task}
            <button
              class="task-chip"
              class:running={activeTimer?.taskId === task.id}
              style="background: {task.color}"
              onclick={() => activeTimer?.taskId === task.id ? stopTimer() : startTimer(task.id, task.name, task.emoji, task.productive, task.color)}
            >
              <span class="task-emoji">{task.emoji}</span>
              <span class="task-name">{task.name}</span>
              <span class="task-badge">{task.productive ? '✅' : '⏸'}</span>
              {#if activeTimer?.taskId === task.id}
                <span class="timer-display">{formatTime(timerSeconds)}</span>
              {/if}
            </button>
          {/each}
        </div>
      </section>

      <section class="timer-panel">
        {#if activeTimer}
          <div class="timer-active card" style="border-color: {activeTimer.productive ? '#22C55E' : '#EF4444'}">
            <div class="timer-big">{formatTime(timerSeconds)}</div>
            <div class="timer-task">
              <span class="task-emoji">{activeTimer.taskEmoji}</span>
              {activeTimer.taskName}
              <span class="prod-tag">{activeTimer.productive ? '✅ Productive' : '⏸ Screen time'}</span>
            </div>
            <button class="stop-btn" onclick={() => stopTimer(true)}>⏹ Stop & Save</button>
            <button class="discard-btn" onclick={() => stopTimer(false)}>🗑 Discard</button>
          </div>
        {:else}
          <div class="timer-idle card">
            <div class="timer-big idle">0:00</div>
            <p class="idle-hint">Tap a task to start the timer</p>
          </div>
        {/if}
      </section>

      <section class="summary-panel">
        <h2 class="panel-title">📊 {formatSelectedDate(selectedDate)} — {selectedDate}</h2>
        <div class="summary-cards">
          <div class="summary-card good">
            <span class="sum-emoji">✅</span>
            <span class="sum-label">Productive</span>
            <span class="sum-value">{formatClock(productiveMinutes)}</span>
            <span class="sum-sub">{productiveMinutes > 0 ? Math.round(productiveMinutes / (totalMinutes || 1) * 100) : 0}% of day</span>
          </div>
          <div class="summary-card neutral">
            <span class="sum-emoji">⏸</span>
            <span class="sum-label">Leisure</span>
            <span class="sum-value">{formatClock(nonProductiveMinutes)}</span>
            <span class="sum-sub">{nonProductiveMinutes > 0 ? Math.round(nonProductiveMinutes / (totalMinutes || 1) * 100) : 0}% of day</span>
          </div>
          <div class="summary-card total">
            <span class="sum-emoji">⏱</span>
            <span class="sum-label">Total</span>
            <span class="sum-value">{formatClock(totalMinutes)}</span>
          </div>
        </div>

        <div class="entries-list">
          {#if entries.length === 0}
            <p class="no-entries">No time logged yet. Tap a task or use ➕.</p>
          {:else}
            {#each entries as entry}
              <div class="entry-row" style="border-left-color: {entry.productive ? '#22C55E' : '#EF4444'}">
                <span class="entry-emoji">{entry.task_emoji}</span>
                <span class="entry-name">{entry.task_name}</span>
                <span class="entry-min">{entry.minutes} min</span>
                {#if entry.note}<span class="entry-note">{entry.note}</span>{/if}
                <button class="del-btn" onclick={() => deleteEntry(entry.id)} title="Delete">✕</button>
              </div>
            {/each}
          {/if}
        </div>
      </section>
    </div>
  {/if}
</div>

{#if showQuickEntry}
  <div class="modal-backdrop" role="button" tabindex="0" onclick={() => showQuickEntry = false} onkeydown={(e) => e.key === 'Enter' && (showQuickEntry = false)}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <h2 class="modal-title">➕ Log Time</h2>
      <div class="field">
        <label>Who?</label>
        <select bind:value={selectedMember}>
          {#each members as m}
            <option value={m}>{m.emoji} {m.display_name}</option>
          {/each}
        </select>
      </div>
      <div class="field">
        <label>Task</label>
        <select bind:value={quickTask} onchange={(e) => selectQuickTask(tasks.find(t => t.name === e.target.value))}>
          <option value="">— pick a task —</option>
          {#each tasks as t}
            <option value={t.name}>{t.emoji} {t.name}</option>
          {/each}
        </select>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Minutes</label>
          <input type="number" bind:value={quickMinutes} min="1" max="480" />
        </div>
        <div class="field">
          <label>Type</label>
          <div class="toggle-row">
            <button class="toggle-btn" class:active={quickProductive} onclick={() => quickProductive = true}>✅ Productive</button>
            <button class="toggle-btn" class:active={!quickProductive} onclick={() => quickProductive = false}>⏸ Leisure</button>
          </div>
        </div>
      </div>
      <div class="field">
        <label>Note (optional)</label>
        <input type="text" bind:value={quickNote} placeholder="e.g. chapter 3" />
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick={() => showQuickEntry = false}>Cancel</button>
        <button class="btn-primary" onclick={handleQuickSave}>Log {quickMinutes} min</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .app { max-width: 800px; margin: 0 auto; padding: 16px; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1f2937; min-height: 100vh; }
  .header { margin-bottom: 20px; }
  .header-top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .member-select { font-size: 0.85rem; padding: 6px 10px; border-radius: 12px; border: 2px solid #e5e7eb; background: #fff; font-weight: 600; }
  .title { font-size: 1.4rem; font-weight: 800; flex: 1; letter-spacing: -0.5px; }
  .icon-btn { background: #7C3AED; color: white; border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 1.3rem; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35); }
  .header-actions { display: flex; gap: 8px; margin-bottom: 8px; }
  .back-btn { background: none; border: 2px solid #e5e7eb; padding: 6px 14px; border-radius: 10px; cursor: pointer; font-family: inherit; font-size: 0.8rem; font-weight: 600; color: #6b7280; }
  .connected-badge { font-size: 0.75rem; padding: 4px 10px; background: #dcfce7; color: #166534; border-radius: 10px; text-align: center; font-weight: 600; }
  .offline-badge { font-size: 0.75rem; padding: 4px 10px; background: #fef3c7; color: #92400e; border-radius: 10px; text-align: center; font-weight: 600; }
  .week-nav { display: flex; align-items: center; gap: 8px; margin-top: 12px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; }
  .nav-btn { flex-shrink: 0; width: 36px; height: 36px; border: 2px solid #e5e7eb; border-radius: 50%; background: #fff; cursor: pointer; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; }
  .nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .today-btn { flex-shrink: 0; padding: 6px 14px; border: 2px solid #7C3AED; border-radius: 20px; background: #7C3AED; color: white; font-family: inherit; font-size: 0.8rem; font-weight: 700; cursor: pointer; white-space: nowrap; }
  .day-strip { display: flex; gap: 6px; overflow-x: auto; flex: 1; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .day-strip::-webkit-scrollbar { display: none; }
  .day-btn { flex: 1; min-width: 52px; max-width: 64px; padding: 8px 4px; border: 2px solid #e5e7eb; border-radius: 14px; background: #fff; cursor: pointer; text-align: center; font-family: inherit; }
  .day-btn.active { background: #7C3AED; border-color: #7C3AED; color: white; }
  .day-btn.today:not(.active) { border-color: #7C3AED; background: #f5f3ff; }
  .day-name { font-size: 0.65rem; opacity: 0.6; display: block; text-transform: uppercase; }
  .day-date { font-size: 0.9rem; font-weight: 700; display: block; }
  .day-btn.today .day-name { opacity: 1; color: #7C3AED; }
  .main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .panel-title { font-size: 0.85rem; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 10px; padding: 0 2px; }
  .tasks-panel, .timer-panel, .summary-panel { background: #fff; border-radius: 20px; padding: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); border: 1px solid #f3f4f6; }
  .tasks-list { display: flex; flex-direction: column; gap: 8px; }
  .task-chip { display: flex; align-items: center; gap: 8px; padding: 12px; border: none; border-radius: 16px; color: white; font-family: inherit; font-weight: 600; font-size: 0.95rem; cursor: pointer; }
  .task-chip.running { box-shadow: 0 0 0 4px rgba(255,255,255,0.6), 0 6px 20px rgba(0,0,0,0.2); }
  .task-emoji { font-size: 1.4rem; } .task-name { flex: 1; } .task-badge { font-size: 1rem; opacity: 0.8; }
  .timer-display { font-size: 0.85rem; background: rgba(0,0,0,0.25); padding: 2px 8px; border-radius: 8px; font-variant-numeric: tabular-nums; }
  .timer-active { text-align: center; padding: 24px 16px; border: 3px solid #22C55E; border-radius: 24px; background: #f0fdf4; }
  .timer-big { font-size: 3rem; font-weight: 800; font-variant-numeric: tabular-nums; color: #1f2937; margin-bottom: 8px; }
  .timer-big.idle { font-size: 2rem; color: #9ca3af; margin: 8px 0; }
  .timer-task { display: flex; align-items: center; gap: 8px; font-size: 1rem; margin-bottom: 16px; }
  .prod-tag { margin-left: auto; font-size: 0.75rem; font-weight: 600; padding: 2px 8px; border-radius: 10px; background: #fff; }
  .stop-btn { background: #EF4444; color: white; border: none; padding: 10px 20px; border-radius: 14px; font-weight: 700; cursor: pointer; font-family: inherit; font-size: 0.95rem; width: 100%; }
  .discard-btn { background: transparent; color: #6b7280; border: 2px solid #e5e7eb; padding: 8px; border-radius: 12px; cursor: pointer; font-family: inherit; margin-top: 8px; font-size: 0.85rem; width: 100%; }
  .summary-cards { display: flex; gap: 8px; margin-bottom: 14px; }
  .summary-card { flex: 1; padding: 12px; border-radius: 16px; background: #f9fafb; text-align: center; }
  .summary-card.good { background: #f0fdf4; } .summary-card.neutral { background: #fef3c7; } .summary-card.total { background: #ede9fe; }
  .sum-emoji { font-size: 1.3rem; }
  .sum-label { font-size: 0.7rem; text-transform: uppercase; color: #6b7280; font-weight: 600; display: block; }
  .sum-value { font-size: 1.4rem; font-weight: 800; display: block; font-variant-numeric: tabular-nums; margin: 4px 0; }
  .sum-sub { font-size: 0.65rem; color: #6b7280; }
  .entries-list { margin-top: 4px; }
  .entry-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #f9fafb; border-radius: 12px; margin-bottom: 6px; border-left: 4px solid #22C55E; }
  .entry-emoji { font-size: 1.2rem; } .entry-name { flex: 1; font-weight: 600; font-size: 0.9rem; }
  .entry-min { font-weight: 700; color: #7C3AED; font-variant-numeric: tabular-nums; }
  .entry-note { font-size: 0.75rem; color: #6b7280; margin-left: 4px; }
  .del-btn { background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 0.9rem; padding: 2px 6px; }
  .no-entries { color: #9ca3af; font-size: 0.85rem; padding: 12px 0; text-align: center; }
  .loading { text-align: center; padding: 40px; color: #9ca3af; }
  .empty { text-align: center; padding: 40px; color: #6b7280; }
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 100; }
  .modal { background: #fff; border-radius: 24px; padding: 20px; width: 100%; max-width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
  .modal-title { font-size: 1.2rem; margin: 0 0 16px; }
  .field { margin-bottom: 12px; }
  .field label { display: block; font-size: 0.8rem; font-weight: 600; color: #6b7280; margin-bottom: 4px; }
  .field select, .field input { width: 100%; padding: 10px 12px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 1rem; font-family: inherit; background: #fff; }
  .field-row { display: flex; gap: 10px; } .field-row .field { flex: 1; }
  .toggle-row { display: flex; gap: 6px; }
  .toggle-btn { flex: 1; padding: 8px; border: 2px solid #e5e7eb; border-radius: 12px; background: #fff; cursor: pointer; font-family: inherit; font-size: 0.8rem; font-weight: 600; }
  .toggle-btn.active { background: #7C3AED; border-color: #7C3AED; color: white; }
  .modal-actions { display: flex; gap: 10px; margin-top: 8px; }
  .btn-primary, .btn-secondary { flex: 1; padding: 12px; border: none; border-radius: 14px; font-weight: 700; cursor: pointer; font-family: inherit; font-size: 1rem; }
  .btn-primary { background: #7C3AED; color: white; }
  .btn-secondary { background: #f3f4f6; color: #374151; }
  @media (max-width: 560px) { .main-grid { grid-template-columns: 1fr; } .title { font-size: 1.1rem; } }
</style>
