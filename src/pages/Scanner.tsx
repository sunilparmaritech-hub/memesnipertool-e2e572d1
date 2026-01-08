import { useState, useEffect, useCallback } from "react";
import TradingHeader from "@/components/trading/TradingHeader";
import TokenScannerPanel from "@/components/trading/TokenScannerPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useTokenScanner, ScannedToken } from "@/hooks/useTokenScanner";
import { useSniperSettings } from "@/hooks/useSniperSettings";
import { useAutoSniper, SnipeDecision } from "@/hooks/useAutoSniper";
import { useWallet } from "@/hooks/useWallet";
import {
  Bot,
  Play,
  CheckCircle,
  XCircle,
  Zap,
  Loader2,
} from "lucide-react";

const DecisionCard = ({ decision }: { decision: SnipeDecision }) => {
  const { token, approved, reasons, tradeParams } = decision;

  return (
    <Card className={`border ${approved ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {approved ? (
              <CheckCircle className="w-5 h-5 text-success" />
            ) : (
              <XCircle className="w-5 h-5 text-destructive" />
            )}
            <span className="font-semibold text-foreground">{token.symbol}</span>
            <Badge variant="outline" className="text-xs">{token.name}</Badge>
          </div>
          {approved && tradeParams && (
            <Badge className="bg-success/20 text-success border-success/30">
              Ready: {tradeParams.amount} SOL
            </Badge>
          )}
        </div>
        <div className="space-y-1">
          {reasons.map((reason, i) => (
            <p key={i} className={`text-xs ${reason.startsWith('✓') ? 'text-success' : 'text-destructive'}`}>
              {reason}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const Scanner = () => {
  const { tokens, loading, scanTokens } = useTokenScanner();
  const { settings } = useSniperSettings();
  const { loading: sniperLoading, result: sniperResult, evaluateTokens, clearResult } = useAutoSniper();
  const { wallet, connectPhantom, disconnect } = useWallet();

  const [scanSpeed, setScanSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [isPaused, setIsPaused] = useState(false);
  const [autoSnipeEnabled, setAutoSnipeEnabled] = useState(false);
  const [executeOnApproval, setExecuteOnApproval] = useState(false);

  useEffect(() => {
    if (settings?.min_liquidity && !isPaused) {
      scanTokens(settings.min_liquidity);
    }
  }, [settings?.min_liquidity]);

  const handleScan = useCallback(() => {
    scanTokens(settings?.min_liquidity || 300);
  }, [scanTokens, settings?.min_liquidity]);

  const runAutoSniper = useCallback(async () => {
    if (!autoSnipeEnabled || tokens.length === 0) return;

    const tokenData = tokens.map(t => ({
      address: t.address,
      name: t.name,
      symbol: t.symbol,
      chain: t.chain,
      liquidity: t.liquidity,
      liquidityLocked: t.liquidityLocked,
      lockPercentage: t.lockPercentage,
      buyerPosition: t.buyerPosition,
      riskScore: t.riskScore,
      categories: [],
    }));

    await evaluateTokens(tokenData, executeOnApproval);
  }, [autoSnipeEnabled, tokens, executeOnApproval, evaluateTokens]);

  const handleConnectWallet = async () => {
    if (wallet.isConnected) {
      await disconnect();
    } else {
      await connectPhantom();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TradingHeader
        walletConnected={wallet.isConnected}
        walletAddress={wallet.address || undefined}
        network={wallet.network}
        onConnectWallet={handleConnectWallet}
      />

      <main className="pt-20 pb-6 px-4">
        <div className="container mx-auto">
          {/* Auto-Sniper Control Panel */}
          <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-primary/20">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Auto-Sniper Engine</h3>
                    <p className="text-xs text-muted-foreground">
                      Rule-based evaluation: Liquidity • Lock Status • Position • Risk
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={autoSnipeEnabled}
                      onCheckedChange={(checked) => {
                        setAutoSnipeEnabled(checked);
                        if (!checked) clearResult();
                      }}
                    />
                    <span className="text-sm text-muted-foreground">Enable</span>
                  </div>

                  {autoSnipeEnabled && (
                    <>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={executeOnApproval}
                          onCheckedChange={setExecuteOnApproval}
                        />
                        <span className="text-sm text-muted-foreground">Auto-Execute</span>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={runAutoSniper}
                        disabled={sniperLoading || tokens.length === 0}
                      >
                        {sniperLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        ) : (
                          <Play className="w-4 h-4 mr-1" />
                        )}
                        Run Rules
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {sniperResult && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <Badge variant="outline">
                      Evaluated: {sniperResult.summary.total}
                    </Badge>
                    <Badge className="bg-success/20 text-success border-success/30">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Approved: {sniperResult.summary.approved}
                    </Badge>
                    <Badge className="bg-destructive/20 text-destructive border-destructive/30">
                      <XCircle className="w-3 h-3 mr-1" />
                      Rejected: {sniperResult.summary.rejected}
                    </Badge>
                    {sniperResult.summary.executed > 0 && (
                      <Badge className="bg-primary/20 text-primary border-primary/30">
                        <Zap className="w-3 h-3 mr-1" />
                        Executed: {sniperResult.summary.executed}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Decisions Grid */}
          {sniperResult && sniperResult.decisions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground mb-3">Rule Evaluation Results</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {sniperResult.decisions.map((decision, idx) => (
                  <DecisionCard key={idx} decision={decision} />
                ))}
              </div>
            </div>
          )}

          {/* Token Scanner */}
          <div className="h-[calc(100vh-320px)]">
            <TokenScannerPanel
              tokens={tokens}
              loading={loading}
              onScan={handleScan}
              scanSpeed={scanSpeed}
              onSpeedChange={setScanSpeed}
              isPaused={isPaused}
              onPauseToggle={() => setIsPaused(!isPaused)}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Scanner;
