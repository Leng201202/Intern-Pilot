export type ApplicationStatus =
  | 'interested'
  | 'applied'
  | 'assessment'
  | 'interview'
  | 'offer'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'

type ApplicationRow = {
  application_date: string
  application_deadline: string | null
  application_method: string | null
  archived_at: string | null
  closed_at: string | null
  company_name: string
  created_at: string
  id: string
  job_url: string | null
  location: string | null
  notes: string | null
  position_title: string
  status: ApplicationStatus
  updated_at: string
  user_id: string
}

type ApplicationInsert = {
  application_date: string
  application_deadline?: string | null
  application_method?: string | null
  company_name: string
  id?: string
  job_url?: string | null
  location?: string | null
  notes?: string | null
  position_title: string
  status?: ApplicationStatus
  user_id: string
}

type ApplicationUpdate = Partial<
  Pick<
    ApplicationRow,
    | 'application_date'
    | 'application_deadline'
    | 'application_method'
    | 'company_name'
    | 'job_url'
    | 'location'
    | 'notes'
    | 'position_title'
    | 'status'
  >
>

export type Database = {
  public: {
    Tables: {
      application_history: {
        Row: {
          actor_user_id: string | null
          application_id: string
          change_source: 'manual' | 'ai' | 'system'
          changed_at: string
          email_event_id: string | null
          id: string
          new_status: ApplicationStatus
          old_status: ApplicationStatus | null
          user_id: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      applications: {
        Row: ApplicationRow
        Insert: ApplicationInsert
        Update: ApplicationUpdate
        Relationships: []
      }
      follow_ups: {
        Row: {
          application_id: string
          completed_at: string | null
          created_at: string
          due_at: string
          id: string
          kind: 'suggested' | 'reminder' | 'long_pending' | 'action_deadline'
          snoozed_until: string | null
          state: 'open' | 'completed' | 'snoozed' | 'cancelled'
          source_activity_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: never
        Update: {
          due_at?: string
          kind?: 'suggested' | 'reminder' | 'long_pending' | 'action_deadline'
          snoozed_until?: string | null
          state?: 'open' | 'completed' | 'snoozed' | 'cancelled'
        }
        Relationships: []
      }
      notifications: {
        Row: {
          application_id: string | null
          created_at: string
          id: string
          is_read: boolean
          kind:
            | 'application_update'
            | 'action_required'
            | 'follow_up'
            | 'deadline'
            | 'sync_issue'
            | 'review_required'
          message: string | null
          resolved_at: string | null
          title: string
          user_id: string
        }
        Insert: never
        Update: { is_read?: boolean }
        Relationships: []
      }
      profiles: {
        Row: {
          ai_risk_acknowledged_at: string | null
          created_at: string
          display_name: string | null
          timezone: string
          university_deadline: string | null
          university_deadline_notified_for: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_risk_acknowledged_at?: string | null
          display_name?: string | null
          timezone?: string
          university_deadline?: string | null
          user_id: string
        }
        Update: {
          ai_risk_acknowledged_at?: string | null
          display_name?: string | null
          timezone?: string
          university_deadline?: string | null
        }
        Relationships: []
      }
      review_items: {
        Row: {
          application_id: string | null
          created_at: string
          email_event_id: string
          id: string
          reason_code:
            | 'privacy_blocked'
            | 'ambiguous_match'
            | 'unknown_outcome'
            | 'conflicting_status'
            | 'unmatched_application'
            | 'sanitization_uncertain'
            | 'invalid_ai_response'
            | 'stale_event'
            | 'ai_disabled'
            | 'provider_unavailable'
          resolved_at: string | null
          state: 'open' | 'resolved' | 'dismissed'
          suggested_deadline: string | null
          suggested_status: ApplicationStatus | null
          user_id: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      email_events: {
        Row: {
          application_id: string | null
          created_at: string
          email_category: string | null
          email_connection_id: string
          gmail_message_id: string
          gmail_thread_id: string | null
          id: string
          next_retry_at: string | null
          privacy_outcome:
            'not_evaluated' | 'allowed' | 'blocked' | 'not_required'
          processed_at: string | null
          processing_source: 'local_rule' | 'gemini' | 'manual' | null
          processing_status:
            'pending' | 'ignored' | 'processed' | 'review' | 'retry' | 'failed'
          received_at: string | null
          retry_count: number
          user_id: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      sync_runs: {
        Row: {
          candidate_count: number
          email_connection_id: string
          error_code: string | null
          fetched_count: number
          finished_at: string | null
          id: string
          processed_count: number
          review_count: number
          started_at: string
          status: 'running' | 'completed' | 'partial' | 'failed'
          trigger_source: 'manual' | 'scheduled'
          user_id: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Application = Database['public']['Tables']['applications']['Row']
export type ApplicationHistory =
  Database['public']['Tables']['application_history']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ReviewItem = Database['public']['Tables']['review_items']['Row']
