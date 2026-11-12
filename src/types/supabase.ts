export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      body_weight: {
        Row: {
          createdAt: string
          date: string
          disabledAt: string | null
          id: string
          kg: number
          notes: string | null
          user_id: string
        }
        Insert: {
          createdAt?: string
          date: string
          disabledAt?: string | null
          id?: string
          kg: number
          notes?: string | null
          user_id?: string
        }
        Update: {
          createdAt?: string
          date?: string
          disabledAt?: string | null
          id?: string
          kg?: number
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          category: string | null
          createdAt: string | null
          disabledAt: string | null
          id: string
          name: string
          notes: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          createdAt?: string | null
          disabledAt?: string | null
          id?: string
          name: string
          notes?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          createdAt?: string | null
          disabledAt?: string | null
          id?: string
          name?: string
          notes?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      food_contents: {
        Row: {
          contentId: string
          createdAt: string
          disabledAt: string | null
          foodId: string
          id: string
          order: number | null
          quantity: number
          user_id: string
        }
        Insert: {
          contentId: string
          createdAt?: string
          disabledAt?: string | null
          foodId: string
          id?: string
          order?: number | null
          quantity: number
          user_id?: string
        }
        Update: {
          contentId?: string
          createdAt?: string
          disabledAt?: string | null
          foodId?: string
          id?: string
          order?: number | null
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_contents_contentId_fkey"
            columns: ["contentId"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_contents_foodId_fkey"
            columns: ["foodId"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      food_log: {
        Row: {
          carbs: number
          createdAt: string
          date: string
          disabledAt: string | null
          fat: number
          fiber: number
          foodId: string
          id: string
          kcal: number
          mealId: string
          parentId: string | null
          planId: string | null
          protein: number
          quantity: number
          user_id: string
        }
        Insert: {
          carbs?: number
          createdAt?: string
          date: string
          disabledAt?: string | null
          fat?: number
          fiber?: number
          foodId: string
          id?: string
          kcal?: number
          mealId: string
          parentId?: string | null
          planId?: string | null
          protein?: number
          quantity: number
          user_id?: string
        }
        Update: {
          carbs?: number
          createdAt?: string
          date?: string
          disabledAt?: string | null
          fat?: number
          fiber?: number
          foodId?: string
          id?: string
          kcal?: number
          mealId?: string
          parentId?: string | null
          planId?: string | null
          protein?: number
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_log_foodId_fkey"
            columns: ["foodId"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_log_mealId_fkey"
            columns: ["mealId"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_log_parentId_fkey"
            columns: ["parentId"]
            isOneToOne: false
            referencedRelation: "food_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_log_planId_fkey"
            columns: ["planId"]
            isOneToOne: false
            referencedRelation: "meal_plan"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          carbs: number
          createdAt: string
          disabledAt: string | null
          fat: number
          fiber: number
          id: string
          kcal: number
          name: string
          notes: string | null
          protein: number
          unit: string
          user_id: string
        }
        Insert: {
          carbs?: number
          createdAt?: string
          disabledAt?: string | null
          fat?: number
          fiber?: number
          id?: string
          kcal?: number
          name: string
          notes?: string | null
          protein?: number
          unit?: string
          user_id?: string
        }
        Update: {
          carbs?: number
          createdAt?: string
          disabledAt?: string | null
          fat?: number
          fiber?: number
          id?: string
          kcal?: number
          name?: string
          notes?: string | null
          protein?: number
          unit?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_plan: {
        Row: {
          createdAt: string
          day: number
          disabledAt: string | null
          foodId: string
          id: string
          mealId: string
          order: number | null
          parentId: string | null
          quantity: number
          user_id: string
        }
        Insert: {
          createdAt?: string
          day: number
          disabledAt?: string | null
          foodId: string
          id?: string
          mealId: string
          order?: number | null
          parentId?: string | null
          quantity: number
          user_id?: string
        }
        Update: {
          createdAt?: string
          day?: number
          disabledAt?: string | null
          foodId?: string
          id?: string
          mealId?: string
          order?: number | null
          parentId?: string | null
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_foodId_fkey"
            columns: ["foodId"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_mealId_fkey"
            columns: ["mealId"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_parentId_fkey"
            columns: ["parentId"]
            isOneToOne: false
            referencedRelation: "meal_plan"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          createdAt: string
          disabledAt: string | null
          id: string
          name: string
          order: number | null
          user_id: string
        }
        Insert: {
          createdAt?: string
          disabledAt?: string | null
          id?: string
          name: string
          order?: number | null
          user_id?: string
        }
        Update: {
          createdAt?: string
          disabledAt?: string | null
          id?: string
          name?: string
          order?: number | null
          user_id?: string
        }
        Relationships: []
      }
      nutrition_goals: {
        Row: {
          carbs: number | null
          fat: number | null
          fiber: number | null
          kcal: number | null
          protein: number | null
          updatedAt: string
          user_id: string
        }
        Insert: {
          carbs?: number | null
          fat?: number | null
          fiber?: number | null
          kcal?: number | null
          protein?: number | null
          updatedAt?: string
          user_id?: string
        }
        Update: {
          carbs?: number | null
          fat?: number | null
          fiber?: number | null
          kcal?: number | null
          protein?: number | null
          updatedAt?: string
          user_id?: string
        }
        Relationships: []
      }
      profile: {
        Row: {
          activityLevel: string | null
          birthDate: string | null
          goal: string | null
          heightCm: number | null
          sex: string | null
          updatedAt: string
          user_id: string
        }
        Insert: {
          activityLevel?: string | null
          birthDate?: string | null
          goal?: string | null
          heightCm?: number | null
          sex?: string | null
          updatedAt?: string
          user_id?: string
        }
        Update: {
          activityLevel?: string | null
          birthDate?: string | null
          goal?: string | null
          heightCm?: number | null
          sex?: string | null
          updatedAt?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduler: {
        Row: {
          createdAt: string | null
          day: number
          disabledAt: string | null
          exerciseId: string
          id: string
          order: number | null
          user_id: string | null
        }
        Insert: {
          createdAt?: string | null
          day: number
          disabledAt?: string | null
          exerciseId: string
          id?: string
          order?: number | null
          user_id?: string | null
        }
        Update: {
          createdAt?: string | null
          day?: number
          disabledAt?: string | null
          exerciseId?: string
          id?: string
          order?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduler_exerciseId_fkey"
            columns: ["exerciseId"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workout: {
        Row: {
          createdAt: string
          disabledAt: string | null
          exerciseId: string
          id: string
          kg: number | null
          notes: string | null
          reps: number | null
          set: number | null
          user_id: string | null
        }
        Insert: {
          createdAt: string
          disabledAt?: string | null
          exerciseId: string
          id?: string
          kg?: number | null
          notes?: string | null
          reps?: number | null
          set?: number | null
          user_id?: string | null
        }
        Update: {
          createdAt?: string
          disabledAt?: string | null
          exerciseId?: string
          id?: string
          kg?: number | null
          notes?: string | null
          reps?: number | null
          set?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_exerciseId_fkey"
            columns: ["exerciseId"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
