<script>
  import { onMount } from 'svelte';
  import { fetchFamilyReport } from '$lib/database.js';

  let family = $state(null);
  let members = $state([]);
  let streakData = $state({});
  let isLoading = $state(true);

  // Calculate streak for a single member
  function calculateStreak(memberId, entries) {
    if (!entries || entries.length === 0) return { current: 0, longest: 0, totalDays: 0 };

    // Get unique dates with entries for this member
    const dates = [...new Set(entries.filter(e => e.member_id === memberId).map(e => e.logged_date))].sort();
    if (dates.length === 0) return { current: 0, longest: 0, totalDays: 0 };

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 1;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Count consecutive days from today backwards
    const dateSet = new Set(dates);
    let checkDate = new Date(today);

    // Check if today has entries, if not start from yesterday
    const todayStr = today.toISOString().slice(0, 10);
    if (!dateSet.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Count current streak
    while (dateSet.has(checkDate.toISOString().slice(0, 10))) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Count longest streak
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T00:00:00');
      const curr = new Date(dates[i] + 'T00:00:00');
      const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return { current: currentStreak, longest: longestStreak, totalDays: dates.length };
  }

  // Calculate family streak (all members logged on same day)
  function calculateFamilyStreak(entries) {
    if (!entries || entries.length === 0) return 0;

    // Get unique dates where ALL members logged
    const dateMap = {};
    for (const e of entries) {
      if (!dateMap[e.logged_date]) dateMap[e.logged_date] = new Set();
      dateMap[e.logged_date].add(e.member_id);
    }

    const allMemberIds = members.map(m => m.id);
    const familyDates = Object.entries(dateMap)
      .filter(([_, memberSet]) => allMemberIds.every(id => memberSet.has(id)))
      .map(([date]) => date)
      .sort();

    if (familyDates.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    // Start from today or yesterday
    const dateSet = new Set(familyDates);
    let checkDate = new Date(today);
    if (!dateSet.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (dateSet.has(checkDate.toISOString().slice(0, 10))) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return streak;
  }

  onMount(async () => {
    const familyData = localStorage.getItem('selectedFamily');
    const membersData = localStorage.getItem('familyMembers');
    if (!familyData || !membersData) return;

    family = JSON.parse(familyData);
    members = JSON.parse(membersData);

    // Get entries from last 90 days for streak calculation
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 90);

    try {
      const entries = await fetchFamilyReport(
        family.id,
        startDate.toISOString().slice(0, 10),
        today.toISOString().slice(0, 10)
      );

      // Calculate streaks per member
      const streaks = {};
      for (const member of members) {
        streaks[member.id] = calculateStreak(member.id, entries);
      }
      streakData = {
        members: streaks,
        family: calculateFamilyStreak(entries)
      };
    } catch (err) {
      console.error('Failed to load streak data:', err);
    }

    isLoading = false;
  });

  function getStreakEmoji(streak) {
    if (streak >= 30) return '🔥';
    if (streak >= 14) return '⚡';
    if (streak >= 7) return '💪';
    if (streak >= 3) return '✅';
    return '🌱';
  }
</script>

{#if !isLoading}
  <div class="streak-widget">
    {#if streakData.family > 0}
      <div class="family-streak">
        <span class="streak-icon">🏠</span>
        <span class="streak-label">Family Streak</span>
        <span class="streak-value">{streakData.family} days 🔥</span>
      </div>
    {/if}

    <div class="member-streaks">
      {#each members as member}
        {@const streak = streakData.members[member.id] || { current: 0, longest: 0, totalDays: 0 }}
        <div class="streak-card">
          <span class="member-emoji">{member.emoji}</span>
          <span class="member-name">{member.display_name}</span>
          <div class="streak-info">
            <span class="current-streak">
              {getStreakEmoji(streak.current)} {streak.current} day streak
            </span>
            <span class="streak-details">
              Best: {streak.longest}d · Total: {streak.totalDays}d
            </span>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .streak-widget {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: linear-gradient(135deg, #fef3c7, #fde68a);
    border-radius: 16px;
    margin-bottom: 16px;
  }

  .family-streak {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }

  .streak-icon {
    font-size: 1.5rem;
  }

  .streak-label {
    flex: 1;
    font-weight: 700;
    color: #374151;
    font-size: 0.9rem;
  }

  .streak-value {
    font-size: 1.2rem;
    font-weight: 800;
    color: #dc2626;
  }

  .member-streaks {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .streak-card {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: white;
    border-radius: 10px;
    flex: 1;
    min-width: 150px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }

  .member-emoji {
    font-size: 1.3rem;
  }

  .member-name {
    font-weight: 600;
    font-size: 0.85rem;
    color: #374151;
    min-width: 60px;
  }

  .streak-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .current-streak {
    font-size: 0.8rem;
    font-weight: 700;
    color: #dc2626;
  }

  .streak-details {
    font-size: 0.7rem;
    color: #6b7280;
  }
</style>
