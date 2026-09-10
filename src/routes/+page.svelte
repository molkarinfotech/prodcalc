<script>
  import { supabase, getTasks, getEntries, logEntry, deleteEntry } from '$lib/supabase.js';
  import { DEFAULT_TASKS } from '$lib/tasks.js';
  import { FAMILY_MEMBERS } from '$lib/members.js';

  // --- Reactive state (Svelte 5 runes) ---
  let tasks = $state(DEFAULT_TASKS);
  let entries = $state([]);
  let selectedMember = $state('parent');
  let today = $state(new Date().toISOString().slice(0, 10));
  let isLoading = $state(true);
  let connected = $state(false);

  // Timer
  let activeTimer = $state(null);
  let timerSeconds = $state(0);
  let timerInterval = $state(null);

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
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (activeTimer && save) {
      const minutes = Math.round(timerSeconds / 60);
      if (minutes > 0) {
        const entry = {
          member_name: FAMILY_MEMBERS.find(m => m.id === selectedMember)?.name || 'Someone',
          task_name: activeTimer.taskName,
          task_emoji: activeTimer.taskEmoji,
          productive: activeTimer.productive,
          minutes,
          logged_date: today,
          logged_at: new Date().toISOString(),
        };
        logEntry(entry).then(() => {
          refresh();
        }).catch(() => {});
      }
    }
    activeTimer = null;
    timerSeconds = 0;
  }

  async function refresh() {
    isLoading = true;
    try {
      const [t, e] = await Promise.all([
        getTasks(),
        getEntries(FAMILY_MEMBERS.find(m => m.id === selectedMember)?.name || 'Someone', today)
      ]);
      tasks = t;
      entries = e;
      connected = !!supabase;
    } catch {
      tasks = DEFAULT_TASKS;
      entries = [];
    }
    isLoading = false;
  }

  async function handleQuickSave() {
    if (!quickTask) return;
    const minutes = parseInt(quickMinutes) || 15;
    const entry = {
      member_name: FAMILY_MEMBERS.find(m => m.id === selectedMember)?.name || 'Someone',
      task_name: quickTask,
      task_emoji: quickTaskEmoji || '',
      productive: quickProductive,
      minutes,
      logged_date: today,
      logged_at: new Date().toISOString(),
      note: quickNote || null,
    };
    try {
      await logEntry(entry);
      quickTask = '';
      quickMinutes = 15;
      quickNote = '';
      showQuickEntry = false;
      await refresh();
    } catch {}
  }

  let showQuickEntry = $state(false);
  let quickTask = $state('');
  let quickTaskEmoji = $state('');
  let quickMinutes = $state(15);
  let quickProductive = $state(true);
  let quickNote = $state('');

  function selectQuickTask(task) {
    quickTask = task.name;
    quickTaskEmoji = task.emoji;
  }

  // Derived values
  const totalMinutes = $derived(entries.reduce((s, e) => s + (e.minutes || 0), 0));
  const productiveMinutes = $derived(entries.filter(e => e.productive).reduce((s, e) => s + (e.minutes || 0), 0));
  const nonProductiveMinutes = $derived(entries.filter(e => !e.productive).reduce((s, e) => s + (e.minutes || 0), 0));

  function formatClock(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  function weekDays() {
    const arr = [];
    const d = new Date(today + 'T00:00:00');
    for (let i = 6; i >= 0; i--) {
      const dd = new Date(d);
      dd.setDate(dd.getDate() - i);
      arr.push(dd.toISOString().slice(0, 10));
    }
    return arr;
  }

  function setDate(d) {
    today = d;
    entries = [];
    refresh();
  }

  // Init
  refresh();
</script>

<div class="app">
  <header class="header">
    <div class="header-top">
      <select class="member-select" bind:value={selectedMember}>
        {#each FAMILY_MEMBERS as m}
          <option value={m.id}>{m.emoji} {m.name}</option>
        {/each}
      </select>
      <h1 class="title">⏱ Time Log</h1>
      <button class="icon-btn" onclick={() => showQuickEntry = !showQuickEntry}>➕</button>
    </div>
    {#if connected}
      <div class="connected-badge">💾 Connected to Supabase</div>
    {:else}
      <div class="offline-badge">📱 Offline mode — logging to browser storage</div>
    {/if}

    <div class="week-nav">
      {#each weekDays() as d}
        <button class="day-btn" class:active={d === today} onclick={() => setDate(d)}>
          <span class="day-name">{new Date(d + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' })}</span>
          <span class="day-date">{new Date(d + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
        </button>
      {/each}
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
            <p class="idle-hint">Tap a task above to start the timer</p>
          </div>
        {/if}
      </section>

      <section class="summary-panel">
        <h2 class="panel-title">📊 Today — {today}</h2>
        <div class="summary-cards">
          <div class="summary-card good">
            <span class="sum-emoji">✅</span>
            <span class="sum-label">Productive</span>
            <span class="sum-value">{formatClock(productiveMinutes)}</span>
            <span class="sum-sub">{productiveMinutes > 0 ? Math.round(productiveMinutes / (totalMinutes || 1) * 100) : 0}% of today</span>
          </div>
          <div class="summary-card neutral">
            <span class="sum-emoji">⏸</span>
            <span class="sum-label">Screen / Leisure</span>
            <span class="sum-value">{formatClock(nonProductiveMinutes)}</span>
            <span class="sum-sub">{nonProductiveMinutes > 0 ? Math.round(nonProductiveMinutes / (totalMinutes || 1) * 100) : 0}% of today</span>
          </div>
          <div class="summary-card total">
            <span class="sum-emoji">⏱</span>
            <span class="sum-label">Total</span>
            <span class="sum-value">{formatClock(totalMinutes)}</span>
          </div>
        </div>

        <div class="entries-list">
          {#if entries.length === 0}
            <p class="no-entries">No time logged yet today. Tap a task or use ➕ to add time.</p>
          {:else}
            {#each entries as entry}
              <div class="entry-row" style="border-left-color: {entry.productive ? '#22C55E' : '#EF4444'}">
                <span class="entry-emoji">{entry.task_emoji}</span>
                <span class="entry-name">{entry.task_name}</span>
                <span class="entry-min">{entry.minutes} min</span>
                {#if entry.note}
                  <span class="entry-note">{entry.note}</span>
                {/if}
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
  <div class="modal-backdrop" onclick={() => showQuickEntry = false}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <h2 class="modal-title">➕ Log Time</h2>
      <div class="field">
        <label>Who?</label>
        <select bind:value={selectedMember}>
          {#each FAMILY_MEMBERS as m}
            <option value={m.id}>{m.emoji} {m.name}</option>
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
  .app {
    max-width: 800px;
    margin: 0 auto;
    padding: 16px;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    color: #1f2937;
    min-height: 100vh;
  }

  .header { margin-bottom: 20px; }

  .header-top {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }

  .member-select {
    font-size: 0.85rem;
    padding: 6px 10px;
    border-radius: 12px;
    border: 2px solid #e5e7eb;
    background: #fff;
    font-weight: 600;
  }

  .title {
    font-size: 1.4rem;
    font-weight: 800;
    flex: 1;
    letter-spacing: -0.5px;
  }

  .icon-btn {
    background: #7C3AED;
    color: white;
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    font-size: 1.3rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35);
  }

  .icon-btn:active { transform: scale(0.95); }

  .connected-badge {
    margin-top: 10px;
    font-size: 0.75rem;
    padding: 4px 10px;
    background: #dcfce7;
    color: #166534;
    border-radius: 10px;
    text-align: center;
    font-weight: 600;
  }

  .offline-badge {
    margin-top: 10px;
    font-size: 0.75rem;
    padding: 4px 10px;
    background: #fef3c7;
    color: #92400e;
    border-radius: 10px;
    text-align: center;
    font-weight: 600;
  }

  .week-nav {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 4px;
    -webkit-overflow-scrolling: touch;
  }

  .day-btn {
    flex: 1;
    min-width: 56px;
    padding: 8px 4px;
    border: 2px solid #e5e7eb;
    border-radius: 14px;
    background: #fff;
    cursor: pointer;
    text-align: center;
    font-family: inherit;
    transition: all 0.15s;
  }

  .day-btn.active { background: #7C3AED; border-color: #7C3AED; color: white; }

  .day-name { font-size: 0.7rem; opacity: 0.7; display: block; }
  .day-date { font-size: 0.95rem; font-weight: 700; display: block; }

  .main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

  .panel-title {
    font-size: 0.85rem;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 10px;
    padding: 0 2px;
  }

  .tasks-panel, .timer-panel, .summary-panel {
    background: #fff;
    border-radius: 20px;
    padding: 16px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    border: 1px solid #f3f4f6;
  }

  .tasks-list { display: flex; flex-direction: column; gap: 8px; }

  .task-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border: none;
    border-radius: 16px;
    color: white;
    font-family: inherit;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    transition: transform 0.1s, opacity 0.1s;
    position: relative;
    overflow: hidden;
  }

  .task-chip:active { transform: scale(0.97); }
  .task-chip.running { box-shadow: 0 0 0 4px rgba(255,255,255,0.6), 0 6px 20px rgba(0,0,0,0.2); }
  .task-emoji { font-size: 1.4rem; }
  .task-name { flex: 1; }
  .task-badge { font-size: 1rem; opacity: 0.8; }

  .timer-display {
    font-size: 0.85rem;
    background: rgba(0,0,0,0.25);
    padding: 2px 8px;
    border-radius: 8px;
    font-variant-numeric: tabular-nums;
  }

  .timer-panel { display: flex; flex-direction: column; }

  .timer-active {
    text-align: center;
    padding: 24px 16px;
    border: 3px solid #22C55E;
    border-radius: 24px;
    background: #f0fdf4;
  }

  .timer-big { font-size: 3rem; font-weight: 800; font-variant-numeric: tabular-nums; color: #1f2937; margin-bottom: 8px; }
  .timer-big.idle { font-size: 2rem; color: #9ca3af; margin: 8px 0; }

  .timer-task {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1rem;
    text-align: left;
    margin-bottom: 16px;
  }

  .prod-tag { margin-left: auto; font-size: 0.75rem; font-weight: 600; padding: 2px 8px; border-radius: 10px; background: #fff; }

  .stop-btn { background: #EF4444; color: white; border: none; padding: 10px 20px; border-radius: 14px; font-weight: 700; cursor: pointer; font-family: inherit; font-size: 0.95rem; width: 100%; }
  .discard-btn { background: transparent; color: #6b7280; border: 2px solid #e5e7eb; padding: 8px; border-radius: 12px; cursor: pointer; font-family: inherit; margin-top: 8px; font-size: 0.85rem; width: 100%; }

  .summary-cards { display: flex; gap: 8px; margin-bottom: 14px; }

  .summary-card { flex: 1; padding: 12px; border-radius: 16px; background: #f9fafb; text-align: center; }
  .summary-card.good { background: #f0fdf4; }
  .summary-card.neutral { background: #fef3c7; }
  .summary-card.total { background: #ede9fe; }

  .sum-emoji { font-size: 1.3rem; }
  .sum-label { font-size: 0.7rem; text-transform: uppercase; color: #6b7280; font-weight: 600; display: block; }
  .sum-value { font-size: 1.4rem; font-weight: 800; display: block; font-variant-numeric: tabular-nums; margin: 4px 0; }
  .sum-sub { font-size: 0.65rem; color: #6b7280; }

  .entries-list { margin-top: 4px; }

  .entry-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: #f9fafb;
    border-radius: 12px;
    margin-bottom: 6px;
    border-left: 4px solid #22C55E;
  }

  .entry-emoji { font-size: 1.2rem; }
  .entry-name { flex: 1; font-weight: 600; font-size: 0.9rem; }
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

  .field-row { display: flex; gap: 10px; }
  .field-row .field { flex: 1; }

  .toggle-row { display: flex; gap: 6px; }
  .toggle-btn { flex: 1; padding: 8px; border: 2px solid #e5e7eb; border-radius: 12px; background: #fff; cursor: pointer; font-family: inherit; font-size: 0.8rem; font-weight: 600; }
  .toggle-btn.active { background: #7C3AED; border-color: #7C3AED; color: white; }

  .modal-actions { display: flex; gap: 10px; margin-top: 8px; }
  .btn-primary, .btn-secondary { flex: 1; padding: 12px; border: none; border-radius: 14px; font-weight: 700; cursor: pointer; font-family: inherit; font-size: 1rem; }
  .btn-primary { background: #7C3AED; color: white; }
  .btn-secondary { background: #f3f4f6; color: #374151; }

  @media (max-width: 560px) {
    .main-grid { grid-template-columns: 1fr; }
    .title { font-size: 1.1rem; }
  }
</style>
