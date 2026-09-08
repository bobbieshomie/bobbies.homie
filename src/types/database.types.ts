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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      calendar_events: {
        Row: {
          assigned_to: string | null
          category: string | null
          color_tag: string | null
          created_at: string
          description: string | null
          end_time: string
          household_id: string
          id: string
          is_shared: boolean
          location: string | null
          owner_id: string
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          color_tag?: string | null
          created_at?: string
          description?: string | null
          end_time: string
          household_id: string
          id?: string
          is_shared?: boolean
          location?: string | null
          owner_id: string
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          color_tag?: string | null
          created_at?: string
          description?: string | null
          end_time?: string
          household_id?: string
          id?: string
          is_shared?: boolean
          location?: string | null
          owner_id?: string
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chores: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          frequency: Database["public"]["Enums"]["chore_frequency"]
          household_id: string
          id: string
          is_completed: boolean
          points: number | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          frequency?: Database["public"]["Enums"]["chore_frequency"]
          household_id: string
          id?: string
          is_completed?: boolean
          points?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          frequency?: Database["public"]["Enums"]["chore_frequency"]
          household_id?: string
          id?: string
          is_completed?: boolean
          points?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chores_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chores_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chores_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_moods: {
        Row: {
          created_at: string
          date: string
          household_id: string
          id: string
          mood_level: number
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          household_id: string
          id?: string
          mood_level: number
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          household_id?: string
          id?: string
          mood_level?: number
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_moods_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_moods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      household_photos: {
        Row: {
          caption: string | null
          category: string | null
          created_at: string
          household_id: string
          id: string
          photo_url: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          category?: string | null
          created_at?: string
          household_id: string
          id?: string
          photo_url: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          category?: string | null
          created_at?: string
          household_id?: string
          id?: string
          photo_url?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_photos_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      monthly_budgets: {
        Row: {
          category_budgets: Json
          created_at: string
          household_id: string
          id: string
          month_year: string
          total_budget: number
          updated_at: string
        }
        Insert: {
          category_budgets?: Json
          created_at?: string
          household_id: string
          id?: string
          month_year: string
          total_budget?: number
          updated_at?: string
        }
        Update: {
          category_budgets?: Json
          created_at?: string
          household_id?: string
          id?: string
          month_year?: string
          total_budget?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_budgets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_logs: {
        Row: {
          cost: number | null
          created_at: string
          id: string
          is_done: boolean
          log_type: Database["public"]["Enums"]["pet_log_type"]
          notes: string | null
          pet_id: string
          scheduled_date: string
          title: string | null
          updated_at: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          id?: string
          is_done?: boolean
          log_type?: Database["public"]["Enums"]["pet_log_type"]
          notes?: string | null
          pet_id: string
          scheduled_date: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          id?: string
          is_done?: boolean
          log_type?: Database["public"]["Enums"]["pet_log_type"]
          notes?: string | null
          pet_id?: string
          scheduled_date?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_logs_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          birthdate: string | null
          breed: string | null
          color_tag: string | null
          created_at: string
          gender: string | null
          household_id: string
          id: string
          name: string
          notes: string | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          birthdate?: string | null
          breed?: string | null
          color_tag?: string | null
          created_at?: string
          gender?: string | null
          household_id: string
          id?: string
          name: string
          notes?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          birthdate?: string | null
          breed?: string | null
          color_tag?: string | null
          created_at?: string
          gender?: string | null
          household_id?: string
          id?: string
          name?: string
          notes?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          anniversary_date: string | null
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          email: string | null
          full_name: string
          household_id: string | null
          id: string
          nickname: string | null
          role: string | null
          theme_color: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          anniversary_date?: string | null
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          household_id?: string | null
          id: string
          nickname?: string | null
          role?: string | null
          theme_color?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          anniversary_date?: string | null
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          household_id?: string | null
          id?: string
          nickname?: string | null
          role?: string | null
          theme_color?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_finances: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["finance_category"]
          created_at: string
          date: string
          household_id: string
          id: string
          is_reimbursed: boolean
          paid_by: string
          receipt_url: string | null
          reimbursed_at: string | null
          split_ratio: number | null
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: Database["public"]["Enums"]["finance_category"]
          created_at?: string
          date?: string
          household_id: string
          id?: string
          is_reimbursed?: boolean
          paid_by: string
          receipt_url?: string | null
          reimbursed_at?: string | null
          split_ratio?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["finance_category"]
          created_at?: string
          date?: string
          household_id?: string
          id?: string
          is_reimbursed?: boolean
          paid_by?: string
          receipt_url?: string | null
          reimbursed_at?: string | null
          split_ratio?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_finances_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_finances_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_items: {
        Row: {
          added_by: string | null
          category: Database["public"]["Enums"]["shopping_category"]
          created_at: string
          household_id: string
          id: string
          is_purchased: boolean
          list_id: string | null
          note: string | null
          purchased_at: string | null
          quantity: string | null
          title: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          category?: Database["public"]["Enums"]["shopping_category"]
          created_at?: string
          household_id: string
          id?: string
          is_purchased?: boolean
          list_id?: string | null
          note?: string | null
          purchased_at?: string | null
          quantity?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          category?: Database["public"]["Enums"]["shopping_category"]
          created_at?: string
          household_id?: string
          id?: string
          is_purchased?: boolean
          list_id?: string | null
          note?: string | null
          purchased_at?: string | null
          quantity?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string | null
          household_id: string
          id: string
          location: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          household_id: string
          id?: string
          location?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          household_id?: string
          id?: string
          location?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_lists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_lists_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_household_and_join: {
        Args: { household_name: string }
        Returns: Json
      }
      get_auth_household_id: { Args: never; Returns: string }
      get_email_by_username: { Args: { p_username: string }; Returns: string }
      join_household_by_invite: {
        Args: { invite_code_input: string }
        Returns: Json
      }
    }
    Enums: {
      chore_frequency: "once" | "daily" | "weekly" | "biweekly" | "monthly"
      finance_category:
        | "groceries"
        | "utilities"
        | "rent"
        | "dining"
        | "pets"
        | "entertainment"
        | "travel"
        | "other"
      pet_log_type:
        | "vaccine"
        | "vet"
        | "grooming"
        | "medication"
        | "weight"
        | "other"
      shopping_category: "grocery" | "household" | "health" | "pets" | "other"
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
  public: {
    Enums: {
      chore_frequency: ["once", "daily", "weekly", "biweekly", "monthly"],
      finance_category: [
        "groceries",
        "utilities",
        "rent",
        "dining",
        "pets",
        "entertainment",
        "travel",
        "other",
      ],
      pet_log_type: [
        "vaccine",
        "vet",
        "grooming",
        "medication",
        "weight",
        "other",
      ],
      shopping_category: ["grocery", "household", "health", "pets", "other"],
    },
  },
} as const
