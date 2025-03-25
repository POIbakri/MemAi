export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          created_at: string
          updated_at: string
          background_logging: boolean
          notification_preferences: Json
          last_active_at: string | null
        }
        Insert: {
          id: string
          email: string
          created_at?: string
          updated_at?: string
          background_logging?: boolean
          notification_preferences?: Json
          last_active_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
          updated_at?: string
          background_logging?: boolean
          notification_preferences?: Json
          last_active_at?: string | null
        }
      }
      daily_logs: {
        Row: {
          id: string
          user_id: string
          date: string
          summary: string
          raw_data: Json
          sentiment_score: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          summary: string
          raw_data?: Json
          sentiment_score?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          summary?: string
          raw_data?: Json
          sentiment_score?: number
          created_at?: string
          updated_at?: string
        }
      }
      locations: {
        Row: {
          id: string
          user_id: string
          timestamp: string
          latitude: number
          longitude: number
          place_name: string
          accuracy: number | null
          altitude: number | null
          speed: number | null
          heading: number | null
          activity_type: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          timestamp: string
          latitude: number
          longitude: number
          place_name: string
          accuracy?: number | null
          altitude?: number | null
          speed?: number | null
          heading?: number | null
          activity_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          timestamp?: string
          latitude?: number
          longitude?: number
          place_name?: string
          accuracy?: number | null
          altitude?: number | null
          speed?: number | null
          heading?: number | null
          activity_type?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      photo_logs: {
        Row: {
          id: string
          user_id: string
          file_uri: string
          timestamp: string
          location_label: string | null
          metadata: Json
          tags: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          file_uri: string
          timestamp: string
          location_label?: string | null
          metadata?: Json
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          file_uri?: string
          timestamp?: string
          location_label?: string | null
          metadata?: Json
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
      }
      calendar_events: {
        Row: {
          id: string
          user_id: string
          calendar_id: string | null
          event_id: string | null
          title: string
          description: string | null
          location: string | null
          start_time: string
          end_time: string
          all_day: boolean
          recurring: boolean
          recurrence_rule: string | null
          attendees: Json
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          calendar_id?: string | null
          event_id?: string | null
          title: string
          description?: string | null
          location?: string | null
          start_time: string
          end_time: string
          all_day?: boolean
          recurring?: boolean
          recurrence_rule?: string | null
          attendees?: Json
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          calendar_id?: string | null
          event_id?: string | null
          title?: string
          description?: string | null
          location?: string | null
          start_time?: string
          end_time?: string
          all_day?: boolean
          recurring?: boolean
          recurrence_rule?: string | null
          attendees?: Json
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}