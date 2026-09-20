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
