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
      batch_stage_events: {
        Row: {
          batch_id: string
          completed_at: string | null
          created_at: string
          evidence_urls: string[] | null
          id: string
          notes: string | null
          performed_by_user_id: string | null
          stage_key: string
          stage_name_snapshot: string
          started_at: string
        }
        Insert: {
          batch_id: string
          completed_at?: string | null
          created_at?: string
          evidence_urls?: string[] | null
          id?: string
          notes?: string | null
          performed_by_user_id?: string | null
          stage_key: string
          stage_name_snapshot: string
          started_at?: string
        }
        Update: {
          batch_id?: string
          completed_at?: string | null
          created_at?: string
          evidence_urls?: string[] | null
          id?: string
          notes?: string | null
          performed_by_user_id?: string | null
          stage_key?: string
          stage_name_snapshot?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_stage_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_stage_events_performed_by_user_id_fkey"
            columns: ["performed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_templates: {
        Row: {
          active: boolean
          config_json: Json
          created_at: string
          id: string
          name: string
          site_id: string
        }
        Insert: {
          active?: boolean
          config_json?: Json
          created_at?: string
          id?: string
          name: string
          site_id: string
        }
        Update: {
          active?: boolean
          config_json?: Json
          created_at?: string
          id?: string
          name?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_templates_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          batch_code: string
          completed_at: string | null
          created_at: string
          created_by_user_id: string | null
          date_produced: string | null
          id: string
          notes: string | null
          organisation_id: string
          product_name: string
          quantity_produced: number | null
          recipe_id: string | null
          recipe_ref: string | null
          site_id: string
          status: Database["public"]["Enums"]["batch_status"]
          template_id: string | null
          total_production_cost: number | null
          unit_cost_snapshot: number | null
          use_by_date: string | null
        }
        Insert: {
          batch_code: string
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          date_produced?: string | null
          id?: string
          notes?: string | null
          organisation_id: string
          product_name: string
          quantity_produced?: number | null
          recipe_id?: string | null
          recipe_ref?: string | null
          site_id: string
          status?: Database["public"]["Enums"]["batch_status"]
          template_id?: string | null
          total_production_cost?: number | null
          unit_cost_snapshot?: number | null
          use_by_date?: string | null
        }
        Update: {
          batch_code?: string
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          date_produced?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string
          product_name?: string
          quantity_produced?: number | null
          recipe_id?: string | null
          recipe_ref?: string | null
          site_id?: string
          status?: Database["public"]["Enums"]["batch_status"]
          template_id?: string | null
          total_production_cost?: number | null
          unit_cost_snapshot?: number | null
          use_by_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "batch_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          organisation_id: string | null
          payload: Json | null
          stripe_event_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          organisation_id?: string | null
          payload?: Json | null
          stripe_event_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          organisation_id?: string | null
          payload?: Json | null
          stripe_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_logs: {
        Row: {
          completed_at: string | null
          completed_by_name: string | null
          completed_by_user_id: string | null
          created_at: string
          done: boolean
          id: string
          log_date: string
          note: string | null
          organisation_id: string
          site_id: string
          task_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by_name?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          done?: boolean
          id?: string
          log_date: string
          note?: string | null
          organisation_id: string
          site_id: string
          task_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by_name?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          done?: boolean
          id?: string
          log_date?: string
          note?: string | null
          organisation_id?: string
          site_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_logs_completed_by_user_id_fkey"
            columns: ["completed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "cleaning_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_tasks: {
        Row: {
          active: boolean
          area: string
          assigned_to_name: string | null
          created_at: string
          due_time: string | null
          frequency: string
          id: string
          organisation_id: string
          site_id: string
          sort_order: number
          task: string
        }
        Insert: {
          active?: boolean
          area: string
          assigned_to_name?: string | null
          created_at?: string
          due_time?: string | null
          frequency?: string
          id?: string
          organisation_id: string
          site_id: string
          sort_order?: number
          task: string
        }
        Update: {
          active?: boolean
          area?: string
          assigned_to_name?: string | null
          created_at?: string
          due_time?: string | null
          frequency?: string
          id?: string
          organisation_id?: string
          site_id?: string
          sort_order?: number
          task?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_tasks_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_tasks_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      closed_days: {
        Row: {
          closed_by_name: string | null
          closed_by_user_id: string | null
          closed_date: string
          created_at: string
          id: string
          organisation_id: string
          reason: string | null
          site_id: string
        }
        Insert: {
          closed_by_name?: string | null
          closed_by_user_id?: string | null
          closed_date: string
          created_at?: string
          id?: string
          organisation_id: string
          reason?: string | null
          site_id: string
        }
        Update: {
          closed_by_name?: string | null
          closed_by_user_id?: string | null
          closed_date?: string
          created_at?: string
          id?: string
          organisation_id?: string
          reason?: string | null
          site_id?: string
        }
        Relationships: []
      }
      day_sheet_entries: {
        Row: {
          completed_at: string | null
          completed_by_user_id: string | null
          created_at: string
          day_sheet_id: string
          done: boolean
          id: string
          item_id: string
          note: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          day_sheet_id: string
          done?: boolean
          id?: string
          item_id: string
          note?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          day_sheet_id?: string
          done?: boolean
          id?: string
          item_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "day_sheet_entries_completed_by_user_id_fkey"
            columns: ["completed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_sheet_entries_day_sheet_id_fkey"
            columns: ["day_sheet_id"]
            isOneToOne: false
            referencedRelation: "day_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_sheet_entries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "day_sheet_items"
            referencedColumns: ["id"]
          },
        ]
      }
      day_sheet_items: {
        Row: {
          active: boolean
          created_at: string
          id: string
          label: string
          section_id: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          label: string
          section_id: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string
          section_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "day_sheet_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "day_sheet_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      day_sheet_sections: {
        Row: {
          active: boolean
          created_at: string
          default_time: string
          icon: string
          id: string
          organisation_id: string
          site_id: string
          sort_order: number
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_time?: string
          icon?: string
          id?: string
          organisation_id: string
          site_id: string
          sort_order?: number
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_time?: string
          icon?: string
          id?: string
          organisation_id?: string
          site_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_sheet_sections_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_sheet_sections_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      day_sheets: {
        Row: {
          created_at: string
          id: string
          locked: boolean
          locked_at: string | null
          locked_by_user_id: string | null
          manager_note: string | null
          organisation_id: string
          problem_notes: string | null
          sheet_date: string
          site_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          locked?: boolean
          locked_at?: string | null
          locked_by_user_id?: string | null
          manager_note?: string | null
          organisation_id: string
          problem_notes?: string | null
          sheet_date: string
          site_id: string
        }
        Update: {
          created_at?: string
          id?: string
          locked?: boolean
          locked_at?: string | null
          locked_by_user_id?: string | null
          manager_note?: string | null
          organisation_id?: string
          problem_notes?: string | null
          sheet_date?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_sheets_locked_by_user_id_fkey"
            columns: ["locked_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_sheets_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_sheets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_logs: {
        Row: {
          accepted: boolean
          created_at: string
          id: string
          items: string
          logged_at: string
          logged_by_name: string
          logged_by_user_id: string | null
          note: string | null
          organisation_id: string
          packaging: string
          site_id: string
          supplier_id: string
          temp: number | null
          temp_pass: boolean | null
          use_by_ok: boolean
        }
        Insert: {
          accepted?: boolean
          created_at?: string
          id?: string
          items: string
          logged_at?: string
          logged_by_name?: string
          logged_by_user_id?: string | null
          note?: string | null
          organisation_id: string
          packaging?: string
          site_id: string
          supplier_id: string
          temp?: number | null
          temp_pass?: boolean | null
          use_by_ok?: boolean
        }
        Update: {
          accepted?: boolean
          created_at?: string
          id?: string
          items?: string
          logged_at?: string
          logged_by_name?: string
          logged_by_user_id?: string | null
          note?: string | null
          organisation_id?: string
          packaging?: string
          site_id?: string
          supplier_id?: string
          temp?: number | null
          temp_pass?: boolean | null
          use_by_ok?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "delivery_logs_logged_by_user_id_fkey"
            columns: ["logged_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_logs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
      haccp_plans: {
        Row: {
          created_at: string
          created_by: string | null
          food_business_type: string | null
          id: string
          last_reviewed_at: string | null
          name: string
          organisation_id: string
          review_due_at: string | null
          site_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          food_business_type?: string | null
          id?: string
          last_reviewed_at?: string | null
          name: string
          organisation_id: string
          review_due_at?: string | null
          site_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          food_business_type?: string | null
          id?: string
          last_reviewed_at?: string | null
          name?: string
          organisation_id?: string
          review_due_at?: string | null
          site_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "haccp_plans_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      haccp_steps: {
        Row: {
          corrective_action: string | null
          created_at: string
          critical_limit: string | null
          description: string | null
          id: string
          monitoring_procedure: string | null
          plan_id: string
          responsible_person: string | null
          sort_order: number
          step_number: number
          step_type: string
          title: string
        }
        Insert: {
          corrective_action?: string | null
          created_at?: string
          critical_limit?: string | null
          description?: string | null
          id?: string
          monitoring_procedure?: string | null
          plan_id: string
          responsible_person?: string | null
          sort_order?: number
          step_number?: number
          step_type: string
          title: string
        }
        Update: {
          corrective_action?: string | null
          created_at?: string
          critical_limit?: string | null
          description?: string | null
          id?: string
          monitoring_procedure?: string | null
          plan_id?: string
          responsible_person?: string | null
          sort_order?: number
          step_number?: number
          step_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "haccp_steps_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "haccp_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      holiday_requests: {
        Row: {
          created_at: string
          end_date: string
          id: string
          notes: string | null
          organisation_id: string
          requested_by: string
          site_id: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          organisation_id: string
          requested_by: string
          site_id: string
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          organisation_id?: string
          requested_by?: string
          site_id?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holiday_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holiday_requests_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holiday_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          created_at: string
          description: string
          id: string
          immediate_action: string
          module: string | null
          organisation_id: string
          prevention: string | null
          reported_at: string
          reported_by_name: string
          reported_by_user_id: string | null
          root_cause: string | null
          site_id: string
          status: string
          title: string
          type: string
          verified_at: string | null
          verified_by_name: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          immediate_action: string
          module?: string | null
          organisation_id: string
          prevention?: string | null
          reported_at?: string
          reported_by_name?: string
          reported_by_user_id?: string | null
          root_cause?: string | null
          site_id: string
          status?: string
          title: string
          type: string
          verified_at?: string | null
          verified_by_name?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          immediate_action?: string
          module?: string | null
          organisation_id?: string
          prevention?: string | null
          reported_at?: string
          reported_by_name?: string
          reported_by_user_id?: string | null
          root_cause?: string | null
          site_id?: string
          status?: string
          title?: string
          type?: string
          verified_at?: string | null
          verified_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reported_by_user_id_fkey"
            columns: ["reported_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          active: boolean
          allergens: string[]
          cost_per_unit: number | null
          created_at: string
          id: string
          name: string
          organisation_id: string
          site_id: string
          supplier_name: string | null
          unit: string
        }
        Insert: {
          active?: boolean
          allergens?: string[]
          cost_per_unit?: number | null
          created_at?: string
          id?: string
          name: string
          organisation_id: string
          site_id: string
          supplier_name?: string | null
          unit?: string
        }
        Update: {
          active?: boolean
          allergens?: string[]
          cost_per_unit?: number | null
          created_at?: string
          id?: string
          name?: string
          organisation_id?: string
          site_id?: string
          supplier_name?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredients_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_logs: {
        Row: {
          created_at: string
          id: string
          issue: string
          item: string
          organisation_id: string
          priority: string
          reported_at: string
          reported_by_name: string
          reported_by_user_id: string | null
          resolution: string | null
          resolved_at: string | null
          site_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue: string
          item: string
          organisation_id: string
          priority?: string
          reported_at?: string
          reported_by_name?: string
          reported_by_user_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          site_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          issue?: string
          item?: string
          organisation_id?: string
          priority?: string
          reported_at?: string
          reported_by_name?: string
          reported_by_user_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          site_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_reported_by_user_id_fkey"
            columns: ["reported_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_site_id_fkey"
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
      messenger_channels: {
        Row: {
          archived: boolean
          created_at: string
          created_by_user_id: string | null
          description: string | null
          id: string
          is_private: boolean
          is_system: boolean
          name: string
          organisation_id: string
          role_filter: string | null
          site_id: string
          type: Database["public"]["Enums"]["messenger_channel_type"]
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          is_private?: boolean
          is_system?: boolean
          name: string
          organisation_id: string
          role_filter?: string | null
          site_id: string
          type?: Database["public"]["Enums"]["messenger_channel_type"]
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          is_private?: boolean
          is_system?: boolean
          name?: string
          organisation_id?: string
          role_filter?: string | null
          site_id?: string
          type?: Database["public"]["Enums"]["messenger_channel_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_channels_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messenger_channels_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messenger_channels_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_messages: {
        Row: {
          attachments: Json
          channel_id: string
          content: string | null
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          is_edited: boolean
          message_type: Database["public"]["Enums"]["messenger_message_type"]
          sender_id: string | null
          sender_name_snapshot: string | null
          site_id: string
          system_payload: Json | null
        }
        Insert: {
          attachments?: Json
          channel_id: string
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_edited?: boolean
          message_type?: Database["public"]["Enums"]["messenger_message_type"]
          sender_id?: string | null
          sender_name_snapshot?: string | null
          site_id: string
          system_payload?: Json | null
        }
        Update: {
          attachments?: Json
          channel_id?: string
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_edited?: boolean
          message_type?: Database["public"]["Enums"]["messenger_message_type"]
          sender_id?: string | null
          sender_name_snapshot?: string | null
          site_id?: string
          system_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "messenger_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "messenger_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messenger_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messenger_messages_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_participants: {
        Row: {
          channel_id: string
          id: string
          joined_at: string
          last_read_at: string
          muted: boolean
          role: Database["public"]["Enums"]["messenger_participant_role"]
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          muted?: boolean
          role?: Database["public"]["Enums"]["messenger_participant_role"]
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
          muted?: boolean
          role?: Database["public"]["Enums"]["messenger_participant_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_participants_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "messenger_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messenger_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_presence: {
        Row: {
          is_online: boolean
          last_seen_at: string
          site_id: string
          user_id: string
        }
        Insert: {
          is_online?: boolean
          last_seen_at?: string
          site_id: string
          user_id: string
        }
        Update: {
          is_online?: boolean
          last_seen_at?: string
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_presence_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messenger_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_read_receipts: {
        Row: {
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messenger_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messenger_read_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_settings: {
        Row: {
          organisation_id: string
          read_receipts_enabled: boolean
          short_notice_compensation_text: string
          short_notice_hours: number
          site_id: string
          updated_at: string
          who_can_create_channels: string
        }
        Insert: {
          organisation_id: string
          read_receipts_enabled?: boolean
          short_notice_compensation_text?: string
          short_notice_hours?: number
          site_id: string
          updated_at?: string
          who_can_create_channels?: string
        }
        Update: {
          organisation_id?: string
          read_receipts_enabled?: boolean
          short_notice_compensation_text?: string
          short_notice_hours?: number
          site_id?: string
          updated_at?: string
          who_can_create_channels?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_settings_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messenger_settings_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      module_activation: {
        Row: {
          activated_at: string | null
          id: string
          is_active: boolean
          module_name: string
          site_id: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          id?: string
          is_active?: boolean
          module_name: string
          site_id: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          id?: string
          is_active?: boolean
          module_name?: string
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_activation_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      org_cost_settings: {
        Row: {
          labour_hourly_rate: number
          monthly_overhead: number
          organisation_id: string
          target_margin_pct: number
          updated_at: string
        }
        Insert: {
          labour_hourly_rate?: number
          monthly_overhead?: number
          organisation_id: string
          target_margin_pct?: number
          updated_at?: string
        }
        Update: {
          labour_hourly_rate?: number
          monthly_overhead?: number
          organisation_id?: string
          target_margin_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_cost_settings_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: true
            referencedRelation: "organisations"
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
      pest_logs: {
        Row: {
          action_taken: string
          created_at: string
          description: string
          id: string
          location: string
          organisation_id: string
          reported_at: string
          reported_by_name: string
          reported_by_user_id: string | null
          resolved: boolean
          resolved_at: string | null
          site_id: string
          type: string
        }
        Insert: {
          action_taken: string
          created_at?: string
          description: string
          id?: string
          location: string
          organisation_id: string
          reported_at?: string
          reported_by_name?: string
          reported_by_user_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          site_id: string
          type: string
        }
        Update: {
          action_taken?: string
          created_at?: string
          description?: string
          id?: string
          location?: string
          organisation_id?: string
          reported_at?: string
          reported_by_name?: string
          reported_by_user_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          site_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pest_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pest_logs_reported_by_user_id_fkey"
            columns: ["reported_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pest_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      preventative_checks: {
        Row: {
          active: boolean
          created_at: string
          frequency: string
          id: string
          last_done_at: string | null
          next_due_at: string | null
          organisation_id: string
          site_id: string
          task: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          frequency?: string
          id?: string
          last_done_at?: string | null
          next_due_at?: string | null
          organisation_id: string
          site_id: string
          task: string
        }
        Update: {
          active?: boolean
          created_at?: string
          frequency?: string
          id?: string
          last_done_at?: string | null
          next_due_at?: string | null
          organisation_id?: string
          site_id?: string
          task?: string
        }
        Relationships: [
          {
            foreignKeyName: "preventative_checks_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventative_checks_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          cost_per_unit_override: number | null
          created_at: string
          id: string
          ingredient_id: string
          recipe_id: string
          sort_order: number
          unit: string | null
          weight: number | null
        }
        Insert: {
          cost_per_unit_override?: number | null
          created_at?: string
          id?: string
          ingredient_id: string
          recipe_id: string
          sort_order?: number
          unit?: string | null
          weight?: number | null
        }
        Update: {
          cost_per_unit_override?: number | null
          created_at?: string
          id?: string
          ingredient_id?: string
          recipe_id?: string
          sort_order?: number
          unit?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          active: boolean
          approved: boolean
          category: string
          created_at: string
          id: string
          label_type: string
          labour_minutes: number
          last_reviewed_at: string | null
          monthly_volume: number
          name: string
          organisation_id: string
          packaging_cost: number
          sell_price_ex_vat: number | null
          site_id: string
          target_margin_override: number | null
          vat_rate: string
        }
        Insert: {
          active?: boolean
          approved?: boolean
          category?: string
          created_at?: string
          id?: string
          label_type?: string
          labour_minutes?: number
          last_reviewed_at?: string | null
          monthly_volume?: number
          name: string
          organisation_id: string
          packaging_cost?: number
          sell_price_ex_vat?: number | null
          site_id: string
          target_margin_override?: number | null
          vat_rate?: string
        }
        Update: {
          active?: boolean
          approved?: boolean
          category?: string
          created_at?: string
          id?: string
          label_type?: string
          labour_minutes?: number
          last_reviewed_at?: string | null
          monthly_volume?: number
          name?: string
          organisation_id?: string
          packaging_cost?: number
          sell_price_ex_vat?: number | null
          site_id?: string
          target_margin_override?: number | null
          vat_rate?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      rota_assignment_tasks: {
        Row: {
          created_at: string
          id: string
          rota_assignment_id: string
          task_id: string
          task_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          rota_assignment_id: string
          task_id: string
          task_type: string
        }
        Update: {
          created_at?: string
          id?: string
          rota_assignment_id?: string
          task_id?: string
          task_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rota_assignment_tasks_rota_assignment_id_fkey"
            columns: ["rota_assignment_id"]
            isOneToOne: false
            referencedRelation: "rota_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      rota_assignments: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by_user_id: string | null
          created_at: string
          created_by_user_id: string | null
          end_time: string
          id: string
          organisation_id: string
          position: string | null
          published_at: string | null
          shift_date: string
          site_id: string
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          end_time: string
          id?: string
          organisation_id: string
          position?: string | null
          published_at?: string | null
          shift_date: string
          site_id: string
          start_time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          end_time?: string
          id?: string
          organisation_id?: string
          position?: string | null
          published_at?: string | null
          shift_date?: string
          site_id?: string
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rota_assignments_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_assignments_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_assignments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rota_audit_trail: {
        Row: {
          action: string
          actor_name: string | null
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          id: string
          notes: string | null
          occurred_at: string
          organisation_id: string
          rota_assignment_id: string | null
          site_id: string
        }
        Insert: {
          action: string
          actor_name?: string | null
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          id?: string
          notes?: string | null
          occurred_at?: string
          organisation_id: string
          rota_assignment_id?: string | null
          site_id: string
        }
        Update: {
          action?: string
          actor_name?: string | null
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          id?: string
          notes?: string | null
          occurred_at?: string
          organisation_id?: string
          rota_assignment_id?: string | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rota_audit_trail_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_audit_trail_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_audit_trail_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_compensation_logs: {
        Row: {
          cancellation_reason: string | null
          compensation_amount: number
          created_at: string
          created_by_user_id: string | null
          hourly_rate_used: number
          id: string
          is_paid: boolean
          notice_given_hours: number
          organisation_id: string
          paid_at: string | null
          paid_by_user_id: string | null
          payroll_export_ref: string | null
          pct_applied: number
          shift_date: string
          shift_end: string
          shift_hours: number
          shift_id: string | null
          shift_start: string
          site_id: string
          user_id: string
        }
        Insert: {
          cancellation_reason?: string | null
          compensation_amount: number
          created_at?: string
          created_by_user_id?: string | null
          hourly_rate_used: number
          id?: string
          is_paid?: boolean
          notice_given_hours: number
          organisation_id: string
          paid_at?: string | null
          paid_by_user_id?: string | null
          payroll_export_ref?: string | null
          pct_applied: number
          shift_date: string
          shift_end: string
          shift_hours: number
          shift_id?: string | null
          shift_start: string
          site_id: string
          user_id: string
        }
        Update: {
          cancellation_reason?: string | null
          compensation_amount?: number
          created_at?: string
          created_by_user_id?: string | null
          hourly_rate_used?: number
          id?: string
          is_paid?: boolean
          notice_given_hours?: number
          organisation_id?: string
          paid_at?: string | null
          paid_by_user_id?: string | null
          payroll_export_ref?: string | null
          pct_applied?: number
          shift_date?: string
          shift_end?: string
          shift_hours?: number
          shift_id?: string | null
          shift_start?: string
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_compensation_logs_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_compensation_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_compensation_logs_paid_by_user_id_fkey"
            columns: ["paid_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_compensation_logs_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "rota_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_compensation_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_compensation_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_requests: {
        Row: {
          created_at: string
          id: string
          manager_decision_at: string | null
          manager_id: string | null
          manager_note: string | null
          message: string | null
          organisation_id: string
          original_shift_id: string
          request_type: Database["public"]["Enums"]["shift_request_type"]
          requester_id: string
          resolved_at: string | null
          site_id: string
          status: Database["public"]["Enums"]["shift_request_status"]
          target_shift_id: string | null
          target_user_id: string | null
          teammate_responded_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_decision_at?: string | null
          manager_id?: string | null
          manager_note?: string | null
          message?: string | null
          organisation_id: string
          original_shift_id: string
          request_type: Database["public"]["Enums"]["shift_request_type"]
          requester_id: string
          resolved_at?: string | null
          site_id: string
          status?: Database["public"]["Enums"]["shift_request_status"]
          target_shift_id?: string | null
          target_user_id?: string | null
          teammate_responded_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_decision_at?: string | null
          manager_id?: string | null
          manager_note?: string | null
          message?: string | null
          organisation_id?: string
          original_shift_id?: string
          request_type?: Database["public"]["Enums"]["shift_request_type"]
          requester_id?: string
          resolved_at?: string | null
          site_id?: string
          status?: Database["public"]["Enums"]["shift_request_status"]
          target_shift_id?: string | null
          target_user_id?: string | null
          teammate_responded_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_requests_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_requests_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_requests_original_shift_id_fkey"
            columns: ["original_shift_id"]
            isOneToOne: false
            referencedRelation: "rota_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_requests_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_requests_target_shift_id_fkey"
            columns: ["target_shift_id"]
            isOneToOne: false
            referencedRelation: "rota_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_requests_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_staff: {
        Row: {
          created_at: string
          id: string
          shift_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          shift_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          shift_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_staff_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_task_completions: {
        Row: {
          completed_at: string
          completed_by_name: string
          completed_by_user_id: string | null
          completion_date: string
          created_at: string
          id: string
          site_id: string
          task_id: string
        }
        Insert: {
          completed_at?: string
          completed_by_name?: string
          completed_by_user_id?: string | null
          completion_date: string
          created_at?: string
          id?: string
          site_id: string
          task_id: string
        }
        Update: {
          completed_at?: string
          completed_by_name?: string
          completed_by_user_id?: string | null
          completion_date?: string
          created_at?: string
          id?: string
          site_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_task_completions_completed_by_user_id_fkey"
            columns: ["completed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_task_completions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "shift_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_tasks: {
        Row: {
          active: boolean
          assigned_to_user_id: string | null
          created_at: string
          due_time: string
          id: string
          module: string
          organisation_id: string
          recurring: boolean
          shift_id: string
          site_id: string
          title: string
        }
        Insert: {
          active?: boolean
          assigned_to_user_id?: string | null
          created_at?: string
          due_time: string
          id?: string
          module?: string
          organisation_id: string
          recurring?: boolean
          shift_id: string
          site_id: string
          title: string
        }
        Update: {
          active?: boolean
          assigned_to_user_id?: string | null
          created_at?: string
          due_time?: string
          id?: string
          module?: string
          organisation_id?: string
          recurring?: boolean
          shift_id?: string
          site_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_tasks_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_tasks_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_tasks_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_tasks_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          active: boolean
          color: string
          created_at: string
          days_active: string[]
          end_time: string
          id: string
          name: string
          organisation_id: string
          site_id: string
          start_time: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          days_active?: string[]
          end_time?: string
          id?: string
          name: string
          organisation_id: string
          site_id: string
          start_time?: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          days_active?: string[]
          end_time?: string
          id?: string
          name?: string
          organisation_id?: string
          site_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_compensation_settings: {
        Row: {
          default_hourly_rate: number | null
          organisation_id: string
          short_notice_hours: number
          short_notice_pct: number
          site_id: string
          updated_at: string
          very_short_notice_hours: number
          very_short_notice_pct: number
        }
        Insert: {
          default_hourly_rate?: number | null
          organisation_id: string
          short_notice_hours?: number
          short_notice_pct?: number
          site_id: string
          updated_at?: string
          very_short_notice_hours?: number
          very_short_notice_pct?: number
        }
        Update: {
          default_hourly_rate?: number | null
          organisation_id?: string
          short_notice_hours?: number
          short_notice_pct?: number
          site_id?: string
          updated_at?: string
          very_short_notice_hours?: number
          very_short_notice_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_compensation_settings_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_compensation_settings_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
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
          site_code: string
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
          site_code?: string
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
          site_code?: string
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
      staff_availability: {
        Row: {
          created_at: string
          day_of_week: number
          effective_from: string | null
          effective_to: string | null
          end_time: string
          id: string
          is_available: boolean
          notes: string | null
          organisation_id: string
          site_id: string
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          effective_from?: string | null
          effective_to?: string | null
          end_time: string
          id?: string
          is_available?: boolean
          notes?: string | null
          organisation_id: string
          site_id: string
          start_time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          effective_from?: string | null
          effective_to?: string | null
          end_time?: string
          id?: string
          is_available?: boolean
          notes?: string | null
          organisation_id?: string
          site_id?: string
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_availability_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_availability_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_availability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          base_active: boolean
          billing_interval: string | null
          bundle_active: boolean
          business_active: boolean
          cancel_at_period_end: boolean | null
          comped_by: string | null
          comped_reason: string | null
          comped_until: string | null
          compliance_active: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          hq_quantity: number
          id: string
          is_comped: boolean
          locked_at: string | null
          organisation_id: string
          site_quantity: number
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"] | null
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          base_active?: boolean
          billing_interval?: string | null
          bundle_active?: boolean
          business_active?: boolean
          cancel_at_period_end?: boolean | null
          comped_by?: string | null
          comped_reason?: string | null
          comped_until?: string | null
          compliance_active?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          hq_quantity?: number
          id?: string
          is_comped?: boolean
          locked_at?: string | null
          organisation_id: string
          site_quantity?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"] | null
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          base_active?: boolean
          billing_interval?: string | null
          bundle_active?: boolean
          business_active?: boolean
          cancel_at_period_end?: boolean | null
          comped_by?: string | null
          comped_reason?: string | null
          comped_until?: string | null
          compliance_active?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          hq_quantity?: number
          id?: string
          is_comped?: boolean
          locked_at?: string | null
          organisation_id?: string
          site_quantity?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"] | null
          trial_end?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          email: string
          granted_at: string
          granted_by: string | null
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          email: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          email?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          active: boolean
          approved: boolean
          category: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          organisation_id: string
          site_id: string
        }
        Insert: {
          active?: boolean
          approved?: boolean
          category?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          organisation_id: string
          site_id: string
        }
        Update: {
          active?: boolean
          approved?: boolean
          category?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          organisation_id?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_logs: {
        Row: {
          corrective_action: string | null
          created_at: string
          food_item: string | null
          id: string
          log_type: string
          logged_at: string
          logged_by_name: string
          logged_by_user_id: string | null
          organisation_id: string
          pass: boolean
          site_id: string
          unit_id: string | null
          value: number
        }
        Insert: {
          corrective_action?: string | null
          created_at?: string
          food_item?: string | null
          id?: string
          log_type?: string
          logged_at?: string
          logged_by_name?: string
          logged_by_user_id?: string | null
          organisation_id: string
          pass: boolean
          site_id: string
          unit_id?: string | null
          value: number
        }
        Update: {
          corrective_action?: string | null
          created_at?: string
          food_item?: string | null
          id?: string
          log_type?: string
          logged_at?: string
          logged_by_name?: string
          logged_by_user_id?: string | null
          organisation_id?: string
          pass?: boolean
          site_id?: string
          unit_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "temp_logs_logged_by_user_id_fkey"
            columns: ["logged_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_logs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "temp_units"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_units: {
        Row: {
          active: boolean
          created_at: string
          id: string
          max_temp: number
          min_temp: number
          name: string
          organisation_id: string
          site_id: string
          sort_order: number
          type: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          max_temp?: number
          min_temp?: number
          name: string
          organisation_id: string
          site_id: string
          sort_order?: number
          type?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          max_temp?: number
          min_temp?: number
          name?: string
          organisation_id?: string
          site_id?: string
          sort_order?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "temp_units_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_units_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          break_minutes: number
          clock_in: string
          clock_out: string | null
          created_at: string
          id: string
          notes: string | null
          organisation_id: string
          shift_id: string | null
          site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number
          clock_in: string
          clock_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organisation_id: string
          shift_id?: string | null
          site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organisation_id?: string
          shift_id?: string | null
          site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_entries_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_export_logs: {
        Row: {
          created_at: string
          date_from: string
          date_to: string
          export_type: string
          exported_by: string
          id: string
          organisation_id: string
          record_count: number
          site_id: string
        }
        Insert: {
          created_at?: string
          date_from: string
          date_to: string
          export_type?: string
          exported_by: string
          id?: string
          organisation_id: string
          record_count?: number
          site_id: string
        }
        Update: {
          created_at?: string
          date_from?: string
          date_to?: string
          export_type?: string
          exported_by?: string
          id?: string
          organisation_id?: string
          record_count?: number
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_export_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      tip_allocations: {
        Row: {
          created_at: string
          hours_worked: number | null
          id: string
          tip_amount: number
          tip_pool_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hours_worked?: number | null
          id?: string
          tip_amount?: number
          tip_pool_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          hours_worked?: number | null
          id?: string
          tip_amount?: number
          tip_pool_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tip_allocations_tip_pool_id_fkey"
            columns: ["tip_pool_id"]
            isOneToOne: false
            referencedRelation: "tip_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      tip_pools: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          distribution_method: string
          id: string
          notes: string | null
          organisation_id: string
          site_id: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          distribution_method?: string
          id?: string
          notes?: string | null
          organisation_id: string
          site_id: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          distribution_method?: string
          id?: string
          notes?: string | null
          organisation_id?: string
          site_id?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tip_pools_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      training_records: {
        Row: {
          certificate_url: string | null
          completed_date: string
          created_at: string
          created_by: string | null
          expiry_date: string | null
          id: string
          notes: string | null
          organisation_id: string
          site_id: string
          training_name: string
          training_type: string
          user_id: string
        }
        Insert: {
          certificate_url?: string | null
          completed_date: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          organisation_id: string
          site_id: string
          training_name: string
          training_type: string
          user_id: string
        }
        Update: {
          certificate_url?: string | null
          completed_date?: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string
          site_id?: string
          training_name?: string
          training_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_records_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      training_requirements: {
        Row: {
          created_at: string
          id: string
          is_mandatory: boolean
          renewal_period_months: number | null
          required_for_roles: string[]
          site_id: string
          training_name: string
          training_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_mandatory?: boolean
          renewal_period_months?: number | null
          required_for_roles?: string[]
          site_id: string
          training_name: string
          training_type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_mandatory?: boolean
          renewal_period_months?: number | null
          required_for_roles?: string[]
          site_id?: string
          training_name?: string
          training_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_requirements_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
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
          hourly_rate: number | null
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
          hourly_rate?: number | null
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
          hourly_rate?: number | null
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
      waste_logs: {
        Row: {
          category: string
          created_at: string
          estimated_cost: number | null
          id: string
          item_name: string
          logged_at: string
          logged_by: string | null
          logged_by_name: string
          notes: string | null
          organisation_id: string
          quantity: number
          shift_date: string
          site_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          estimated_cost?: number | null
          id?: string
          item_name: string
          logged_at?: string
          logged_by?: string | null
          logged_by_name?: string
          notes?: string | null
          organisation_id: string
          quantity?: number
          shift_date?: string
          site_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          estimated_cost?: number | null
          id?: string
          item_name?: string
          logged_at?: string
          logged_by?: string | null
          logged_by_name?: string
          notes?: string | null
          organisation_id?: string
          quantity?: number
          shift_date?: string
          site_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_logs_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_site_code: { Args: never; Returns: string }
      generate_staff_code: { Args: { _org_id: string }; Returns: string }
      get_app_user_id: { Args: never; Returns: string }
      get_user_org_id: { Args: never; Returns: string }
      get_user_weekly_hours: {
        Args: { _user_id: string; _week_start: string }
        Returns: number
      }
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
      has_channel_audit_access: {
        Args: { _channel_id: string }
        Returns: boolean
      }
      has_clopen_conflict: {
        Args: {
          _end_time: string
          _exclude_assignment_id?: string
          _shift_date: string
          _start_time: string
          _user_id: string
        }
        Returns: boolean
      }
      has_hq_access: { Args: { _org_id: string }; Returns: boolean }
      has_site_access: { Args: { _site_id: string }; Returns: boolean }
      has_site_membership: { Args: { _site_id: string }; Returns: boolean }
      has_site_write_access: { Args: { _site_id: string }; Returns: boolean }
      is_channel_participant: {
        Args: { _channel_id: string }
        Returns: boolean
      }
      is_org_manager_or_hq: { Args: { _org_id: string }; Returns: boolean }
      is_org_owner: { Args: { _org_id: string }; Returns: boolean }
      is_site_supervisor_or_owner: {
        Args: { _site_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      link_staff_session: {
        Args: { _site_id: string; _staff_code: string }
        Returns: Json
      }
      messenger_mark_read: { Args: { _channel_id: string }; Returns: undefined }
      org_has_active_access: { Args: { _org_id: string }; Returns: boolean }
      seed_messenger_channels_for_site: {
        Args: { _site_id: string }
        Returns: undefined
      }
      sync_org_modules: { Args: { _org_id: string }; Returns: undefined }
      validate_staff_code: {
        Args: { _site_id: string; _staff_code: string }
        Returns: Json
      }
    }
    Enums: {
      auth_type: "email" | "staff_code"
      batch_status: "in_progress" | "complete" | "quarantined" | "disposed"
      messenger_channel_type: "direct" | "group" | "system" | "role"
      messenger_message_type: "user" | "system" | "shift_card"
      messenger_participant_role: "admin" | "member"
      org_role: "org_owner" | "hq_admin" | "hq_auditor"
      shift_request_status:
        | "pending_teammate"
        | "pending_approval"
        | "approved"
        | "declined"
        | "cancelled"
        | "expired"
      shift_request_type: "swap" | "cover"
      site_role: "owner" | "supervisor" | "staff" | "read_only"
      subscription_tier: "starter" | "pro" | "multisite"
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
      batch_status: ["in_progress", "complete", "quarantined", "disposed"],
      messenger_channel_type: ["direct", "group", "system", "role"],
      messenger_message_type: ["user", "system", "shift_card"],
      messenger_participant_role: ["admin", "member"],
      org_role: ["org_owner", "hq_admin", "hq_auditor"],
      shift_request_status: [
        "pending_teammate",
        "pending_approval",
        "approved",
        "declined",
        "cancelled",
        "expired",
      ],
      shift_request_type: ["swap", "cover"],
      site_role: ["owner", "supervisor", "staff", "read_only"],
      subscription_tier: ["starter", "pro", "multisite"],
      user_status: ["active", "suspended"],
    },
  },
} as const
