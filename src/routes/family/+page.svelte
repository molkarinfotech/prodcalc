<script>
  import { onMount } from 'svelte';
  import { getCurrentUser, signOut, createFamily, getFamiliesForUser, joinFamily, getFamilyByInviteCode, getFamilyMembers } from '$lib/family.js';
  import { goto } from '$app/navigation';

  let user = $state(null);
  let families = $state([]);
  let selectedFamily = $state(null);
  let members = $state([]);
  let inviteCode = $state('');
  let familyName = $state('');
  let isLoading = $state(true);
  let showJoinModal = $state(false);
  let showCreateModal = $state(false);
  let error = $state('');

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
      }
    } catch (err) { console.error('Failed to load families:', err); }
  }

  async function loadMembers(familyId) {
    try { members = await getFamilyMembers(familyId); }
    catch (err) { console.error('Failed to load members:', err); }
  }

  async function handleCreateFamily() {
    error = '';
    if (!familyName.trim()) { error = 'Please enter a family name'; return; }
    try {
      const family = await createFamily(familyName, user.id);
      showCreateModal = false;
      familyName = '';
      await loadFamilies();
      selectedFamily = families.find(f => f.id === family.id);
      await loadMembers(selectedFamily.id);
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
    } catch (err) { error = err.message || 'Failed to join family'; }
  }

  async function handleSignOut() { await signOut(); goto('/login'); }

  function selectFamily(family) { selectedFamily = family; loadMembers(family.id); }

  function goToTimeLog() {
    if (selectedFamily) {
      localStorage.setItem('selectedFamily', JSON.stringify(selectedFamily));
      localStorage.setItem('familyMembers', JSON.stringify(members));
      goto('/');
    }
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
          <div class="members-section">
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
  .members-section { background: white; border-radius: 20px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
  .members-section h3 { font-size: 1rem; font-weight: 700; color: #374151; margin: 0 0 12px; }
  .members-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
  .member-chip { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: #f9fafb; border-radius: 20px; border: 1px solid #e5e7eb; }
  .member-chip .emoji { font-size: 1.2rem; }
  .member-chip .name { font-weight: 600; font-size: 0.9rem; }
  .member-chip .role { font-size: 0.7rem; text-transform: uppercase; color: #6b7280; }
  .btn-primary { padding: 12px 20px; border: none; border-radius: 14px; background: #7C3AED; color: white; font-family: inherit; font-weight: 700; cursor: pointer; font-size: 0.9rem; }
  .btn-secondary { padding: 12px 20px; border: 2px solid #e5e7eb; border-radius: 14px; background: white; color: #374151; font-family: inherit; font-weight: 700; cursor: pointer; font-size: 0.9rem; }
  .btn-cancel { padding: 12px 20px; border: none; border-radius: 12px; background: #f3f4f6; color: #374151; font-family: inherit; font-weight: 700; cursor: pointer; font-size: 0.9rem; }
  .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 100; }
  .modal { background: white; border-radius: 24px; padding: 24px; width: 100%; max-width: 380px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
  .modal h3 { margin: 0 0 16px; font-size: 1.2rem; }
  .modal-actions { display: flex; gap: 10px; margin-top: 16px; }
  .field { margin-bottom: 12px; }
  .field label { display: block; font-size: 0.8rem; font-weight: 600; color: #374151; margin-bottom: 4px; }
  .field input { width: 100%; padding: 12px 14px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 1rem; font-family: inherit; box-sizing: border-box; }
  .field input:focus { outline: none; border-color: #7C3AED; }
  .error { background: #fef2f2; color: #dc2626; padding: 10px; border-radius: 10px; font-size: 0.85rem; margin-bottom: 12px; }
  .loading { text-align: center; padding: 40px; color: #9ca3af; }
</style>
