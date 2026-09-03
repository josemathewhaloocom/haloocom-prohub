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
      daily_updates: {
        Row: {
          blockers: string | null
          created_at: string
          engineer_id: string
          hours_worked: number
          id: string
          percentage_complete: number
          project_id: string
          summary: string
          update_date: string
        }
        Insert: {
          blockers?: string | null
          created_at?: string
          engineer_id: string
          hours_worked?: number
          id?: string
          percentage_complete?: number
          project_id: string
          summary: string
          update_date?: string
        }
        Update: {
          blockers?: string | null
          created_at?: string
          engineer_id?: string
          hours_worked?: number
          id?: string
          percentage_complete?: number
          project_id?: string
          summary?: string
          update_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_updates_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          created_at: string
          document_type: string | null
          file_name: string
          file_url: string
          id: string
          notes: string | null
          project_id: string
          signature_url: string | null
          signed_at: string | null
          signer_ip: string | null
          signer_name: string | null
          signing_token: string | null
          signing_token_expires_at: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          document_type?: string | null
          file_name: string
          file_url: string
          id?: string
          notes?: string | null
          project_id: string
          signature_url?: string | null
          signed_at?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          signing_token?: string | null
          signing_token_expires_at?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          document_type?: string | null
          file_name?: string
          file_url?: string
          id?: string
          notes?: string | null
          project_id?: string
          signature_url?: string | null
          signed_at?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          signing_token?: string | null
          signing_token_expires_at?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_items: {
        Row: {
          answer: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          question: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          answer: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          question: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          question?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          project_id: string
          status: Database["public"]["Enums"]["milestone_status"]
          target_date: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          status?: Database["public"]["Enums"]["milestone_status"]
          target_date?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          status?: Database["public"]["Enums"]["milestone_status"]
          target_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      poc_assignments: {
        Row: {
          assigned_at: string
          engineer_id: string
          id: string
          poc_id: string
        }
        Insert: {
          assigned_at?: string
          engineer_id: string
          id?: string
          poc_id: string
        }
        Update: {
          assigned_at?: string
          engineer_id?: string
          id?: string
          poc_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poc_assignments_poc_id_fkey"
            columns: ["poc_id"]
            isOneToOne: false
            referencedRelation: "pocs"
            referencedColumns: ["id"]
          },
        ]
      }
      poc_daily_updates: {
        Row: {
          blockers: string | null
          created_at: string
          engineer_id: string
          hours_worked: number
          id: string
          percentage_complete: number
          poc_id: string
          summary: string
          update_date: string
        }
        Insert: {
          blockers?: string | null
          created_at?: string
          engineer_id: string
          hours_worked?: number
          id?: string
          percentage_complete?: number
          poc_id: string
          summary: string
          update_date?: string
        }
        Update: {
          blockers?: string | null
          created_at?: string
          engineer_id?: string
          hours_worked?: number
          id?: string
          percentage_complete?: number
          poc_id?: string
          summary?: string
          update_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "poc_daily_updates_poc_id_fkey"
            columns: ["poc_id"]
            isOneToOne: false
            referencedRelation: "pocs"
            referencedColumns: ["id"]
          },
        ]
      }
      poc_stakeholders: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          poc_id: string
          role: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          poc_id: string
          role?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          poc_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poc_stakeholders_poc_id_fkey"
            columns: ["poc_id"]
            isOneToOne: false
            referencedRelation: "pocs"
            referencedColumns: ["id"]
          },
        ]
      }
      pocs: {
        Row: {
          actual_go_live_date: string | null
          ai_rep_id: string | null
          client_company: string | null
          client_email: string | null
          client_name: string
          client_poc_email: string | null
          client_poc_name: string | null
          converted_at: string | null
          converted_project_id: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json
          description: string | null
          evaluation_date: string | null
          id: string
          is_archived: boolean
          location: string | null
          name: string
          num_channels: number | null
          num_users: number | null
          outcome: string | null
          outcome_reason: string | null
          phase: string | null
          priority: string
          product_id: string | null
          product_version: string | null
          progress_percentage: number
          received_date: string | null
          sales_rep_id: string | null
          start_date: string | null
          status: string
          success_criteria: string | null
          tech_rep_id: string | null
          tech_stack: string | null
          trunk: string | null
          uat_date: string | null
          updated_at: string
        }
        Insert: {
          actual_go_live_date?: string | null
          ai_rep_id?: string | null
          client_company?: string | null
          client_email?: string | null
          client_name: string
          client_poc_email?: string | null
          client_poc_name?: string | null
          converted_at?: string | null
          converted_project_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          description?: string | null
          evaluation_date?: string | null
          id?: string
          is_archived?: boolean
          location?: string | null
          name: string
          num_channels?: number | null
          num_users?: number | null
          outcome?: string | null
          outcome_reason?: string | null
          phase?: string | null
          priority?: string
          product_id?: string | null
          product_version?: string | null
          progress_percentage?: number
          received_date?: string | null
          sales_rep_id?: string | null
          start_date?: string | null
          status?: string
          success_criteria?: string | null
          tech_rep_id?: string | null
          tech_stack?: string | null
          trunk?: string | null
          uat_date?: string | null
          updated_at?: string
        }
        Update: {
          actual_go_live_date?: string | null
          ai_rep_id?: string | null
          client_company?: string | null
          client_email?: string | null
          client_name?: string
          client_poc_email?: string | null
          client_poc_name?: string | null
          converted_at?: string | null
          converted_project_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          description?: string | null
          evaluation_date?: string | null
          id?: string
          is_archived?: boolean
          location?: string | null
          name?: string
          num_channels?: number | null
          num_users?: number | null
          outcome?: string | null
          outcome_reason?: string | null
          phase?: string | null
          priority?: string
          product_id?: string | null
          product_version?: string | null
          progress_percentage?: number
          received_date?: string | null
          sales_rep_id?: string | null
          start_date?: string | null
          status?: string
          success_criteria?: string | null
          tech_rep_id?: string | null
          tech_stack?: string | null
          trunk?: string | null
          uat_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_catalog: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          first_name?: string
          id: string
          last_name?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_assignments: {
        Row: {
          assigned_at: string
          engineer_id: string
          id: string
          project_id: string
        }
        Insert: {
          assigned_at?: string
          engineer_id: string
          id?: string
          project_id: string
        }
        Update: {
          assigned_at?: string
          engineer_id?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_dropdown_config: {
        Row: {
          created_at: string
          created_by: string | null
          field_name: string
          field_value: string
          id: string
          is_active: boolean
          parent_value: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          field_name: string
          field_value: string
          id?: string
          is_active?: boolean
          parent_value?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          field_name?: string
          field_value?: string
          id?: string
          is_active?: boolean
          parent_value?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      project_field_config: {
        Row: {
          created_at: string
          created_by: string | null
          dropdown_options: Json | null
          field_name: string
          field_type: string
          id: string
          is_required: boolean
          sort_order: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dropdown_options?: Json | null
          field_name: string
          field_type?: string
          id?: string
          is_required?: boolean
          sort_order?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dropdown_options?: Json | null
          field_name?: string
          field_type?: string
          id?: string
          is_required?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      project_stakeholders: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          project_id: string
          role: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          project_id: string
          role?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          project_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_stakeholders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_go_live_date: string | null
          admin_email: string | null
          ai_rep_id: string | null
          amc_end_date: string | null
          amc_start_date: string | null
          budget: number | null
          client_company: string | null
          client_email: string | null
          client_name: string
          client_poc_email: string | null
          client_poc_name: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json
          deadline: string | null
          description: string | null
          gw_sl_no: string | null
          id: string
          is_active: boolean
          location: string | null
          name: string
          num_channels: number | null
          num_users: number | null
          phase: string | null
          priority: Database["public"]["Enums"]["project_priority"]
          product_id: string | null
          product_version: string | null
          progress_percentage: number
          purchase_type: string | null
          received_date: string | null
          sales_rep_id: string | null
          server_serial_number: string | null
          sl_no_remarks: string | null
          sla_end_date: string | null
          sla_period: string | null
          sla_start_date: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          tech_rep_id: string | null
          tech_stack: string | null
          trunk: string | null
          uat_date: string | null
          updated_at: string
        }
        Insert: {
          actual_go_live_date?: string | null
          admin_email?: string | null
          ai_rep_id?: string | null
          amc_end_date?: string | null
          amc_start_date?: string | null
          budget?: number | null
          client_company?: string | null
          client_email?: string | null
          client_name: string
          client_poc_email?: string | null
          client_poc_name?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          deadline?: string | null
          description?: string | null
          gw_sl_no?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          num_channels?: number | null
          num_users?: number | null
          phase?: string | null
          priority?: Database["public"]["Enums"]["project_priority"]
          product_id?: string | null
          product_version?: string | null
          progress_percentage?: number
          purchase_type?: string | null
          received_date?: string | null
          sales_rep_id?: string | null
          server_serial_number?: string | null
          sl_no_remarks?: string | null
          sla_end_date?: string | null
          sla_period?: string | null
          sla_start_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          tech_rep_id?: string | null
          tech_stack?: string | null
          trunk?: string | null
          uat_date?: string | null
          updated_at?: string
        }
        Update: {
          actual_go_live_date?: string | null
          admin_email?: string | null
          ai_rep_id?: string | null
          amc_end_date?: string | null
          amc_start_date?: string | null
          budget?: number | null
          client_company?: string | null
          client_email?: string | null
          client_name?: string
          client_poc_email?: string | null
          client_poc_name?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          deadline?: string | null
          description?: string | null
          gw_sl_no?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          num_channels?: number | null
          num_users?: number | null
          phase?: string | null
          priority?: Database["public"]["Enums"]["project_priority"]
          product_id?: string | null
          product_version?: string | null
          progress_percentage?: number
          purchase_type?: string | null
          received_date?: string | null
          sales_rep_id?: string | null
          server_serial_number?: string | null
          sl_no_remarks?: string | null
          sla_end_date?: string | null
          sla_period?: string | null
          sla_start_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          tech_rep_id?: string | null
          tech_stack?: string | null
          trunk?: string | null
          uat_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      reporting_managers: {
        Row: {
          created_at: string
          id: string
          manager_id: string
          relationship_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id: string
          relationship_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string
          relationship_type?: string
          user_id?: string
        }
        Relationships: []
      }
      smtp_settings: {
        Row: {
          from_email: string | null
          from_name: string | null
          host: string | null
          id: string
          password: string | null
          port: number | null
          updated_at: string | null
          updated_by: string | null
          use_ssl: boolean | null
          use_tls: boolean | null
          username: string | null
        }
        Insert: {
          from_email?: string | null
          from_name?: string | null
          host?: string | null
          id?: string
          password?: string | null
          port?: number | null
          updated_at?: string | null
          updated_by?: string | null
          use_ssl?: boolean | null
          use_tls?: boolean | null
          username?: string | null
        }
        Update: {
          from_email?: string | null
          from_name?: string | null
          host?: string | null
          id?: string
          password?: string | null
          port?: number | null
          updated_at?: string | null
          updated_by?: string | null
          use_ssl?: boolean | null
          use_tls?: boolean | null
          username?: string | null
        }
        Relationships: []
      }
      standup_action_items: {
        Row: {
          assigned_to: string | null
          closed_date: string | null
          comments: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          id: string
          poc_id: string | null
          priority: string
          project_id: string | null
          source_standup_item_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          closed_date?: string | null
          comments?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          id?: string
          poc_id?: string | null
          priority?: string
          project_id?: string | null
          source_standup_item_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          closed_date?: string | null
          comments?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          poc_id?: string | null
          priority?: string
          project_id?: string | null
          source_standup_item_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      standup_items: {
        Row: {
          blockers: string | null
          created_at: string
          created_by: string | null
          eta_date: string | null
          id: string
          meeting_id: string
          next_steps: string | null
          poc_id: string | null
          progress: string | null
          project_id: string | null
          status_today: string | null
          updated_at: string
        }
        Insert: {
          blockers?: string | null
          created_at?: string
          created_by?: string | null
          eta_date?: string | null
          id?: string
          meeting_id: string
          next_steps?: string | null
          poc_id?: string | null
          progress?: string | null
          project_id?: string | null
          status_today?: string | null
          updated_at?: string
        }
        Update: {
          blockers?: string | null
          created_at?: string
          created_by?: string | null
          eta_date?: string | null
          id?: string
          meeting_id?: string
          next_steps?: string | null
          poc_id?: string | null
          progress?: string | null
          project_id?: string | null
          status_today?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      standup_meetings: {
        Row: {
          conducted_by: string | null
          created_at: string
          id: string
          meeting_date: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          conducted_by?: string | null
          created_at?: string
          id?: string
          meeting_date: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          conducted_by?: string | null
          created_at?: string
          id?: string
          meeting_date?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_ticket_config: {
        Row: {
          created_at: string
          created_by: string | null
          field_name: string
          field_value: string
          id: string
          is_active: boolean
          parent_value: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          field_name: string
          field_value: string
          id?: string
          is_active?: boolean
          parent_value?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          field_name?: string
          field_value?: string
          id?: string
          is_active?: boolean
          parent_value?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      support_ticket_logs: {
        Row: {
          changed_at: string
          changed_by: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          ticket_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          ticket_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_email: string | null
          assigned_engineer_id: string | null
          case_type: string
          category: string
          client_email: string | null
          client_name: string
          closed_at: string | null
          created_at: string
          created_by: string
          department: string
          description: string | null
          id: string
          issue_reported_via: string
          priority: string
          product_name: string | null
          project_id: string
          report_file_url: string | null
          resolution: string | null
          status: string
          sub_category: string | null
          subject: string
          team: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          admin_email?: string | null
          assigned_engineer_id?: string | null
          case_type: string
          category: string
          client_email?: string | null
          client_name: string
          closed_at?: string | null
          created_at?: string
          created_by: string
          department: string
          description?: string | null
          id?: string
          issue_reported_via: string
          priority?: string
          product_name?: string | null
          project_id: string
          report_file_url?: string | null
          resolution?: string | null
          status?: string
          sub_category?: string | null
          subject: string
          team?: string
          ticket_id?: string
          updated_at?: string
        }
        Update: {
          admin_email?: string | null
          assigned_engineer_id?: string | null
          case_type?: string
          category?: string
          client_email?: string | null
          client_name?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string
          department?: string
          description?: string | null
          id?: string
          issue_reported_via?: string
          priority?: string
          product_name?: string | null
          project_id?: string
          report_file_url?: string | null
          resolution?: string | null
          status?: string
          sub_category?: string | null
          subject?: string
          team?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_engineer_id_fkey"
            columns: ["assigned_engineer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_role: {
        Args: { _roles: string[]; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_assigned_to_poc: { Args: { _poc_id: string }; Returns: boolean }
      is_assigned_to_project: {
        Args: { _project_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role:
        | "project_manager"
        | "admin_manager"
        | "sales"
        | "sales_manager"
        | "accounts_manager"
        | "support_engineer"
        | "engineering"
        | "ceo"
        | "support_manager"
        | "engineering_manager"
      approval_status: "pending" | "approved" | "rejected"
      milestone_status: "pending" | "in_progress" | "completed"
      project_priority: "low" | "medium" | "high" | "critical"
      project_status:
        | "draft"
        | "sales_approved"
        | "accounts_approved"
        | "admin_reviewed"
        | "open"
        | "qc_completed"
        | "kick_off_scheduled"
        | "site_ready"
        | "on_hold"
        | "scheduled"
        | "in_progress"
        | "client_signing_pending"
        | "client_signed"
        | "pending_admin_approval"
        | "closed"
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
      app_role: [
        "project_manager",
        "admin_manager",
        "sales",
        "sales_manager",
        "accounts_manager",
        "support_engineer",
        "engineering",
        "ceo",
        "support_manager",
        "engineering_manager",
      ],
      approval_status: ["pending", "approved", "rejected"],
      milestone_status: ["pending", "in_progress", "completed"],
      project_priority: ["low", "medium", "high", "critical"],
      project_status: [
        "draft",
        "sales_approved",
        "accounts_approved",
        "admin_reviewed",
        "open",
        "qc_completed",
        "kick_off_scheduled",
        "site_ready",
        "on_hold",
        "scheduled",
        "in_progress",
        "client_signing_pending",
        "client_signed",
        "pending_admin_approval",
        "closed",
      ],
    },
  },
} as const
