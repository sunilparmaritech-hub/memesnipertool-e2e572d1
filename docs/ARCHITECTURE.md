# SolTrades - Technical Architecture Document

**Version:** 3.0.0  
**Last Updated:** February 2025  
**Document Type:** Technical Specification

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Backend Architecture](#5-backend-architecture)
6. [Trading Engine](#6-trading-engine)
7. [Complete Trading Pipeline](#7-complete-trading-pipeline)
8. [Risk Management System](#8-risk-management-system)
9. [Circuit Breaker System](#9-circuit-breaker-system)
10. [Transaction Integrity System](#10-transaction-integrity-system)
11. [Data Flow](#11-data-flow)
12. [Database Schema](#12-database-schema)
13. [Security Architecture](#13-security-architecture)
14. [External Integrations](#14-external-integrations)
15. [Deployment Architecture](#15-deployment-architecture)

---

## 1. Executive Summary

SolTrades is a **Solana-based meme token sniping and trading platform** designed for automated token discovery, multi-layer risk assessment, and protected trade execution. The platform operates in two modes:

- **Demo Mode**: Simulated trading for practice and evaluation
- **Live Mode**: Real on-chain trading with connected Solana wallets

### Core Capabilities

| Feature | Description |
|---------|-------------|
| Token Discovery | Two-stage pipeline for broad detection and tradability filtering |
| 11-Stage Safety Pipeline | Discovery → Deployer Check → LP Verification → Liquidity Stability → Sell Simulation → Tax Check → Rug Probability → BUY → Delta Validation → Post-Buy Revalidation → Real-Time Monitoring |
| Automated Sniping | 3-stage engine: Liquidity Detection → Raydium Snipe → Jupiter Exit |
| Risk Assessment | Multi-layer validation including honeypot, rug-pull, holder entropy, and fake profit detection |
| Circuit Breaker | Automated trading halt on drawdown, rug streaks, hidden taxes, or frozen tokens |
| Portfolio Management | Real-time P&L tracking with realized/unrealized separation |
| Auto-Exit | Automated stop-loss and take-profit execution |
| Transaction Integrity | On-chain SOL delta as single source of truth for all P&L calculations |

---

## 2. Technology Stack

### 2.1 Frontend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.3.x | UI Component Framework |
| **TypeScript** | 5.x | Type-safe JavaScript |
| **Vite** | 5.x | Build Tool & Dev Server |
| **Tailwind CSS** | 3.x | Utility-first CSS Framework |
| **shadcn/ui** | Latest | Pre-built UI Components |
| **React Router** | 6.x | Client-side Routing |
| **TanStack Query** | 5.x | Server State Management |
| **Zustand** | 5.x | Client State Management |
| **Recharts** | 2.x | Data Visualization |
| **Framer Motion** | - | Animations (via Tailwind Animate) |

### 2.2 Backend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Lovable Cloud** | - | Backend-as-a-Service (Supabase-powered) |
| **PostgreSQL** | 15.x | Primary Database |
| **Deno Edge Functions** | - | Serverless API Endpoints |
| **Row Level Security** | - | Data Access Control |

### 2.3 Blockchain Stack

| Technology | Purpose |
|------------|---------|
| **@solana/web3.js** | Solana RPC & Transaction Building |
| **Jupiter Aggregator** | DEX Aggregation for Exits |
| **Raydium Protocol** | Direct AMM Sniping |
| **Helius RPC** | Enhanced Solana RPC (configurable) |

### 2.4 Data Providers (Free/Low-Cost)

| Provider | Purpose | Cost |
|----------|---------|------|
| **DexScreener** | Token Discovery, Price Feeds, Pool Data | Free |
| **GeckoTerminal** | Alternative Token Discovery | Free |
| **Solscan** | Transaction Verification | Free |
| **Jupiter API** | Route Quotes, Token Indexing | Free |
| **Raydium API** | Pool Detection, Liquidity Data | Free |

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Dashboard  │  │   Scanner    │  │  Portfolio   │          │
│  │    Page      │  │    Page      │  │    Page      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│           │                │                │                   │
│  ┌────────┴────────────────┴────────────────┴────────┐         │
│  │              React Context Providers               │         │
│  │  (Auth, AppMode, Bot, DisplayUnit, DemoPortfolio) │         │
│  └────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        HOOK LAYER                               │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │
│  │  Trading Hooks │  │  Data Hooks    │  │  Utility Hooks │    │
│  │  - useLive...  │  │  - usePositions│  │  - useWallet   │    │
│  │  - useAuto...  │  │  - useTrade... │  │  - useSolPrice │    │
│  └────────────────┘  └────────────────┘  └────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SAFETY LAYER                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Pre-Execution Gate                       │  │
│  │  Deployer → LP Burn → Liquidity → Sell Sim → Tax → Rug   │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Circuit Breaker                          │  │
│  │  Drawdown Monitor → Rug Streak → Tax Counter → Freeze     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     TRADING ENGINE                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    controller.ts                          │  │
│  │         Orchestrates 3-Stage Trading Flow                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│       │                    │                    │               │
│       ▼                    ▼                    ▼               │
│  ┌──────────┐       ┌──────────────┐      ┌──────────────┐     │
│  │ Stage 1  │       │   Stage 2    │      │   Stage 3    │     │
│  │Liquidity │  ──►  │   Raydium    │  ──► │   Jupiter    │     │
│  │Detection │       │    Snipe     │      │    Exit      │     │
│  └──────────┘       └──────────────┘      └──────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  POST-EXECUTION VALIDATION                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Dual-RPC Delta Validation                       │  │
│  │  - parseSolDelta() for actual SOL movement                │  │
│  │  - verifyDeltaWithBalance() cross-check                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Post-Buy Liquidity Revalidation                 │  │
│  │  - quickLiquidityCheck() for instant rug detection        │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Real-Time Liquidity Watcher                     │  │
│  │  - Continuous monitoring of open positions                │  │
│  │  - LP withdrawal detection                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  TRANSACTION INTEGRITY LAYER                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           confirm-transaction Edge Function               │  │
│  │  - On-chain confirmation polling                          │  │
│  │  - SOL delta extraction from RPC                          │  │
│  │  - FIFO P&L matching                                      │  │
│  │  - Semantic column logging                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND LAYER                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Lovable Cloud (Supabase)                     │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐          │  │
│  │  │ PostgreSQL │  │   Edge     │  │    Auth    │          │  │
│  │  │  Database  │  │ Functions  │  │  Service   │          │  │
│  │  └────────────┘  └────────────┘  └────────────┘          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BLOCKCHAIN LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Solana     │  │   Raydium    │  │   Jupiter    │          │
│  │     RPC      │  │     AMM      │  │  Aggregator  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Complete Trading Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────┐
│              COMPLETE 11-STAGE TRADING PIPELINE                  │
│                                                                  │
│  ┌─────────────┐                                                │
│  │ 1. DISCOVERY│ Token detected from DexScreener/GeckoTerminal  │
│  └──────┬──────┘                                                │
│         ▼                                                        │
│  ┌─────────────────────┐                                        │
│  │ 2. HARD PRE-FILTERS │ Token age, basic validation            │
│  └──────────┬──────────┘                                        │
│             ▼                                                    │
│  ┌─────────────────────────┐                                    │
│  │ 3. DEPLOYER REPUTATION  │ Historical rug ratio, cluster check│
│  └──────────┬──────────────┘                                    │
│             ▼                                                    │
│  ┌──────────────────────┐                                       │
│  │ 4. LP BURN VERIFY    │ Verify LP tokens burned               │
│  └──────────┬───────────┘                                       │
│             ▼                                                    │
│  ┌─────────────────────────┐                                    │
│  │ 5. LIQUIDITY STABILITY  │ Pool depth, volatility check       │
│  └──────────┬──────────────┘                                    │
│             ▼                                                    │
│  ┌─────────────────────────────┐                                │
│  │ 6. SELL SIMULATION (MULTI) │ Jupiter + Raydium route test    │
│  └──────────┬─────────────────┘                                 │
│             ▼                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 7. TAX DISCREPANCY CHECK │ Hidden sell tax detection         │
│  └──────────┬───────────────┘                                   │
│             ▼                                                    │
│  ┌────────────────────────┐                                     │
│  │ 8. RUG PROBABILITY     │ Multi-factor rug score (0-100)      │
│  └──────────┬─────────────┘                                     │
│             ▼                                                    │
│  ╔══════════════════════════╗                                   │
│  ║    9. BUY EXECUTION      ║ Raydium snipe if all gates pass   │
│  ╚══════════╤═══════════════╝                                   │
│             ▼                                                    │
│  ┌──────────────────────────────┐                               │
│  │ 10. DUAL-RPC DELTA VALIDATION│ Verify actual SOL movement    │
│  └──────────┬───────────────────┘                               │
│             ▼                                                    │
│  ┌───────────────────────────────┐                              │
│  │ 11. POST-BUY LIQUIDITY RECHECK│ Catch instant rugs           │
│  └──────────┬────────────────────┘                              │
│             ▼                                                    │
│  ┌──────────────────────────────┐                               │
│  │ REAL-TIME LIQUIDITY WATCHER  │ Continuous monitoring         │
│  └──────────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Frontend Architecture

### 4.1 Directory Structure

```
src/
├── components/
│   ├── admin/              # Admin dashboard components
│   ├── auth/               # Authentication components
│   ├── charts/             # Price chart components
│   ├── dashboard/          # Dashboard widgets
│   ├── layout/             # App layout components
│   ├── navigation/         # Mobile/desktop navigation
│   ├── portfolio/          # Portfolio management
│   ├── scanner/            # Token scanner components
│   ├── trading/            # Trading panels and controls
│   ├── ui/                 # shadcn/ui base components
│   └── wallet/             # Wallet connection modals
│
├── contexts/
│   ├── AppModeContext.tsx  # Demo/Live mode switching
│   ├── AuthContext.tsx     # Authentication state
│   ├── BotContext.tsx      # Bot automation state
│   ├── DemoPortfolioContext.tsx  # Demo trading simulation
│   └── DisplayUnitContext.tsx    # SOL/USD display toggle
│
├── hooks/
│   ├── wallet/             # Wallet-specific hooks
│   ├── useDiscoveryPipeline.ts   # Token discovery
│   ├── useLiveTradingOrchestrator.ts  # Trade execution + post-validation
│   ├── usePositions.ts     # Position management
│   ├── useTradeHistory.ts  # Transaction history
│   ├── useAutoExit.ts      # Auto TP/SL monitoring
│   ├── useLiquidityWatcher.ts    # Real-time liquidity monitoring
│   ├── useTransactionAudit.ts    # Transaction integrity audit
│   └── useTokenRiskAssessment.ts  # Risk validation
│
├── lib/
│   ├── trading-engine/     # Core trading logic
│   │   ├── controller.ts   # Main orchestrator
│   │   ├── liquidity-detector.ts  # Stage 1
│   │   ├── raydium-sniper.ts      # Stage 2
│   │   ├── jupiter-trader.ts      # Stage 3
│   │   ├── rpc-pool-validator.ts  # RPC-based pool validation
│   │   └── types.ts        # Type definitions
│   │
│   ├── preExecutionGate.ts       # Pre-trade safety gate (11 rules)
│   ├── deployerReputation.ts     # Deployer history & rug detection
│   ├── lpVerification.ts         # LP burn verification
│   ├── liquidityMonitor.ts       # Liquidity stability & real-time watch
│   ├── sellTaxDetector.ts        # Hidden tax detection
│   ├── rugProbability.ts         # Multi-factor rug probability
│   ├── holderEntropy.ts          # Holder distribution analysis
│   ├── solDeltaParser.ts         # Dual-RPC SOL delta extraction
│   ├── circuitBreaker.ts         # Trading halt system
│   ├── transactionIntegrity.ts   # P&L validation & guards
│   ├── tokenRiskAssessment.ts    # Risk engine
│   └── routeValidator.ts         # Swap route checks
│
├── pages/
│   ├── Index.tsx           # Dashboard
│   ├── Scanner.tsx         # Token scanner
│   ├── Portfolio.tsx       # Portfolio view
│   ├── RiskCompliance.tsx  # Risk settings & circuit breaker
│   ├── Admin.tsx           # Admin panel
│   └── Auth.tsx            # Login/signup
│
└── stores/
    └── scannerStore.ts     # Zustand scanner state
```

### 4.2 Context Providers

| Context | Purpose | State |
|---------|---------|-------|
| `AuthContext` | User authentication | user, session, isAdmin |
| `AppModeContext` | Demo/Live mode | isDemo, isLive, switchMode |
| `BotContext` | Bot automation | isBotActive, startBot, stopBot |
| `DisplayUnitContext` | Currency display | unit (SOL/USD), toggle |
| `DemoPortfolioContext` | Demo trading | virtual balance, positions |

### 4.3 Key Hooks

| Hook | Purpose | Dependencies |
|------|---------|--------------|
| `useLiveTradingOrchestrator` | Central trade execution + post-validation | useWallet, useTradingEngine, usePositions |
| `useDiscoveryPipeline` | Token discovery | useTokenStateManager, supabase |
| `useAutoSniper` | Automated trading decisions | useSniperSettings, useRiskCompliance |
| `useAutoExit` | Stop-loss/Take-profit | usePositions, useTradeExecution |
| `useLiquidityWatcher` | Real-time liquidity monitoring | usePositions |
| `useTokenRiskAssessment` | P&L validation | useTradeHistory |
| `useTransactionAudit` | Transaction integrity verification | supabase |
| `useRiskCompliance` | Circuit breaker & risk settings | supabase |

---

## 5. Backend Architecture

### 5.1 Edge Functions

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `token-scanner` | POST | Discover tokens from DexScreener/GeckoTerminal |
| `trade-execution` | POST | Execute trades via Jupiter/Raydium |
| `confirm-transaction` | POST | Verify on-chain TX, log with semantic SOL columns |
| `transaction-audit` | POST | 5-phase integrity audit with FIFO P&L recalculation |
| `auto-exit` | POST | Process stop-loss/take-profit triggers |
| `liquidity-check` | POST | Validate pool liquidity |
| `risk-check` | POST | Run safety validations + circuit breaker checks |
| `token-metadata` | GET | Fetch token details |
| `fix-token-metadata` | POST | Repair corrupted token data via DexScreener |
| `token-holders` | GET | Get holder count and buyer positions |
| `solana-balance` | GET | Get wallet SOL balance |
| `wallet-tokens` | GET | List wallet token holdings |
| `sol-price` | GET | Aggregated SOL price from CoinGecko/Jupiter/Binance |
| `admin-analytics` | GET | Admin dashboard data |
| `api-health` | GET | External API status checks |

### 5.2 Shared Modules

```
supabase/functions/_shared/
├── api-keys.ts         # API key management
├── jupiter-fast.ts     # Jupiter API helpers (batched quotes)
├── jupiter-retry.ts    # Retry logic for quotes
├── fast-discovery.ts   # High-speed token discovery
├── helius-realtime.ts  # Helius real-time pool detection
└── validation.ts       # Input validation
```

### 5.3 Token Scanner Performance (v2 - Optimized)

**Target Latency:** <1.5s full scan (vs 4-8s previous)

| Optimization | Before | After | Improvement |
|--------------|--------|-------|-------------|
| API Timeouts | 8s each | 3s racing | 2.5x faster |
| Discovery Strategy | Sequential | Racing (first wins) | 3x faster |
| Jupiter Concurrency | 5 parallel | 10 parallel | 2x faster |
| Cache TTL | 30s | 15s (freshness) | Better data |
| Sources | DexScreener + GeckoTerminal | +Raydium Direct API | +1 source |

---

## 6. Trading Engine

### 6.1 Three-Stage Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 STAGE 1: LIQUIDITY DETECTION                │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Raydium    │    │   Pool      │    │  Liquidity  │     │
│  │  Pool Scan  │───►│ Validation  │───►│  Threshold  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                               │             │
│  Output: LiquidityDetectionResult             │             │
│  - poolAddress, tokenSymbol, liquidity        │             │
└───────────────────────────────────────────────┼─────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────┐
│                 STAGE 2: RAYDIUM SNIPE                      │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Build Swap │    │    Sign     │    │   Submit    │     │
│  │ Transaction │───►│     TX      │───►│   On-Chain  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                               │             │
│  Output: RaydiumSnipeResult                   │             │
│  - txHash, entryPrice, tokenAmount, solSpent  │             │
└───────────────────────────────────────────────┼─────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────┐
│                 STAGE 3: JUPITER EXIT                       │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Wait for   │    │  Get Best   │    │  Execute    │     │
│  │  Indexing   │───►│   Route     │───►│   Sell      │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                             │
│  Output: JupiterTradeResult                                 │
│  - txHash, outputAmount, priceImpact                        │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Trading Flow Options

| Flow | Use Case | Stages |
|------|----------|--------|
| `preExecutionGate` | Safety validation | Gate ONLY |
| `quickSnipe` | Immediate execution | Gate → 1 → 2 |
| `monitorAndSnipe` | Wait for liquidity | Gate → 1 (polling) → 2 → 3 |
| `checkTokenStatus` | Information only | 1 + 3 (check only) |
| `executeExit` | Sell position | 3 only |

### 6.3 Configuration

```typescript
interface TradingConfig {
  buyAmount: number;      // SOL to spend
  slippage: number;       // 0.01-1.0 (1%-100%)
  priorityFee: number;    // SOL for priority
  maxRetries: number;     // Retry attempts
  riskFilters: {
    checkRugPull: boolean;
    checkHoneypot: boolean;
    checkMintAuthority: boolean;
    checkFreezeAuthority: boolean;
    maxOwnershipPercent: number;
    minHolders: number;
  };
}
```

---

## 7. Complete Trading Pipeline

### 7.1 Pre-Execution Gate (STAGE 0)

The Pre-Execution Gate is a **HARD, EXECUTION-BLOCKING** safety layer that MUST pass before ANY trade. If the gate fails, execution STOPS immediately.

**Location:** `src/lib/preExecutionGate.ts`

```
┌─────────────────────────────────────────────────────────────┐
│               PRE-EXECUTION GATE (STAGE 0)                  │
│                                                             │
│  Called BEFORE any trade execution:                         │
│  - useAutoSniper                                            │
│  - controller.snipeToken()                                  │
│  - Raydium buy execution                                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  GATE RULES                          │   │
│  │                                                       │   │
│  │  1. TIME_BUFFER: Token age ≥ 20s (blocks <15s)       │   │
│  │  2. DEPLOYER_REPUTATION: Historical rug check        │   │
│  │  3. LP_BURN_VERIFICATION: LP tokens burned           │   │
│  │  4. LIQUIDITY_STABILITY: Pool stable, no volatility  │   │
│  │  5. LIQUIDITY_REALITY: Pool ≥ $3k, no rug signals    │   │
│  │  6. EXECUTABLE_SELL: Jupiter route exists, ≤25% slip │   │
│  │  7. HIDDEN_TAX: Sell tax < 50%, no discrepancy       │   │
│  │  8. RUG_PROBABILITY: Rug score < 65                  │   │
│  │  9. HOLDER_ENTROPY: Distribution not centralized     │   │
│  │  10. BUYER_POSITION: Position #2-#20, unique buyers  │   │
│  │  11. PRICE_SANITY: No >50x jumps, USD price exists   │   │
│  │  12. SYMBOL_SPOOFING: Not impersonating SOL/USDC     │   │
│  │  13. FREEZE_AUTHORITY: Owner cannot freeze transfers │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               RISK SCORE (0-100)                     │   │
│  │                                                       │   │
│  │  Start: 100 points                                    │   │
│  │  Penalties:                                           │   │
│  │    - No Jupiter route:     -60                        │   │
│  │    - Liquidity < $3k:      -40                        │   │
│  │    - Deployer = 1st buyer: -30                        │   │
│  │    - Only 1 buyer:         -20                        │   │
│  │    - Price jump >50x:      -20                        │   │
│  │    - Symbol spoofing:      -15                        │   │
│  │    - High rug probability: -25                        │   │
│  │    - Low holder entropy:   -20                        │   │
│  │    - Hidden sell tax:      -30                        │   │
│  │    - Freeze authority:     -50 (BLOCK)                │   │
│  │                                                       │   │
│  │  ALLOW trade: score ≥ 60 AND no blocking failures    │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│                            ▼                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  EXECUTABLE  │  │   OBSERVED   │  │   BLOCKED    │      │
│  │  (Trade OK)  │  │ (Watch Only) │  │  (No Trade)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Deployer Reputation System

**Location:** `src/lib/deployerReputation.ts`

```
┌─────────────────────────────────────────────────────────────┐
│               DEPLOYER REPUTATION CHECK                      │
│                                                              │
│  For each token deployer wallet:                             │
│                                                              │
│  1. Query deployer_reputation table                          │
│     - total_tokens_created                                   │
│     - total_rugs                                             │
│     - rug_ratio                                              │
│     - avg_liquidity_survival_seconds                         │
│     - cluster_id (linked wallet groups)                      │
│                                                              │
│  2. Calculate reputation score (0-100):                      │
│     ┌──────────────────────────────────────────────┐        │
│     │  Base: 50 points                              │        │
│     │  + 25 if rug_ratio < 10%                      │        │
│     │  + 15 if liquidity_survival > 3600s           │        │
│     │  + 10 if tokens_created > 5                   │        │
│     │  - 40 if rug_ratio > 50%                      │        │
│     │  - 30 if in known scam cluster                │        │
│     └──────────────────────────────────────────────┘        │
│                                                              │
│  3. Decision:                                                │
│     - score < 30: BLOCK (known bad actor)                    │
│     - score 30-50: HIGH_RISK (proceed with caution)          │
│     - score > 50: PASS                                       │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Liquidity Stability Check

**Location:** `src/lib/liquidityMonitor.ts`

```
┌─────────────────────────────────────────────────────────────┐
│               LIQUIDITY STABILITY CHECK                      │
│                                                              │
│  Pre-Trade Analysis:                                         │
│                                                              │
│  1. Take liquidity snapshot                                  │
│     - Current SOL in pool                                    │
│     - Current token reserves                                 │
│     - LP token supply                                        │
│                                                              │
│  2. Check historical stability (if available):               │
│     - Volatility < 30% over last 5 minutes                   │
│     - No sudden drops > 50%                                  │
│     - No LP withdrawal detected                              │
│                                                              │
│  3. Blocking conditions:                                     │
│     ┌──────────────────────────────────────────────┐        │
│     │  BLOCK if:                                    │        │
│     │  - Liquidity dropped >70% in last minute      │        │
│     │  - LP tokens being withdrawn                  │        │
│     │  - Pool appears to be draining                │        │
│     │  - Extreme price volatility detected          │        │
│     └──────────────────────────────────────────────┘        │
│                                                              │
│  Output: LiquidityMonitorResult                              │
│  - isStable: boolean                                         │
│  - riskLevel: 'low' | 'medium' | 'high' | 'critical'        │
│  - lpWithdrawalDetected: boolean                            │
└─────────────────────────────────────────────────────────────┘
```

### 7.4 Sell Tax Detection

**Location:** `src/lib/sellTaxDetector.ts`

```
┌─────────────────────────────────────────────────────────────┐
│               HIDDEN SELL TAX DETECTION                      │
│                                                              │
│  Multi-Route Simulation:                                     │
│                                                              │
│  1. Simulate sell via Jupiter:                               │
│     - Quote output for selling X tokens                      │
│     - Expected output: A SOL                                 │
│                                                              │
│  2. Simulate sell via Raydium (direct):                      │
│     - Quote output for same X tokens                         │
│     - Expected output: B SOL                                 │
│                                                              │
│  3. Calculate implied tax:                                   │
│     ┌──────────────────────────────────────────────┐        │
│     │  Expected (based on price): C SOL             │        │
│     │  Actual (simulation): min(A, B) SOL           │        │
│     │  Tax = (C - Actual) / C * 100                 │        │
│     └──────────────────────────────────────────────┘        │
│                                                              │
│  Thresholds:                                                 │
│  - HIDDEN_TAX_THRESHOLD: 10% (flag as suspicious)           │
│  - MODERATE_TAX_THRESHOLD: 25% (high risk)                  │
│  - HIGH_TAX_THRESHOLD: 50% (BLOCK)                          │
│                                                              │
│  Output: SellTaxDetectionResult                              │
│  - estimatedTax: number (percentage)                         │
│  - isHoneypot: boolean (tax > 90%)                          │
│  - discrepancyDetected: boolean                              │
└─────────────────────────────────────────────────────────────┘
```

### 7.5 Rug Probability Engine

**Location:** `src/lib/rugProbability.ts`

```
┌─────────────────────────────────────────────────────────────┐
│               RUG PROBABILITY CALCULATOR                     │
│                                                              │
│  Multi-Factor Analysis (0-100 score):                        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  FACTOR                          │ WEIGHT │ MAX PTS │    │
│  ├──────────────────────────────────┼────────┼─────────┤    │
│  │  Liquidity/FDV Ratio             │  25%   │   25    │    │
│  │  Holder Concentration (Entropy)  │  20%   │   20    │    │
│  │  Deployer Reputation             │  20%   │   20    │    │
│  │  Token Age (seconds)             │  15%   │   15    │    │
│  │  LP Lock Status                  │  10%   │   10    │    │
│  │  Trading Volume Pattern          │  10%   │   10    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Scoring:                                                    │
│  - 0-30: LOW risk (safe to trade)                           │
│  - 30-50: MODERATE risk (proceed with caution)              │
│  - 50-65: HIGH risk (risky trade)                           │
│  - 65+: BLOCK (too dangerous)                               │
│                                                              │
│  Block Threshold: RUG_PROBABILITY_BLOCK_THRESHOLD = 65      │
│                                                              │
│  Output: RugProbabilityResult                                │
│  - score: number (0-100)                                     │
│  - riskLevel: 'low' | 'moderate' | 'high' | 'critical'      │
│  - factors: RugFactorBreakdown                               │
│  - shouldBlock: boolean                                      │
└─────────────────────────────────────────────────────────────┘
```

### 7.6 Holder Entropy Analysis

**Location:** `src/lib/holderEntropy.ts`

```
┌─────────────────────────────────────────────────────────────┐
│               HOLDER ENTROPY ANALYSIS                        │
│                                                              │
│  Shannon Entropy Calculation:                                │
│                                                              │
│  H(X) = -Σ p(x) * log₂(p(x))                                │
│                                                              │
│  Where p(x) = holder_balance / total_supply                  │
│                                                              │
│  Normalized Score: H / log₂(n) where n = holder count       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ENTROPY SCORE    │ INTERPRETATION                  │    │
│  ├───────────────────┼─────────────────────────────────┤    │
│  │  0.8 - 1.0        │ Well distributed (SAFE)         │    │
│  │  0.6 - 0.8        │ Moderately distributed          │    │
│  │  0.35 - 0.6       │ Concentrated (RISKY)            │    │
│  │  < 0.35           │ Highly centralized (BLOCK)      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Additional Metrics:                                         │
│  - Gini Coefficient: Inequality measure                      │
│  - HHI (Herfindahl-Hirschman Index): Market concentration   │
│  - Largest holder %: Single holder dominance                 │
│  - Top 10 concentration %                                    │
│                                                              │
│  Hard Block Conditions:                                      │
│  - entropyScore < 0.35                                       │
│  - largestHolder > 50%                                       │
│  - top10Concentration > 85%                                  │
│                                                              │
│  Output: EntropyResult                                       │
│  - entropyScore: number (0-1, normalized)                   │
│  - centralized: boolean                                      │
│  - shouldBlock: boolean                                      │
│  - riskLevel: 'low' | 'medium' | 'high' | 'critical'        │
└─────────────────────────────────────────────────────────────┘
```

### 7.7 Post-Buy Validation

**Location:** `src/hooks/useLiveTradingOrchestrator.ts`

```
┌─────────────────────────────────────────────────────────────┐
│               POST-BUY VALIDATION FLOW                       │
│                                                              │
│  After successful BUY execution:                             │
│                                                              │
│  STEP 1: Dual-RPC Delta Validation                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  1. Parse transaction via primary RPC                 │    │
│  │  2. Extract preBalance and postBalance               │    │
│  │  3. Calculate solDelta = (post - pre) / 1e9          │    │
│  │  4. Verify against quoted amount                     │    │
│  │  5. If discrepancy > 10%, flag for review            │    │
│  │  6. Optionally verify with secondary RPC             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  STEP 2: Post-Buy Liquidity Revalidation                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  1. quickLiquidityCheck() immediately after buy      │    │
│  │  2. Compare to pre-buy liquidity                     │    │
│  │  3. If liquidity dropped > 50%: ALERT (instant rug)  │    │
│  │  4. If liquidity dropped > 70%: EMERGENCY EXIT       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  STEP 3: Start Real-Time Monitoring                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  1. Add position to liquidity watcher                │    │
│  │  2. Monitor for LP withdrawals                       │    │
│  │  3. Track price and liquidity changes                │    │
│  │  4. Trigger auto-exit if conditions met              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Risk Management System

### 8.1 Token Risk Assessment Engine

**Location:** `src/lib/tokenRiskAssessment.ts`

#### Risk Labels

| Label | Description | Portfolio Impact |
|-------|-------------|------------------|
| `REAL` | Passes all checks | Included in P&L |
| `HIGH_RISK` | Volatile but tradable | Included with warning |
| `SCAM` | Honeypot/rug detected | Excluded from P&L |
| `HONEYPOT` | Can't sell / high tax | Excluded from P&L |
| `FAKE_PROFIT` | Unrealistic gains | Excluded from P&L |
| `MANIPULATED` | Price manipulation | Excluded from P&L |
| `INVALID_DATA` | Missing data | Excluded from P&L |
| `SPOOFED` | Brand impersonation | Excluded from P&L |

#### Detection Rules

**Fake Profit Detection:**
- P&L > 500% within 24 hours
- P&L > 2000% lifetime
- Buy < 0.05 SOL AND Sell > 2 SOL
- Price jumps > 100x between trades
- USD price missing for >50% of trades

**Scam/Honeypot Detection:**
- Average loss ≥ 85%
- Sell price consistently << Buy price
- Only 1 successful SELL after BUY
- Liquidity collapses >90% post-buy

**Brand Spoofing Detection:**
- Protected symbols: SOL, USDC, USDT, ETH, BTC, TRX, BNB
- Suspicious names: politicians, brands, "official"

### 8.2 Pre-Trade Safety Checks

| Check | Source | Block Condition |
|-------|--------|-----------------|
| Sell Simulation | Jupiter/Raydium | Simulation fails |
| Sell Tax | Multi-route comparison | Tax > 50% |
| Liquidity | Raydium Pool | Below threshold |
| Route Availability | Jupiter/Raydium | No routes |
| Risk Score | RugCheck | Score > max |
| Deployer Reputation | Database | Known scammer |
| Holder Entropy | On-chain analysis | Centralized distribution |
| Rug Probability | Multi-factor | Score > 65 |

---

## 9. Circuit Breaker System

**Location:** `src/lib/circuitBreaker.ts`

### 9.1 Overview

The Circuit Breaker is an **automated trading halt system** that protects users from sustained losses. When triggered, ALL trading is paused for a cooldown period and requires manual admin override to resume.

### 9.2 Trigger Conditions

```
┌─────────────────────────────────────────────────────────────┐
│               CIRCUIT BREAKER TRIGGERS                       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  TRIGGER                    │ THRESHOLD              │    │
│  ├─────────────────────────────┼────────────────────────┤    │
│  │  Wallet Drawdown            │ > 20% in 30 minutes    │    │
│  │  Rug Streak                 │ 3 rugs in 10 trades    │    │
│  │  Hidden Tax Detections      │ 2 occurrences          │    │
│  │  Frozen Token Encounters    │ 2 occurrences          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  When ANY trigger fires:                                     │
│  1. Trading immediately HALTED                               │
│  2. Event logged to circuit_breaker_events table             │
│  3. 60-minute auto-lock begins                               │
│  4. User notified via UI                                     │
│  5. Admin override REQUIRED to resume                        │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 Drawdown Calculation

```typescript
// Rolling 30-minute window drawdown check
async function checkDrawdownTrigger(
  userId: string,
  threshold: number,  // 20%
  windowMinutes: number  // 30
): Promise<{ shouldTrigger: boolean; drawdownPercent: number }> {
  
  // Get positions closed in the last 30 minutes
  const recentClosedPositions = await getRecentClosedPositions(userId, windowMinutes);
  
  // Calculate total realized loss
  const totalLoss = recentClosedPositions
    .filter(p => (p.realized_pnl_sol ?? 0) < 0)
    .reduce((sum, p) => sum + Math.abs(p.realized_pnl_sol ?? 0), 0);
  
  // Calculate drawdown as % of initial investment
  const totalInvested = recentClosedPositions
    .reduce((sum, p) => sum + (p.sol_spent ?? 0), 0);
  
  const drawdownPercent = totalInvested > 0 
    ? (totalLoss / totalInvested) * 100 
    : 0;
  
  return {
    shouldTrigger: drawdownPercent >= threshold,
    drawdownPercent
  };
}
```

### 9.4 Counter-Based Triggers

```
┌─────────────────────────────────────────────────────────────┐
│               COUNTER-BASED TRIGGERS                         │
│                                                              │
│  Stored in risk_settings table:                              │
│  - circuit_breaker_rug_count: number                        │
│  - circuit_breaker_tax_count: number                        │
│  - circuit_breaker_freeze_count: number                     │
│                                                              │
│  Incremented by:                                             │
│  - incrementCounter('rug') when rug detected                │
│  - incrementCounter('hidden_tax') when tax > threshold      │
│  - incrementCounter('freeze') when freeze authority found   │
│                                                              │
│  Counter resets:                                             │
│  - After circuit breaker triggers                            │
│  - After 24 hours of no triggers                             │
│  - On admin reset                                            │
└─────────────────────────────────────────────────────────────┘
```

### 9.5 Recovery Flow

```
┌─────────────────────────────────────────────────────────────┐
│               CIRCUIT BREAKER RECOVERY                       │
│                                                              │
│  1. Cooldown Period (60 minutes)                            │
│     - No trades allowed                                      │
│     - UI shows locked status                                 │
│     - Countdown timer displayed                              │
│                                                              │
│  2. After Cooldown:                                          │
│     - Trading still BLOCKED                                  │
│     - Requires admin override                                │
│                                                              │
│  3. Admin Override:                                          │
│     adminResetCircuitBreaker(userId, resetReason)            │
│     - Clears triggered state                                 │
│     - Resets all counters                                    │
│     - Logs reset event with reason                           │
│     - Trading resumes                                        │
│                                                              │
│  4. Self-Recovery (NOT ALLOWED):                             │
│     - circuit_breaker_requires_admin_override = true        │
│     - Users cannot bypass cooldown                           │
└─────────────────────────────────────────────────────────────┘
```

### 9.6 Database Schema

```sql
-- Circuit breaker events table
CREATE TABLE circuit_breaker_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trigger_type TEXT NOT NULL,  -- 'drawdown', 'rug_streak', 'hidden_tax', 'frozen_token'
  triggered_at TIMESTAMPTZ DEFAULT now(),
  cooldown_expires_at TIMESTAMPTZ NOT NULL,
  trigger_details JSONB,
  reset_at TIMESTAMPTZ,
  reset_by UUID,
  reset_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Added columns to risk_settings
ALTER TABLE risk_settings ADD COLUMN circuit_breaker_rug_count INTEGER DEFAULT 0;
ALTER TABLE risk_settings ADD COLUMN circuit_breaker_tax_count INTEGER DEFAULT 0;
ALTER TABLE risk_settings ADD COLUMN circuit_breaker_freeze_count INTEGER DEFAULT 0;
ALTER TABLE risk_settings ADD COLUMN circuit_breaker_drawdown_threshold NUMERIC DEFAULT 20;
ALTER TABLE risk_settings ADD COLUMN circuit_breaker_drawdown_window_minutes INTEGER DEFAULT 30;
ALTER TABLE risk_settings ADD COLUMN circuit_breaker_requires_admin_override BOOLEAN DEFAULT true;
```

---

## 10. Transaction Integrity System

### 10.1 Overview

The Transaction Integrity System ensures all P&L calculations are derived from **on-chain SOL delta** as the single source of truth. This prevents fake profits, data corruption, and reconciliation issues.

**Key Principle:** Never calculate P&L from price math. Always use actual SOL spent/received.

### 10.2 Semantic Column Schema

The `trade_history` table uses semantic columns to distinguish BUY from SELL flows:

| Column | BUY Meaning | SELL Meaning |
|--------|-------------|--------------|
| `sol_spent` | Actual SOL deducted | Always 0 |
| `sol_received` | Always 0 | Actual SOL credited |
| `token_amount` | Tokens received | Tokens sold |
| `realized_pnl_sol` | NULL (never show) | solReceived - matchedBuySolSpent |
| `roi_percent` | NULL (never show) | (pnl / solSpent) * 100 |
| `matched_buy_tx_hash` | NULL | TX hash of matched BUY |

### 10.3 Dual-RPC SOL Delta Extraction

**Location:** `src/lib/solDeltaParser.ts`

```
┌─────────────────────────────────────────────────────────────┐
│               DUAL-RPC DELTA VALIDATION                      │
│                                                              │
│  Step 1: Primary RPC Extraction                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  const tx = await connection.getTransaction(sig);    │    │
│  │  const preBalance = tx.meta.preBalances[0];          │    │
│  │  const postBalance = tx.meta.postBalances[0];        │    │
│  │  const solDelta = (postBalance - preBalance) / 1e9;  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Step 2: Cross-Validation (Optional)                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Verify with secondary RPC if discrepancy detected   │    │
│  │  Flag for manual review if RPCs disagree             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Step 3: Block P&L Calculation                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  shouldBlockPnlCalculation() returns true if:        │    │
│  │  - Delta extraction failed                           │    │
│  │  - RPC discrepancy detected                          │    │
│  │  - Transaction not confirmed                         │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 10.4 Transaction Flow (Post-Confirmation)

```
┌─────────────────────────────────────────────────────────────┐
│             TRANSACTION CONFIRMATION FLOW                    │
│                                                              │
│  1. Execute Transaction (sign & submit)                      │
│                    │                                         │
│                    ▼                                         │
│  2. Poll for Confirmation (getSignatureStatuses)             │
│                    │                                         │
│                    ▼                                         │
│  3. Fetch On-Chain SOL Delta                                 │
│     - getTransaction(signature)                              │
│     - solDelta = (postBalance - preBalance) / 1e9            │
│                    │                                         │
│                    ▼                                         │
│  4. Log to trade_history with Semantic Columns               │
│     ┌──────────────────────────────────────────┐            │
│     │  BUY Transaction:                         │            │
│     │    sol_spent = abs(solDelta)              │            │
│     │    sol_received = 0                       │            │
│     │    realized_pnl_sol = NULL                │            │
│     │    roi_percent = NULL                     │            │
│     └──────────────────────────────────────────┘            │
│     ┌──────────────────────────────────────────┐            │
│     │  SELL Transaction:                        │            │
│     │    sol_spent = 0                          │            │
│     │    sol_received = max(0, solDelta)        │            │
│     │    FIFO match → find earliest BUY         │            │
│     │    realized_pnl_sol = received - spent    │            │
│     │    roi_percent = (pnl / spent) * 100      │            │
│     └──────────────────────────────────────────┘            │
│                    │                                         │
│                    ▼                                         │
│  5. Update Position Status                                   │
│     - BUY: status = 'open'                                   │
│     - SELL: status = 'closed', exit_tx_id = signature        │
└─────────────────────────────────────────────────────────────┘
```

### 10.5 P&L Calculation Rules

**Location:** `src/lib/transactionIntegrity.ts`

```typescript
// FIFO-Based P&L Calculation
function calculateRealizedPnl(
  solReceived: number,
  matchedBuySolSpent: number
): { pnlSol: number; roiPercent: number } {
  if (matchedBuySolSpent <= 0) return { pnlSol: 0, roiPercent: 0 };
  
  const pnlSol = solReceived - matchedBuySolSpent;
  const roiPercent = (pnlSol / matchedBuySolSpent) * 100;
  return { pnlSol, roiPercent };
}
```

**Critical Rules:**
1. **Realized P&L Only**: Only calculate when BOTH BUY and SELL confirmed
2. **FIFO Matching**: First BUY matches first SELL for same token
3. **Never Price-Based**: P&L = SOL received - SOL spent (not price × amount)
4. **No ROI for BUY**: ROI column is always NULL for BUY transactions
5. **Impossible ROI Filter**: Flag ROI > 500% with solReceived < 0.1 SOL

### 10.6 Data Integrity Guards

**Runtime Validation:**

| Guard | Trigger | Action |
|-------|---------|--------|
| No SELL without BUY | SELL for token with no BUY | Block logging |
| No ROI without solReceived | SELL with solReceived = 0 | Mark corrupted |
| No logging before confirm | TX not confirmed | Reject insert |
| Negative balance prevention | Calculated balance < 0 | Flag for audit |
| P&L display for unrealized | Position still open | Hide ROI column |

### 10.7 Transaction Audit System

**Edge Function:** `transaction-audit`

**5-Phase Audit Process:**

| Phase | Action | Output |
|-------|--------|--------|
| 1. Verify Signatures | Re-fetch TX status via RPC | Confirmed/Failed status |
| 2. Recalculate P&L | FIFO match BUY/SELL pairs | Corrected pnl/roi values |
| 3. Reconcile Wallet | Compare ledger vs RPC balance | Mismatch detection |
| 4. Validate Routes | Check historical route availability | Route audit results |
| 5. Detect Scams | Flag honeypots, liquidity rugs | Risk labels |

---

## 11. Data Flow

### 11.1 Token Discovery Pipeline

```
Stage 1: Broad Discovery (Low Filter)
─────────────────────────────────────
DexScreener/GeckoTerminal
    │
    ▼
Capture ALL new pools (minLiquidity: $1)
    │
    ▼
Store in token_processing_states
State: NEW or PENDING
    │
    ▼
Register with TokenStateManager

Stage 2: Tradability Filter (Strict)
─────────────────────────────────────
token_processing_states (NEW/PENDING)
    │
    ▼
Check: Liquidity ≥ user threshold
Check: Jupiter/Raydium route available
Check: Safety validation (RugCheck)
Check: Not honeypot/scam
    │
    ▼
If PASS: State → TRADEABLE
If FAIL: State → REJECTED with reason
```

### 11.2 Trade Execution Flow

```
ApprovedToken (from AutoSniper)
    │
    ▼
LiveTradingOrchestrator.submitTrade()
    │
    ├─► Validate Prerequisites
    │   - Wallet connected?
    │   - Balance sufficient?
    │   - Settings loaded?
    │   - Circuit breaker not triggered?
    │
    ├─► Pre-Execution Gate (11 checks)
    │   - Deployer reputation
    │   - LP verification
    │   - Liquidity stability
    │   - Sell simulation
    │   - Tax check
    │   - Rug probability
    │   - Holder entropy
    │   - Buyer position
    │   - Price sanity
    │   - Symbol spoofing
    │   - Freeze authority
    │
    ├─► Check Deduplication
    │   - Already executed?
    │   - Active position exists?
    │   - Persistent state: TRADED?
    │
    └─► Execute Trade
        │
        ├─► TradingEngine.snipeToken()
        │   │
        │   ├─► Stage 1: Liquidity Detection
        │   ├─► Stage 2: Raydium Snipe
        │   └─► Stage 3: Jupiter Ready
        │
        ├─► Post-Buy Validation
        │   │
        │   ├─► Dual-RPC Delta Validation
        │   └─► Liquidity Revalidation
        │
        └─► Persist Position & History
            │
            ├─► createPosition()
            ├─► confirm-transaction edge function
            │   └─► Fetch on-chain SOL delta
            │   └─► Log trade_history with semantic columns
            │   └─► Calculate P&L for SELL (FIFO)
            ├─► Update token_processing_states → TRADED
            └─► Start real-time liquidity monitoring
```

### 11.3 Metadata Propagation Flow

```
Discovery Time Capture:
┌─────────────────────────────────────────────────────────────┐
│  Token Scanner detects new token with metadata:              │
│    - buyer_position (from holder count)                      │
│    - liquidity (from pool data)                              │
│    - risk_score (from risk checks)                           │
│    - deployer_reputation                                     │
│    - rug_probability                                         │
│                           │                                  │
│                           ▼                                  │
│  Store in token_processing_states:                           │
│    - buyer_position_at_discovery                             │
│    - liquidity_at_discovery                                  │
│    - risk_score_at_discovery                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
Execution Time Propagation:
┌─────────────────────────────────────────────────────────────┐
│  TradingEngine receives tokenMetadata:                       │
│    { buyerPosition, liquidity, riskScore, slippage }         │
│                           │                                  │
│                           ▼                                  │
│  confirm-transaction receives body:                          │
│    { buyerPosition, liquidity, riskScore, slippage }         │
│                           │                                  │
│                           ▼                                  │
│  Logged to trade_history:                                    │
│    buyer_position, liquidity, risk_score, slippage           │
└─────────────────────────────────────────────────────────────┘
```

---

## 12. Database Schema

### 12.1 Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `positions` | Active and closed positions | token_address, entry_price, amount, status |
| `trade_history` | Transaction ledger with semantic SOL columns | sol_spent, sol_received, realized_pnl_sol, roi_percent |
| `trade_signals` | Pending trade signals | token_address, status, expires_at |
| `token_processing_states` | Discovery pipeline state | token_address, state, rejection_reason |
| `risk_check_logs` | Safety check results | token_address, is_honeypot, risk_score |
| `circuit_breaker_events` | Trading halt events | trigger_type, cooldown_expires_at, reset_at |
| `deployer_reputation` | Deployer wallet history | rug_ratio, reputation_score, cluster_id |

### 12.2 trade_history Schema (v2)

```sql
CREATE TABLE trade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_address TEXT NOT NULL,
  token_symbol TEXT,
  token_name TEXT,
  trade_type TEXT NOT NULL,  -- 'buy' or 'sell'
  amount NUMERIC NOT NULL,
  
  -- Semantic SOL columns (source of truth)
  sol_spent NUMERIC DEFAULT 0,        -- BUY: actual SOL deducted
  sol_received NUMERIC DEFAULT 0,     -- SELL: actual SOL credited
  token_amount NUMERIC,
  
  -- P&L (calculated from SOL delta, not prices)
  realized_pnl_sol NUMERIC,           -- SELL only: received - spent
  roi_percent NUMERIC,                -- SELL only: (pnl/spent) * 100
  matched_buy_tx_hash TEXT,           -- FIFO matching reference
  
  -- Execution metadata (captured at trade time)
  buyer_position INTEGER,             -- Position in buyer queue
  liquidity NUMERIC,                  -- Pool liquidity at execution
  risk_score INTEGER,                 -- Risk score at execution
  slippage NUMERIC,                   -- Actual slippage %
  entry_price NUMERIC,                -- USD price at entry
  exit_price NUMERIC,                 -- USD price at exit
  
  -- Legacy compatibility
  price_sol NUMERIC,
  price_usd NUMERIC,
  
  -- Integrity tracking
  data_source TEXT DEFAULT 'on_chain', -- 'on_chain' or 'provided'
  is_corrupted BOOLEAN DEFAULT false,
  corruption_reason TEXT,
  sol_balance_after NUMERIC,          -- Running balance
  
  -- Standard fields
  status TEXT DEFAULT 'pending',
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 12.3 User Configuration Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profile data |
| `user_sniper_settings` | Trading preferences (amount, TP/SL, filters) |
| `sniper_settings` | Legacy settings |
| `risk_settings` | Risk thresholds, circuit breaker |

### 12.4 Admin Tables

| Table | Purpose |
|-------|---------|
| `admin_settings` | System-wide configuration |
| `api_configurations` | External API endpoints |
| `api_health_metrics` | API status monitoring |
| `user_roles` | Admin/user role assignment |
| `system_logs` | System event logging |

---

## 13. Security Architecture

### 13.1 Authentication

- **Provider**: Lovable Cloud Auth (Supabase Auth)
- **Methods**: Email/Password
- **Sessions**: JWT-based with refresh tokens
- **MFA**: Optional 2FA support

### 13.2 Row Level Security (RLS)

All tables enforce RLS policies:

```sql
-- Users can only access their own data
CREATE POLICY "Users can manage their own positions"
ON positions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins have elevated access
CREATE POLICY "Admins can view all positions"
ON positions FOR SELECT
USING (has_role(auth.uid(), 'admin'));
```

### 13.3 Wallet Security

- No private keys stored on server
- Transaction signing happens client-side only
- Wallet connection via standard Solana adapters

### 13.4 API Security

- Edge functions require authenticated requests
- Rate limiting on external API calls
- Encrypted API key storage

---

## 14. External Integrations

### 14.1 Data Providers

| Provider | Endpoints Used | Rate Limit |
|----------|----------------|------------|
| DexScreener | /latest/dex/tokens, /latest/dex/search | ~300/min |
| GeckoTerminal | /networks/solana/new_pools | ~30/min |
| Jupiter | /quote, /price, /tokens | ~600/min |
| Raydium | /pools/info/mint, /compute/swap-base-in | ~100/min |

### 14.2 Blockchain Interaction

| Service | Purpose |
|---------|---------|
| Solana RPC | Transaction submission, balance queries, SOL delta extraction |
| Helius RPC | Enhanced RPC with historical data |
| Jupiter Aggregator | DEX route aggregation |
| Raydium SDK | Direct AMM interaction |

### 14.3 Price Feed Aggregation

**Edge Function:** `sol-price`

```
┌─────────────────────────────────────────────────────────────┐
│               SOL PRICE AGGREGATION                          │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ CoinGecko│  │ Jupiter  │  │ Binance  │                  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                  │
│       │             │             │                         │
│       └─────────────┼─────────────┘                         │
│                     │                                        │
│                     ▼                                        │
│             First successful response wins                   │
│                     │                                        │
│                     ▼                                        │
│               Cached (60s TTL)                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 15. Deployment Architecture

### 15.1 Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                    LOVABLE PLATFORM                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Frontend (Vite + React)                 │   │
│  │              CDN: Lovable Edge Network               │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Lovable Cloud (Supabase)                │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐              │   │
│  │  │ Edge    │  │ Postgres│  │  Auth   │              │   │
│  │  │Functions│  │   DB    │  │ Service │              │   │
│  │  └─────────┘  └─────────┘  └─────────┘              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Solana   │  │ Jupiter  │  │ Raydium  │  │DexScreener│   │
│  │   RPC    │  │   API    │  │   API    │  │    API    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 15.2 Environment Configuration

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Lovable Cloud API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public API key |
| `SOLANA_RPC_URL` | Primary Solana RPC endpoint |
| `HELIUS_API_KEY` | Enhanced RPC (optional) |

---

## Appendix A: File Quick Reference

### Core Trading Files

| File | Purpose |
|------|---------|
| `src/lib/trading-engine/controller.ts` | Main trading orchestrator |
| `src/lib/trading-engine/liquidity-detector.ts` | Stage 1: Raydium pool detection |
| `src/lib/trading-engine/raydium-sniper.ts` | Stage 2: Direct AMM execution |
| `src/lib/trading-engine/jupiter-trader.ts` | Stage 3: Jupiter aggregation |
| `src/lib/trading-engine/rpc-pool-validator.ts` | RPC-based pool validation |
| `src/lib/preExecutionGate.ts` | Pre-trade safety validation (11 rules) |
| `src/lib/transactionIntegrity.ts` | P&L validation & guards |

### Safety Module Files

| File | Purpose |
|------|---------|
| `src/lib/deployerReputation.ts` | Deployer history & rug detection |
| `src/lib/lpVerification.ts` | LP burn verification |
| `src/lib/liquidityMonitor.ts` | Liquidity stability & real-time watch |
| `src/lib/sellTaxDetector.ts` | Hidden sell tax detection |
| `src/lib/rugProbability.ts` | Multi-factor rug probability |
| `src/lib/holderEntropy.ts` | Holder distribution analysis |
| `src/lib/solDeltaParser.ts` | Dual-RPC SOL delta extraction |
| `src/lib/circuitBreaker.ts` | Trading halt system |

### Key Hooks

| File | Purpose |
|------|---------|
| `src/hooks/useTradingEngine.ts` | Trade execution with metadata |
| `src/hooks/useLiveTradingOrchestrator.ts` | Central trade coordination + post-validation |
| `src/hooks/useAutoExit.ts` | Automated TP/SL execution |
| `src/hooks/useLiquidityWatcher.ts` | Real-time liquidity monitoring |
| `src/hooks/useLiquidityRetryWorker.ts` | Retry for waiting tokens |
| `src/hooks/useTransactionAudit.ts` | Integrity audit interface |
| `src/hooks/useRiskCompliance.ts` | Circuit breaker & risk settings |

### Edge Functions

| Function | Purpose |
|----------|---------|
| `confirm-transaction` | On-chain verification + semantic logging |
| `transaction-audit` | 5-phase integrity audit |
| `trade-execution` | Jupiter/Raydium trade execution |
| `token-scanner` | Multi-source token discovery |
| `risk-check` | Safety validations + circuit breaker |
| `fix-token-metadata` | Corrupted data repair |

---

## Appendix B: Changelog

### Version 3.0.0 (February 2025)

**Complete Trading Pipeline (11 Stages):**
- Discovery → Hard Filters → Deployer Reputation → LP Verification → Liquidity Stability → Sell Simulation → Tax Check → Rug Probability → BUY → Dual-RPC Delta Validation → Post-Buy Liquidity Revalidation → Real-Time Monitoring

**Safety Modules:**
- Added `deployerReputation.ts` for historical rug detection
- Added `lpVerification.ts` for LP burn verification
- Added `liquidityMonitor.ts` for real-time liquidity tracking
- Added `sellTaxDetector.ts` for hidden tax detection
- Added `rugProbability.ts` for multi-factor rug scoring
- Added `holderEntropy.ts` for distribution analysis (Shannon entropy)
- Added `solDeltaParser.ts` for dual-RPC delta extraction

**Circuit Breaker System:**
- 20% wallet drawdown in 30 minutes triggers halt
- 3 rugs in 10 trades triggers halt
- 2 hidden tax detections triggers halt
- 2 frozen token encounters triggers halt
- 60-minute auto-lock with mandatory admin override
- Full event logging to `circuit_breaker_events` table

**Post-Buy Validation:**
- Dual-RPC SOL delta validation after every trade
- Immediate liquidity recheck to catch instant rugs
- Automatic monitoring start for open positions

### Version 2.0.0 (February 2025)

**Transaction Integrity System:**
- Added semantic columns: `sol_spent`, `sol_received`, `realized_pnl_sol`, `roi_percent`
- Implemented FIFO matching for P&L calculations
- Added on-chain SOL delta extraction via RPC
- Created `transactionIntegrity.ts` for validation guards
- Added 5-phase `transaction-audit` edge function

**Metadata Propagation:**
- Capture `buyer_position`, `liquidity`, `risk_score`, `slippage` at execution
- Pass metadata through full trade lifecycle
- Store in `trade_history` for historical analysis

**UI Updates:**
- Renamed columns: "SOL In/Out" → "SOL Spent/Received"
- Added Buyer#, Liquidity, Risk, Slippage columns
- ROI% only shown for SELL transactions

### Version 1.0.0 (January 2025)

- Initial release with 3-stage trading engine
- Pre-execution gate safety system
- Token discovery pipeline
- Risk assessment engine
