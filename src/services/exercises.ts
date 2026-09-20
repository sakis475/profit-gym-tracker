import { supabase } from '../lib/supabase'
import type { ExerciseRow, ExerciseInsert, ExerciseUpdate } from '../types/entityTypes'


export async function getExercises(): Promise<ExerciseRow[] | null> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .is('disabledAt', null)
    .order('id', { ascending: true })

  if (error) {
    console.error('Read exercises error:', error)
    return null
  }

  return data
}

export async function getExerciseCategories(): Promise<string[] | null> {
  const { data, error } = await supabase
    .from('exercises')
    .select('category')
    .is('disabledAt', null)
    .not('category', 'is', null)

  if (error) {
    console.error('Read exercise categories error:', error)
    return null
  }

  const categories = new Set<string>()
  for (const { category } of data) {
    const trimmed = category?.trim()
    if (trimmed) categories.add(trimmed)
  }

  return [...categories].sort((a, b) => a.localeCompare(b))
}

export async function createExercise(
  exercise: ExerciseInsert
): Promise<ExerciseRow | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) {
    console.error('Create exercise - getUser error:', userError)
    return null
  }

  if (userData?.user) {
    exercise.user_id = userData.user.id
  }

  const { data, error } = await supabase
    .from('exercises')
    .insert(exercise)
    .select()
    .single()

  if (error) {
    console.error('Create exercise error:', error)
    return null
  }

  return data
}

export async function getExercise(id: string): Promise<ExerciseRow | null> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('Get exercise error:', error)
    return null
  }

  return data
}

export async function updateExercise(
  id: string,
  updates: Partial<ExerciseUpdate>
): Promise<ExerciseRow | null> {
  const { data, error } = await supabase
    .from('exercises')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Update exercise error:', error)
    return null
  }

  return data
}

export async function deleteExercise(
  id: string,
): Promise<ExerciseRow | null> {
  const { data, error } = await supabase
    .from('exercises')
    .update({ disabledAt: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Update exercise error:', error)
    return null
  }

  return data
}
