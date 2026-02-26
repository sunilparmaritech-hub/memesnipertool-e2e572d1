 /**
  * Hook for Token Risk Assessment
  * Provides risk analysis and validated P&L calculations
  */
 
 import { useMemo } from 'react';
 import { TradeHistoryEntry } from '@/hooks/useTradeHistory';
 import { 
   assessPortfolioRisk, 
   assessTokenRisk,
   PortfolioRiskSummary,
   TokenRiskAssessment,
 } from '@/lib/tokenRiskAssessment';
 
 interface UseTokenRiskAssessmentResult {
   portfolioSummary: PortfolioRiskSummary | null;
   getTokenAssessment: (tokenAddress: string) => TokenRiskAssessment | null;
   validRealizedPnL: number;
   validRealizedPnLPercent: number;
   flaggedCount: number;
   realCount: number;
   scamCount: number;
   fakeCount: number;
 }
 
 export function useTokenRiskAssessment(
   trades: TradeHistoryEntry[]
 ): UseTokenRiskAssessmentResult {
   const portfolioSummary = useMemo(() => {
     if (!trades || trades.length === 0) return null;
     return assessPortfolioRisk(trades);
   }, [trades]);
 
   const getTokenAssessment = (tokenAddress: string): TokenRiskAssessment | null => {
     if (!portfolioSummary) return null;
     return portfolioSummary.tokenAssessments.get(tokenAddress) || null;
   };
 
   return {
     portfolioSummary,
     getTokenAssessment,
     validRealizedPnL: portfolioSummary?.validRealizedPnL ?? 0,
     validRealizedPnLPercent: portfolioSummary?.validRealizedPnLPercent ?? 0,
     flaggedCount: portfolioSummary?.flaggedTokensCount ?? 0,
     realCount: portfolioSummary?.realTokensCount ?? 0,
     scamCount: portfolioSummary?.scamTokensCount ?? 0,
     fakeCount: portfolioSummary?.fakeProfileCount ?? 0,
   };
 }
 
 /**
  * Hook for single token assessment
  */
 export function useSingleTokenRisk(
   tokenAddress: string,
   trades: TradeHistoryEntry[]
 ): TokenRiskAssessment | null {
   return useMemo(() => {
     const tokenTrades = trades.filter(t => t.token_address === tokenAddress && t.tx_hash);
     if (tokenTrades.length === 0) return null;
     return assessTokenRisk(tokenAddress, tokenTrades);
   }, [tokenAddress, trades]);
 }