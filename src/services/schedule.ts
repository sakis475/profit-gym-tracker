import { supabase } from '../lib/supabase'
import type {
  ScheduleRow,
  ScheduleInsert,
  ScheduleUpdate,
  ScheduleWithExercise,
} from '../types/entityTypes'


// Entries whose exercise was deleted (disabled) are left out, hence the inner join
export async function getSchedules(day?: number): Promise<ScheduleWithExercise[] | null> {
  let query = supabase
    .from('scheduler')
    .select('*, exercises!inner(name, category)')
    .is('disabledAt', null)
    .is('exercises.disabledAt', null)

  if (day !== undefined) query = query.eq('day', day)

  const { data, error } = await query
    .order('day', { ascending: true })
    .order('order', { ascending: true, nullsFirst: false })
    .order('createdAt', { ascending: true })

  if (error) {
    console.error('Read schedules error:', error)
    return null
  }

  return data
}

// Persists a new order for a single day's schedule entries, in the given order
export async function reorderSchedules(orderedIds: string[]): Promise<boolean> {
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from('scheduler').update({ order: index }).eq('id', id)
    )
  )

  const error = results.find((res) => res.error)?.error
  if (error) {
    console.error('Reorder schedules error:', error)
    return false
  }

  return true
}

export async function createSchedule(
  schedule: ScheduleInsert
): Promise<ScheduleRow | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) {
    console.error('Create schedule - getUser error:', userError)
    return null
  }

  if (userData?.user) {
    schedule.user_id = userData.user.id
  }

  const { data, error } = await supabase
    .from('scheduler')
    .insert(schedule)
    .select()
    .single()

  if (error) {
    console.error('Create schedule error:', error)
    return null
  }

  return data
}

export async function getSchedule(id: string): Promise<ScheduleRow | null> {
  const { data, error } = await supabase
    .from('scheduler')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('Get schedule error:', error)
    return null
  }

  return data
}

export async function updateSchedule(
  id: string,
  updates: Partial<ScheduleUpdate>
): Promise<ScheduleRow | null> {
  const { data, error } = await supabase
    .from('scheduler')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Update schedule error:', error)
    return null
  }

  return data
}

export async function deleteSchedule(
  id: string,
): Promise<ScheduleRow | null> {
  const { data, error } = await supabase
    .from('scheduler')
    .update({ disabledAt: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Delete schedule error:', error)
    return null
  }

  return data
}
