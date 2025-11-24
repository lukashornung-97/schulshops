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
      schools: {
        Row: {
          id: string
          name: string
          short_code: string | null
          city: string | null
          country: string | null
          contact_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          short_code?: string | null
          city?: string | null
          country?: string | null
          contact_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          short_code?: string | null
          city?: string | null
          country?: string | null
          contact_id?: string | null
          created_at?: string
        }
      }
      shops: {
        Row: {
          id: string
          school_id: string
          name: string
          slug: string
          status: 'draft' | 'live' | 'closed'
          currency: string
          shop_open_at: string | null
          shop_close_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          school_id: string
          name: string
          slug: string
          status?: 'draft' | 'live' | 'closed'
          currency?: string
          shop_open_at?: string | null
          shop_close_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          school_id?: string
          name?: string
          slug?: string
          status?: 'draft' | 'live' | 'closed'
          currency?: string
          shop_open_at?: string | null
          shop_close_at?: string | null
          created_at?: string
        }
      }
      products: {
        Row: {
          id: string
          shop_id: string
          name: string
          description: string | null
          base_price: number
          active: boolean
          sort_index: number | null
          created_at: string
        }
        Insert: {
          id?: string
          shop_id: string
          name: string
          description?: string | null
          base_price: number
          active?: boolean
          sort_index?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          shop_id?: string
          name?: string
          description?: string | null
          base_price?: number
          active?: boolean
          sort_index?: number | null
          created_at?: string
        }
      }
      product_variants: {
        Row: {
          id: string
          product_id: string
          name: string
          color_name: string | null
          color_hex: string | null
          additional_price: number | null
          sku: string | null
          active: boolean | null
        }
        Insert: {
          id?: string
          product_id: string
          name: string
          color_name?: string | null
          color_hex?: string | null
          additional_price?: number | null
          sku?: string | null
          active?: boolean | null
        }
        Update: {
          id?: string
          product_id?: string
          name?: string
          color_name?: string | null
          color_hex?: string | null
          additional_price?: number | null
          sku?: string | null
          active?: boolean | null
        }
      }
      orders: {
        Row: {
          id: string
          shop_id: string
          user_id: string | null
          customer_name: string
          customer_email: string | null
          class_name: string | null
          status: 'pending' | 'paid' | 'cancelled' | 'fulfilled'
          total_amount: number
          created_at: string
        }
        Insert: {
          id?: string
          shop_id: string
          user_id?: string | null
          customer_name: string
          customer_email?: string | null
          class_name?: string | null
          status?: 'pending' | 'paid' | 'cancelled' | 'fulfilled'
          total_amount?: number
          created_at?: string
        }
        Update: {
          id?: string
          shop_id?: string
          user_id?: string | null
          customer_name?: string
          customer_email?: string | null
          class_name?: string | null
          status?: 'pending' | 'paid' | 'cancelled' | 'fulfilled'
          total_amount?: number
          created_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          variant_id: string | null
          quantity: number
          unit_price: number
          line_total: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          variant_id?: string | null
          quantity: number
          unit_price: number
          line_total: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          variant_id?: string | null
          quantity?: number
          unit_price?: number
          line_total?: number
        }
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          school_id: string | null
          shop_id: string | null
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          school_id?: string | null
          shop_id?: string | null
          role: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          school_id?: string | null
          shop_id?: string | null
          role?: string
          created_at?: string
        }
      }
      school_contacts: {
        Row: {
          id: string
          school_id: string
          first_name: string
          last_name: string
          title: string | null
          role: string | null
          email: string | null
          phone: string | null
          mobile: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          school_id: string
          first_name: string
          last_name: string
          title?: string | null
          role?: string | null
          email?: string | null
          phone?: string | null
          mobile?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          school_id?: string
          first_name?: string
          last_name?: string
          title?: string | null
          role?: string | null
          email?: string | null
          phone?: string | null
          mobile?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

