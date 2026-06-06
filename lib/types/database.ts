/**
 * Tipos TypeScript del schema de Supabase.
 *
 * Estos tipos reflejan el estado actual de la base de datos.
 * Cuando se agreguen módulos nuevos, ampliar este archivo.
 *
 * En producción, esto debería generarse automáticamente con:
 * npx supabase gen types typescript --project-id <id> > lib/types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // ============================================================
      // ORGANIZATIONS
      // ============================================================
      organizations: {
        Row: {
          id: string;
          name: string;
          legal_name: string | null;
          slug: string;
          tax_id: string | null;
          tax_regime: string | null;
          address: Json | null;
          country_code: string;
          timezone: string;
          currency: string;
          logo_url: string | null;
          logo_dark_url: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          email_settings: Json | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          legal_name?: string | null;
          slug: string;
          tax_id?: string | null;
          tax_regime?: string | null;
          address?: Json | null;
          country_code?: string;
          timezone?: string;
          currency?: string;
          logo_url?: string | null;
          logo_dark_url?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          email_settings?: Json | null;
          is_active?: boolean;
          created_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>;
      };

      // ============================================================
      // SUPER_ADMINS
      // ============================================================
      super_admins: {
        Row: {
          id: string;
          auth_user_id: string | null;
          email: string;
          name: string;
          is_active: boolean;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          email: string;
          name: string;
          is_active?: boolean;
          last_login_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['super_admins']['Insert']>;
      };

      // ============================================================
      // USERS
      // ============================================================
      users: {
        Row: {
          id: string;
          organization_id: string;
          auth_user_id: string | null;
          email: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          avatar_url: string | null;
          address: Json | null;
          birth_date: string | null;
          hire_date: string | null;
          position_title: string | null;
          is_active: boolean;
          invited_by: string | null;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          auth_user_id?: string | null;
          email: string;
          first_name: string;
          last_name: string;
          phone?: string | null;
          avatar_url?: string | null;
          address?: Json | null;
          birth_date?: string | null;
          hire_date?: string | null;
          position_title?: string | null;
          is_active?: boolean;
          invited_by?: string | null;
          last_login_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };

      // ============================================================
      // PERMISSIONS
      // ============================================================
      permissions: {
        Row: {
          id: string;
          code: string;
          category: string;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          category: string;
          description: string;
        };
        Update: Partial<Database['public']['Tables']['permissions']['Insert']>;
      };

      // ============================================================
      // ROLES
      // ============================================================
      roles: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          color: string | null;
          is_system: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          color?: string | null;
          is_system?: boolean;
          created_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['roles']['Insert']>;
      };

      // ============================================================
      // ROLE_PERMISSIONS
      // ============================================================
      role_permissions: {
        Row: {
          role_id: string;
          permission_id: string;
          created_at: string;
        };
        Insert: {
          role_id: string;
          permission_id: string;
        };
        Update: Partial<Database['public']['Tables']['role_permissions']['Insert']>;
      };

      // ============================================================
      // USER_ROLES
      // ============================================================
      user_roles: {
        Row: {
          user_id: string;
          role_id: string;
          assigned_by: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role_id: string;
          assigned_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['user_roles']['Insert']>;
      };

      // ============================================================
      // INVITATIONS
      // ============================================================
      invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          first_name: string;
          last_name: string;
          token: string;
          roles_to_assign: string[];
          expires_at: string;
          accepted_at: string | null;
          invited_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          first_name: string;
          last_name: string;
          token?: string;
          roles_to_assign?: string[];
          expires_at?: string;
          accepted_at?: string | null;
          invited_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['invitations']['Insert']>;
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_super_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      current_organization_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      current_user_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      current_user_has_permission: {
        Args: { permission_code: string };
        Returns: boolean;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

// Helpers
export type Organization = Database['public']['Tables']['organizations']['Row'];
export type SuperAdmin = Database['public']['Tables']['super_admins']['Row'];
export type User = Database['public']['Tables']['users']['Row'];
export type Permission = Database['public']['Tables']['permissions']['Row'];
export type Role = Database['public']['Tables']['roles']['Row'];
export type Invitation = Database['public']['Tables']['invitations']['Row'];
