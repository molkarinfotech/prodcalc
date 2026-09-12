import { supabase } from './supabase.js';

// =============================================
// AUTH
// =============================================

export async function signUp(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

// =============================================
// FAMILIES
// =============================================

export async function createFamily(name, userId, displayName) {
  // Create the family
  const { data: family, error } = await supabase
    .from('families')
    .insert({ name, created_by: userId })
    .select()
    .single();
  if (error) throw error;

  // Add the creator as an admin member
  const { error: memberError } = await supabase
    .from('family_members')
    .insert({
      family_id: family.id,
      user_id: userId,
      display_name: displayName || 'Admin',
      emoji: '👑',
      color: '#7C3AED',
      role: 'admin',
    });
  if (memberError) throw memberError;

  return family;
}

export async function getFamilyByInviteCode(code) {
  const { data, error } = await supabase
    .from('families')
    .select('*')
    .eq('invite_code', code.toUpperCase())
    .single();
  if (error) throw error;
  return data;
}

export async function joinFamily(familyId, userId, displayName, emoji = '🧒', color = '#6B7280') {
  const { data, error } = await supabase
    .from('family_members')
    .insert({
      family_id: familyId,
      user_id: userId,
      display_name: displayName,
      emoji,
      color,
      role: 'member',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getFamiliesForUser(userId) {
  const { data, error } = await supabase
    .from('family_members')
    .select(
      `
      family_id,
      role,
      display_name,
      emoji,
      color,
      families (
        id,
        name,
        invite_code,
        created_by
      )
    `
    )
    .eq('user_id', userId);
  if (error) throw error;
  return data.map((m) => ({
    ...m.families,
    member_id: m.family_id,
    role: m.role,
    display_name: m.display_name,
    emoji: m.emoji,
    color: m.color,
  }));
}

export async function getFamilyMembers(familyId) {
  const { data, error } = await supabase
    .from('family_members')
    .select('*')
    .eq('family_id', familyId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}
