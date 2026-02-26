import { memo, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
} from "lucide-react";
import type { GateDecision } from "@/lib/preExecutionGate";
import { VALIDATION_RULES } from "@/lib/validationRuleConfig";

interface GateResult {
  token: string;
  decision: GateDecision;
}

interface ValidationSummaryPanelProps {
  gateResults: GateResult[];
  className?: string;
}

// Derive rule labels and order from the single source of truth
const RULE_LABELS: Record<string, string> = Object.fromEntries(
  VALIDATION_RULES.map((r) => [r.key, r.label])
);

// All 22 expected rules in config order
const ALL_RULES = VALIDATION_RULES.map((r) => r.key);

const TokenGateRow = memo(({ result }: { result: GateResult }) => {
  const [isOpen, setIsOpen] = useState(false);
  const decision = result.decision;

  // Build token-specific tooltip message
  const tooltipInfo = useMemo(() => {
    const lines: string[] = [];
    
    if (decision.state === "EXECUTABLE") {
      // Find penalties applied
      const penaltyRules = decision.reasons
        .filter(r => r.includes('penalty') || r.includes('PENALTY') || r.includes('caution') || r.includes('risk'))
        .map(r => {
          const match = r.match(/^\[([^\]]+)\]\s*(.*)/);
          return match ? `${RULE_LABELS[match[1]] || match[1]}: ${match[2]}` : r;
        });
      
      // Find skipped/unavailable rules
      const skippedRules = decision.reasons
        .filter(r => r.includes('skipped') || r.includes('unavailable') || r.includes('unknown') || r.includes('not configured') || r.includes('disabled by user'))
        .map(r => {
          const match = r.match(/^\[([^\]]+)\]/);
          return match ? RULE_LABELS[match[1]] || match[1] : '';
        })
        .filter(Boolean);
      
      // Check observation delay
      const obsReason = decision.reasons.find(r => r.startsWith('[OBSERVATION_DELAY]'));
      
      // Check dynamic cap
      const capReason = decision.reasons.find(r => r.startsWith('[DYNAMIC_CAP]'));
      
      // Check early trust bonus
      const trustReason = decision.reasons.find(r => r.startsWith('[EARLY_TRUST]'));
      
      if (penaltyRules.length > 0) {
        lines.push(`⚠️ Warnings: ${penaltyRules.slice(0, 2).join('; ')}`);
      }
      if (skippedRules.length > 0) {
        lines.push(`⏭️ Skipped: ${skippedRules.join(', ')}`);
      }
      if (capReason) {
        const capMatch = capReason.match(/Score capped: (\d+) → (\d+)/);
        if (capMatch) lines.push(`📉 Risk cap applied: ${capMatch[1]} → ${capMatch[2]}`);
      }
      if (trustReason) {
        const trustMatch = trustReason.match(/\+(\d+) bonus \((.+)\)/);
        if (trustMatch) lines.push(`🏆 Trust bonus: +${trustMatch[1]} (${trustMatch[2]})`);
      }
      if (obsReason) {
        const obsText = obsReason.replace('[OBSERVATION_DELAY] ', '');
        lines.push(`🔍 ${obsText}`);
      }
      
      if (lines.length === 0) {
        lines.push('✅ All 23 rules passed — token cleared for execution');
      }
      
      // Add route confirmation status
      const sellRouteReason = decision.reasons.find(r => r.startsWith('[EXECUTABLE_SELL]'));
      if (sellRouteReason) {
        const routeText = sellRouteReason.replace('[EXECUTABLE_SELL] ', '');
        lines.push(`🔄 Route: ${routeText}`);
      }
    } else if (decision.state === "BLOCKED") {
      // Show specific failed rules with reasons
      for (const failedRule of decision.failedRules.slice(0, 3)) {
        const reason = decision.reasons.find(r => r.startsWith(`[${failedRule}]`));
        const reasonText = reason?.replace(`[${failedRule}] `, '') || 'Failed';
        lines.push(`❌ ${RULE_LABELS[failedRule] || failedRule}: ${reasonText}`);
      }
      if (decision.failedRules.length > 3) {
        lines.push(`...and ${decision.failedRules.length - 3} more failed rules`);
      }
    } else {
      // OBSERVED state
      const obsReason = decision.reasons.find(r => r.startsWith('[OBSERVATION_DELAY]'));
      if (obsReason) {
        lines.push(`👁 ${obsReason.replace('[OBSERVATION_DELAY] ', '')}`);
      }
      // Show what's borderline
      const score = decision.riskScore;
      const minScore = 55; // manual threshold
      if (score < minScore) {
        lines.push(`📊 Score ${score} below minimum threshold (${minScore})`);
      } else {
        lines.push(`📊 Score ${score} — under observation for stability`);
      }
      // Show key penalties
      const penalties = decision.reasons
        .filter(r => r.includes('PENALTY'))
        .map(r => {
          const match = r.match(/^\[([^\]]+)\]/);
          return match ? RULE_LABELS[match[1]] || match[1] : '';
        })
        .filter(Boolean);
      if (penalties.length > 0) {
        lines.push(`⚠️ Penalties: ${penalties.join(', ')}`);
      }
    }
    
    return lines;
  }, [decision]);

  const stateIcon = decision.state === "EXECUTABLE" ? (
    <ShieldCheck className="w-4 h-4 text-success" />
  ) : decision.state === "BLOCKED" ? (
    <ShieldX className="w-4 h-4 text-destructive" />
  ) : (
    <ShieldAlert className="w-4 h-4 text-warning" />
  );

  const stateBadge = decision.state === "EXECUTABLE" ? (
    <Badge variant="success" className="text-[10px] px-1.5 py-0 h-4">
      PASS
    </Badge>
  ) : decision.state === "BLOCKED" ? (
    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
      BLOCKED
    </Badge>
  ) : (
    <Badge variant="warning" className="text-[10px] px-1.5 py-0 h-4">
      OBSERVE
    </Badge>
  );

  // Build rule results map for this token
  const ruleMap = useMemo(() => {
    const map = new Map<string, { passed: boolean; reason: string }>();
    for (const rule of decision.passedRules) {
      const reason = decision.reasons.find((r) => r.startsWith(`[${rule}]`));
      map.set(rule, {
        passed: true,
        reason: reason?.replace(`[${rule}] `, "") || "Passed",
      });
    }
    for (const rule of decision.failedRules) {
      const reason = decision.reasons.find((r) => r.startsWith(`[${rule}]`));
      map.set(rule, {
        passed: false,
        reason: reason?.replace(`[${rule}] `, "") || "Failed",
      });
    }
    return map;
  }, [decision]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/20 hover:bg-secondary/30 transition-colors cursor-pointer group">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {stateIcon}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-medium text-sm text-foreground truncate max-w-[140px] sm:max-w-[180px] cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
                  {result.token}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="max-w-[340px] text-xs space-y-1 p-2">
                <div className="font-semibold mb-1">
                  {decision.state === "EXECUTABLE" ? "✅ Passed" : decision.state === "BLOCKED" ? "❌ Blocked" : "👁 Observed"} — Risk: {decision.riskScore}
                </div>
                {tooltipInfo.map((line, idx) => (
                  <div key={idx} className={cn(
                    "text-xs",
                    line.startsWith('❌') ? "text-destructive" :
                    line.startsWith('⚠️') ? "text-warning" :
                    line.startsWith('✅') || line.startsWith('🏆') ? "text-success" :
                    "text-muted-foreground"
                  )}>
                    {line}
                  </div>
                ))}
              </TooltipContent>
            </Tooltip>
            {stateBadge}
            <span className="text-xs text-muted-foreground tabular-nums">
              Score: {decision.riskScore}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Mini rule summary: show dots in two rows */}
            <div className="hidden md:grid grid-cols-11 gap-0.5">
              {ALL_RULES.map((rule) => {
                const ruleResult = ruleMap.get(rule);
                if (!ruleResult) return (
                  <Tooltip key={rule}>
                    <TooltipTrigger>
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {RULE_LABELS[rule] || rule}: Not checked
                    </TooltipContent>
                  </Tooltip>
                );
                const isDisabled = ruleResult.reason.includes('disabled by user');
                const isSkipped = ruleResult.passed && (
                  ruleResult.reason.includes('skipped') || 
                  ruleResult.reason.includes('unavailable') || 
                  ruleResult.reason.includes('unknown') ||
                  ruleResult.reason.includes('not configured') ||
                  ruleResult.reason.includes('No holder data') ||
                  ruleResult.reason.includes('No trade records') ||
                  ruleResult.reason.includes('Insufficient buyer') ||
                  ruleResult.reason.includes('proceeding with caution')
                );
                return (
                  <Tooltip key={rule}>
                    <TooltipTrigger>
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          isDisabled ? "bg-muted-foreground/40" :
                          isSkipped ? "bg-warning/50" :
                          ruleResult.passed ? "bg-success" : "bg-destructive"
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-[200px]">
                      <span className="font-medium">{RULE_LABELS[rule] || rule}:</span>{" "}
                      {ruleResult.reason}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            {isOpen ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 py-2 bg-secondary/20 border-b border-border/20 space-y-1">
          {ALL_RULES.map((rule) => {
            const ruleResult = ruleMap.get(rule);
            const label = RULE_LABELS[rule] || rule;
            if (!ruleResult) {
              return (
                <div key={rule} className="flex items-center gap-2 text-xs text-muted-foreground/60 py-0.5">
                  <div className="w-3.5 h-3.5 flex items-center justify-center">
                    <Eye className="w-3 h-3" />
                  </div>
                <span className="font-medium w-28 shrink-0">{label}</span>
                  <span className="truncate">Not evaluated</span>
                </div>
              );
            }
            const isDisabled = ruleResult.reason.includes('disabled by user');
            const isSkipped = ruleResult.passed && (
              ruleResult.reason.includes('skipped') || 
              ruleResult.reason.includes('unavailable') || 
              ruleResult.reason.includes('unknown') ||
              ruleResult.reason.includes('not configured') ||
              ruleResult.reason.includes('No holder data') ||
              ruleResult.reason.includes('No trade records') ||
              ruleResult.reason.includes('Insufficient buyer') ||
              ruleResult.reason.includes('proceeding with caution')
            );
            return (
              <div
                key={rule}
                className={cn(
                  "flex items-center gap-2 text-xs py-0.5",
                  isDisabled
                    ? "text-muted-foreground/50"
                    : isSkipped
                      ? "text-warning"
                      : ruleResult.passed
                        ? "text-muted-foreground"
                        : "text-destructive"
                )}
              >
                <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                  {isDisabled ? (
                    <Eye className="w-3 h-3 text-muted-foreground/40" />
                  ) : isSkipped ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                  ) : ruleResult.passed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-destructive" />
                  )}
                </div>
                <span className="font-medium w-28 shrink-0">{label}</span>
                <span className="truncate">{ruleResult.reason}</span>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

TokenGateRow.displayName = "TokenGateRow";

export default memo(function ValidationSummaryPanel({
  gateResults,
  className,
}: ValidationSummaryPanelProps) {
  const [showAll, setShowAll] = useState(false);

  const stats = useMemo(() => {
    const executable = gateResults.filter(
      (r) => r.decision.state === "EXECUTABLE"
    ).length;
    const blocked = gateResults.filter(
      (r) => r.decision.state === "BLOCKED"
    ).length;
    const observed = gateResults.filter(
      (r) => r.decision.state === "OBSERVED"
    ).length;
    return { executable, blocked, observed, total: gateResults.length };
  }, [gateResults]);

  // Show most recently validated tokens first (reverse order)
  const sortedResults = useMemo(() => {
    return [...gateResults].reverse();
  }, [gateResults]);

  const displayedResults = showAll
    ? sortedResults
    : sortedResults.slice(0, 8);

  if (gateResults.length === 0) {
    return (
      <Card className={cn("bg-card/80 backdrop-blur-sm border-border/50", className)}>
        <CardHeader className="pb-2 px-3 pt-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Validation Gate
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <p className="text-xs text-muted-foreground text-center py-4">
            No tokens evaluated yet. Start the bot to see validation results.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("bg-card/80 backdrop-blur-sm border-border/50", className)}>
      <CardHeader className="pb-2 px-3 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Validation Gate
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {stats.executable > 0 && (
              <Badge variant="success" className="text-[10px] px-1.5 py-0 h-4">
                {stats.executable} ✓
              </Badge>
            )}
            {stats.observed > 0 && (
              <Badge variant="warning" className="text-[10px] px-1.5 py-0 h-4">
                {stats.observed} 👁
              </Badge>
            )}
            {stats.blocked > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                {stats.blocked} ✗
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {displayedResults.map((result, i) => (
          <TokenGateRow key={`${result.token}-${i}`} result={result} />
        ))}
        {sortedResults.length > 8 && (
          <div className="px-3 py-2 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-muted-foreground h-7"
            >
              {showAll
                ? "Show Less"
                : `Show ${sortedResults.length - 8} more`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
