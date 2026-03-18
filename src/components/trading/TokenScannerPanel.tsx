import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScannedToken } from "@/hooks/useTokenScanner";
import {
  Search,
  Filter,
  Pause,
  Play,
  ExternalLink,
  Shield,
  ShieldCheck,
  ShieldX,
  Lock,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Zap,
  CheckCircle2,
  XCircle,
  LayoutGrid,
  List,
} from "lucide-react";
import { formatPreciseUsd } from "@/lib/precision";
import TokenImage from "@/components/ui/TokenImage";

interface TokenScannerPanelProps {
  tokens: ScannedToken[];
  loading: boolean;
  onScan: () => void;
  scanSpeed: "slow" | "normal" | "fast";
  onSpeedChange: (speed: "slow" | "normal" | "fast") => void;
  isPaused: boolean;
  onPauseToggle: () => void;
}

const formatLiquidity = (value: number) => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 100_000) return `$${(value / 1_000).toFixed(0)}K`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return formatPreciseUsd(value);
};

const formatAge = (createdAt: string) => {
  if (!createdAt) return "—";
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
};

const getDexBadge = (source?: string) => {
  const dex = source?.toLowerCase() || "raydium";
  if (dex.includes("jupiter"))
    return { name: "Jupiter", cls: "bg-success/15 text-success border-success/30" };
  if (dex.includes("raydium"))
    return { name: "Raydium", cls: "bg-purple-500/15 text-purple-400 border-purple-500/30" };
  if (dex.includes("orca"))
    return { name: "Orca", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
  return { name: "DEX", cls: "bg-muted/60 text-muted-foreground border-border" };
};

/* ────────── Grid Card ────────── */
const TokenGridCard = ({ token }: { token: ScannedToken }) => {
  const isPositive = token.priceChange24h >= 0;
  const dex = getDexBadge(token.source);

  const statRows: { label: string; valueA: string; labelB: string; valueB: string }[] = [
    {
      label: "MCAP",
      valueA: formatLiquidity(token.marketCap),
      labelB: "LIQUIDITY",
      valueB: formatLiquidity(token.liquidity),
    },
    {
      label: "VOLUME",
      valueA: formatLiquidity(token.volume24h),
      labelB: "AGE",
      valueB: formatAge(token.createdAt),
    },
    {
      label: "HOLDERS",
      valueA: token.holders > 0 ? token.holders.toLocaleString() : "—",
      labelB: "RISK",
      valueB: `${token.riskScore} / 100`,
    },
  ];

  const canBuy = token.canBuy ?? token.riskScore < 60;
  const canSell = token.canSell ?? token.riskScore < 70;

  return (
    <div className="group relative rounded-xl border border-border/40 bg-card overflow-hidden hover:border-primary/40 hover:shadow-[0_0_18px_hsl(var(--primary)/0.18)] transition-all duration-200 cursor-pointer flex flex-col">
      {/* Top accent line */}
      <div
        className={`h-[2px] w-full ${isPositive ? "bg-gradient-to-r from-success/70 via-success to-success/30" : "bg-gradient-to-r from-destructive/70 via-destructive to-destructive/30"}`}
      />

      {/* Token header */}
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
        <TokenImage
          symbol={token.symbol}
          address={token.address}
          imageUrl={(token as any).imageUrl}
          size="lg"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-foreground text-sm truncate leading-tight">
              {token.name.length > 10 ? token.name.slice(0, 10) + "…" : token.name}
            </span>
            <span className="text-muted-foreground text-[10px] font-medium">
              {token.symbol}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
            <span className="font-mono">
              {token.address.slice(0, 4)}…{token.address.slice(-4)}
            </span>
            <ExternalLink
              className="w-2.5 h-2.5 opacity-60 hover:opacity-100 hover:text-primary shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`https://solscan.io/token/${token.address}`, "_blank");
              }}
            />
          </div>
        </div>
      </div>

      {/* Price change hero */}
      <div className="px-3 pb-2">
        <div
          className={`flex items-baseline gap-1.5 ${isPositive ? "text-success" : "text-destructive"}`}
        >
          <span className="text-2xl font-black tabular-nums leading-none">
            {isPositive ? "+" : ""}
            {token.priceChange24h.toFixed(1)}%
          </span>
          <span className="text-[10px] text-muted-foreground font-medium">(24h)</span>
          {isPositive ? (
            <TrendingUp className="w-4 h-4 ml-auto" />
          ) : (
            <TrendingDown className="w-4 h-4 ml-auto" />
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-border/30" />

      {/* Stats grid */}
      <div className="px-3 py-2 flex-1 space-y-1.5">
        {statRows.map(({ label, valueA, labelB, valueB }) => (
          <div key={label} className="flex items-center">
            <div className="flex-1 flex items-center justify-between pr-3 border-r border-border/25">
              <span className="text-[9px] font-semibold text-muted-foreground tracking-widest uppercase">
                {label}
              </span>
              <span
                className={`text-[11px] font-bold tabular-nums ${
                  label === "RISK"
                    ? token.riskScore < 40
                      ? "text-success"
                      : token.riskScore < 70
                      ? "text-warning"
                      : "text-destructive"
                    : "text-foreground"
                }`}
              >
                {valueA}
              </span>
            </div>
            <div className="flex-1 flex items-center justify-between pl-3">
              <span className="text-[9px] font-semibold text-muted-foreground tracking-widest uppercase">
                {labelB}
              </span>
              <span
                className={`text-[11px] font-bold tabular-nums ${
                  labelB === "RISK"
                    ? token.riskScore < 40
                      ? "text-success"
                      : token.riskScore < 70
                      ? "text-warning"
                      : "text-destructive"
                    : "text-foreground"
                }`}
              >
                {valueB}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-border/30" />

      {/* Footer: BUY/SELL + SOURCE */}
      <div className="flex items-center px-3 py-2 gap-3">
        {/* BUY/SELL */}
        <div className="flex items-center gap-1.5 text-[10px] font-semibold">
          <span className="text-muted-foreground tracking-widest uppercase text-[9px]">
            BUY/SELL
          </span>
          {canBuy ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
          ) : (
            <XCircle className="w-3.5 h-3.5 text-destructive" />
          )}
          <span className="text-muted-foreground">/</span>
          {canSell ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
          ) : (
            <XCircle className="w-3.5 h-3.5 text-destructive" />
          )}
        </div>

        <div className="flex-1" />

        {/* SOURCE */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-muted-foreground tracking-widest uppercase font-semibold">
            SOURCE
          </span>
          <span className="text-[10px] text-foreground font-semibold">{dex.name}</span>
          <Badge
            variant="outline"
            className={`text-[9px] px-1 py-0 h-4 border ${dex.cls}`}
          >
            DEX
          </Badge>
        </div>
      </div>

      {/* Safety micro-icons overlay */}
      <div className="absolute top-2.5 right-2.5 flex gap-1">
        {token.riskScore < 50 ? (
          <ShieldCheck className="w-3 h-3 text-success opacity-80" />
        ) : (
          <ShieldX className="w-3 h-3 text-destructive opacity-80" />
        )}
        {token.liquidityLocked && (
          <Lock className="w-3 h-3 text-success opacity-80" />
        )}
        {token.riskScore < 40 && (
          <Zap className="w-3 h-3 text-primary opacity-80" />
        )}
      </div>
    </div>
  );
};

/* ────────── List Row (compact fallback) ────────── */
const TokenListRow = ({ token }: { token: ScannedToken }) => {
  const isPositive = token.priceChange24h >= 0;
  const dex = getDexBadge(token.source);
  const canBuy = token.canBuy ?? token.riskScore < 60;
  const canSell = token.canSell ?? token.riskScore < 70;

  return (
    <div className="flex items-center gap-2 md:gap-3 px-3 py-2.5 border-b border-border/25 last:border-0 hover:bg-secondary/30 transition-colors">
      <TokenImage
        symbol={token.symbol}
        address={token.address}
        imageUrl={(token as any).imageUrl}
        size="md"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="font-semibold text-xs text-foreground truncate">
            {token.name.slice(0, 12)}
          </span>
          <span className="text-muted-foreground text-[10px]">{token.symbol}</span>
          <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 ${dex.cls}`}>
            {dex.name}
          </Badge>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          {token.address.slice(0, 4)}…{token.address.slice(-4)}
        </span>
      </div>

      {/* Holders */}
      <div className="hidden md:block text-right min-w-[54px]">
        <div className="text-[9px] text-muted-foreground uppercase tracking-widest">Holders</div>
        <div className="text-xs font-bold tabular-nums text-foreground">
          {token.holders > 0 ? token.holders.toLocaleString() : "—"}
        </div>
      </div>

      {/* Risk */}
      <div className="hidden sm:block text-right min-w-[48px]">
        <div className="text-[9px] text-muted-foreground uppercase tracking-widest">Risk</div>
        <div
          className={`text-xs font-bold tabular-nums ${
            token.riskScore < 40
              ? "text-success"
              : token.riskScore < 70
              ? "text-warning"
              : "text-destructive"
          }`}
        >
          {token.riskScore}/100
        </div>
      </div>

      {/* Buy/Sell */}
      <div className="flex items-center gap-0.5">
        {canBuy ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-destructive" />
        )}
        <span className="text-muted-foreground text-[10px]">/</span>
        {canSell ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-destructive" />
        )}
      </div>

      {/* Price change */}
      <div
        className={`flex items-center gap-0.5 font-bold text-xs min-w-[58px] justify-end ${
          isPositive ? "text-success" : "text-destructive"
        }`}
      >
        {isPositive ? (
          <TrendingUp className="w-3 h-3" />
        ) : (
          <TrendingDown className="w-3 h-3" />
        )}
        <span className="tabular-nums">
          {isPositive ? "+" : ""}
          {token.priceChange24h.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

/* ────────── Main Panel ────────── */
export default function TokenScannerPanel({
  tokens,
  loading,
  onScan,
  scanSpeed,
  onSpeedChange,
  isPaused,
  onPauseToggle,
}: TokenScannerPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filteredTokens = tokens.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden h-full flex flex-col">
      {/* ── Header ── */}
      <div className="p-3 md:p-4 border-b border-border/50">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shrink-0">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-foreground text-sm md:text-base truncate">
                Token Scanner
              </h2>
              <p className="text-[10px] text-muted-foreground truncate">
                Real-time DEX monitoring
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Speed switcher */}
            <div className="hidden sm:flex bg-secondary/60 rounded-lg p-0.5">
              {(["slow", "normal", "fast"] as const).map((speed) => (
                <button
                  key={speed}
                  onClick={() => onSpeedChange(speed)}
                  className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${
                    scanSpeed === speed
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {speed.charAt(0).toUpperCase() + speed.slice(1)}
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div className="flex bg-secondary/60 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1 rounded-md transition-all ${
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1 rounded-md transition-all ${
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="List view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            <Button
              variant={isPaused ? "default" : "outline"}
              size="sm"
              onClick={onPauseToggle}
              className={`h-8 text-xs px-2 ${
                isPaused ? "bg-warning hover:bg-warning/90 text-warning-foreground" : ""
              }`}
            >
              {isPaused ? (
                <Play className="w-3.5 h-3.5 md:mr-1.5" />
              ) : (
                <Pause className="w-3.5 h-3.5 md:mr-1.5" />
              )}
              <span className="hidden md:inline">{isPaused ? "Resume" : "Pause"}</span>
            </Button>
          </div>
        </div>

        {/* Status row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${
                loading
                  ? "bg-success animate-pulse"
                  : isPaused
                  ? "bg-warning"
                  : "bg-success"
              }`}
            />
            <span className="text-muted-foreground font-medium text-xs">
              {loading ? "Scanning…" : isPaused ? "Paused" : "Active"}
            </span>
          </div>
          <span className="text-foreground font-semibold text-xs tabular-nums">
            {tokens.length} tokens
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-[2px] bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              loading ? "bg-primary animate-pulse" : "bg-success"
            }`}
            style={{ width: loading ? "60%" : "100%" }}
          />
        </div>
      </div>

      {/* ── Search ── */}
      <div className="p-2 border-b border-border/30">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search tokens, addresses…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 bg-secondary/40 border-border/30 h-8 text-xs"
          />
        </div>
      </div>

      {/* ── Token List / Grid ── */}
      <div className="flex-1 overflow-y-auto">
        {loading && tokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-7 h-7 animate-spin text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Scanning for new tokens…</p>
          </div>
        ) : filteredTokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Shield className="w-10 h-10 mb-2 opacity-25" />
            <p className="font-medium text-sm mb-1">No tokens found</p>
            <p className="text-xs mb-3">Try adjusting your filters</p>
            <Button variant="outline" size="sm" onClick={onScan} className="h-8 text-xs">
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
              Scan Now
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {filteredTokens.map((token) => (
              <TokenGridCard key={token.id} token={token} />
            ))}
          </div>
        ) : (
          <div>
            {filteredTokens.map((token) => (
              <TokenListRow key={token.id} token={token} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
