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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [
          {
            foreignKeyName: 'users_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          }
        ];
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
        Relationships: [];
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
        Relationships: [
          {
            foreignKeyName: 'roles_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: 'role_permissions_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'role_permissions_permission_id_fkey';
            columns: ['permission_id'];
            isOneToOne: false;
            referencedRelation: 'permissions';
            referencedColumns: ['id'];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: 'user_roles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_roles_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: 'invitations_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invitations_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };

      // ============================================================
      // CLIENTS (Módulo 02)
      // ============================================================
      clients: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          legal_name: string | null;
          tax_id: string | null;
          tax_regime: string | null;
          cfdi_use: string | null;
          industry: string | null;
          website: string | null;
          address: Json | null;
          logo_url: string | null;
          brand_book_url: string | null;
          status: 'active' | 'paused' | 'churned';
          acquisition_source: string | null;
          notes: string | null;
          account_manager_id: string | null;
          current_package_id: string | null;
          package_started_at: string | null;
          package_ends_at: string | null;
          archived_at: string | null;
          archived_by: string | null;
          archive_reason: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          legal_name?: string | null;
          tax_id?: string | null;
          tax_regime?: string | null;
          cfdi_use?: string | null;
          industry?: string | null;
          website?: string | null;
          address?: Json | null;
          logo_url?: string | null;
          brand_book_url?: string | null;
          status?: 'active' | 'paused' | 'churned';
          acquisition_source?: string | null;
          notes?: string | null;
          account_manager_id?: string | null;
          current_package_id?: string | null;
          package_started_at?: string | null;
          package_ends_at?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
          archive_reason?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['clients']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'clients_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clients_account_manager_id_fkey';
            columns: ['account_manager_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clients_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clients_archived_by_fkey';
            columns: ['archived_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clients_current_package_id_fkey';
            columns: ['current_package_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          }
        ];
      };

      // ============================================================
      // CONTACTS (Módulo 02)
      // ============================================================
      contacts: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          position: string | null;
          is_primary: boolean;
          has_portal_access: boolean;
          portal_auth_user_id: string | null;
          telegram_user_id: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone?: string | null;
          position?: string | null;
          is_primary?: boolean;
          has_portal_access?: boolean;
          portal_auth_user_id?: string | null;
          telegram_user_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['contacts']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'contacts_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contacts_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contacts_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };

      // ============================================================
      // SERVICES (Módulo 03.A)
      // ============================================================
      services: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          sku: string | null;
          service_type: 'atomic' | 'package' | 'addon';
          default_price: number;
          currency: string;
          unit: string;
          color: string | null;
          is_active: boolean;
          archived_at: string | null;
          archived_by: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          sku?: string | null;
          service_type: 'atomic' | 'package' | 'addon';
          default_price?: number;
          currency?: string;
          unit?: string;
          color?: string | null;
          is_active?: boolean;
          archived_at?: string | null;
          archived_by?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['services']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'services_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'services_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'services_archived_by_fkey';
            columns: ['archived_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };

      // ============================================================
      // PACKAGE_COMPOSITION (Módulo 03.A)
      // ============================================================
      package_composition: {
        Row: {
          id: string;
          package_service_id: string;
          included_service_id: string;
          quantity: number;
          position: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          package_service_id: string;
          included_service_id: string;
          quantity?: number;
          position?: number;
          notes?: string | null;
        };
        Update: Partial<Database['public']['Tables']['package_composition']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'package_composition_package_service_id_fkey';
            columns: ['package_service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'package_composition_included_service_id_fkey';
            columns: ['included_service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          }
        ];
      };

      // ============================================================
      // TAXES (Módulo 03.A)
      // ============================================================
      taxes: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          code: string | null;
          description: string | null;
          percentage: number;
          is_enabled: boolean;
          apply_by_default: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          code?: string | null;
          description?: string | null;
          percentage: number;
          is_enabled?: boolean;
          apply_by_default?: boolean;
          position?: number;
        };
        Update: Partial<Database['public']['Tables']['taxes']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'taxes_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          }
        ];
      };

      // ============================================================
      // QUOTE_TEMPLATES (Módulo 03.B)
      // ============================================================
      quote_templates: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          folio_prefix: string;
          valid_days_default: number;
          currency_default: string;
          layers: Json;
          primary_color: string | null;
          is_default: boolean;
          is_active: boolean;
          archived_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          folio_prefix?: string;
          valid_days_default?: number;
          currency_default?: string;
          layers?: Json;
          primary_color?: string | null;
          is_default?: boolean;
          is_active?: boolean;
          archived_at?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['quote_templates']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'quote_templates_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quote_templates_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };

      // ============================================================
      // QUOTES (Módulo 03.B)
      // ============================================================
      quotes: {
        Row: {
          id: string;
          organization_id: string;
          folio: string;
          title: string | null;
          client_id: string;
          contact_id: string | null;
          template_id: string | null;
          status: 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected' | 'expired';
          issue_date: string;
          valid_until: string;
          layers: Json;
          message_to_client: string | null;
          notes_internal: string | null;
          currency: string;
          subtotal: number;
          discount_total: number;
          tax_total: number;
          total: number;
          sent_at: string | null;
          viewed_at: string | null;
          decided_at: string | null;
          rejection_reason: string | null;
          public_share_token: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          folio: string;
          title?: string | null;
          client_id: string;
          contact_id?: string | null;
          template_id?: string | null;
          status?: 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected' | 'expired';
          issue_date?: string;
          valid_until: string;
          layers?: Json;
          message_to_client?: string | null;
          notes_internal?: string | null;
          currency?: string;
          subtotal?: number;
          discount_total?: number;
          tax_total?: number;
          total?: number;
          sent_at?: string | null;
          viewed_at?: string | null;
          decided_at?: string | null;
          rejection_reason?: string | null;
          public_share_token?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['quotes']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'quotes_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quotes_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quotes_contact_id_fkey';
            columns: ['contact_id'];
            isOneToOne: false;
            referencedRelation: 'contacts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quotes_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'quote_templates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quotes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };

      // ============================================================
      // QUOTE_ITEMS (Módulo 03.B)
      // ============================================================
      quote_items: {
        Row: {
          id: string;
          quote_id: string;
          service_id: string | null;
          service_type: 'atomic' | 'package' | 'addon';
          name: string;
          description: string | null;
          unit: string;
          quantity: number;
          unit_price: number;
          subtotal: number;
          composition_snapshot: Json | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          quote_id: string;
          service_id?: string | null;
          service_type: 'atomic' | 'package' | 'addon';
          name: string;
          description?: string | null;
          unit?: string;
          quantity?: number;
          unit_price?: number;
          subtotal?: number;
          composition_snapshot?: Json | null;
          position?: number;
        };
        Update: Partial<Database['public']['Tables']['quote_items']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'quote_items_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quote_items_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          }
        ];
      };

      // ============================================================
      // QUOTE_ADJUSTMENTS (Módulo 03.B)
      // ============================================================
      quote_adjustments: {
        Row: {
          id: string;
          quote_id: string;
          adjustment_type: 'discount_percent' | 'discount_amount' | 'bonus';
          label: string;
          description: string | null;
          amount: number;
          calculated_amount: number;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          quote_id: string;
          adjustment_type: 'discount_percent' | 'discount_amount' | 'bonus';
          label: string;
          description?: string | null;
          amount?: number;
          calculated_amount?: number;
          position?: number;
        };
        Update: Partial<Database['public']['Tables']['quote_adjustments']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'quote_adjustments_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          }
        ];
      };

      // ============================================================
      // QUOTE_TAXES (Módulo 03.B)
      // ============================================================
      quote_taxes: {
        Row: {
          id: string;
          quote_id: string;
          tax_id: string | null;
          name: string;
          code: string | null;
          percentage: number;
          tax_amount: number;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          quote_id: string;
          tax_id?: string | null;
          name: string;
          code?: string | null;
          percentage: number;
          tax_amount?: number;
          position?: number;
        };
        Update: Partial<Database['public']['Tables']['quote_taxes']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'quote_taxes_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quote_taxes_tax_id_fkey';
            columns: ['tax_id'];
            isOneToOne: false;
            referencedRelation: 'taxes';
            referencedColumns: ['id'];
          }
        ];
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
      generate_quote_folio: {
        Args: { p_organization_id: string; p_prefix: string };
        Returns: string;
      };
      recalculate_quote_totals: {
        Args: { p_quote_id: string };
        Returns: void;
      };
      generate_share_token: {
        Args: Record<string, never>;
        Returns: string;
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
export type Client = Database['public']['Tables']['clients']['Row'];
export type Contact = Database['public']['Tables']['contacts']['Row'];
export type ClientStatus = Database['public']['Tables']['clients']['Row']['status'];
export type Service = Database['public']['Tables']['services']['Row'];
export type ServiceType = Database['public']['Tables']['services']['Row']['service_type'];
export type PackageComposition = Database['public']['Tables']['package_composition']['Row'];
export type Tax = Database['public']['Tables']['taxes']['Row'];
export type QuoteTemplate = Database['public']['Tables']['quote_templates']['Row'];
export type Quote = Database['public']['Tables']['quotes']['Row'];
export type QuoteStatus = Database['public']['Tables']['quotes']['Row']['status'];
export type QuoteItem = Database['public']['Tables']['quote_items']['Row'];
export type QuoteAdjustment = Database['public']['Tables']['quote_adjustments']['Row'];
export type QuoteAdjustmentType = Database['public']['Tables']['quote_adjustments']['Row']['adjustment_type'];
export type QuoteTax = Database['public']['Tables']['quote_taxes']['Row'];

// Tipos para las capas (campo jsonb 'layers')
export type QuoteLayerKind =
  | 'cover'
  | 'introduction'
  | 'scope'
  | 'deliverables'
  | 'investment'
  | 'terms'
  | 'closing';

export interface QuoteLayer {
  kind: QuoteLayerKind;
  order: number;
  enabled: boolean;
  title?: string;
  subtitle?: string;
  content_html?: string;
  auto_generated?: boolean;
}
