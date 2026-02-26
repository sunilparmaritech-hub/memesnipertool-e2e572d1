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
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      api_configurations: {
        Row: {
          api_key_encrypted: string | null
          api_name: string
          api_type: string
          base_url: string
          created_at: string
          created_by: string | null
          id: string
          is_enabled: boolean | null
          last_checked_at: string | null
          rate_limit_per_minute: number | null
          status: string | null
          updated_at: string
        }
        Insert: {
          api_key_encrypted?: string | null
          api_name: string
          api_type: string
          base_url: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean | null
          last_checked_at?: string | null
          rate_limit_per_minute?: number | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          api_key_encrypted?: string | null
          api_name?: string
          api_type?: string
          base_url?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean | null
          last_checked_at?: string | null
          rate_limit_per_minute?: number | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      api_health_metrics: {
        Row: {
          api_type: string
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          is_success: boolean | null
          response_time_ms: number | null
          status_code: number | null
        }
        Insert: {
          api_type: string
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          is_success?: boolean | null
          response_time_ms?: number | null
          status_code?: number | null
        }
        Update: {
          api_type?: string
          created_at?: string
          endpoint?: string
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
          amount_cents: number | null
          created_at: string
          currency: string | null
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          stripe_event_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          stripe_event_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          stripe_event_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      circuit_breaker_events: {
        Row: {
          cooldown_expires_at: string
          created_at: string
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
          cooldown_expires_at: string
          created_at?: string
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
          cooldown_expires_at?: string
          created_at?: string
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
          status: string | null
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
          status?: string | null
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
          status?: string | null
          token_address?: string
          token_symbol?: string
          tx_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      coupon_codes: {
        Row: {
          applicable_plans: string[] | null
          code: string
          created_at: string
          created_by: string | null
          current_redemptions: number | null
          discount_type: string
          discount_value: number
          duration_months: number | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_redemptions: number | null
        }
        Insert: {
          applicable_plans?: string[] | null
          code: string
          created_at?: string
          created_by?: string | null
          current_redemptions?: number | null
          discount_type: string
          discount_value: number
          duration_months?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_redemptions?: number | null
        }
        Update: {
          applicable_plans?: string[] | null
          code?: string
          created_at?: string
          created_by?: string | null
          current_redemptions?: number | null
          discount_type?: string
          discount_value?: number
          duration_months?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_redemptions?: number | null
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
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
          bonus_credits: number
          created_at: string
          credits_amount: number
          id: string
          is_active: boolean
          name: string
          sol_price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          bonus_credits?: number
          created_at?: string
          credits_amount: number
          id?: string
          is_active?: boolean
          name: string
          sol_price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bonus_credits?: number
          created_at?: string
          credits_amount?: number
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
          failure_reason: string | null
          id: string
          memo: string | null
          pack_id: string | null
          recipient_wallet: string
          sender_wallet: string
          slot: number | null
          status: string
          tx_hash: string
          user_id: string
        }
        Insert: {
          amount_sol: number
          confirmed_at?: string | null
          created_at?: string
          credits_added?: number
          failure_reason?: string | null
          id?: string
          memo?: string | null
          pack_id?: string | null
          recipient_wallet: string
          sender_wallet: string
          slot?: number | null
          status?: string
          tx_hash: string
          user_id: string
        }
        Update: {
          amount_sol?: number
          confirmed_at?: string | null
          created_at?: string
          credits_added?: number
          failure_reason?: string | null
          id?: string
          memo?: string | null
          pack_id?: string | null
          recipient_wallet?: string
          sender_wallet?: string
          slot?: number | null
          status?: string
          tx_hash?: string
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
          credits_used?: number
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
          last_token_deployed_at: string | null
          last_updated: string
          rapid_deploy_flag: boolean | null
          reputation_score: number
          rug_ratio: number | null
          tokens_last_7d: number | null
          total_rugs: number
          total_tokens_created: number
          wallet_address: string
        }
        Insert: {
          avg_liquidity_survival_seconds?: number | null
          avg_lp_lifespan_seconds?: number | null
          cluster_association_score?: number | null
          cluster_id?: string | null
          created_at?: string
          last_token_deployed_at?: string | null
          last_updated?: string
          rapid_deploy_flag?: boolean | null
          reputation_score?: number
          rug_ratio?: number | null
          tokens_last_7d?: number | null
          total_rugs?: number
          total_tokens_created?: number
          wallet_address: string
        }
        Update: {
          avg_liquidity_survival_seconds?: number | null
          avg_lp_lifespan_seconds?: number | null
          cluster_association_score?: number | null
          cluster_id?: string | null
          created_at?: string
          last_token_deployed_at?: string | null
          last_updated?: string
          rapid_deploy_flag?: boolean | null
          reputation_score?: number
          rug_ratio?: number | null
          tokens_last_7d?: number | null
          total_rugs?: number
          total_tokens_created?: number
          wallet_address?: string
        }
        Relationships: []
      }
      disclaimer_acknowledgments: {
        Row: {
          acknowledged_at: string
          id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string | null
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
          user_id?: string
          win_rate?: number | null
        }
        Relationships: []
      }
      positions: {
        Row: {
          amount: number
          chain: string | null
          closed_at: string | null
          created_at: string
          current_price: number | null
          current_value: number | null
          entry_price: number
          entry_price_usd: number | null
          entry_value: number | null
          exit_price: number | null
          exit_reason: string | null
          exit_tx_id: string | null
          id: string
          liquidity_check_count: number | null
          liquidity_last_checked_at: string | null
          pnl_percentage: number | null
          profit_loss_percent: number | null
          profit_loss_value: number | null
          profit_take_percent: number | null
          status: string | null
          stop_loss_percent: number | null
          token_address: string
          token_name: string | null
          token_symbol: string | null
          updated_at: string
          user_id: string
          waiting_for_liquidity_since: string | null
        }
        Insert: {
          amount: number
          chain?: string | null
          closed_at?: string | null
          created_at?: string
          current_price?: number | null
          current_value?: number | null
          entry_price: number
          entry_price_usd?: number | null
          entry_value?: number | null
          exit_price?: number | null
          exit_reason?: string | null
          exit_tx_id?: string | null
          id?: string
          liquidity_check_count?: number | null
          liquidity_last_checked_at?: string | null
          pnl_percentage?: number | null
          profit_loss_percent?: number | null
          profit_loss_value?: number | null
          profit_take_percent?: number | null
          status?: string | null
          stop_loss_percent?: number | null
          token_address: string
          token_name?: string | null
          token_symbol?: string | null
          updated_at?: string
          user_id: string
          waiting_for_liquidity_since?: string | null
        }
        Update: {
          amount?: number
          chain?: string | null
          closed_at?: string | null
          created_at?: string
          current_price?: number | null
          current_value?: number | null
          entry_price?: number
          entry_price_usd?: number | null
          entry_value?: number | null
          exit_price?: number | null
          exit_reason?: string | null
          exit_tx_id?: string | null
          id?: string
          liquidity_check_count?: number | null
          liquidity_last_checked_at?: string | null
          pnl_percentage?: number | null
          profit_loss_percent?: number | null
          profit_loss_value?: number | null
          profit_take_percent?: number | null
          status?: string | null
          stop_loss_percent?: number | null
          token_address?: string
          token_name?: string | null
          token_symbol?: string | null
          updated_at?: string
          user_id?: string
          waiting_for_liquidity_since?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          credit_balance: number
          device_fingerprint: string | null
          display_name: string | null
          email: string | null
          email_verified_at: string | null
          enhanced_verification_at: string | null
          id: string
          ip_country: string | null
          is_suspended: boolean | null
          last_screened_at: string | null
          referral_code: string | null
          referral_earnings: number
          referred_by: string | null
          suspended_at: string | null
          suspension_reason: string | null
          total_credits_purchased: number
          total_credits_used: number
          total_referrals: number
          two_factor_enabled: boolean | null
          updated_at: string
          user_id: string
          verification_tier: number
          wallet_risk_score: number | null
          wallet_screening_status: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          credit_balance?: number
          device_fingerprint?: string | null
          display_name?: string | null
          email?: string | null
          email_verified_at?: string | null
          enhanced_verification_at?: string | null
          id?: string
          ip_country?: string | null
          is_suspended?: boolean | null
          last_screened_at?: string | null
          referral_code?: string | null
          referral_earnings?: number
          referred_by?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          total_credits_purchased?: number
          total_credits_used?: number
          total_referrals?: number
          two_factor_enabled?: boolean | null
          updated_at?: string
          user_id: string
          verification_tier?: number
          wallet_risk_score?: number | null
          wallet_screening_status?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          credit_balance?: number
          device_fingerprint?: string | null
          display_name?: string | null
          email?: string | null
          email_verified_at?: string | null
          enhanced_verification_at?: string | null
          id?: string
          ip_country?: string | null
          is_suspended?: boolean | null
          last_screened_at?: string | null
          referral_code?: string | null
          referral_earnings?: number
          referred_by?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          total_credits_purchased?: number
          total_credits_used?: number
          total_referrals?: number
          two_factor_enabled?: boolean | null
          updated_at?: string
          user_id?: string
          verification_tier?: number
          wallet_risk_score?: number | null
          wallet_screening_status?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_credited: boolean
          created_at: string
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          bonus_credited?: boolean
          created_at?: string
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          bonus_credited?: boolean
          created_at?: string
          id?: string
          referral_code?: string
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
          metadata: Json | null
          owner_renounced: boolean | null
          passed_checks: boolean | null
          rejection_reasons: string[] | null
          risk_score: number | null
          sell_tax: number | null
          token_address: string
          token_symbol: string | null
          user_id: string | null
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
          metadata?: Json | null
          owner_renounced?: boolean | null
          passed_checks?: boolean | null
          rejection_reasons?: string[] | null
          risk_score?: number | null
          sell_tax?: number | null
          token_address: string
          token_symbol?: string | null
          user_id?: string | null
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
          metadata?: Json | null
          owner_renounced?: boolean | null
          passed_checks?: boolean | null
          rejection_reasons?: string[] | null
          risk_score?: number | null
          sell_tax?: number | null
          token_address?: string
          token_symbol?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      risk_settings: {
        Row: {
          circuit_breaker_cooldown_minutes: number | null
          circuit_breaker_drawdown_threshold: number | null
          circuit_breaker_drawdown_window_minutes: number | null
          circuit_breaker_enabled: boolean
          circuit_breaker_freeze_count: number | null
          circuit_breaker_loss_threshold: number
          circuit_breaker_requires_admin_override: boolean | null
          circuit_breaker_rug_count: number | null
          circuit_breaker_tax_count: number | null
          circuit_breaker_time_window_minutes: number
          circuit_breaker_trigger_reason: string | null
          circuit_breaker_triggered_at: string | null
          created_at: string
          emergency_stop_active: boolean
          id: string
          max_risk_score: number
          max_tax_percent: number
          min_liquidity_auto_usd: number | null
          min_liquidity_manual_usd: number | null
          require_liquidity_locked: boolean
          require_ownership_renounced: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          circuit_breaker_cooldown_minutes?: number | null
          circuit_breaker_drawdown_threshold?: number | null
          circuit_breaker_drawdown_window_minutes?: number | null
          circuit_breaker_enabled?: boolean
          circuit_breaker_freeze_count?: number | null
          circuit_breaker_loss_threshold?: number
          circuit_breaker_requires_admin_override?: boolean | null
          circuit_breaker_rug_count?: number | null
          circuit_breaker_tax_count?: number | null
          circuit_breaker_time_window_minutes?: number
          circuit_breaker_trigger_reason?: string | null
          circuit_breaker_triggered_at?: string | null
          created_at?: string
          emergency_stop_active?: boolean
          id?: string
          max_risk_score?: number
          max_tax_percent?: number
          min_liquidity_auto_usd?: number | null
          min_liquidity_manual_usd?: number | null
          require_liquidity_locked?: boolean
          require_ownership_renounced?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          circuit_breaker_cooldown_minutes?: number | null
          circuit_breaker_drawdown_threshold?: number | null
          circuit_breaker_drawdown_window_minutes?: number | null
          circuit_breaker_enabled?: boolean
          circuit_breaker_freeze_count?: number | null
          circuit_breaker_loss_threshold?: number
          circuit_breaker_requires_admin_override?: boolean | null
          circuit_breaker_rug_count?: number | null
          circuit_breaker_tax_count?: number | null
          circuit_breaker_time_window_minutes?: number
          circuit_breaker_trigger_reason?: string | null
          circuit_breaker_triggered_at?: string | null
          created_at?: string
          emergency_stop_active?: boolean
          id?: string
          max_risk_score?: number
          max_tax_percent?: number
          min_liquidity_auto_usd?: number | null
          min_liquidity_manual_usd?: number | null
          require_liquidity_locked?: boolean
          require_ownership_renounced?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sniper_settings: {
        Row: {
          auto_buy_enabled: boolean | null
          created_at: string
          gas_priority: string | null
          id: string
          max_buy_amount: number | null
          slippage_tolerance: number | null
          stop_loss_enabled: boolean | null
          stop_loss_percentage: number | null
          take_profit_enabled: boolean | null
          take_profit_percentage: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_buy_enabled?: boolean | null
          created_at?: string
          gas_priority?: string | null
          id?: string
          max_buy_amount?: number | null
          slippage_tolerance?: number | null
          stop_loss_enabled?: boolean | null
          stop_loss_percentage?: number | null
          take_profit_enabled?: boolean | null
          take_profit_percentage?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_buy_enabled?: boolean | null
          created_at?: string
          gas_priority?: string | null
          id?: string
          max_buy_amount?: number | null
          slippage_tolerance?: number | null
          stop_loss_enabled?: boolean | null
          stop_loss_percentage?: number | null
          take_profit_enabled?: boolean | null
          take_profit_percentage?: number | null
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
          id: string
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_interval?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_interval?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          category: string
          created_at: string
          description: string
          id: string
          priority: string | null
          replied_at: string | null
          replied_by: string | null
          status: string
          subject: string
          ticket_number: string
          updated_at: string
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          admin_reply?: string | null
          category: string
          created_at?: string
          description: string
          id?: string
          priority?: string | null
          replied_at?: string | null
          replied_by?: string | null
          status?: string
          subject: string
          ticket_number: string
          updated_at?: string
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          admin_reply?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string | null
          replied_at?: string | null
          replied_by?: string | null
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
          buyer_position_at_discovery: number | null
          created_at: string
          discovered_at: string
          id: string
          liquidity_at_discovery: number | null
          max_retries: number
          pending_reason: string | null
          pending_since: string | null
          position_id: string | null
          rejected_at: string | null
          rejection_reason: string | null
          retry_count: number
          retry_expires_at: string | null
          risk_score_at_discovery: number | null
          source: string | null
          state: string
          token_address: string
          token_name: string | null
          token_symbol: string | null
          trade_tx_hash: string | null
          traded_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          buyer_position_at_discovery?: number | null
          created_at?: string
          discovered_at?: string
          id?: string
          liquidity_at_discovery?: number | null
          max_retries?: number
          pending_reason?: string | null
          pending_since?: string | null
          position_id?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          retry_count?: number
          retry_expires_at?: string | null
          risk_score_at_discovery?: number | null
          source?: string | null
          state?: string
          token_address: string
          token_name?: string | null
          token_symbol?: string | null
          trade_tx_hash?: string | null
          traded_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          buyer_position_at_discovery?: number | null
          created_at?: string
          discovered_at?: string
          id?: string
          liquidity_at_discovery?: number | null
          max_retries?: number
          pending_reason?: string | null
          pending_since?: string | null
          position_id?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          retry_count?: number
          retry_expires_at?: string | null
          risk_score_at_discovery?: number | null
          source?: string | null
          state?: string
          token_address?: string
          token_name?: string | null
          token_symbol?: string | null
          trade_tx_hash?: string | null
          traded_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_history: {
        Row: {
          amount: number
          buyer_position: number | null
          corruption_reason: string | null
          created_at: string
          data_source: string | null
          entry_price: number | null
          exit_price: number | null
          id: string
          is_corrupted: boolean | null
          liquidity: number | null
          matched_buy_tx_hash: string | null
          price_sol: number | null
          price_usd: number | null
          realized_pnl_sol: number | null
          risk_score: number | null
          roi_percent: number | null
          slippage: number | null
          sol_balance_after: number | null
          sol_received: number | null
          sol_spent: number | null
          status: string | null
          token_address: string
          token_amount: number | null
          token_name: string | null
          token_symbol: string | null
          trade_type: string
          tx_hash: string | null
          user_id: string
        }
        Insert: {
          amount: number
          buyer_position?: number | null
          corruption_reason?: string | null
          created_at?: string
          data_source?: string | null
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          is_corrupted?: boolean | null
          liquidity?: number | null
          matched_buy_tx_hash?: string | null
          price_sol?: number | null
          price_usd?: number | null
          realized_pnl_sol?: number | null
          risk_score?: number | null
          roi_percent?: number | null
          slippage?: number | null
          sol_balance_after?: number | null
          sol_received?: number | null
          sol_spent?: number | null
          status?: string | null
          token_address: string
          token_amount?: number | null
          token_name?: string | null
          token_symbol?: string | null
          trade_type: string
          tx_hash?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          buyer_position?: number | null
          corruption_reason?: string | null
          created_at?: string
          data_source?: string | null
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          is_corrupted?: boolean | null
          liquidity?: number | null
          matched_buy_tx_hash?: string | null
          price_sol?: number | null
          price_usd?: number | null
          realized_pnl_sol?: number | null
          risk_score?: number | null
          roi_percent?: number | null
          slippage?: number | null
          sol_balance_after?: number | null
          sol_received?: number | null
          sol_spent?: number | null
          status?: string | null
          token_address?: string
          token_amount?: number | null
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
          chain: string | null
          created_at: string
          executed_at: string | null
          expires_at: string
          id: string
          is_pump_fun: boolean | null
          liquidity: number | null
          metadata: Json | null
          price_usd: number | null
          priority: string | null
          reasons: Json | null
          risk_score: number | null
          slippage: number | null
          source: string | null
          status: string | null
          token_address: string
          token_name: string
          token_symbol: string
          trade_amount: number
          tx_signature: string | null
          user_id: string
        }
        Insert: {
          chain?: string | null
          created_at?: string
          executed_at?: string | null
          expires_at: string
          id?: string
          is_pump_fun?: boolean | null
          liquidity?: number | null
          metadata?: Json | null
          price_usd?: number | null
          priority?: string | null
          reasons?: Json | null
          risk_score?: number | null
          slippage?: number | null
          source?: string | null
          status?: string | null
          token_address: string
          token_name: string
          token_symbol: string
          trade_amount: number
          tx_signature?: string | null
          user_id: string
        }
        Update: {
          chain?: string | null
          created_at?: string
          executed_at?: string | null
          expires_at?: string
          id?: string
          is_pump_fun?: boolean | null
          liquidity?: number | null
          metadata?: Json | null
          price_usd?: number | null
          priority?: string | null
          reasons?: Json | null
          risk_score?: number | null
          slippage?: number | null
          source?: string | null
          status?: string | null
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
          count: number
          created_at: string
          id: string
          updated_at: string
          usage_date: string
          usage_type: string
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          updated_at?: string
          usage_date?: string
          usage_type: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          updated_at?: string
          usage_date?: string
          usage_type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_activity_logs: {
        Row: {
          activity_category: string
          activity_type: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          activity_category: string
          activity_type: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          activity_category?: string
          activity_type?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sniper_settings: {
        Row: {
          category_filters: Json | null
          created_at: string
          id: string
          max_concurrent_trades: number | null
          max_risk_score: number | null
          min_liquidity: number | null
          priority: string | null
          profit_take_percentage: number | null
          slippage_tolerance: number | null
          stop_loss_percentage: number | null
          target_buyer_positions: Json | null
          token_blacklist: Json | null
          token_whitelist: Json | null
          trade_amount: number | null
          updated_at: string
          user_id: string
          validation_rule_toggles: Json
        }
        Insert: {
          category_filters?: Json | null
          created_at?: string
          id?: string
          max_concurrent_trades?: number | null
          max_risk_score?: number | null
          min_liquidity?: number | null
          priority?: string | null
          profit_take_percentage?: number | null
          slippage_tolerance?: number | null
          stop_loss_percentage?: number | null
          target_buyer_positions?: Json | null
          token_blacklist?: Json | null
          token_whitelist?: Json | null
          trade_amount?: number | null
          updated_at?: string
          user_id: string
          validation_rule_toggles?: Json
        }
        Update: {
          category_filters?: Json | null
          created_at?: string
          id?: string
          max_concurrent_trades?: number | null
          max_risk_score?: number | null
          min_liquidity?: number | null
          priority?: string | null
          profit_take_percentage?: number | null
          slippage_tolerance?: number | null
          stop_loss_percentage?: number | null
          target_buyer_positions?: Json | null
          token_blacklist?: Json | null
          token_whitelist?: Json | null
          trade_amount?: number | null
          updated_at?: string
          user_id?: string
          validation_rule_toggles?: Json
        }
        Relationships: []
      }
      volume_authenticity_cache: {
        Row: {
          analyzed_at: string
          circular_trade_count: number | null
          created_at: string
          expires_at: string
          id: string
          is_wash_trading: boolean | null
          same_wallet_loop_count: number | null
          sub_second_trade_count: number | null
          token_address: string
          top5_wallet_volume_percent: number | null
          volume_score: number | null
        }
        Insert: {
          analyzed_at?: string
          circular_trade_count?: number | null
          created_at?: string
          expires_at?: string
          id?: string
          is_wash_trading?: boolean | null
          same_wallet_loop_count?: number | null
          sub_second_trade_count?: number | null
          token_address: string
          top5_wallet_volume_percent?: number | null
          volume_score?: number | null
        }
        Update: {
          analyzed_at?: string
          circular_trade_count?: number | null
          created_at?: string
          expires_at?: string
          id?: string
          is_wash_trading?: boolean | null
          same_wallet_loop_count?: number | null
          sub_second_trade_count?: number | null
          token_address?: string
          top5_wallet_volume_percent?: number | null
          volume_score?: number | null
        }
        Relationships: []
      }
      wallet_graph_cache: {
        Row: {
          analyzed_at: string
          cluster_id: string | null
          created_at: string
          expires_at: string
          funding_depth: number | null
          funding_source: string | null
          id: string
          initial_funding_sol: number | null
          is_fresh_wallet: boolean | null
          wallet_address: string
          wallet_age_hours: number | null
        }
        Insert: {
          analyzed_at?: string
          cluster_id?: string | null
          created_at?: string
          expires_at?: string
          funding_depth?: number | null
          funding_source?: string | null
          id?: string
          initial_funding_sol?: number | null
          is_fresh_wallet?: boolean | null
          wallet_address: string
          wallet_age_hours?: number | null
        }
        Update: {
          analyzed_at?: string
          cluster_id?: string | null
          created_at?: string
          expires_at?: string
          funding_depth?: number | null
          funding_source?: string | null
          id?: string
          initial_funding_sol?: number | null
          is_fresh_wallet?: boolean | null
          wallet_address?: string
          wallet_age_hours?: number | null
        }
        Relationships: []
      }
      wallet_screening_results: {
        Row: {
          created_at: string
          expires_at: string
          flags: Json | null
          id: string
          is_illicit: boolean | null
          is_sanctioned: boolean | null
          raw_response: Json | null
          risk_level: string
          risk_score: number
          screened_at: string
          screening_source: string | null
          user_id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          flags?: Json | null
          id?: string
          is_illicit?: boolean | null
          is_sanctioned?: boolean | null
          raw_response?: Json | null
          risk_level?: string
          risk_score?: number
          screened_at?: string
          screening_source?: string | null
          user_id: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          flags?: Json | null
          id?: string
          is_illicit?: boolean | null
          is_sanctioned?: boolean | null
          raw_response?: Json | null
          risk_level?: string
          risk_score?: number
          screened_at?: string
          screening_source?: string | null
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_api_health_metrics: { Args: never; Returns: undefined }
      credit_referral_bonus: {
        Args: { bonus_amount: number; target_user_id: string }
        Returns: undefined
      }
      get_credit_costs: { Args: never; Returns: Json }
      get_payment_wallet: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
