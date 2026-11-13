
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "exchange_members": {
                  Row: {
                    "exchange_id": string,"id": string,"joined_at": string,"left_at": string | null,"state": Database["public"]['Enums']["exchange_member_state"],"taking_part": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "exchange_id": string,"id"?: string,"joined_at"?: string,"left_at"?: string | null,"state"?: Database["public"]['Enums']["exchange_member_state"],"taking_part": boolean,"user_id": string
                  }
                  Update: {
                    "exchange_id"?: string,"id"?: string,"joined_at"?: string,"left_at"?: string | null,"state"?: Database["public"]['Enums']["exchange_member_state"],"taking_part"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exchange_members_exchange_id_fkey"
      columns: ["exchange_id"]
isOneToOne: false
      referencedRelation: "exchanges"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exchange_members_exchange_id_fkey"
      columns: ["exchange_id"]
isOneToOne: false
      referencedRelation: "exchanges_visible"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exchange_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"exchanges": {
                  Row: {
                    "approval_required": boolean,"budget_preset": Database["public"]['Enums']["exchange_budget_preset"],"cancelled_at": string | null,"completed_at": string | null,"created_at": string,"draw_at": string | null,"draw_blocked_reason": string | null,"draw_mode": Database["public"]['Enums']["exchange_draw_mode"],"draw_round": number,"gift_day": string,"id": string,"invite_token": string,"join_by_at": string,"name": string,"note": string | null,"organiser_id": string,"organiser_tz": string,"reopened_join_by_at": string | null,"tint": Database["public"]['Enums']["exchange_tint"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_required"?: boolean,"budget_preset": Database["public"]['Enums']["exchange_budget_preset"],"cancelled_at"?: string | null,"completed_at"?: string | null,"created_at"?: string,"draw_at"?: string | null,"draw_blocked_reason"?: string | null,"draw_mode": Database["public"]['Enums']["exchange_draw_mode"],"draw_round"?: number,"gift_day": string,"id"?: string,"invite_token"?: string,"join_by_at": string,"name": string,"note"?: string | null,"organiser_id"?: string,"organiser_tz": string,"reopened_join_by_at"?: string | null,"tint": Database["public"]['Enums']["exchange_tint"],"updated_at"?: string
                  }
                  Update: {
                    "approval_required"?: boolean,"budget_preset"?: Database["public"]['Enums']["exchange_budget_preset"],"cancelled_at"?: string | null,"completed_at"?: string | null,"created_at"?: string,"draw_at"?: string | null,"draw_blocked_reason"?: string | null,"draw_mode"?: Database["public"]['Enums']["exchange_draw_mode"],"draw_round"?: number,"gift_day"?: string,"id"?: string,"invite_token"?: string,"join_by_at"?: string,"name"?: string,"note"?: string | null,"organiser_id"?: string,"organiser_tz"?: string,"reopened_join_by_at"?: string | null,"tint"?: Database["public"]['Enums']["exchange_tint"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exchanges_organiser_id_fkey"
      columns: ["organiser_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "anonymised_at": string | null,"avatar_path": string | null,"created_at": string,"display_name": string,"id": string,"onboarded_at": string | null,"photo_prompt_dismissed_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anonymised_at"?: string | null,"avatar_path"?: string | null,"created_at"?: string,"display_name": string,"id": string,"onboarded_at"?: string | null,"photo_prompt_dismissed_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "anonymised_at"?: string | null,"avatar_path"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"onboarded_at"?: string | null,"photo_prompt_dismissed_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_settings": {
                  Row: {
                    "created_at": string,"default_wishlist_visibility": Database["public"]['Enums']["wishlist_visibility"],"notify_event_reminder": boolean,"notify_join_by_reminder": boolean,"notify_names_drawn": boolean,"notify_someone_joins": boolean,"timezone": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"default_wishlist_visibility"?: Database["public"]['Enums']["wishlist_visibility"],"notify_event_reminder"?: boolean,"notify_join_by_reminder"?: boolean,"notify_names_drawn"?: boolean,"notify_someone_joins"?: boolean,"timezone"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"default_wishlist_visibility"?: Database["public"]['Enums']["wishlist_visibility"],"notify_event_reminder"?: boolean,"notify_join_by_reminder"?: boolean,"notify_names_drawn"?: boolean,"notify_someone_joins"?: boolean,"timezone"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"wishlist_items": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"id": string,"link": string | null,"name": string,"note": string | null,"photo_path": string | null,"price_kobo": number | null,"priority": Database["public"]['Enums']["wishlist_item_priority"],"updated_at": string,"wishlist_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"link"?: string | null,"name": string,"note"?: string | null,"photo_path"?: string | null,"price_kobo"?: number | null,"priority": Database["public"]['Enums']["wishlist_item_priority"],"updated_at"?: string,"wishlist_id": string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"link"?: string | null,"name"?: string,"note"?: string | null,"photo_path"?: string | null,"price_kobo"?: number | null,"priority"?: Database["public"]['Enums']["wishlist_item_priority"],"updated_at"?: string,"wishlist_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wishlist_items_wishlist_id_fkey"
      columns: ["wishlist_id"]
isOneToOne: false
      referencedRelation: "wishlists"
      referencedColumns: ["id"]
    }
                  ]
                },"wishlists": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"id": string,"kind": Database["public"]['Enums']["wishlist_kind"],"name": string,"owner_id": string,"share_token": string,"updated_at": string,"visibility": Database["public"]['Enums']["wishlist_visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["wishlist_kind"],"name": string,"owner_id"?: string,"share_token"?: string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["wishlist_visibility"]
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["wishlist_kind"],"name"?: string,"owner_id"?: string,"share_token"?: string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["wishlist_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "wishlists_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "exchanges_visible": {
                  Row: {
                    "approval_required": boolean,"budget_preset": Database["public"]['Enums']["exchange_budget_preset"],"cancelled_at": string | null,"completed_at": string | null,"created_at": string,"draw_at": string | null,"draw_blocked_reason": string | null,"draw_mode": Database["public"]['Enums']["exchange_draw_mode"],"draw_round": number,"gift_day": string,"id": string,"join_by_at": string,"name": string,"note": string | null,"organiser_id": string,"organiser_tz": string,"reopened_join_by_at": string | null,"tint": Database["public"]['Enums']["exchange_tint"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                           "approval_required"?: boolean | null,"budget_preset"?: Database["public"]['Enums']["exchange_budget_preset"] | null,"cancelled_at"?: string | null,"completed_at"?: string | null,"created_at"?: string | null,"draw_at"?: string | null,"draw_blocked_reason"?: string | null,"draw_mode"?: Database["public"]['Enums']["exchange_draw_mode"] | null,"draw_round"?: number | null,"gift_day"?: string | null,"id"?: string | null,"join_by_at"?: string | null,"name"?: string | null,"note"?: string | null,"organiser_id"?: string | null,"organiser_tz"?: string | null,"reopened_join_by_at"?: string | null,"tint"?: Database["public"]['Enums']["exchange_tint"] | null,"updated_at"?: string | null
                         }
                        Update: {
                           "approval_required"?: boolean | null,"budget_preset"?: Database["public"]['Enums']["exchange_budget_preset"] | null,"cancelled_at"?: string | null,"completed_at"?: string | null,"created_at"?: string | null,"draw_at"?: string | null,"draw_blocked_reason"?: string | null,"draw_mode"?: Database["public"]['Enums']["exchange_draw_mode"] | null,"draw_round"?: number | null,"gift_day"?: string | null,"id"?: string | null,"join_by_at"?: string | null,"name"?: string | null,"note"?: string | null,"organiser_id"?: string | null,"organiser_tz"?: string | null,"reopened_join_by_at"?: string | null,"tint"?: Database["public"]['Enums']["exchange_tint"] | null,"updated_at"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "exchanges_organiser_id_fkey"
      columns: ["organiser_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "create_exchange":
{ Args: { "p_approval_required": boolean,"p_budget": Database["public"]['Enums']["exchange_budget_preset"],"p_draw_mode": Database["public"]['Enums']["exchange_draw_mode"],"p_draw_time": string,"p_gift_day": string,"p_join_by_date": string,"p_name": string,"p_note": string,"p_taking_part": boolean,"p_time_zone": string }; Returns: string
                           },
"delete_wishlist":
{ Args: { "p_wishlist_id": string }; Returns: undefined
                           },
"exchange_state":
{ Args: { "p_exchange": string }; Returns: Database["public"]['Enums']["exchange_status"]
                           },
"get_exchange_invite_token":
{ Args: { "p_exchange": string }; Returns: string
                           },
"get_shared_wishlist":
{ Args: { "p_token": string }; Returns: Json
                           },
"has_deleted_wishlists":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_member":
{ Args: { "p_exchange": string }; Returns: boolean
                           },
"is_organiser":
{ Args: { "p_exchange": string }; Returns: boolean
                           },
"remove_wishlist_item":
{ Args: { "p_item_id": string }; Returns: undefined
                           },
"restore_wishlist":
{ Args: { "p_wishlist_id": string }; Returns: undefined
                           },
"restore_wishlist_item":
{ Args: { "p_item_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "exchange_budget_preset": "5k_10k"|"10k_20k"|"20k_50k"|"50k_plus","exchange_draw_mode": "at_join_by"|"organiser_chooses","exchange_member_state": "active"|"left"|"removed","exchange_status": "open"|"joining_closed"|"drawn"|"event_passed"|"complete"|"cancelled","exchange_tint": "clay"|"peach"|"sand"|"mint","wishlist_item_priority": "most_wanted"|"nice_to_have","wishlist_kind": "personal"|"exchange_ideas","wishlist_visibility": "private"|"link"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "exchange_budget_preset": ["5k_10k", "10k_20k", "20k_50k", "50k_plus"],"exchange_draw_mode": ["at_join_by", "organiser_chooses"],"exchange_member_state": ["active", "left", "removed"],"exchange_status": ["open", "joining_closed", "drawn", "event_passed", "complete", "cancelled"],"exchange_tint": ["clay", "peach", "sand", "mint"],"wishlist_item_priority": ["most_wanted", "nice_to_have"],"wishlist_kind": ["personal", "exchange_ideas"],"wishlist_visibility": ["private", "link"]
          }
        }
} as const
