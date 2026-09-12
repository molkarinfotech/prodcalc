<script>
  import { onMount } from 'svelte';
  import { getCurrentUser, signOut, createFamily, getFamiliesForUser, joinFamily, getFamilyByInviteCode, getFamilyMembers } from '$lib/family.js';
  import { fetchTasks, insertTask, deleteTask } from '$lib/database.js';
  import { goto } from '$app/navigation';

  let user = $state(null);
  let families = $state([]);
  let selectedFamily = $state(null);
  let members = $state([]);
  let tasks = $state([]);
  let inviteCode = $state('');
  let familyName = $state('');
  let isLoading = $state(true);
  let showJoinModal = $state(false);
  let showCreateModal = $state(false);
  let showTasksModal = $state(false);
  let showShareModal = $state(false);
  let error = $state('');

  // Task form
  let newTaskName = $state('');
  let newTaskEmoji = $state('📌');
  let newTaskColor = $state('#7C3AED');
  let newTaskProductive = $state(true);

  let isAdmin = $derived(() => {
    const member = members.find(m => m.user_id === user?.id);
    return member?.role === 'admin';
  });

  onMount(async () => {
    user = await getCurrentUser();
    if (!user) { goto('/login'); return; }
    await loadFamilies();
    isLoading = false;
  });

  async function loadFamilies() {
    try {
      families = await getFamiliesForUser(user.id);
      if (families.length > 0 && !selectedFamily) {
        selectedFamily = families[0];
        await loadMembers(selectedFamily.id);
        await loadTasks(selectedFamily.id);
      }
    } catch (err) { console.error('Failed to load families:', err); }
  }

  async function loadMembers(familyId) {
    try { members = await getFamilyMembers(familyId); }
    catch (err) { console.error('Failed to load members:', err); }
  }

  async function loadTasks(familyId) {
    try { tasks = await fetchTasks(familyId); }
    catch (err) { console.error('Failed to load tasks:', err); }
  }

  async function handleCreateFamily() {
    error = '';
    if (!familyName.trim()) { error = 'Please enter a family name'; return; }
    try {
      const family = await createFamily(familyName, user.id, user.user_metadata?.display_name || 'Admin');
      showCreateModal = false;
      familyName = '';
      await loadFamilies();
      selectedFamily = families.find(f => f.id === family.id);
      await loadMembers(selectedFamily.id);
      await loadTasks(selectedFamily.id);
    } catch (err) { error = err.message || 'Failed to create family'; }
  }

  async function handleJoinFamily() {
    error = '';
    if (!inviteCode.trim()) { error = 'Please enter an invite code'; return; }
    try {
      const family = await getFamilyByInviteCode(inviteCode);
      await joinFamily(family.id, user.id, user.user_metadata?.display_name || 'Member');
      showJoinModal = false;
      inviteCode = '';
      await loadFamilies();
      selectedFamily = families.find(f => f.id === family.id);
      await loadMembers(selectedFamily.id);
      await loadTasks(selectedFamily.id);
    } catch (err) { error = err.message || 'Failed to join family'; }
  }

  async function handleAddTask() {
    error = '';
    if (!newTaskName.trim()) { error = 'Please enter a task name'; return; }
    try {
      await insertTask({
        family_id: selectedFamily.id,
        name: newTaskName.trim(),
        emoji: newTaskEmoji,
        color: newTaskColor,
        productive: newTaskProductive,
        sort_order: tasks.length,
      });
      newTaskName = '';
      newTaskEmoji = '📌';
      await loadTasks(selectedFamily.id);
    } catch (err) { error = err.message || 'Failed to add task'; }
  }

  async function handleDeleteTask(taskId) {
    if (!confirm('Delete this task?')) return;
    try {
      await deleteTask(taskId);
      await loadTasks(selectedFamily.id);
    } catch (err) { alert('Failed to delete task: ' + err.message); }
  }

  function copyInvite() {
    const link = window.location.origin;
    const text = `Join my family on Family Time Log!\n\nInvite Code: ${selectedFamily.invite_code}\n\n${link}`;
    navigator.clipboard.writeText(text);
    alert('Invite link copied to clipboard!');
  }

  async function handleSignOut() { await signOut(); goto('/login'); }

  function selectFamily(family) { selectedFamily = family; loadMembers(family.id); loadTasks(family.id); }

  function goToTimeLog() {
    if (selectedFamily) {
      localStorage.setItem('selectedFamily', JSON.stringify(selectedFamily));
      localStorage.setItem('familyMembers', JSON.stringify(members));
      goto('/');
    }
  }

  function goToReport() {
    localStorage.setItem('selectedFamily', JSON.stringify(selectedFamily));
    localStorage.setItem('familyMembers', JSON.stringify(members));
    goto('/report');
  }
</script>

<div class="family-page">
  <header>
    <div class="top">
      <h1>👨‍👧 My Families</h1>
      <button class="signout" onclick={handleSignOut}>Sign Out</button>
    </div>
    {#if user}<p class="email">{user.email}</p>{/if}
  </header>

  {#if isLoading}
    <div class="loading">Loading...</div>
  {:else}
    <div class="content">
      {#if families.length === 0}
        <div class="empty">
          <div class="icon">🏠</div>
          <h2>No families yet</h2>
          <p>Create a new family or join an existing one with an invite code.</p>
          <div class="actions">
            <button class="btn-primary" onclick={() => showCreateModal = true}>✨ Create Family</button>
            <button class="btn-secondary" onclick={() => showJoinModal = true}>🔗 Join with Code</button>
          </div>
        </div>
      {:else}
        <div class="families">
          {#each families as family}
            <button class="family-card" class:selected={selectedFamily?.id === family.id} onclick={() => selectFamily(family)}>
              <div class="info">
                <span class="name">{family.name}</span>
                <span class="role">{family.role}</span>
              </div>
              <div class="code">Code: {family.invite_code}</div>
            </button>
          {/each}
        </div>

        {#if selectedFamily}
          <div class="detail-section">
            <div class="detail-header">
              <h2>{selectedFamily.name}</h2>
              <div class="header-actions">
                <button class="btn-secondary" onclick={() => showShareModal = true}>📤 Share Invite</button>
                <button class="btn-secondary" onclick={() => showTasksModal = true}>🏷 Manage Tasks</button>
              </div>
            </div>

            <h3>Members</h3>
            <div class="members-list">
              {#each members as member}
                <div class="member-chip">
                  <span class="emoji">{member.emoji}</span>
                  <span class="name">{member.display_name}</span>
                  <span class="role">{member.role}</span>
                </div>
              {/each}
            </div>

            <div class="actions">
              <button class="btn-primary" onclick={goToTimeLog}>⏱ Open Time Log</button>
              <button class="btn-secondary" onclick={goToReport}>📊 Family Report</button>
              <button class="btn-secondary" onclick={() => showJoinModal = true}>🔗 Join Another</button>
              <button class="btn-secondary" onclick={() => showCreateModal = true}>✨ Create New</button>
            </div>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

{#if showCreateModal}
  <div class="backdrop" role="button" tabindex="0" onclick={() => showCreateModal = false} onkeydown={(e) => e.key === 'Enter' && (showCreateModal = false)}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <h3>✨ Create New Family</h3>
      <div class="field"><label>Family Name</label><input type="text" bind:value={familyName} placeholder="e.g. Smith Family" /></div>
      {#if error}<div class="error">{error}</div>{/if}
      <div class="modal-actions">
        <button class="btn-cancel" onclick={() => showCreateModal = false}>Cancel</button>
        <button class="btn-primary" onclick={handleCreateFamily}>Create</button>
      </div>
    </div>
  </div>
{/if}

{#if showJoinModal}
  <div class="backdrop" role="button" tabindex="0" onclick={() => showJoinModal = false} onkeydown={(e) => e.key === 'Enter' && (showJoinModal = false)}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <h3>🔗 Join Family</h3>
      <div class="field"><label>Invite Code</label><input type="text" bind:value={inviteCode} placeholder="e.g. ABC123" /></div>
      {#if error}<div class="error">{error}</div>{/if}
      <div class="modal-actions">
        <button class="btn-cancel" onclick={() => showJoinModal = false}>Cancel</button>
        <button class="btn-primary" onclick={handleJoinFamily}>Join</button>
      </div>
    </div>
  </div>
{/if}

{#if showTasksModal && selectedFamily}
  <div class="backdrop" role="button" tabindex="0" onclick={() => showTasksModal = false} onkeydown={(e) => e.key === 'Enter' && (showTasksModal = false)}>
    <div class="modal modal-large" onclick={(e) => e.stopPropagation()}>
      <h3>🏷 Manage Tasks — {selectedFamily.name}</h3>
      <p class="hint">Family-specific tasks (global tasks are shown to all families)</p>

      <div class="tasks-list">
        {#each tasks as task}
          <div class="task-row" class:global={!task.family_id}>
            <span class="task-emoji">{task.emoji}</span>
            <span class="task-name">{task.name}</span>
            <span class="task-type">{task.productive ? '✅' : '⏸'}</span>
            {#if task.family_id && isAdmin()}
              <button class="btn-delete" onclick={() => handleDeleteTask(task.id)} title="Delete">🗑</button>
            {/if}
            {#if !task.family_id}
              <span class="global-badge">GLOBAL</span>
            {/if}
          </div>
        {/each}
      </div>

      {#if isAdmin()}
        <div class="add-task-form">
          <h4>Add New Task</h4>
          <div class="form-row">
            <input type="text" bind:value={newTaskEmoji} class="emoji-input" />
            <input type="text" bind:value={newTaskName} placeholder="Task name" class="name-input" />
            <input type="color" bind:value={newTaskColor} class="color-input" />
            <label class="productive-label">
              <input type="checkbox" bind:checked={newTaskProductive} />
              Productive
            </label>
            <button class="btn-primary" onclick={handleAddTask}>Add</button>
          </div>
          {#if error}<div class="error">{error}</div>{/if}
        </div>
      {/if}

      <div class="modal-actions">
        <button class="btn-cancel" onclick={() => showTasksModal = false}>Close</button>
      </div>
    </div>
  </div>
{/if}

{#if showShareModal && selectedFamily}
  <div class="backdrop" role="button" tabindex="0" onclick={() => showShareModal = false} onkeydown={(e) => e.key === 'Enter' && (showShareModal = false)}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <h3>📤 Share Invite</h3>
      <div class="share-info">
        <p>Share this invite code with your family members:</p>
        <div class="invite-code-display">{selectedFamily.invite_code}</div>
        <p class="hint">They can enter this code at the family page to join.</p>
      </div>
      <div class="modal-actions">
        <button class="btn-cancel" onclick={() => showShareModal = false}>Close</button>
        <button class="btn-primary" onclick={copyInvite}>📋 Copy Invite</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .family-page { max-width: 700px; margin: 0 auto; padding: 16px; min-height: 100vh; }
  header { margin-bottom: 24px; }
  .top { display: flex; justify-content: space-between; align-items: center; }
  h1 { font-size: 1.4rem; font-weight: 800; margin: 0; color: #4c1d95; }
  .signout { background: none; border: 2px solid #e5e7eb; padding: 8px 16px; border-radius: 10px; cursor: pointer; font-family: inherit; font-size: 0.85rem; font-weight: 600; color: #6b7280; }
  .email { color: #6b7280; margin: 4px 0 0; font-size: 0.85rem; }
  .empty { text-align: center; padding: 48px 24px; background: white; border-radius: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
  .icon { font-size: 3rem; }
  .empty h2 { color: #374151; margin: 8px 0; }
  .empty p { color: #6b7280; margin: 0 0 20px; }
  .actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
  .families { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
  .family-card { background: white; border: 2px solid #e5e7eb; border-radius: 16px; padding: 16px; cursor: pointer; text-align: left; font-family: inherit; }
  .family-card.selected { border-color: #7C3AED; background: #f5f3ff; }
  .info { display: flex; justify-content: space-between; align-items: center; }
  .name { font-weight: 700; color: #374151; }
  .role { font-size: 0.75rem; text-transform: uppercase; color: #7C3AED; background: #f5f3ff; padding: 2px 8px; border-radius: 10px; }
  .code { font-size: 0.8rem; color: #6b7280; margin-top: 4px; }

  .detail-section { background: white; border-radius: 20px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
  .detail-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
  .detail-header h2 { font-size: 1.2rem; font-weight: 700; color: #374151; margin: 0; }
  .header-actions { display: flex; gap: 8px; }
  .detail-section h3 { font-size: 0.9rem; font-weight: 700; color: #6b7280; text-transform: uppercase; margin: 16px 0 8px; }
  .members-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  .member-chip { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: #f9fafb; border-radius: 20px; border: 1px solid #e5e7eb; }
  .member-chip .emoji { font-size: 1.2rem; }
  .member-chip .name { font-weight: 600; font-size: 0.9rem; }
  .member-chip .role { font-size: 0.7rem; text-transform: uppercase; color: #6b7280; }

  .btn-primary { padding: 12px 20px; border: none; border-radius: 14px; background: #7C3AED; color: white; font-family: inherit; font-weight: 700; cursor: pointer; font-size: 0.9rem; }
  .btn-secondary { padding: 12px 20px; border: 2px solid #e5e7eb; border-radius: 14px; background: white; color: #374151; font-family: inherit; font-weight: 700; cursor: pointer; font-size: 0.9rem; }
  .btn-cancel { padding: 12px 20px; border: none; border-radius: 12px; background: #f3f4f6; color: #374151; font-family: inherit; font-weight: 700; cursor: pointer; font-size: 0.9rem; }
  .btn-delete { background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 0.9rem; padding: 4px 8px; }
  .btn-delete:hover { color: #dc2626; }

  .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 100; }
  .modal { background: white; border-radius: 24px; padding: 24px; width: 100%; max-width: 380px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); max-height: 80vh; overflow-y: auto; }
  .modal-large { max-width: 500px; }
  .modal h3 { margin: 0 0 16px; font-size: 1.2rem; }
  .modal-actions { display: flex; gap: 10px; margin-top: 16px; }
  .field { margin-bottom: 12px; }
  .field label { display: block; font-size: 0.8rem; font-weight: 600; color: #374151; margin-bottom: 4px; }
  .field input { width: 100%; padding: 12px 14px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 1rem; font-family: inherit; box-sizing: border-box; }
  .field input:focus { outline: none; border-color: #7C3AED; }
  .error { background: #fef2f2; color: #dc2626; padding: 10px; border-radius: 10px; font-size: 0.85rem; margin-bottom: 12px; }
  .hint { color: #6b7280; font-size: 0.85rem; margin: 0 0 12px; }
  .loading { text-align: center; padding: 40px; color: #9ca3af; }

  /* Tasks modal */
  .tasks-list { display: flex; flex-direction: column; gap: 6px; max-height: 300px; overflow-y: auto; margin-bottom: 16px; }
  .task-row { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #f9fafb; border-radius: 10px; border: 1px solid #f3f4f6; }
  .task-row.global { background: #fefce8; border-color: #fef08a; }
  .task-emoji { font-size: 1.2rem; min-width: 28px; }
  .task-name { flex: 1; font-weight: 600; font-size: 0.9rem; }
  .task-type { font-size: 0.9rem; }
  .global-badge { font-size: 0.65rem; font-weight: 700; background: #fef08a; color: #854d0e; padding: 2px 6px; border-radius: 6px; }
  .add-task-form { border-top: 1px solid #f3f4f6; padding-top: 16px; }
  .add-task-form h4 { font-size: 0.9rem; font-weight: 700; color: #374151; margin: 0 0 12px; }
  .form-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .emoji-input { width: 50px; padding: 8px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1.2rem; text-align: center; }
  .name-input { flex: 1; padding: 8px 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-family: inherit; font-size: 0.9rem; }
  .color-input { width: 40px; height: 36px; padding: 0; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; }
  .productive-label { display: flex; align-items: center; gap: 4px; font-size: 0.85rem; font-weight: 600; color: #374151; }

  /* Share modal */
  .share-info { text-align: center; }
  .invite-code-display { font-size: 2.5rem; font-weight: 800; color: #7C3AED; padding: 16px; background: #f5f3ff; border-radius: 16px; margin: 16px 0; letter-spacing: 4px; }
</style>
