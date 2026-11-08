import type { Database } from "./supabase"

export type ExerciseRow = Database['public']['Tables']['exercises']['Row']
export type ExerciseInsert = Database['public']['Tables']['exercises']['Insert']
export type ExerciseUpdate = Database['public']['Tables']['exercises']['Update']

export type ScheduleRow = Database['public']['Tables']['scheduler']['Row']
export type ScheduleInsert = Database['public']['Tables']['scheduler']['Insert']
export type ScheduleUpdate = Database['public']['Tables']['scheduler']['Update']
export type ScheduleWithExercise = ScheduleRow & {
    exercises: Pick<ExerciseRow, 'name' | 'category'>
}

export type WorkoutRow = Database['public']['Tables']['workout']['Row']
export type WorkoutInsert = Database['public']['Tables']['workout']['Insert']
export type WorkoutUpdate = Database['public']['Tables']['workout']['Update']
export type WorkoutWithExercise = WorkoutRow & {
    exercises: Pick<ExerciseRow, 'name' | 'category'>
}

export type FoodRow = Database['public']['Tables']['foods']['Row']
export type FoodInsert = Database['public']['Tables']['foods']['Insert']
export type FoodUpdate = Database['public']['Tables']['foods']['Update']

export type MealRow = Database['public']['Tables']['meals']['Row']
export type MealInsert = Database['public']['Tables']['meals']['Insert']
export type MealUpdate = Database['public']['Tables']['meals']['Update']

export type MealPlanRow = Database['public']['Tables']['meal_plan']['Row']
export type MealPlanInsert = Database['public']['Tables']['meal_plan']['Insert']
export type MealPlanUpdate = Database['public']['Tables']['meal_plan']['Update']
export type MealPlanWithFood = MealPlanRow & { foods: FoodRow }

export type NutritionGoalsRow = Database['public']['Tables']['nutrition_goals']['Row']
export type NutritionGoalsInsert = Database['public']['Tables']['nutrition_goals']['Insert']

export type FoodLogRow = Database['public']['Tables']['food_log']['Row']
export type FoodLogInsert = Database['public']['Tables']['food_log']['Insert']
export type FoodLogUpdate = Database['public']['Tables']['food_log']['Update']
export type FoodLogWithFood = FoodLogRow & { foods: Pick<FoodRow, 'name' | 'unit'> }

export type BodyWeightRow = Database['public']['Tables']['body_weight']['Row']

export type ProfileRow = Database['public']['Tables']['profile']['Row']
export type ProfileInsert = Database['public']['Tables']['profile']['Insert']
