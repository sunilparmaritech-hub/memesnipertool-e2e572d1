 /**
  * Token Risk Assessment Module
  * Comprehensive validation for P&L calculations, scam detection, and user protection
  */
 
 import { TradeHistoryEntry } from '@/hooks/useTradeHistory';
 
 // ==================== TYPE DEFINITIONS ====================
 
 export type TokenRiskLabel = 
   | 'REAL'           // Passes all checks - legitimate trading
   | 'HIGH_RISK'      // Volatile but tradable
   | 'SCAM'           // Honeypot or rug pull detected
   | 'HONEYPOT'       // Can't sell / massive sell tax
   | 'FAKE_PROFIT'    // Unrealistic gains, likely manipulated
   | 'MANIPULATED'    // Price manipulation detected
   | 'INVALID_DATA'   // Missing critical data
   | 'SPOOFED';       // Brand/symbol spoofing detected
 
 export type ReasonCode = 
   // Fake Profit Reasons
   | 'PNL_OVER_500_24H'        // P&L > 500% within 24 hours
   | 'PNL_OVER_2000_LIFETIME'  // P&L > 2000% lifetime
   | 'TINY_BUY_HUGE_SELL'      // Buy < 0.05 SOL, Sell > 2 SOL
   | 'PRICE_JUMP_100X'         // Price jumps > 100x between trades
   | 'MISSING_USD_PRICES'      // USD price missing for >50% trades
   // Scam/Honeypot Reasons
   | 'AVG_LOSS_85_PERCENT'     // Average loss >= 85%
   | 'SELL_PRICE_LOW'          // Sell price consistently << Buy price
   | 'SINGLE_SELL_AFTER_BUY'   // Only 1 successful SELL after BUY
   | 'LIQUIDITY_COLLAPSED'     // Liquidity collapses >90% post-buy
   | 'NO_JUPITER_ROUTE'        // Jupiter route unavailable
   // Spoofing Reasons
   | 'SPOOFED_SYMBOL'          // Symbol matches protected symbols
   | 'DUPLICATE_SYMBOL'        // Symbol reused across addresses
   | 'SUSPICIOUS_NAME'         // Name contains brands/politicians
   // Data Issues
   | 'SELL_ONLY'               // Only SELL transactions exist
   | 'BUY_ONLY'                // Only BUY transactions exist
   | 'ZERO_BUY_COST'           // Buy cost is 0
   | 'INVALID_AMOUNTS';        // Negative or invalid amounts
 
 export interface TokenRiskAssessment {
   tokenAddress: string;
   tokenSymbol: string | null;
   tokenName: string | null;
   riskLabel: TokenRiskLabel;
   reasonCodes: ReasonCode[];
   realizedPnL: number | null;      // Only when both BUY and SELL exist
   realizedPnLPercent: number | null;
   totalBuyCost: number;
   totalSellValue: number;
   buyCount: number;
   sellCount: number;
   weightedAvgBuyPrice: number | null;
   displayMessage: string;
   excludeFromPortfolio: boolean;   // Should this be excluded from total P&L?
   showWarning: boolean;
   warningMessage: string | null;
 }
 
 export interface PortfolioRiskSummary {
   validRealizedPnL: number;        // P&L only from REAL tokens
   validRealizedPnLPercent: number;
   totalValidBuyCost: number;
   totalValidSellValue: number;
   tokenAssessments: Map<string, TokenRiskAssessment>;
   flaggedTokensCount: number;
   realTokensCount: number;
   scamTokensCount: number;
   fakeProfileCount: number;
 }
 
 // ==================== CONSTANTS ====================
 
 // Official Solana token mints for protected symbols
 const OFFICIAL_MINTS: Record<string, string> = {
   'SOL': 'So11111111111111111111111111111111111111112',
   'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
   'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
 };
 
 // Symbols that should be flagged if used by non-official mints
 const PROTECTED_SYMBOLS = ['SOL', 'USDC', 'USDT', 'ETH', 'BTC', 'TRX', 'BNB', 'WBTC', 'WETH'];
 
 // Suspicious name patterns (brands, politicians, etc.)
 const SUSPICIOUS_NAME_PATTERNS = [
   /\b(trump|biden|elon|musk|obama|putin)\b/i,
   /\b(apple|google|microsoft|amazon|tesla|nvidia)\b/i,
   /\b(official|verified|real|authentic)\b/i,
 ];
 
 // Thresholds
 const THRESHOLDS = {
   FAKE_PROFIT_24H_PERCENT: 500,       // 500% in 24h
   FAKE_PROFIT_LIFETIME_PERCENT: 2000, // 2000% lifetime
   TINY_BUY_SOL: 0.05,                 // Minimum buy size
   HUGE_SELL_SOL: 2,                   // Maximum sell that triggers flag with tiny buy
   PRICE_JUMP_MULTIPLIER: 100,         // 100x price jump
   MISSING_USD_THRESHOLD: 0.5,         // 50% missing USD prices
   SCAM_AVG_LOSS_PERCENT: 85,          // 85% average loss = scam
   HIGH_RISK_LOSS_PERCENT: 50,         // 50% average loss = high risk
 };
 
 // ==================== CORE ASSESSMENT FUNCTIONS ====================
 
 /**
  * Assess a single token's risk based on its trade history
  */
 export function assessTokenRisk(
   tokenAddress: string,
   trades: TradeHistoryEntry[],
   allTradesSymbolMap?: Map<string, Set<string>> // symbol -> set of addresses
 ): TokenRiskAssessment {
   const reasonCodes: ReasonCode[] = [];
   let riskLabel: TokenRiskLabel = 'REAL';
   
   // Get token info from first trade
   const firstTrade = trades[0];
   const tokenSymbol = firstTrade?.token_symbol || null;
   const tokenName = firstTrade?.token_name || null;
   
   // Separate buys and sells
   const buys = trades.filter(t => t.trade_type === 'buy');
   const sells = trades.filter(t => t.trade_type === 'sell');
   
   // Calculate totals (use price_sol as the value in SOL)
   const totalBuyCost = buys.reduce((sum, t) => sum + (t.price_sol ?? 0), 0);
   const totalSellValue = sells.reduce((sum, t) => sum + (t.price_sol ?? 0), 0);
   
   // Calculate weighted average buy price (SOL per token)
   const totalBuyAmount = buys.reduce((sum, t) => sum + t.amount, 0);
   const weightedAvgBuyPrice = totalBuyAmount > 0 
     ? totalBuyCost / totalBuyAmount 
     : null;
   
   // ==================== A. REALIZED P&L VALIDATION ====================
   
   // Check for BUY-only or SELL-only
   if (buys.length === 0 && sells.length > 0) {
     reasonCodes.push('SELL_ONLY');
     riskLabel = 'INVALID_DATA';
   } else if (sells.length === 0 && buys.length > 0) {
     reasonCodes.push('BUY_ONLY');
     // Not invalid, just unrealized - but don't calculate realized P&L
   }
   
   // Check for zero buy cost with sells
   if (sells.length > 0 && totalBuyCost === 0 && buys.length > 0) {
     reasonCodes.push('ZERO_BUY_COST');
     riskLabel = 'INVALID_DATA';
   }
   
   // Calculate P&L only when both BUY and SELL exist
   let realizedPnL: number | null = null;
   let realizedPnLPercent: number | null = null;
   
   if (buys.length > 0 && sells.length > 0 && totalBuyCost > 0) {
     realizedPnL = totalSellValue - totalBuyCost;
     realizedPnLPercent = (realizedPnL / totalBuyCost) * 100;
   }
   
   // ==================== B. FAKE PROFIT DETECTION ====================
   
   if (realizedPnLPercent !== null) {
     // Check 24h P&L threshold
     const sortedTrades = [...trades].sort((a, b) => 
       new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
     );
     
     if (sortedTrades.length >= 2) {
       const firstTradeTime = new Date(sortedTrades[0].created_at).getTime();
       const lastTradeTime = new Date(sortedTrades[sortedTrades.length - 1].created_at).getTime();
       const hoursDiff = (lastTradeTime - firstTradeTime) / (1000 * 60 * 60);
       
       if (hoursDiff <= 24 && realizedPnLPercent > THRESHOLDS.FAKE_PROFIT_24H_PERCENT) {
         reasonCodes.push('PNL_OVER_500_24H');
         riskLabel = 'FAKE_PROFIT';
       }
     }
     
     // Check lifetime P&L threshold
     if (realizedPnLPercent > THRESHOLDS.FAKE_PROFIT_LIFETIME_PERCENT) {
       reasonCodes.push('PNL_OVER_2000_LIFETIME');
       riskLabel = 'FAKE_PROFIT';
     }
   }
   
   // Check tiny buy / huge sell pattern
   if (totalBuyCost < THRESHOLDS.TINY_BUY_SOL && 
       totalSellValue > THRESHOLDS.HUGE_SELL_SOL) {
     reasonCodes.push('TINY_BUY_HUGE_SELL');
     riskLabel = 'FAKE_PROFIT';
   }
   
   // Check for price jumps > 100x
   const sortedByTime = [...trades].sort((a, b) => 
     new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
   );
   
   for (let i = 1; i < sortedByTime.length; i++) {
     const prevPrice = sortedByTime[i-1].price_usd;
     const currPrice = sortedByTime[i].price_usd;
     
     if (prevPrice && currPrice && prevPrice > 0) {
       const priceRatio = currPrice / prevPrice;
       if (priceRatio >= THRESHOLDS.PRICE_JUMP_MULTIPLIER) {
         reasonCodes.push('PRICE_JUMP_100X');
         riskLabel = 'MANIPULATED';
         break;
       }
     }
   }
   
   // Check for missing USD prices
   const tradesWithUsd = trades.filter(t => t.price_usd !== null && t.price_usd !== undefined);
   if (trades.length > 0 && tradesWithUsd.length / trades.length < THRESHOLDS.MISSING_USD_THRESHOLD) {
     reasonCodes.push('MISSING_USD_PRICES');
     if (riskLabel === 'REAL') {
       riskLabel = 'HIGH_RISK';
     }
   }
   
   // ==================== C. HONEYPOT / RUG DETECTION ====================
   
   if (realizedPnLPercent !== null && realizedPnLPercent <= -THRESHOLDS.SCAM_AVG_LOSS_PERCENT) {
     reasonCodes.push('AVG_LOSS_85_PERCENT');
     riskLabel = 'SCAM';
   } else if (realizedPnLPercent !== null && realizedPnLPercent <= -THRESHOLDS.HIGH_RISK_LOSS_PERCENT) {
     if (riskLabel === 'REAL') {
       riskLabel = 'HIGH_RISK';
     }
   }
   
   // Check if sell price consistently lower than buy price
   if (buys.length > 0 && sells.length > 0 && weightedAvgBuyPrice) {
     const avgSellAmount = sells.reduce((sum, t) => sum + t.amount, 0);
     const avgSellPrice = avgSellAmount > 0 
       ? totalSellValue / avgSellAmount 
       : 0;
     
     // If sell price is less than 15% of buy price, it's suspicious
     if (avgSellPrice < weightedAvgBuyPrice * 0.15) {
       reasonCodes.push('SELL_PRICE_LOW');
       if (riskLabel === 'REAL' || riskLabel === 'HIGH_RISK') {
         riskLabel = 'HONEYPOT';
       }
     }
   }
   
   // Check for single sell after buy (common honeypot pattern)
   if (buys.length >= 1 && sells.length === 1) {
     // Only flag if there was a significant loss
     if (realizedPnLPercent !== null && realizedPnLPercent < -50) {
       reasonCodes.push('SINGLE_SELL_AFTER_BUY');
       if (riskLabel === 'REAL') {
         riskLabel = 'HIGH_RISK';
       }
     }
   }
   
   // ==================== D. BRAND & SYMBOL SPOOFING ====================
   
   if (tokenSymbol) {
     const upperSymbol = tokenSymbol.toUpperCase();
     
     // Check if using protected symbol with wrong mint
     if (PROTECTED_SYMBOLS.includes(upperSymbol)) {
       const officialMint = OFFICIAL_MINTS[upperSymbol];
       if (!officialMint || tokenAddress !== officialMint) {
         reasonCodes.push('SPOOFED_SYMBOL');
         riskLabel = 'SPOOFED';
       }
     }
     
     // Check for duplicate symbols across addresses
     if (allTradesSymbolMap) {
       const addressesWithSymbol = allTradesSymbolMap.get(upperSymbol);
       if (addressesWithSymbol && addressesWithSymbol.size > 1) {
         // Multiple tokens using same symbol
         if (!PROTECTED_SYMBOLS.includes(upperSymbol)) {
           reasonCodes.push('DUPLICATE_SYMBOL');
           if (riskLabel === 'REAL') {
             riskLabel = 'HIGH_RISK';
           }
         }
       }
     }
   }
   
   // Check for suspicious names
   if (tokenName) {
     for (const pattern of SUSPICIOUS_NAME_PATTERNS) {
       if (pattern.test(tokenName)) {
         reasonCodes.push('SUSPICIOUS_NAME');
         if (riskLabel === 'REAL') {
           riskLabel = 'HIGH_RISK';
         }
         break;
       }
     }
   }
   
   // ==================== GENERATE DISPLAY MESSAGE ====================
   
   const displayMessage = generateDisplayMessage(riskLabel, reasonCodes, realizedPnL, realizedPnLPercent);
   const warningMessage = generateWarningMessage(riskLabel, reasonCodes);
   
   // Determine if should be excluded from portfolio
   const excludeFromPortfolio = ['FAKE_PROFIT', 'MANIPULATED', 'SCAM', 'SPOOFED', 'INVALID_DATA'].includes(riskLabel);
   const showWarning = riskLabel !== 'REAL';
   
   return {
     tokenAddress,
     tokenSymbol,
     tokenName,
     riskLabel,
     reasonCodes,
     realizedPnL,
     realizedPnLPercent,
     totalBuyCost,
     totalSellValue,
     buyCount: buys.length,
     sellCount: sells.length,
     weightedAvgBuyPrice,
     displayMessage,
     excludeFromPortfolio,
     showWarning,
     warningMessage,
   };
 }
 
 /**
  * Assess all tokens and generate portfolio summary
  */
 export function assessPortfolioRisk(trades: TradeHistoryEntry[]): PortfolioRiskSummary {
   // Group trades by token address
   const tradesByToken = new Map<string, TradeHistoryEntry[]>();
   for (const trade of trades) {
     if (!trade.tx_hash) continue; // Skip fake entries
     
     const existing = tradesByToken.get(trade.token_address) || [];
     existing.push(trade);
     tradesByToken.set(trade.token_address, existing);
   }
   
   // Build symbol -> addresses map for duplicate detection
   const symbolToAddresses = new Map<string, Set<string>>();
   for (const [address, tokenTrades] of tradesByToken) {
     const symbol = tokenTrades[0]?.token_symbol?.toUpperCase();
     if (symbol) {
       const addresses = symbolToAddresses.get(symbol) || new Set();
       addresses.add(address);
       symbolToAddresses.set(symbol, addresses);
     }
   }
   
   // Assess each token
   const tokenAssessments = new Map<string, TokenRiskAssessment>();
   let validRealizedPnL = 0;
   let totalValidBuyCost = 0;
   let totalValidSellValue = 0;
   let flaggedTokensCount = 0;
   let realTokensCount = 0;
   let scamTokensCount = 0;
   let fakeProfileCount = 0;
   
   for (const [address, tokenTrades] of tradesByToken) {
     const assessment = assessTokenRisk(address, tokenTrades, symbolToAddresses);
     tokenAssessments.set(address, assessment);
     
     // Aggregate stats based on risk label
     if (assessment.riskLabel === 'REAL') {
       realTokensCount++;
       if (assessment.realizedPnL !== null) {
         validRealizedPnL += assessment.realizedPnL;
         totalValidBuyCost += assessment.totalBuyCost;
         totalValidSellValue += assessment.totalSellValue;
       }
     } else if (assessment.riskLabel === 'HIGH_RISK') {
       // Include high risk in P&L but flag it
       if (assessment.realizedPnL !== null) {
         validRealizedPnL += assessment.realizedPnL;
         totalValidBuyCost += assessment.totalBuyCost;
         totalValidSellValue += assessment.totalSellValue;
       }
       flaggedTokensCount++;
     } else if (['SCAM', 'HONEYPOT'].includes(assessment.riskLabel)) {
       scamTokensCount++;
       flaggedTokensCount++;
     } else if (['FAKE_PROFIT', 'MANIPULATED'].includes(assessment.riskLabel)) {
       fakeProfileCount++;
       flaggedTokensCount++;
     } else {
       flaggedTokensCount++;
     }
   }
   
   const validRealizedPnLPercent = totalValidBuyCost > 0 
     ? (validRealizedPnL / totalValidBuyCost) * 100 
     : 0;
   
   return {
     validRealizedPnL,
     validRealizedPnLPercent,
     totalValidBuyCost,
     totalValidSellValue,
     tokenAssessments,
     flaggedTokensCount,
     realTokensCount,
     scamTokensCount,
     fakeProfileCount,
   };
 }
 
 // ==================== HELPER FUNCTIONS ====================
 
 function generateDisplayMessage(
   label: TokenRiskLabel,
   reasons: ReasonCode[],
   pnl: number | null,
   pnlPercent: number | null
 ): string {
   switch (label) {
     case 'REAL':
       if (pnl !== null && pnlPercent !== null) {
         const sign = pnl >= 0 ? '+' : '';
         return `Realized P&L: ${sign}${pnl.toFixed(4)} SOL (${sign}${pnlPercent.toFixed(1)}%)`;
       }
       return 'Valid token - no realized P&L yet';
     
     case 'HIGH_RISK':
       return 'High volatility token - trade with caution';
     
     case 'SCAM':
     case 'HONEYPOT':
       return '⚠️ Likely scam/honeypot - excluded from P&L';
     
     case 'FAKE_PROFIT':
       return '⚠️ Unrealistic profit - likely manipulated token';
     
     case 'MANIPULATED':
       return '⚠️ Price manipulation detected - excluded from P&L';
     
     case 'SPOOFED':
       return '⚠️ Impersonating official token - excluded from P&L';
     
     case 'INVALID_DATA':
       if (reasons.includes('SELL_ONLY')) {
         return 'Sell-only (no buy record) - cannot calculate P&L';
       }
       return 'Invalid or incomplete trade data';
     
     default:
       return 'Unknown risk status';
   }
 }
 
 function generateWarningMessage(label: TokenRiskLabel, reasons: ReasonCode[]): string | null {
   if (label === 'REAL') return null;
   
   const warnings: string[] = [];
   
   for (const reason of reasons) {
     switch (reason) {
       case 'PNL_OVER_500_24H':
         warnings.push('Profit >500% in 24h');
         break;
       case 'PNL_OVER_2000_LIFETIME':
         warnings.push('Profit >2000% lifetime');
         break;
       case 'TINY_BUY_HUGE_SELL':
         warnings.push('Tiny buy, huge sell value');
         break;
       case 'PRICE_JUMP_100X':
         warnings.push('100x+ price jump detected');
         break;
       case 'AVG_LOSS_85_PERCENT':
         warnings.push('Average loss >85%');
         break;
       case 'SELL_PRICE_LOW':
         warnings.push('Sell price far below buy price');
         break;
       case 'SPOOFED_SYMBOL':
         warnings.push('Impersonating official token');
         break;
       case 'SUSPICIOUS_NAME':
         warnings.push('Suspicious token name');
         break;
     }
   }
   
   return warnings.length > 0 ? warnings.join(', ') : null;
 }
 
 /**
  * Get badge styling for risk labels
  */
 export function getRiskLabelBadge(label: TokenRiskLabel): {
   variant: 'default' | 'secondary' | 'destructive' | 'outline';
   className: string;
   icon: string;
 } {
   switch (label) {
     case 'REAL':
       return { variant: 'default', className: 'bg-green-500/20 text-green-400 border-green-500/30', icon: '✓' };
     case 'HIGH_RISK':
       return { variant: 'outline', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: '⚠' };
     case 'SCAM':
     case 'HONEYPOT':
       return { variant: 'destructive', className: 'bg-red-500/20 text-red-400 border-red-500/30', icon: '🚫' };
     case 'FAKE_PROFIT':
     case 'MANIPULATED':
       return { variant: 'destructive', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: '⚠️' };
     case 'SPOOFED':
       return { variant: 'destructive', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: '🎭' };
     case 'INVALID_DATA':
       return { variant: 'secondary', className: 'bg-muted text-muted-foreground', icon: '?' };
     default:
       return { variant: 'outline', className: '', icon: '' };
   }
 }
 
 /**
  * Should profit be displayed in green?
  * RULE: Never show FAKE_PROFIT in green
  */
 export function shouldShowProfitAsGreen(assessment: TokenRiskAssessment): boolean {
   if (['FAKE_PROFIT', 'MANIPULATED', 'SCAM', 'SPOOFED'].includes(assessment.riskLabel)) {
     return false;
   }
   return (assessment.realizedPnL ?? 0) >= 0;
 }