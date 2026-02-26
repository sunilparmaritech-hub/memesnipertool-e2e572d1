import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AuditResult {
  signature: string;
  status: 'VALID' | 'MISMATCH' | 'NOT_FOUND' | 'FAILED';
  issues: string[];
  corrections: Record<string, any>;
}

export interface TokenRiskAssessment {
  tokenAddress: string;
  tokenSymbol: string;
  status: 'SAFE' | 'RISKY' | 'SCAM';
  flags: string[];
}

export interface AuditSummary {
  totalAudited: number;
  valid: number;
  mismatches: number;
  notFound: number;
  failed: number;
  correctionsApplied: number;
}

export interface FullAuditResult {
  success: boolean;
  transactions: AuditResult[];
  pnlCorrections: Array<{
    positionId: string;
    tokenAddress: string;
    tokenSymbol: string;
    storedPnl: number;
    calculatedPnl: number;
    difference: number;
    status: string;
  }>;
  walletReconciliation: {
    totalSolSpent: number;
    totalSolReceived: number;
    netSolFlow: number;
    note: string;
  } | null;
  fakeTokens: TokenRiskAssessment[];
  summary: AuditSummary;
  error?: string;
}

type AuditAction = 'audit_transactions' | 'reconcile_wallet' | 'validate_pnl' | 'detect_fake_tokens' | 'full_audit';

export interface FakeTradeInfo {
  id: string;
  token_symbol: string;
  token_name: string;
  trade_type: string;
  created_at: string;
}

export function useTransactionAudit() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FullAuditResult | null>(null);
  const [fakeTrades, setFakeTrades] = useState<FakeTradeInfo[]>([]);
  const { toast } = useToast();

  // Find trades without tx_hash (fake trades from old backfill)
  const findFakeTrades = useCallback(async (): Promise<FakeTradeInfo[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const { data } = await supabase
      .from('trade_history')
      .select('id, token_symbol, token_name, trade_type, created_at')
      .eq('user_id', session.user.id)
      .is('tx_hash', null)
      .order('created_at', { ascending: false });

    const trades = (data || []) as FakeTradeInfo[];
    setFakeTrades(trades);
    return trades;
  }, []);

  // Delete fake trades (entries without tx_hash)
  const cleanupFakeTrades = useCallback(async (): Promise<number> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to cleanup fake trades',
        variant: 'destructive',
      });
      return 0;
    }

    try {
      setLoading(true);

      // First, count how many will be deleted
      const { count } = await supabase
        .from('trade_history')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .is('tx_hash', null);

      if (!count || count === 0) {
        toast({
          title: 'No Fake Trades',
          description: 'All trades have valid transaction hashes',
        });
        return 0;
      }

      // Delete trades without tx_hash
      const { error } = await supabase
        .from('trade_history')
        .delete()
        .eq('user_id', session.user.id)
        .is('tx_hash', null);

      if (error) throw error;

      setFakeTrades([]);
      toast({
        title: '🧹 Cleanup Complete',
        description: `Removed ${count} fake trades without on-chain signatures`,
      });

      return count;
    } catch (error: any) {
      console.error('Cleanup failed:', error);
      toast({
        title: 'Cleanup Failed',
        description: error.message || 'Failed to remove fake trades',
        variant: 'destructive',
      });
      return 0;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const runAudit = useCallback(async (
    action: AuditAction = 'full_audit',
    limit: number = 100
  ): Promise<FullAuditResult | null> => {
    setLoading(true);
    setResults(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to run audit',
          variant: 'destructive',
        });
        return null;
      }

      const response = await supabase.functions.invoke('transaction-audit', {
        body: { action, limit },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data as FullAuditResult;
      setResults(data);

      // Also find fake trades
      await findFakeTrades();

      // Show summary toast
      if (data.success) {
        const { summary } = data;
        const issues = summary.mismatches + summary.notFound + summary.failed;
        
        if (issues > 0) {
          toast({
            title: '⚠️ Audit Complete - Issues Found',
            description: `${summary.valid} valid, ${summary.mismatches} corrected, ${summary.notFound} not found, ${data.fakeTokens.length} risky tokens`,
            variant: 'destructive',
          });
        } else {
          toast({
            title: '✅ Audit Complete',
            description: `${summary.totalAudited} transactions verified, all valid`,
          });
        }
      }

      return data;
    } catch (error: any) {
      console.error('Audit failed:', error);
      toast({
        title: 'Audit Failed',
        description: error.message || 'Failed to run audit',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast, findFakeTrades]);

  const auditTransactions = useCallback((limit?: number) => 
    runAudit('audit_transactions', limit), [runAudit]);

  const validatePnl = useCallback((limit?: number) => 
    runAudit('validate_pnl', limit), [runAudit]);

  const detectFakeTokens = useCallback((limit?: number) => 
    runAudit('detect_fake_tokens', limit), [runAudit]);

  const reconcileWallet = useCallback((limit?: number) => 
    runAudit('reconcile_wallet', limit), [runAudit]);

  const fullAudit = useCallback((limit?: number) => 
    runAudit('full_audit', limit), [runAudit]);

  return {
    loading,
    results,
    fakeTrades,
    auditTransactions,
    validatePnl,
    detectFakeTokens,
    reconcileWallet,
    fullAudit,
    findFakeTrades,
    cleanupFakeTrades,
  };
}
