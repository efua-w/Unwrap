
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "profiles": {
                  Row: {
                    "anonymised_at": string | null,"avatar_path": string | null,"created_at": string,"display_name": string,"id": string,"photo_prompt_dismissed_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anonymised_at"?: string | null,"avatar_path"?: string | null,"created_at"?: string,"display_name": string,"id": string,"photo_prompt_dismissed_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "anonymised_at"?: string | null,"avatar_path"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"photo_prompt_dismissed_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_settings": {
                  Row: {
                    "created_at": string,"default_wishlist_visibility": "private"|"link","notify_event_reminder": boolean,"notify_join_by_reminder": boolean,"notify_names_drawn": boolean,"notify_someone_joins": boolean,"timezone": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"default_wishlist_visibility"?: "private"|"link","notify_event_reminder"?: boolean,"notify_join_by_reminder"?: boolean,"notify_names_drawn"?: boolean,"notify_someone_joins"?: boolean,"timezone"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"default_wishlist_visibility"?: "private"|"link","notify_event_reminder"?: boolean,"notify_join_by_reminder"?: boolean,"notify_names_drawn"?: boolean,"notify_someone_joins"?: boolean,"timezone"?: string,"updated_at"?: string,"user_id"?: string
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
            [_ in never]: never
          }
          Functions: {
            "get_shared_wishlist":
{ Args: { "p_token": string }; Returns: Json
                           },
"delete_wishlist":
{ Args: { "p_wishlist_id": string }; Returns: undefined
                           },
"has_deleted_wishlists":
{ Args: Record<PropertyKey, never>; Returns: boolean
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
            "wishlist_item_priority": "most_wanted"|"nice_to_have","wishlist_kind": "personal"|"exchange_ideas","wishlist_visibility": "private"|"link"
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
            "wishlist_item_priority": ["most_wanted", "nice_to_have"],"wishlist_kind": ["personal", "exchange_ideas"],"wishlist_visibility": ["private", "link"]
          }
        }
} as const
