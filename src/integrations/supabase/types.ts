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
      audit_trail: {
        Row: {
          action: string
          actor_user_id: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata_json: Json | null
          organisation_id: string
          server_timestamp: string
          site_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata_json?: Json | null
          organisation_id: string
          server_timestamp?: string
          site_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata_json?: Json | null
          organisation_id?: string
          server_timestamp?: string
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_trail_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          approved: boolean
          created_at: string
          device_key: string
          device_name: string
          id: string
          revoked_at: string | null
          site_id: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          device_key: string
          device_name: string
          id?: string
          revoked_at?: string | null
          site_id: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          device_key?: string
          device_name?: string
          id?: string
          revoked_at?: string | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          active: boolean
          created_at: string
          id: string
          site_id: string
          site_role: Database["public"]["Enums"]["site_role"]
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          site_id: string
          site_role?: Database["public"]["Enums"]["site_role"]
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          site_id?: string
          site_role?: Database["public"]["Enums"]["site_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      org_users: {
        Row: {
          active: boolean
          created_at: string
          id: string
          org_role: Database["public"]["Enums"]["org_role"]
          organisation_id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          org_role: Database["public"]["Enums"]["org_role"]
          organisation_id: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          org_role?: Database["public"]["Enums"]["org_role"]
          organisation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_users_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      sites: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          id: string
          name: string
          organisation_id: string
          owner_user_id: string | null
          timezone: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          name: string
          organisation_id: string
          owner_user_id?: string | null
          timezone?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          organisation_id?: string
          owner_user_id?: string | null
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_type: Database["public"]["Enums"]["auth_type"]
          auth_user_id: string | null
          created_at: string
          display_name: string
          email: string | null
          id: string
          last_login_at: string | null
          organisation_id: string
          staff_code: string | null
          status: Database["public"]["Enums"]["user_status"]
        }
        Insert: {
          auth_type?: Database["public"]["Enums"]["auth_type"]
          auth_user_id?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          last_login_at?: string | null
          organisation_id: string
          staff_code?: string | null
          status?: Database["public"]["Enums"]["user_status"]
        }
        Update: {
          auth_type?: Database["public"]["Enums"]["auth_type"]
          auth_user_id?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          last_login_at?: string | null
          organisation_id?: string
          staff_code?: string | null
          status?: Database["public"]["Enums"]["user_status"]
        }
        Relationships: [
          {
            foreignKeyName: "fk_users_org"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_app_user_id: { Args: never; Returns: string }
      get_user_org_id: { Args: never; Returns: string }
      handle_signup: {
        Args: {
          _display_name: string
          _email: string
          _org_name: string
          _site_address?: string
          _site_name: string
        }
        Returns: Json
      }
      has_hq_access: { Args: { _org_id: string }; Returns: boolean }
      has_site_access: { Args: { _site_id: string }; Returns: boolean }
      has_site_membership: { Args: { _site_id: string }; Returns: boolean }
      is_org_owner: { Args: { _org_id: string }; Returns: boolean }
      validate_staff_code: {
        Args: { _site_id: string; _staff_code: string }
        Returns: Json
      }
    }
    Enums: {
      auth_type: "email" | "staff_code"
      org_role: "org_owner" | "hq_admin" | "hq_auditor"
      site_role: "owner" | "supervisor" | "staff" | "read_only"
      user_status: "active" | "suspended"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      auth_type: ["email", "staff_code"],
      org_role: ["org_owner", "hq_admin", "hq_auditor"],
      site_role: ["owner", "supervisor", "staff", "read_only"],
      user_status: ["active", "suspended"],
    },
  },
} as const
