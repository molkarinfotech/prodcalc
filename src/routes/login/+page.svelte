<script>
  import { onMount } from 'svelte';
  import { signIn, signUp, getCurrentUser, onAuthStateChange } from '$lib/family.js';
  import { goto } from '$app/navigation';

  let mode = $state('login');
  let email = $state('');
  let password = $state('');
  let displayName = $state('');
  let isLoading = $state(false);
  let error = $state('');

  onMount(async () => {
    const user = await getCurrentUser();
    if (user) goto('/family');
  });

  async function handleSubmit() {
    error = '';
    isLoading = true;
    try {
      if (mode === 'login') {
        await signIn(email, password);
        goto('/family');
      } else {
        const result = await signUp(email, password, displayName);
        if (result.user) {
          alert('Account created! You can now sign in.');
          mode = 'login';
        }
      }
    } catch (err) {
      error = err.message || 'Something went wrong.';
    }
    isLoading = false;
  }
</script>

<div class="auth-page">
  <div class="auth-card">
    <h1 class="logo">⏱ Family Time Log</h1>
    <p class="tagline">Track productive time for your family</p>

    <div class="tabs">
      <button class="tab" class:active={mode === 'login'} onclick={() => mode = 'login'}>Sign In</button>
      <button class="tab" class:active={mode === 'signup'} onclick={() => mode = 'signup'}>Sign Up</button>
    </div>

    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      {#if mode === 'signup'}
        <div class="field">
          <label>Your Name</label>
          <input type="text" bind:value={displayName} placeholder="e.g. Mom, Dad" required />
        </div>
      {/if}
      <div class="field">
        <label>Email</label>
        <input type="email" bind:value={email} placeholder="you@example.com" required />
      </div>
      <div class="field">
        <label>Password</label>
        <input type="password" bind:value={password} placeholder="••••••••" minlength="6" required />
      </div>

      {#if error}<div class="error">{error}</div>{/if}

      <button type="submit" class="submit" disabled={isLoading}>
        {isLoading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
      </button>
    </form>

    <p class="footer">
      {mode === 'login' ? "No account? " : "Have an account? "}
      <button class="link" onclick={() => mode = mode === 'login' ? 'signup' : 'login'}>
        {mode === 'login' ? 'Sign up' : 'Sign in'}
      </button>
    </p>
  </div>
</div>

<style>
  .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: linear-gradient(135deg, #f5f3ff, #ede9fe); }
  .auth-card { background: white; border-radius: 24px; padding: 32px; width: 100%; max-width: 380px; box-shadow: 0 8px 32px rgba(124,58,237,0.12); }
  .logo { font-size: 1.5rem; font-weight: 800; color: #4c1d95; text-align: center; margin: 0; }
  .tagline { color: #6b7280; text-align: center; margin: 4px 0 24px; }
  .tabs { display: flex; gap: 8px; margin-bottom: 20px; background: #f3f4f6; border-radius: 12px; padding: 4px; }
  .tab { flex: 1; padding: 10px; border: none; border-radius: 10px; background: transparent; cursor: pointer; font-family: inherit; font-weight: 600; color: #6b7280; }
  .tab.active { background: white; color: #7C3AED; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .field { margin-bottom: 16px; }
  .field label { display: block; font-size: 0.8rem; font-weight: 600; color: #374151; margin-bottom: 4px; }
  .field input { width: 100%; padding: 12px 14px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 1rem; font-family: inherit; box-sizing: border-box; }
  .field input:focus { outline: none; border-color: #7C3AED; }
  .submit { width: 100%; padding: 14px; border: none; border-radius: 14px; background: #7C3AED; color: white; font-family: inherit; font-size: 1rem; font-weight: 700; cursor: pointer; }
  .submit:disabled { opacity: 0.6; }
  .error { background: #fef2f2; color: #dc2626; padding: 10px; border-radius: 10px; font-size: 0.85rem; margin-bottom: 16px; }
  .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 0.85rem; }
  .link { background: none; border: none; color: #7C3AED; cursor: pointer; font-family: inherit; font-weight: 600; padding: 0; }
</style>
