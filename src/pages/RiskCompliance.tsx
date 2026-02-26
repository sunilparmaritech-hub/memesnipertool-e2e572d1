import React, { forwardRef, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useRiskCompliance, RiskCheckLog } from "@/hooks/useRiskCompliance";
import { formatDistanceToNow } from "date-fns";
import {
  Shield,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  Ban,
  Lock,
  LockOpen,
  Percent,
  Activity,
  RefreshCw,
  Search,
  Loader2,
  XOctagon,
  Zap,
  History,
  Check,
  X,
  AlertOctagon,
  TrendingDown,
  BarChart3,
  Eye,
} from "lucide-react";

const RiskCompliance = forwardRef<HTMLDivElement, object>(function RiskCompliance(_props, ref) {
  const {
    settings,
    loading,
    checkLoading,
    logs,
    updateSettings,
    toggleEmergencyStop,
    resetCircuitBreaker,
    checkTokens,
    fetchLogs,
    isEmergencyStopActive,
    isCircuitBreakerTriggered,
  } = useRiskCompliance();

  const [tokenAddress, setTokenAddress] = useState("");
  const [checkResult, setCheckResult] = useState<any>(null);

  const handleManualCheck = async () => {
    if (!tokenAddress.trim()) return;
    const result = await checkTokens([{ address: tokenAddress.trim() }]);
    setCheckResult(result);
    fetchLogs(20);
  };

  const getRiskColor = (score: number) => {
    if (score < 40) return "text-success";
    if (score < 70) return "text-warning";
    return "text-destructive";
  };

  const getRiskBadge = (score: number) => {
    if (score < 40) return <Badge className="bg-success/20 text-success border-success/30">Low Risk</Badge>;
    if (score < 70) return <Badge className="bg-warning/20 text-warning border-warning/30">Medium</Badge>;
    return <Badge className="bg-destructive/20 text-destructive border-destructive/30">High Risk</Badge>;
  };

  const CheckIcon = ({ passed }: { passed: boolean }) =>
    passed ? <Check className="w-4 h-4 text-success" /> : <X className="w-4 h-4 text-destructive" />;

  // Compute stats from logs
  const totalChecks = logs.length;
  const passedChecks = logs.filter(l => l.passed_checks).length;
  const failedChecks = totalChecks - passedChecks;
  const avgRisk = totalChecks > 0 ? Math.round(logs.reduce((s, l) => s + (l.risk_score ?? 0), 0) / totalChecks) : 0;

  return (
    <AppLayout>
      <div className="container mx-auto max-w-[1600px] px-2 sm:px-3 md:px-5 py-2 sm:py-3 space-y-3 sm:space-y-4">
        <div className="flex justify-end">
          <Button
            variant={isEmergencyStopActive ? "outline" : "destructive"}
            size="sm"
            onClick={() => toggleEmergencyStop(!isEmergencyStopActive)}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XOctagon className="w-3.5 h-3.5" />}
            {isEmergencyStopActive ? "Resume Trading" : "Emergency Stop"}
          </Button>
        </div>

        {/* Emergency / Circuit Breaker banners */}
        {isEmergencyStopActive && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/10">
            <XOctagon className="w-6 h-6 text-destructive animate-pulse shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-destructive">EMERGENCY STOP ACTIVE</p>
              <p className="text-xs text-muted-foreground">All automated trading is halted</p>
            </div>
          </div>
        )}

        {isCircuitBreakerTriggered && !isEmergencyStopActive && (
          <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-warning/30 bg-warning/10">
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6 text-warning shrink-0" />
              <div>
                <p className="font-bold text-warning">Circuit Breaker Triggered</p>
                <p className="text-xs text-muted-foreground">Trading paused due to loss threshold</p>
              </div>
            </div>
            <Button variant="outline" size="xs" onClick={resetCircuitBreaker} disabled={loading}>
              <RefreshCw className="w-3 h-3" /> Reset
            </Button>
          </div>
        )}

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[
            {
              label: "System Status",
              value: isEmergencyStopActive ? "STOPPED" : "Active",
              icon: isEmergencyStopActive ? ShieldX : ShieldCheck,
              color: isEmergencyStopActive ? "text-destructive" : "text-success",
              bg: isEmergencyStopActive ? "bg-destructive/10" : "bg-success/10",
            },
            {
              label: "Circuit Breaker",
              value: isCircuitBreakerTriggered ? "Triggered" : "Ready",
              icon: Zap,
              color: isCircuitBreakerTriggered ? "text-warning" : "text-primary",
              bg: isCircuitBreakerTriggered ? "bg-warning/10" : "bg-primary/10",
            },
            {
              label: "Avg Risk Score",
              value: String(avgRisk),
              icon: BarChart3,
              color: getRiskColor(avgRisk),
              bg: "bg-primary/10",
            },
            {
              label: "Checks (Pass/Fail)",
              value: `${passedChecks}/${failedChecks}`,
              icon: Eye,
              color: "text-foreground",
              bg: "bg-primary/10",
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-xl border border-border/30 bg-card/40 p-3 sm:p-4">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</p>
                    <p className={`text-sm sm:text-base font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {/* Token Risk Scanner */}
          <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Token Risk Scanner</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter token address..."
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  className="font-mono text-sm bg-secondary/30"
                />
                <Button onClick={handleManualCheck} disabled={checkLoading || !tokenAddress.trim()} variant="glow">
                  {checkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>

              {checkResult && checkResult.results?.[0] && (
                <div className="space-y-3 p-4 bg-secondary/20 rounded-lg border border-border/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {checkResult.canTrade ? (
                        <ShieldCheck className="w-5 h-5 text-success" />
                      ) : (
                        <ShieldX className="w-5 h-5 text-destructive" />
                      )}
                      <span className={`font-bold text-sm ${checkResult.canTrade ? "text-success" : "text-destructive"}`}>
                        {checkResult.canTrade ? "APPROVED" : "REJECTED"}
                      </span>
                    </div>
                    {getRiskBadge(checkResult.results[0].riskScore)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      { label: "Honeypot", icon: AlertOctagon, passed: checkResult.results[0].checks.honeypot.passed },
                      { label: "Blacklist", icon: Ban, passed: checkResult.results[0].checks.blacklist.passed },
                      { label: "Owner Renounced", icon: LockOpen, passed: checkResult.results[0].checks.ownershipRenounced.passed },
                      { label: "LP Locked", icon: Lock, passed: checkResult.results[0].checks.liquidityLocked.passed },
                    ].map((c) => {
                      const CIcon = c.icon;
                      return (
                        <div key={c.label} className="flex items-center justify-between p-2 bg-card/60 rounded-lg border border-border/20">
                          <span className="flex items-center gap-1.5 text-xs">
                            <CIcon className="w-3.5 h-3.5 text-muted-foreground" /> {c.label}
                          </span>
                          <CheckIcon passed={c.passed} />
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between p-2 bg-card/60 rounded-lg border border-border/20 col-span-2">
                      <span className="flex items-center gap-1.5 text-xs">
                        <Percent className="w-3.5 h-3.5 text-muted-foreground" /> Tax Check
                      </span>
                      <span className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">
                          Buy: {checkResult.results[0].checks.taxCheck.buyTax}% | Sell: {checkResult.results[0].checks.taxCheck.sellTax}%
                        </span>
                        <CheckIcon passed={checkResult.results[0].checks.taxCheck.passed} />
                      </span>
                    </div>
                  </div>

                  {checkResult.results[0].rejectionReasons.length > 0 && (
                    <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                      <p className="text-xs font-medium text-destructive mb-1.5">Rejection Reasons:</p>
                      <ul className="text-xs text-destructive/80 space-y-1">
                        {checkResult.results[0].rejectionReasons.map((reason: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <X className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Risk Settings Panel */}
          <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Risk Settings</h3>
            </div>
            <div className="p-4 space-y-5">
              {/* Risk Score Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Max Risk Score</Label>
                  <span className={`font-mono text-sm font-bold ${getRiskColor(settings.max_risk_score)}`}>
                    {settings.max_risk_score}
                  </span>
                </div>
                <Slider
                  value={[settings.max_risk_score]}
                  onValueChange={([value]) => updateSettings({ max_risk_score: value })}
                  max={100} min={10} step={5}
                  disabled={loading}
                />
                <p className="text-[10px] text-muted-foreground">Tokens above this score are rejected</p>
              </div>

              {/* Tax Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Max Tax %</Label>
                  <span className="font-mono text-sm font-bold text-foreground">{settings.max_tax_percent}%</span>
                </div>
                <Slider
                  value={[settings.max_tax_percent]}
                  onValueChange={([value]) => updateSettings({ max_tax_percent: value })}
                  max={50} min={1} step={1}
                  disabled={loading}
                />
                <p className="text-[10px] text-muted-foreground">Reject tokens with higher buy/sell tax</p>
              </div>

              {/* Safety Toggles */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Safety Requirements</Label>
                {[
                  {
                    label: "Require Ownership Renounced",
                    desc: "Owner cannot modify contract",
                    icon: LockOpen,
                    checked: settings.require_ownership_renounced,
                    onChange: (v: boolean) => updateSettings({ require_ownership_renounced: v }),
                  },
                  {
                    label: "Require Liquidity Locked",
                    desc: "Prevents rug pulls",
                    icon: Lock,
                    checked: settings.require_liquidity_locked,
                    onChange: (v: boolean) => updateSettings({ require_liquidity_locked: v }),
                  },
                ].map((toggle) => {
                  const TIcon = toggle.icon;
                  return (
                    <div key={toggle.label} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                      <div className="flex items-center gap-2.5">
                        <TIcon className="w-4 h-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{toggle.label}</p>
                          <p className="text-[10px] text-muted-foreground">{toggle.desc}</p>
                        </div>
                      </div>
                      <Switch checked={toggle.checked} onCheckedChange={toggle.onChange} disabled={loading} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Circuit Breaker Settings */}
        <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-warning" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Circuit Breaker</h3>
            </div>
            <Switch
              checked={settings.circuit_breaker_enabled}
              onCheckedChange={(checked) => updateSettings({ circuit_breaker_enabled: checked })}
              disabled={loading}
            />
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Loss Threshold</Label>
                <span className="font-mono text-sm text-destructive font-bold">{settings.circuit_breaker_loss_threshold}%</span>
              </div>
              <Slider
                value={[settings.circuit_breaker_loss_threshold]}
                onValueChange={([value]) => updateSettings({ circuit_breaker_loss_threshold: value })}
                max={100} min={5} step={5}
                disabled={loading || !settings.circuit_breaker_enabled}
              />
              <p className="text-[10px] text-muted-foreground">Cumulative loss that triggers pause</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Time Window (minutes)</Label>
              <Input
                type="number"
                value={settings.circuit_breaker_time_window_minutes}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= 15 && val <= 1440) {
                    updateSettings({ circuit_breaker_time_window_minutes: val });
                  } else if (e.target.value === '') {
                    updateSettings({ circuit_breaker_time_window_minutes: 60 });
                  }
                }}
                min={15} max={1440}
                disabled={loading || !settings.circuit_breaker_enabled}
                className="bg-secondary/30"
              />
              <p className="text-[10px] text-muted-foreground">Period for loss calculation</p>
            </div>
          </div>
        </div>

        {/* Recent Risk Checks */}
        <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Recent Risk Checks</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => fetchLogs()} className="text-xs">
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
            </Button>
          </div>
          <div className="p-2">
            {logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No risk checks performed yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {logs.slice(0, 10).map((log: RiskCheckLog) => (
                  <div key={log.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-2.5">
                      {log.passed_checks ? (
                        <ShieldCheck className="w-4 h-4 text-success" />
                      ) : (
                        <ShieldX className="w-4 h-4 text-destructive" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <span className="font-mono text-xs">{log.token_symbol || log.token_address.slice(0, 8) + "..."}</span>
                          <Badge variant="outline" className="text-[9px] capitalize px-1.5 py-0">{log.chain}</Badge>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(log.checked_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold tabular-nums ${getRiskColor(log.risk_score)}`}>{log.risk_score}</span>
                      <div className="flex gap-0.5">
                        {!log.is_honeypot ? <Check className="w-3.5 h-3.5 text-success" /> : <AlertOctagon className="w-3.5 h-3.5 text-destructive" />}
                        {!log.is_blacklisted ? <Check className="w-3.5 h-3.5 text-success" /> : <Ban className="w-3.5 h-3.5 text-destructive" />}
                        {log.owner_renounced ? <Check className="w-3.5 h-3.5 text-success" /> : <X className="w-3.5 h-3.5 text-warning" />}
                        {log.liquidity_locked ? <Lock className="w-3.5 h-3.5 text-success" /> : <LockOpen className="w-3.5 h-3.5 text-warning" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
});

RiskCompliance.displayName = "RiskCompliance";

export default RiskCompliance;
