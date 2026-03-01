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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      api_configurations: {
        Row: {
          api_key_encrypted: string | null
          api_name: string
          api_type: Database["public"]["Enums"]["api_type"]
          base_url: string
          created_at: string
          created_by: string | null
          id: string
          is_enabled: boolean
          last_checked_at: string | null
          rate_limit_per_minute: number
          status: Database["public"]["Enums"]["api_status"]
          updated_at: string
        }
        Insert: {
          api_key_encrypted?: string | null
          api_name: string
          api_type: Database["public"]["Enums"]["api_type"]
          base_url: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean
          last_checked_at?: string | null
          rate_limit_per_minute?: number
          status?: Database["public"]["Enums"]["api_status"]
          updated_at?: string
        }
        Update: {
          api_key_encrypted?: string | null
          api_name?: string
          api_type?: Database["public"]["Enums"]["api_type"]
          base_url?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean
          last_checked_at?: string | null
          rate_limit_per_minute?: number
          status?: Database["public"]["Enums"]["api_status"]
          updated_at?: string
        }
        Relationships: []
      }
      api_health_metrics: {
        Row: {
          api_type: string
          created_at: string
          endpoint: string | null
          error_message: string | null
          id: string
          is_success: boolean | null
          response_time_ms: number | null
          status_code: number | null
        }
        Insert: {
          api_type: string
          created_at?: string
          endpoint?: string | null
          error_message?: string | null
          id?: string
          is_success?: boolean | null
          response_time_ms?: number | null
          status_code?: number | null
        }
        Update: {
          api_type?: string
          created_at?: string
          endpoint?: string | null
          error_message?: string | null
          id?: string
          is_success?: boolean | null
          response_time_ms?: number | null
          status_code?: number | null
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          event_type: string
          id: string
          metadata: Json | null
          stripe_event_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"] | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          stripe_event_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"] | null
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          stripe_event_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"] | null
          user_id?: string
        }
        Relationships: []
      }
      circuit_breaker_events: {
        Row: {
          cooldown_expires_at: string | null
          id: string
          reset_at: string | null
          reset_by: string | null
          reset_reason: string | null
          trigger_details: Json | null
          trigger_type: string
          triggered_at: string
          user_id: string
        }
        Insert: {
          cooldown_expires_at?: string | null
          id?: string
          reset_at?: string | null
          reset_by?: string | null
          reset_reason?: string | null
          trigger_details?: Json | null
          trigger_type: string
          triggered_at?: string
          user_id: string
        }
        Update: {
          cooldown_expires_at?: string | null
          id?: string
          reset_at?: string | null
          reset_by?: string | null
          reset_reason?: string | null
          trigger_details?: Json | null
          trigger_type?: string
          triggered_at?: string
          user_id?: string
        }
        Relationships: []
      }
      copy_trades: {
        Row: {
          action: string
          amount: number
          created_at: string
          id: string
          leader_address: string
          leader_name: string | null
          price: number
          status: string
          token_address: string
          token_symbol: string
          tx_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          amount: number
          created_at?: string
          id?: string
          leader_address: string
          leader_name?: string | null
          price: number
          status?: string
          token_address: string
          token_symbol: string
          tx_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          amount?: number
          created_at?: string
          id?: string
          leader_address?: string
          leader_name?: string | null
          price?: number
          status?: string
          token_address?: string
          token_symbol?: string
          tx_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      coupon_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number
          duration: Database["public"]["Enums"]["coupon_duration"]
          expires_at: string | null
          id: string
          is_active: boolean
          max_redemptions: number | null
          redemption_count: number
          tier_restriction:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          discount_type?: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number
          duration?: Database["public"]["Enums"]["coupon_duration"]
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          redemption_count?: number
          tier_restriction?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          discount_type?: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value?: number
          duration?: Database["public"]["Enums"]["coupon_duration"]
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          redemption_count?: number
          tier_restriction?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          updated_at?: string
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          discount_applied: number
          id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          discount_applied: number
          id?: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          discount_applied?: number
          id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupon_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packs: {
        Row: {
          badge: string | null
          bonus_credits: number
          created_at: string
          credits: number
          description: string | null
          features: Json | null
          id: string
          is_active: boolean
          name: string
          sol_price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          badge?: string | null
          bonus_credits?: number
          created_at?: string
          credits: number
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          name: string
          sol_price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          badge?: string | null
          bonus_credits?: number
          created_at?: string
          credits?: number
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          sol_price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount_sol: number
          confirmed_at: string | null
          created_at: string
          credits_added: number
          id: string
          memo: string | null
          pack_id: string | null
          sender_wallet: string | null
          status: Database["public"]["Enums"]["credit_tx_status"]
          tx_hash: string | null
          updated_at: string
          usd_value_at_payment: number | null
          user_id: string
        }
        Insert: {
          amount_sol: number
          confirmed_at?: string | null
          created_at?: string
          credits_added?: number
          id?: string
          memo?: string | null
          pack_id?: string | null
          sender_wallet?: string | null
          status?: Database["public"]["Enums"]["credit_tx_status"]
          tx_hash?: string | null
          updated_at?: string
          usd_value_at_payment?: number | null
          user_id: string
        }
        Update: {
          amount_sol?: number
          confirmed_at?: string | null
          created_at?: string
          credits_added?: number
          id?: string
          memo?: string | null
          pack_id?: string | null
          sender_wallet?: string | null
          status?: Database["public"]["Enums"]["credit_tx_status"]
          tx_hash?: string | null
          updated_at?: string
          usd_value_at_payment?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "credit_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_usage_log: {
        Row: {
          action_type: string
          created_at: string
          credits_used: number
          id: string
          reference_id: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          credits_used: number
          id?: string
          reference_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          credits_used?: number
          id?: string
          reference_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      deployer_reputation: {
        Row: {
          avg_liquidity_survival_seconds: number | null
          avg_lp_lifespan_seconds: number | null
          cluster_association_score: number | null
          cluster_id: string | null
          created_at: string
          fast_lp_pull_flag: boolean | null
          id: string
          last_token_deployed_at: string | null
          last_updated: string | null
          rapid_deploy_flag: boolean | null
          reputation_score: number | null
          rug_ratio: number | null
          tokens_last_7d: number | null
          total_rugs: number | null
          total_tokens_created: number | null
          updated_at: string
          wallet_address: string
        }
        Insert: {
          avg_liquidity_survival_seconds?: number | null
          avg_lp_lifespan_seconds?: number | null
          cluster_association_score?: number | null
          cluster_id?: string | null
          created_at?: string
          fast_lp_pull_flag?: boolean | null
          id?: string
          last_token_deployed_at?: string | null
          last_updated?: string | null
          rapid_deploy_flag?: boolean | null
          reputation_score?: number | null
          rug_ratio?: number | null
          tokens_last_7d?: number | null
          total_rugs?: number | null
          total_tokens_created?: number | null
          updated_at?: string
          wallet_address: string
        }
        Update: {
          avg_liquidity_survival_seconds?: number | null
          avg_lp_lifespan_seconds?: number | null
          cluster_association_score?: number | null
          cluster_id?: string | null
          created_at?: string
          fast_lp_pull_flag?: boolean | null
          id?: string
          last_token_deployed_at?: string | null
          last_updated?: string | null
          rapid_deploy_flag?: boolean | null
          reputation_score?: number | null
          rug_ratio?: number | null
          tokens_last_7d?: number | null
          total_rugs?: number | null
          total_tokens_created?: number | null
          updated_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
      disclaimer_acknowledgments: {
        Row: {
          acknowledged_at: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      portfolio_snapshots: {
        Row: {
          closed_trades_count: number | null
          created_at: string
          id: string
          open_positions_count: number
          realized_pnl_sol: number
          snapshot_date: string
          sol_price_usd: number | null
          total_invested_sol: number
          total_pnl_sol: number
          total_value_sol: number
          unrealized_pnl_sol: number
          updated_at: string
          user_id: string
          win_rate: number | null
        }
        Insert: {
          closed_trades_count?: number | null
          created_at?: string
          id?: string
          open_positions_count?: number
          realized_pnl_sol?: number
          snapshot_date?: string
          sol_price_usd?: number | null
          total_invested_sol?: number
          total_pnl_sol?: number
          total_value_sol?: number
          unrealized_pnl_sol?: number
          updated_at?: string
          user_id: string
          win_rate?: number | null
        }
        Update: {
          closed_trades_count?: number | null
          created_at?: string
          id?: string
          open_positions_count?: number
          realized_pnl_sol?: number
          snapshot_date?: string
          sol_price_usd?: number | null
          total_invested_sol?: number
          total_pnl_sol?: number
          total_value_sol?: number
          unrealized_pnl_sol?: number
          updated_at?: string
          user_id?: string
          win_rate?: number | null
        }
        Relationships: []
      }
      positions: {
        Row: {
          amount: number
          chain: string
          closed_at: string | null
          created_at: string
          current_price: number
          current_value: number
          entry_price: number
          entry_price_usd: number | null
          entry_value: number
          exit_price: number | null
          exit_reason: string | null
          exit_tx_id: string | null
          id: string
          liquidity_check_count: number | null
          liquidity_last_checked_at: string | null
          profit_loss_percent: number | null
          profit_loss_value: number | null
          profit_take_percent: number
          status: Database["public"]["Enums"]["position_status"]
          stop_loss_percent: number
          token_address: string
          token_name: string
          token_symbol: string
          updated_at: string
          user_id: string
          waiting_for_liquidity_since: string | null
        }
        Insert: {
          amount: number
          chain?: string
          closed_at?: string | null
          created_at?: string
          current_price: number
          current_value: number
          entry_price: number
          entry_price_usd?: number | null
          entry_value: number
          exit_price?: number | null
          exit_reason?: string | null
          exit_tx_id?: string | null
          id?: string
          liquidity_check_count?: number | null
          liquidity_last_checked_at?: string | null
          profit_loss_percent?: number | null
          profit_loss_value?: number | null
          profit_take_percent: number
          status?: Database["public"]["Enums"]["position_status"]
          stop_loss_percent: number
          token_address: string
          token_name: string
          token_symbol: string
          updated_at?: string
          user_id: string
          waiting_for_liquidity_since?: string | null
        }
        Update: {
          amount?: number
          chain?: string
          closed_at?: string | null
          created_at?: string
          current_price?: number
          current_value?: number
          entry_price?: number
          entry_price_usd?: number | null
          entry_value?: number
          exit_price?: number | null
          exit_reason?: string | null
          exit_tx_id?: string | null
          id?: string
          liquidity_check_count?: number | null
          liquidity_last_checked_at?: string | null
          profit_loss_percent?: number | null
          profit_loss_value?: number | null
          profit_take_percent?: number
          status?: Database["public"]["Enums"]["position_status"]
          stop_loss_percent?: number
          token_address?: string
          token_name?: string
          token_symbol?: string
          updated_at?: string
          user_id?: string
          waiting_for_liquidity_since?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_suspended: boolean | null
          referral_code: string | null
          referral_earnings: number | null
          suspension_reason: string | null
          total_referrals: number | null
          updated_at: string
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_suspended?: boolean | null
          referral_code?: string | null
          referral_earnings?: number | null
          suspension_reason?: string | null
          total_referrals?: number | null
          updated_at?: string
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_suspended?: boolean | null
          referral_code?: string | null
          referral_earnings?: number | null
          suspension_reason?: string | null
          total_referrals?: number | null
          updated_at?: string
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_credited: boolean
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          bonus_credited?: boolean
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          bonus_credited?: boolean
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      risk_check_logs: {
        Row: {
          buy_tax: number | null
          chain: string | null
          checked_at: string
          id: string
          is_blacklisted: boolean | null
          is_honeypot: boolean | null
          liquidity_locked: boolean | null
          lock_percentage: number | null
          owner_renounced: boolean | null
          passed_checks: boolean | null
          rejection_reasons: string[] | null
          risk_score: number | null
          sell_tax: number | null
          token_address: string
          token_symbol: string | null
          user_id: string
        }
        Insert: {
          buy_tax?: number | null
          chain?: string | null
          checked_at?: string
          id?: string
          is_blacklisted?: boolean | null
          is_honeypot?: boolean | null
          liquidity_locked?: boolean | null
          lock_percentage?: number | null
          owner_renounced?: boolean | null
          passed_checks?: boolean | null
          rejection_reasons?: string[] | null
          risk_score?: number | null
          sell_tax?: number | null
          token_address: string
          token_symbol?: string | null
          user_id: string
        }
        Update: {
          buy_tax?: number | null
          chain?: string | null
          checked_at?: string
          id?: string
          is_blacklisted?: boolean | null
          is_honeypot?: boolean | null
          liquidity_locked?: boolean | null
          lock_percentage?: number | null
          owner_renounced?: boolean | null
          passed_checks?: boolean | null
          rejection_reasons?: string[] | null
          risk_score?: number | null
          sell_tax?: number | null
          token_address?: string
          token_symbol?: string | null
          user_id?: string
        }
        Relationships: []
      }
      risk_settings: {
        Row: {
          circuit_breaker_cooldown_minutes: number | null
          circuit_breaker_enabled: boolean | null
          circuit_breaker_freeze_count: number | null
          circuit_breaker_loss_threshold: number | null
          circuit_breaker_requires_admin_override: boolean | null
          circuit_breaker_rug_count: number | null
          circuit_breaker_tax_count: number | null
          circuit_breaker_time_window_minutes: number | null
          circuit_breaker_trigger_reason: string | null
          circuit_breaker_triggered_at: string | null
          created_at: string
          emergency_stop_active: boolean | null
          id: string
          max_risk_score: number | null
          max_tax_percent: number | null
          min_liquidity_auto_usd: number | null
          min_liquidity_manual_usd: number | null
          require_liquidity_locked: boolean | null
          require_ownership_renounced: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          circuit_breaker_cooldown_minutes?: number | null
          circuit_breaker_enabled?: boolean | null
          circuit_breaker_freeze_count?: number | null
          circuit_breaker_loss_threshold?: number | null
          circuit_breaker_requires_admin_override?: boolean | null
          circuit_breaker_rug_count?: number | null
          circuit_breaker_tax_count?: number | null
          circuit_breaker_time_window_minutes?: number | null
          circuit_breaker_trigger_reason?: string | null
          circuit_breaker_triggered_at?: string | null
          created_at?: string
          emergency_stop_active?: boolean | null
          id?: string
          max_risk_score?: number | null
          max_tax_percent?: number | null
          min_liquidity_auto_usd?: number | null
          min_liquidity_manual_usd?: number | null
          require_liquidity_locked?: boolean | null
          require_ownership_renounced?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          circuit_breaker_cooldown_minutes?: number | null
          circuit_breaker_enabled?: boolean | null
          circuit_breaker_freeze_count?: number | null
          circuit_breaker_loss_threshold?: number | null
          circuit_breaker_requires_admin_override?: boolean | null
          circuit_breaker_rug_count?: number | null
          circuit_breaker_tax_count?: number | null
          circuit_breaker_time_window_minutes?: number | null
          circuit_breaker_trigger_reason?: string | null
          circuit_breaker_triggered_at?: string | null
          created_at?: string
          emergency_stop_active?: boolean | null
          id?: string
          max_risk_score?: number | null
          max_tax_percent?: number | null
          min_liquidity_auto_usd?: number | null
          min_liquidity_manual_usd?: number | null
          require_liquidity_locked?: boolean | null
          require_ownership_renounced?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_interval: string | null
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          grace_period_end: string | null
          id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_interval?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_period_end?: string | null
          id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_interval?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_period_end?: string | null
          id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          trial_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          priority: string
          status: string
          subject: string
          ticket_number: string
          updated_at: string
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          id?: string
          priority?: string
          status?: string
          subject: string
          ticket_number: string
          updated_at?: string
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          status?: string
          subject?: string
          ticket_number?: string
          updated_at?: string
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          created_at: string
          event_category: string
          event_type: string
          id: string
          message: string | null
          metadata: Json | null
          severity: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_category: string
          event_type: string
          id?: string
          message?: string | null
          metadata?: Json | null
          severity?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_category?: string
          event_type?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          severity?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      token_processing_states: {
        Row: {
          created_at: string
          id: string
          pending_reason: string | null
          state: string
          token_address: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          pending_reason?: string | null
          state?: string
          token_address: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          pending_reason?: string | null
          state?: string
          token_address?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      trade_history: {
        Row: {
          amount: number
          buyer_position: number | null
          created_at: string
          entry_price: number | null
          id: string
          liquidity: number | null
          price_sol: number | null
          price_usd: number | null
          risk_score: number | null
          sol_spent: number | null
          status: string | null
          token_address: string
          token_name: string | null
          token_symbol: string | null
          trade_type: string
          tx_hash: string | null
          user_id: string
        }
        Insert: {
          amount: number
          buyer_position?: number | null
          created_at?: string
          entry_price?: number | null
          id?: string
          liquidity?: number | null
          price_sol?: number | null
          price_usd?: number | null
          risk_score?: number | null
          sol_spent?: number | null
          status?: string | null
          token_address: string
          token_name?: string | null
          token_symbol?: string | null
          trade_type: string
          tx_hash?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          buyer_position?: number | null
          created_at?: string
          entry_price?: number | null
          id?: string
          liquidity?: number | null
          price_sol?: number | null
          price_usd?: number | null
          risk_score?: number | null
          sol_spent?: number | null
          status?: string | null
          token_address?: string
          token_name?: string | null
          token_symbol?: string | null
          trade_type?: string
          tx_hash?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trade_signals: {
        Row: {
          chain: string
          created_at: string
          executed_at: string | null
          expires_at: string
          id: string
          is_pump_fun: boolean
          liquidity: number
          metadata: Json
          price_usd: number | null
          priority: string
          reasons: string[]
          risk_score: number
          slippage: number
          source: string | null
          status: string
          token_address: string
          token_name: string
          token_symbol: string
          trade_amount: number
          tx_signature: string | null
          user_id: string
        }
        Insert: {
          chain?: string
          created_at?: string
          executed_at?: string | null
          expires_at?: string
          id?: string
          is_pump_fun?: boolean
          liquidity?: number
          metadata?: Json
          price_usd?: number | null
          priority?: string
          reasons?: string[]
          risk_score?: number
          slippage?: number
          source?: string | null
          status?: string
          token_address: string
          token_name?: string
          token_symbol?: string
          trade_amount?: number
          tx_signature?: string | null
          user_id: string
        }
        Update: {
          chain?: string
          created_at?: string
          executed_at?: string | null
          expires_at?: string
          id?: string
          is_pump_fun?: boolean
          liquidity?: number
          metadata?: Json
          price_usd?: number | null
          priority?: string
          reasons?: string[]
          risk_score?: number
          slippage?: number
          source?: string | null
          status?: string
          token_address?: string
          token_name?: string
          token_symbol?: string
          trade_amount?: number
          tx_signature?: string | null
          user_id?: string
        }
        Relationships: []
      }
      usage_logs: {
        Row: {
          api_intensive_count: number
          auto_executions_count: number
          clustering_calls_count: number
          created_at: string
          id: string
          rpc_simulations_count: number
          updated_at: string
          usage_date: string
          user_id: string
          validations_count: number
        }
        Insert: {
          api_intensive_count?: number
          auto_executions_count?: number
          clustering_calls_count?: number
          created_at?: string
          id?: string
          rpc_simulations_count?: number
          updated_at?: string
          usage_date?: string
          user_id: string
          validations_count?: number
        }
        Update: {
          api_intensive_count?: number
          auto_executions_count?: number
          clustering_calls_count?: number
          created_at?: string
          id?: string
          rpc_simulations_count?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
          validations_count?: number
        }
        Relationships: []
      }
      user_activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          created_at: string
          credit_balance: number
          id: string
          total_credits_purchased: number
          total_credits_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_balance?: number
          id?: string
          total_credits_purchased?: number
          total_credits_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credit_balance?: number
          id?: string
          total_credits_purchased?: number
          total_credits_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sniper_settings: {
        Row: {
          category_filters: string[]
          created_at: string
          id: string
          max_concurrent_trades: number
          min_liquidity: number
          priority: Database["public"]["Enums"]["sniping_priority"]
          profit_take_percentage: number
          slippage_tolerance: number | null
          stop_loss_percentage: number
          target_buyer_positions: number[] | null
          token_blacklist: string[]
          token_whitelist: string[]
          trade_amount: number
          updated_at: string
          user_id: string
          validation_rule_toggles: Json | null
        }
        Insert: {
          category_filters?: string[]
          created_at?: string
          id?: string
          max_concurrent_trades?: number
          min_liquidity?: number
          priority?: Database["public"]["Enums"]["sniping_priority"]
          profit_take_percentage?: number
          slippage_tolerance?: number | null
          stop_loss_percentage?: number
          target_buyer_positions?: number[] | null
          token_blacklist?: string[]
          token_whitelist?: string[]
          trade_amount?: number
          updated_at?: string
          user_id: string
          validation_rule_toggles?: Json | null
        }
        Update: {
          category_filters?: string[]
          created_at?: string
          id?: string
          max_concurrent_trades?: number
          min_liquidity?: number
          priority?: Database["public"]["Enums"]["sniping_priority"]
          profit_take_percentage?: number
          slippage_tolerance?: number | null
          stop_loss_percentage?: number
          target_buyer_positions?: number[] | null
          token_blacklist?: string[]
          token_whitelist?: string[]
          trade_amount?: number
          updated_at?: string
          user_id?: string
          validation_rule_toggles?: Json | null
        }
        Relationships: []
      }
      volume_authenticity_cache: {
        Row: {
          authenticity_score: number | null
          bot_volume_ratio: number | null
          cached_at: string
          id: string
          token_address: string
          wash_trade_ratio: number | null
        }
        Insert: {
          authenticity_score?: number | null
          bot_volume_ratio?: number | null
          cached_at?: string
          id?: string
          token_address: string
          wash_trade_ratio?: number | null
        }
        Update: {
          authenticity_score?: number | null
          bot_volume_ratio?: number | null
          cached_at?: string
          id?: string
          token_address?: string
          wash_trade_ratio?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_credits: {
        Args: { _amount: number; _tx_id?: string; _user_id: string }
        Returns: Json
      }
      deduct_credits: {
        Args: {
          _action_type: string
          _amount: number
          _reference_id?: string
          _user_id: string
        }
        Returns: Json
      }
      get_credit_costs: { Args: never; Returns: Json }
      get_payment_wallet: { Args: never; Returns: string }
      get_subscription_with_usage: { Args: { _user_id: string }; Returns: Json }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_usage: {
        Args: { _amount?: number; _field: string; _user_id: string }
        Returns: number
      }
    }
    Enums: {
      api_status: "active" | "inactive" | "error" | "rate_limited"
      api_type:
        | "dexscreener"
        | "geckoterminal"
        | "birdeye"
        | "dextools"
        | "honeypot_rugcheck"
        | "liquidity_lock"
        | "trade_execution"
        | "rpc_provider"
        | "raydium"
        | "helius"
        | "pumpfun"
        | "jupiter"
      app_role: "admin" | "user"
      coupon_discount_type: "percent" | "flat"
      coupon_duration: "once" | "three_months" | "lifetime"
      credit_tx_status: "pending" | "confirmed" | "failed" | "expired"
      position_status:
        | "open"
        | "closed"
        | "pending"
        | "waiting_for_liquidity"
        | "frozen"
      sniping_priority: "normal" | "fast" | "turbo"
      subscription_status:
        | "active"
        | "trialing"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "expired"
      subscription_tier: "free" | "pro" | "elite"
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
      api_status: ["active", "inactive", "error", "rate_limited"],
      api_type: [
        "dexscreener",
        "geckoterminal",
        "birdeye",
        "dextools",
        "honeypot_rugcheck",
        "liquidity_lock",
        "trade_execution",
        "rpc_provider",
        "raydium",
        "helius",
        "pumpfun",
        "jupiter",
      ],
      app_role: ["admin", "user"],
      coupon_discount_type: ["percent", "flat"],
      coupon_duration: ["once", "three_months", "lifetime"],
      credit_tx_status: ["pending", "confirmed", "failed", "expired"],
      position_status: [
        "open",
        "closed",
        "pending",
        "waiting_for_liquidity",
        "frozen",
      ],
      sniping_priority: ["normal", "fast", "turbo"],
      subscription_status: [
        "active",
        "trialing",
        "past_due",
        "canceled",
        "unpaid",
        "expired",
      ],
      subscription_tier: ["free", "pro", "elite"],
    },
  },
} as const
