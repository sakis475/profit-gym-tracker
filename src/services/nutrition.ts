import { supabase } from '../lib/supabase'
import type {
  BodyWeightRow,
  FoodContentInsert,
  FoodContentRow,
  FoodContentUpdate,
  FoodInsert,
  FoodLogInsert,
  FoodLogUpdate,
  FoodLogWithFood,
  FoodRow,
  FoodUpdate,
  MealInsert,
  MealPlanInsert,
  MealPlanUpdate,
  MealPlanWithFood,
  MealRow,
  MealUpdate,
  NutritionGoalsInsert,
  NutritionGoalsRow,
} from '../types/entityTypes'

// On the nutrition tables user_id defaults to auth.uid() in the database, so inserts leave it out.
// Deleting is a soft delete through disabledAt, like the workout tables.

const now = () => new Date().toISOString()

// Foods

export async function getFoods(): Promise<FoodRow[] | null> {
  const { data, error } = await supabase
    .from('foods')
    .select('*')
    .is('disabledAt', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('Read foods error:', error)
    return null
  }

  return data
}

export async function createFood(food: FoodInsert): Promise<FoodRow | null> {
  const { data, error } = await supabase.from('foods').insert(food).select().single()

  if (error) {
    console.error('Create food error:', error)
    return null
  }

  return data
}

export async function updateFood(id: string, updates: FoodUpdate): Promise<FoodRow | null> {
  const { data, error } = await supabase.from('foods').update(updates).eq('id', id).select().single()

  if (error) {
    console.error('Update food error:', error)
    return null
  }

  return data
}

export async function deleteFood(id: string): Promise<FoodRow | null> {
  return updateFood(id, { disabledAt: now() })
}

// What goes in the foods, of every food, in order
export async function getFoodContents(): Promise<FoodContentRow[] | null> {
  const { data, error } = await supabase
    .from('food_contents')
    .select('*')
    .is('disabledAt', null)
    .order('order', { ascending: true, nullsFirst: false })
    .order('createdAt', { ascending: true })

  if (error) {
    console.error('Read food contents error:', error)
    return null
  }

  return data
}

// Returns the new row's id
export async function createFoodContent(content: FoodContentInsert): Promise<string | null> {
  const { data, error } = await supabase.from('food_contents').insert(content).select('id').single()

  if (error) {
    console.error('Create food content error:', error)
    return null
  }

  return data.id
}

export async function updateFoodContent(id: string, updates: FoodContentUpdate): Promise<boolean> {
  const { data, error } = await supabase.from('food_contents').update(updates).eq('id', id).select('id')

  if (error || data.length !== 1) {
    console.error('Update food content error:', error ?? 'row not updated')
    return false
  }

  return true
}

export async function deleteFoodContent(id: string): Promise<boolean> {
  return updateFoodContent(id, { disabledAt: now() })
}

// Meals

export async function getMeals(): Promise<MealRow[] | null> {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .is('disabledAt', null)
    .order('order', { ascending: true, nullsFirst: false })
    .order('createdAt', { ascending: true })

  if (error) {
    console.error('Read meals error:', error)
    return null
  }

  return data
}

export async function createMeal(meal: MealInsert): Promise<MealRow | null> {
  const { data, error } = await supabase.from('meals').insert(meal).select().single()

  if (error) {
    console.error('Create meal error:', error)
    return null
  }

  return data
}

export async function updateMeal(id: string, updates: MealUpdate): Promise<MealRow | null> {
  const { data, error } = await supabase.from('meals').update(updates).eq('id', id).select().single()

  if (error) {
    console.error('Update meal error:', error)
    return null
  }

  return data
}

export async function deleteMeal(id: string): Promise<MealRow | null> {
  return updateMeal(id, { disabledAt: now() })
}

// Persists a new order for the meals, in the given order
export async function reorderMeals(orderedIds: string[]): Promise<boolean> {
  const results = await Promise.all(
    orderedIds.map((id, index) => supabase.from('meals').update({ order: index }).eq('id', id))
  )

  const error = results.find((res) => res.error)?.error
  if (error) {
    console.error('Reorder meals error:', error)
    return false
  }

  return true
}

// Meal plan

// Entries whose food or meal was deleted (disabled) are left out, hence the inner joins
export async function getMealPlan(day?: number): Promise<MealPlanWithFood[] | null> {
  let query = supabase
    .from('meal_plan')
    .select('*, foods!inner(*), meals!inner(id)')
    .is('disabledAt', null)
    .is('foods.disabledAt', null)
    .is('meals.disabledAt', null)

  if (day !== undefined) query = query.eq('day', day)

  const { data, error } = await query
    .order('day', { ascending: true })
    .order('order', { ascending: true, nullsFirst: false })
    .order('createdAt', { ascending: true })

  if (error) {
    console.error('Read meal plan error:', error)
    return null
  }

  return data
}

// Returns the new item's id
export async function createPlanItem(item: MealPlanInsert): Promise<string | null> {
  const { data, error } = await supabase.from('meal_plan').insert(item).select('id').single()

  if (error) {
    console.error('Create meal plan item error:', error)
    return null
  }

  return data.id
}

// Several items at once, e.g. what goes in a food. Returns their ids, in the order given.
export async function createPlanItems(items: MealPlanInsert[]): Promise<string[] | null> {
  if (items.length === 0) return []
  const { data, error } = await supabase.from('meal_plan').insert(items).select('id')

  if (error) {
    console.error('Create meal plan items error:', error)
    return null
  }

  return data.map((row) => row.id)
}

export async function updatePlanItem(id: string, updates: MealPlanUpdate): Promise<boolean> {
  const { data, error } = await supabase.from('meal_plan').update(updates).eq('id', id).select('id')

  if (error || data.length !== 1) {
    console.error('Update meal plan item error:', error ?? 'row not updated')
    return false
  }

  return true
}

// The same change to everything put in a planned food, e.g. its meal when it moves
export async function updatePlanContents(parentId: string, updates: MealPlanUpdate): Promise<boolean> {
  const { error } = await supabase.from('meal_plan').update(updates).eq('parentId', parentId).is('disabledAt', null)

  if (error) {
    console.error('Update meal plan contents error:', error)
    return false
  }

  return true
}

// What was put in it goes with it
export async function deletePlanItem(id: string): Promise<boolean> {
  return (await updatePlanContents(id, { disabledAt: now() })) && updatePlanItem(id, { disabledAt: now() })
}

// Goals

export async function getGoals(): Promise<NutritionGoalsRow | null> {
  const { data, error } = await supabase.from('nutrition_goals').select('*').maybeSingle()

  if (error) {
    console.error('Read nutrition goals error:', error)
    return null
  }

  return data
}

export async function saveGoals(goals: Omit<NutritionGoalsInsert, 'user_id' | 'updatedAt'>): Promise<NutritionGoalsRow | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    console.error('Save nutrition goals - getUser error:', userError)
    return null
  }

  // One row per user: the user id has to be sent for the upsert to find the existing row
  const { data, error } = await supabase
    .from('nutrition_goals')
    .upsert({ ...goals, user_id: userData.user.id, updatedAt: now() })
    .select()
    .single()

  if (error) {
    console.error('Save nutrition goals error:', error)
    return null
  }

  return data
}

// Food log

// The food is joined without filtering on its disabledAt, so what was eaten stays in the log
export async function getFoodLog(from: string, to: string): Promise<FoodLogWithFood[] | null> {
  const { data, error } = await supabase
    .from('food_log')
    .select('*, foods(name, unit)')
    .is('disabledAt', null)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
    .order('createdAt', { ascending: true })

  if (error) {
    console.error('Read food log error:', error)
    return null
  }

  return data
}

// Returns the new rows' ids, in the order given
export async function createFoodLogs(rows: FoodLogInsert[]): Promise<string[] | null> {
  const { data, error } = await supabase.from('food_log').insert(rows).select('id')

  if (error) {
    console.error('Create food log error:', error)
    return null
  }

  return data.map((row) => row.id)
}

export async function updateFoodLog(id: string, updates: FoodLogUpdate): Promise<boolean> {
  const { data, error } = await supabase.from('food_log').update(updates).eq('id', id).select('id')

  if (error || data.length !== 1) {
    console.error('Update food log error:', error ?? 'row not updated')
    return false
  }

  return true
}

// The same change to everything put in a logged food, e.g. its meal when it moves
export async function updateFoodLogContents(parentId: string, updates: FoodLogUpdate): Promise<boolean> {
  const { error } = await supabase.from('food_log').update(updates).eq('parentId', parentId).is('disabledAt', null)

  if (error) {
    console.error('Update food log contents error:', error)
    return false
  }

  return true
}

// What was put in it goes with it
export async function deleteFoodLog(id: string): Promise<boolean> {
  return (await updateFoodLogContents(id, { disabledAt: now() })) && updateFoodLog(id, { disabledAt: now() })
}

// Body weight

export async function getBodyWeights(): Promise<BodyWeightRow[] | null> {
  const { data, error } = await supabase
    .from('body_weight')
    .select('*')
    .is('disabledAt', null)
    .order('date', { ascending: true })

  if (error) {
    console.error('Read body weight error:', error)
    return null
  }

  return data
}

// There is one weigh-in per date: an existing one for the date is updated, otherwise one is added
export async function saveBodyWeight(date: string, kg: number, notes: string | null): Promise<boolean> {
  const { data: existing, error: readError } = await supabase
    .from('body_weight')
    .select('id')
    .eq('date', date)
    .is('disabledAt', null)
    .maybeSingle()

  if (readError) {
    console.error('Save body weight - read error:', readError)
    return false
  }

  const { error } = existing
    ? await supabase.from('body_weight').update({ kg, notes }).eq('id', existing.id)
    : await supabase.from('body_weight').insert({ date, kg, notes })

  if (error) {
    console.error('Save body weight error:', error)
    return false
  }

  return true
}

export async function deleteBodyWeight(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('body_weight')
    .update({ disabledAt: now() })
    .eq('id', id)
    .select('id')

  if (error || data.length !== 1) {
    console.error('Delete body weight error:', error ?? 'row not updated')
    return false
  }

  return true
}
