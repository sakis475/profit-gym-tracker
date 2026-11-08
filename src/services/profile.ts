import { supabase } from '../lib/supabase'
import type { ProfileInsert, ProfileRow } from '../types/entityTypes'

export async function getProfile(): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from('profile').select('*').maybeSingle()

  if (error) {
    console.error('Read profile error:', error)
    return null
  }

  return data
}

export async function saveProfile(profile: Omit<ProfileInsert, 'user_id' | 'updatedAt'>): Promise<ProfileRow | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    console.error('Save profile - getUser error:', userError)
    return null
  }

  // One row per user: the user id has to be sent for the upsert to find the existing row
  const { data, error } = await supabase
    .from('profile')
    .upsert({ ...profile, user_id: userData.user.id, updatedAt: new Date().toISOString() })
    .select()
    .single()

  if (error) {
    console.error('Save profile error:', error)
    return null
  }

  return data
}
