import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CreditPack {
  id: string;
  name: string;
  description: string | null;
  sol_price: number;
  credits: number;
  bonus_credits: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
  badge: string | null;
}

interface CreditData {
  credit_balance: number;
  total_credits_purchased: number;
  total_credits_used: number;
}

interface CreditContextType {
  credits: CreditData;
  packs: CreditPack[];
  loading: boolean;
  hasCredits: (amount?: number) => boolean;
  deductCredits: (amount: number, actionType: string, referenceId?: string) => Promise<{ success: boolean; balance: number; error?: string }>;
  refreshCredits: () => Promise<void>;
  usageToday: number;
}

const CreditContext = createContext<CreditContextType | undefined>(undefined);

export const useCredits = () => {
  const context = useContext(CreditContext);
  if (!context) throw new Error("useCredits must be used within CreditProvider");
  return context;
};

export const CreditProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [credits, setCredits] = useState<CreditData>({ credit_balance: 0, total_credits_purchased: 0, total_credits_used: 0 });
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [usageToday, setUsageToday] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCredits = useCallback(async () => {
    if (!user) {
      setCredits({ credit_balance: 0, total_credits_purchased: 0, total_credits_used: 0 });
      setLoading(false);
      return;
    }

    try {
      // Fetch credits
      const { data: creditData } = await supabase
        .from('user_credits')
        .select('credit_balance, total_credits_purchased, total_credits_used')
        .eq('user_id', user.id)
        .single();

      if (creditData) {
        setCredits(creditData);
      } else {
        // Create credit account if none exists
        const { data: newCredits } = await supabase
          .from('user_credits')
          .insert({ user_id: user.id, credit_balance: 10 })
          .select('credit_balance, total_credits_purchased, total_credits_used')
          .single();
        if (newCredits) setCredits(newCredits);
      }

      // Fetch today's usage
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('credit_usage_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', todayStart.toISOString());

      setUsageToday(count || 0);
    } catch (err) {
      console.error('[Credits] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchPacks = useCallback(async () => {
    const { data } = await supabase
      .from('credit_packs')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    
    if (data) {
      setPacks(data.map(p => ({
        ...p,
        features: Array.isArray(p.features) ? p.features as string[] : [],
      })));
    }
  }, []);

  useEffect(() => {
    fetchCredits();
    fetchPacks();
  }, [fetchCredits, fetchPacks]);

  const hasCredits = useCallback((amount: number = 1): boolean => {
    return credits.credit_balance >= amount;
  }, [credits.credit_balance]);

  const deductCredits = useCallback(async (
    amount: number,
    actionType: string,
    referenceId?: string
  ): Promise<{ success: boolean; balance: number; error?: string }> => {
    if (!user) return { success: false, balance: 0, error: 'Not authenticated' };

    try {
      const { data, error } = await supabase.rpc('deduct_credits', {
        _user_id: user.id,
        _amount: amount,
        _action_type: actionType,
        _reference_id: referenceId || null,
      });

      if (error) throw error;

      const result = data as unknown as { success: boolean; balance: number; error?: string };
      
      if (result.success) {
        setCredits(prev => ({
          ...prev,
          credit_balance: result.balance,
          total_credits_used: prev.total_credits_used + amount,
        }));
        setUsageToday(prev => prev + 1);
      }

      return result;
    } catch (err: any) {
      console.error('[Credits] Deduction error:', err);
      return { success: false, balance: credits.credit_balance, error: err.message };
    }
  }, [user, credits.credit_balance]);

  return (
    <CreditContext.Provider value={{
      credits,
      packs,
      loading,
      hasCredits,
      deductCredits,
      refreshCredits: fetchCredits,
      usageToday,
    }}>
      {children}
    </CreditContext.Provider>
  );
};
