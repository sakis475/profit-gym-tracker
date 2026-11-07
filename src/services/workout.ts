import { supabase } from '../lib/supabase'
import type { WorkoutRow, WorkoutInsert, WorkoutWithExercise } from '../types/entityTypes'


// Every row is one set. The sets logged together share the same createdAt, which is
// what makes them one workout.

async function getWorkoutSets(
  exerciseId: string,
  createdAt: string
): Promise<WorkoutRow[] | null> {
  const { data, error } = await supabase
    .from('workout')
    .select('*')
    .eq('exerciseId', exerciseId)
    .eq('createdAt', createdAt)
    .is('disabledAt', null)
    .order('set', { ascending: true })

  if (error) {
    console.error('Get workout sets error:', error)
    return null
  }

  return data
}

// All sets of the last workout of an exercise, optionally only those before `before` (ISO string)
export async function getLastWorkoutSets(
  exerciseId: string,
  before?: string
): Promise<WorkoutRow[] | null> {
  let latest = supabase
    .from('workout')
    .select('createdAt')
    .eq('exerciseId', exerciseId)
    .is('disabledAt', null)

  if (before) latest = latest.lt('createdAt', before)

  const { data: last, error: lastError } = await latest
    .order('createdAt', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastError) {
    console.error('Get last workout error:', lastError)
    return null
  }
  if (!last) return []

  return getWorkoutSets(exerciseId, last.createdAt)
}

// The set with the highest `column`, the other column breaking a tie and the first time
// winning after that. Zero is left out with null, it means nothing was entered.
async function getTopSet(
  exerciseId: string,
  column: 'kg' | 'reps',
  before?: string
): Promise<WorkoutRow | null> {
  let query = supabase
    .from('workout')
    .select('*')
    .eq('exerciseId', exerciseId)
    .is('disabledAt', null)
    .gt(column, 0)

  if (before) query = query.lt('createdAt', before)

  const { data, error } = await query
    .order(column, { ascending: false })
    .order(column === 'kg' ? 'reps' : 'kg', { ascending: false, nullsFirst: false })
    .order('createdAt', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Get top set error:', error)
    return null
  }

  return data
}

// The max of an exercise, optionally only from before `before` (ISO string): its heaviest
// set, or for an exercise done without weight the set with the most reps. Null when there is none.
export async function getMaxSet(exerciseId: string, before?: string): Promise<WorkoutRow | null> {
  return (await getTopSet(exerciseId, 'kg', before)) ?? getTopSet(exerciseId, 'reps', before)
}

export async function getWorkoutsSince(since: string): Promise<WorkoutRow[] | null> {
  const { data, error } = await supabase
    .from('workout')
    .select('*')
    .gte('createdAt', since)
    .is('disabledAt', null)
    .order('set', { ascending: true })

  if (error) {
    console.error('Read workouts error:', error)
    return null
  }

  return data
}

const HISTORY_PAGE_SIZE = 1000

// Every logged set, newest workout first. The exercise is joined without filtering on its
// disabledAt, so workouts of a deleted exercise stay in the history. Fetched in pages since
// the API caps how many rows one request returns.
export async function getWorkoutHistory(): Promise<WorkoutWithExercise[] | null> {
  const rows: WorkoutWithExercise[] = []

  for (let from = 0; ; from += HISTORY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('workout')
      .select('*, exercises(name, category)')
      .is('disabledAt', null)
      .order('createdAt', { ascending: false })
      .order('set', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + HISTORY_PAGE_SIZE - 1)

    if (error) {
      console.error('Read workout history error:', error)
      return null
    }

    rows.push(...data)
    if (data.length < HISTORY_PAGE_SIZE) return rows
  }
}

export async function createWorkoutSets(
  sets: WorkoutInsert[]
): Promise<WorkoutRow[] | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) {
    console.error('Create workout sets - getUser error:', userError)
    return null
  }

  if (userData?.user) {
    for (const set of sets) set.user_id = userData.user.id
  }

  const { data, error } = await supabase
    .from('workout')
    .insert(sets)
    .select()

  if (error) {
    console.error('Create workout sets error:', error)
    return null
  }

  return data
}

// Makes the workout (exerciseId + createdAt) contain exactly `sets`, matched by set number:
// changed sets are updated, new ones inserted and the ones left out disabled (soft deleted).
// It works from what is in the database, so it is safe to retry after a failure.
export async function replaceWorkoutSets(
  exerciseId: string,
  createdAt: string,
  sets: { set: number; reps: number | null; kg: number | null; notes: string | null }[]
): Promise<WorkoutRow[] | null> {
  const current = await getWorkoutSets(exerciseId, createdAt)
  if (!current) return null

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) {
    console.error('Replace workout sets - getUser error:', userError)
    return null
  }

  const currentBySet = new Map(current.map((w) => [w.set, w]))
  const wanted = new Set<number | null>(sets.map((s) => s.set))

  const updates: { id: string; reps: number | null; kg: number | null; notes: string | null }[] = []
  const inserts: WorkoutInsert[] = []
  for (const { set, reps, kg, notes } of sets) {
    const existing = currentBySet.get(set)
    if (!existing) {
      inserts.push({ exerciseId, createdAt, set, reps, kg, notes, user_id: userData?.user?.id })
    } else if (existing.reps !== reps || existing.kg !== kg || existing.notes !== notes) {
      updates.push({ id: existing.id, reps, kg, notes })
    }
  }
  const removedIds = current.filter((w) => !wanted.has(w.set)).map((w) => w.id)

  // A row-level security policy that blocks an update is not an error, it just touches
  // no rows. So the rows that come back are counted, otherwise the workout would
  // silently end up half changed.

  // Removing goes first: if it is not allowed nothing has been changed yet
  if (removedIds.length > 0) {
    const { data, error } = await supabase
      .from('workout')
      .update({ disabledAt: new Date().toISOString() })
      .in('id', removedIds)
      .select('id')
    if (error || data.length !== removedIds.length) {
      console.error('Replace workout sets - delete error:', error ?? 'rows not disabled, check the update policy')
      return null
    }
  }

  const updated = await Promise.all(
    updates.map(({ id, reps, kg, notes }) =>
      supabase.from('workout').update({ reps, kg, notes }).eq('id', id).select('id')
    )
  )
  const failedUpdate = updated.find((r) => r.error || r.data.length !== 1)
  if (failedUpdate) {
    console.error('Replace workout sets - update error:', failedUpdate.error ?? 'row not updated, check the update policy')
    return null
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from('workout').insert(inserts)
    if (error) {
      console.error('Replace workout sets - insert error:', error)
      return null
    }
  }

  return getWorkoutSets(exerciseId, createdAt)
}
