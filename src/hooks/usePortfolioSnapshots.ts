/**
 * Portfolio Snapshots Hook
 * 
 * Saves daily snapshots of portfolio state for historical equity curves.
 * Uses upsert to allow one snapshot per user per day.
 */

import { useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';

export interface PortfolioSnapshot {
  id: string;
  user_id: string;
  snapshot_date: string;
  open_positions_count: number;
  total_invested_sol: number;
  total_value_sol: number;
  unrealized_pnl_sol: number;
  realized_pnl_sol: number;
  total_pnl_sol: number;
  sol_price_usd: number | null;
  win_rate: number | null;
  closed_trades_count: number | null;
  created_at: string;
}

interface SnapshotData {
  openPositionsCount: number;
  totalInvestedSol: number;
  totalValueSol: number;
  unrealizedPnlSol: number;
  realizedPnlSol: number;
  totalPnlSol: number;
  solPriceUsd: number;
  winRate: number;
  closedTradesCount: number;
}

export function usePortfolioSnapshots(days = 30) {
  const { user } = useAuth();

  const { data: snapshots = [], refetch } = useQuery({
    queryKey: ['portfolio-snapshots', user?.id, days],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('portfolio_snapshots' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('snapshot_date', { ascending: true })
        .limit(days);
      if (error) {
        console.error('[PortfolioSnapshots] Fetch error:', error);
        return [];
      }
      return (data || []) as unknown as PortfolioSnapshot[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const saveSnapshot = useCallback(async (data: SnapshotData) => {
    if (!user?.id) return;
    const today = new Date().toISOString().split('T')[0];

    try {
      await supabase
        .from('portfolio_snapshots' as any)
        .upsert({
          user_id: user.id,
          snapshot_date: today,
          open_positions_count: data.openPositionsCount,
          total_invested_sol: data.totalInvestedSol,
          total_value_sol: data.totalValueSol,
          unrealized_pnl_sol: data.unrealizedPnlSol,
          realized_pnl_sol: data.realizedPnlSol,
          total_pnl_sol: data.totalPnlSol,
          sol_price_usd: data.solPriceUsd,
          win_rate: data.winRate,
          closed_trades_count: data.closedTradesCount,
        } as any, { onConflict: 'user_id,snapshot_date' });
    } catch (err) {
      console.error('[PortfolioSnapshots] Save error:', err);
    }
  }, [user?.id]);

  return { snapshots, saveSnapshot, refetch };
}
