/**
 * Risk Transparency Panel
 *
 * Displays the full probabilistic risk breakdown for a token evaluation:
 * composite score, confidence score, category breakdown, trade class.
 */

import { Shield, Droplets, UserX, Activity, TrendingUp, CheckCircle, XCircle, Info, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  type ProbabilisticDecision,
  type CategoryBreakdown,
  tradeClassLabel,
  tradeClassColor,
  riskScoreColor,
  riskScoreLabel,
} from "@/lib/probabilisticScoring";
import { Badge } from "@/components/ui/badge";

interface RiskTransparencyPanelProps {
  decision: ProbabilisticDecision;
  tokenSymbol: string;
  compact?: boolean;
}

const CATEGORY_META: Record<keyof CategoryBreakdown, { label: string; icon: React.ElementType; tooltip: string }> = {
  structural_safety: { label: 'Structural Safety', icon: Shield, tooltip: 'Freeze authority, sell route, LP integrity, hidden tax — 35% weight' },
  liquidity_health:  { label: 'Liquidity Health',  icon: Droplets, tooltip: 'Min liquidity, stability, quote depth, capital preservation — 20% weight' },
  deployer_risk:     { label: 'Deployer Risk',     icon: UserX, tooltip: 'Deployer reputation, behavior, rug probability — 15% weight' },
  market_authenticity: { label: 'Market Auth',     icon: Activity, tooltip: 'Holder entropy, volume authenticity, buyer & wallet clusters — 15% weight' },
  market_positioning:  { label: 'Positioning',     icon: TrendingUp, tooltip: 'Buyer position, price sanity, liquidity aging, double-quote — 15% weight' },
};

function CategoryBar({ cat, data }: { cat: keyof CategoryBreakdown; data: { score: number; weight: number } }) {
  const meta = CATEGORY_META[cat];
  const Icon = meta.icon;
  const color = data.score >= 75 ? 'bg-success' : data.score >= 60 ? 'bg-warning' : data.score >= 50 ? 'bg-yellow-400' : 'bg-destructive';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="space-y-1 cursor-help">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Icon className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">{meta.label}</span>
              </div>
              <span className={`text-[10px] font-bold tabular-nums ${riskScoreColor(data.score)}`}>{data.score}</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${color}`}
                style={{ width: `${data.score}%` }}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="text-xs max-w-[200px]">
          {meta.tooltip}<br />
          Weight: {Math.round(data.weight * 100)}% | Score: {data.score}/100
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function RiskTransparencyPanel({ decision, tokenSymbol, compact = false }: RiskTransparencyPanelProps) {
  const scoreColor = riskScoreColor(decision.compositeScore);
  const classColor = tradeClassColor(decision.tradeClass);

  return (
    <div className="rounded-xl border border-border/20 overflow-hidden" style={{ background: 'linear-gradient(180deg, hsl(220 18% 9%), hsl(220 18% 7%))' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/15 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent" />
          <span className="text-xs font-bold uppercase tracking-widest text-foreground">Risk Analysis</span>
          <span className="text-xs text-muted-foreground">{tokenSymbol}</span>
        </div>
        {decision.killSwitchTriggered && (
          <Badge variant="destructive" className="text-[10px] h-5">BLOCKED</Badge>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Score row */}
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-3xl font-bold tabular-nums ${scoreColor}`}>{decision.compositeScore}</div>
            <div className="text-xs text-muted-foreground">{riskScoreLabel(decision.compositeScore)} — {Math.round(decision.positionMultiplier * 100)}% size</div>
          </div>
          <div className="text-right">
            <div className={`text-sm font-bold ${classColor}`}>{tradeClassLabel(decision.tradeClass)}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Confidence: <span className={decision.confidence.score >= 80 ? 'text-success' : decision.confidence.score >= 65 ? 'text-warning' : 'text-destructive'}>{decision.confidence.score}%</span>
            </div>
          </div>
        </div>

        {/* Kill switch alert */}
        {decision.killSwitchTriggered && decision.killSwitchReason && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
            <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
            <span className="text-[11px] text-destructive font-medium">{decision.killSwitchReason.replace(/_/g, ' ')}</span>
          </div>
        )}

        {/* Rug adjusted warning */}
        {decision.rugThresholdAdjusted && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-warning/10 border border-warning/20">
            <Info className="w-3.5 h-3.5 text-warning flex-shrink-0" />
            <span className="text-[11px] text-warning">Rug probability 55–69% — position reduced to {Math.round(decision.positionMultiplier * 100)}%</span>
          </div>
        )}

        {/* Age adaptive notice */}
        {decision.ageAdaptive.relaxHolderEntropy && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Zap className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="text-[11px] text-primary">New token (&lt;2min) — behavioral checks relaxed, structural rules active</span>
          </div>
        )}

        {/* Category breakdown */}
        {!compact && (
          <div className="space-y-2.5">
            {(Object.keys(CATEGORY_META) as Array<keyof CategoryBreakdown>).map(cat => (
              <CategoryBar
                key={cat}
                cat={cat}
                data={{ score: decision.categoryBreakdown[cat]?.score ?? 100, weight: decision.categoryBreakdown[cat]?.weight ?? 0 }}
              />
            ))}
          </div>
        )}

        {/* Confidence details */}
        {decision.confidence.missingRules.length > 0 && (
          <div className="p-2 rounded-lg bg-secondary/20 border border-border/10">
            <div className="text-[10px] text-muted-foreground mb-1 font-medium">Missing data ({decision.confidence.missingRules.length} rules):</div>
            <div className="flex flex-wrap gap-1">
              {decision.confidence.missingRules.slice(0, 6).map(r => (
                <span key={r} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground">{r.replace(/_/g, ' ')}</span>
              ))}
            </div>
          </div>
        )}

        {/* Trade class indicator */}
        <div className="flex items-center justify-between pt-1 border-t border-border/10">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Position multiplier</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 rounded-full bg-secondary/40 overflow-hidden">
              <div
                className={`h-full rounded-full ${decision.positionMultiplier >= 0.75 ? 'bg-success' : decision.positionMultiplier >= 0.50 ? 'bg-warning' : 'bg-destructive'}`}
                style={{ width: `${decision.positionMultiplier * 100}%` }}
              />
            </div>
            <span className={`text-[10px] font-bold tabular-nums ${classColor}`}>{Math.round(decision.positionMultiplier * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
