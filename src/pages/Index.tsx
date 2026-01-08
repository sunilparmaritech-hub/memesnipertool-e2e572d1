import { useState, useEffect, useCallback } from "react";
import TradingHeader from "@/components/trading/TradingHeader";
import TokenScannerPanel from "@/components/trading/TokenScannerPanel";
import LiquidityBotPanel from "@/components/trading/LiquidityBotPanel";
import { useTokenScanner } from "@/hooks/useTokenScanner";
import { useSniperSettings } from "@/hooks/useSniperSettings";
import { useWallet } from "@/hooks/useWallet";
import { useAutoSniper } from "@/hooks/useAutoSniper";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { tokens, loading: tokensLoading, scanTokens } = useTokenScanner();
  const { settings, loading: settingsLoading, saving, saveSettings, updateField } = useSniperSettings();
  const { wallet, connectPhantom, disconnect } = useWallet();
  const { evaluateTokens } = useAutoSniper();
  const { toast } = useToast();
  
  const [scanSpeed, setScanSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [isPaused, setIsPaused] = useState(false);
  const [isBotActive, setIsBotActive] = useState(false);

  // Auto-scan on mount and periodically
  useEffect(() => {
    if (settings?.min_liquidity && !isPaused) {
      scanTokens(settings.min_liquidity);
    }
  }, [settings?.min_liquidity]);

  // Periodic scanning based on speed
  useEffect(() => {
    if (isPaused) return;
    
    const intervals = { slow: 60000, normal: 30000, fast: 10000 };
    const interval = setInterval(() => {
      if (settings?.min_liquidity) {
        scanTokens(settings.min_liquidity);
      }
    }, intervals[scanSpeed]);
    
    return () => clearInterval(interval);
  }, [scanSpeed, isPaused, settings?.min_liquidity, scanTokens]);

  // Auto-sniper when bot is active and tokens update
  useEffect(() => {
    if (!isBotActive || tokens.length === 0 || !settings) return;
    
    // Evaluate top opportunities
    const tokenData = tokens.slice(0, 10).map(t => ({
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
    
    evaluateTokens(tokenData, true);
  }, [isBotActive, tokens.length]);

  const handleScan = useCallback(() => {
    scanTokens(settings?.min_liquidity || 300);
  }, [scanTokens, settings?.min_liquidity]);

  const handleConnectWallet = async () => {
    if (wallet.isConnected) {
      await disconnect();
    } else {
      await connectPhantom();
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      await saveSettings(settings);
    } catch (e) {
      // Error handled in hook
    }
  };

  const handleToggleBotActive = (active: boolean) => {
    setIsBotActive(active);
    if (active) {
      toast({
        title: "Liquidity Bot Activated",
        description: "Bot will automatically enter trades when conditions are met",
      });
    } else {
      toast({
        title: "Liquidity Bot Deactivated",
        description: "Automatic trading has been paused",
      });
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
      
      {/* Main Content */}
      <main className="pt-20 pb-6 px-4">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-[1fr,380px] gap-6 h-[calc(100vh-120px)]">
            {/* Left: Token Scanner */}
            <TokenScannerPanel
              tokens={tokens}
              loading={tokensLoading}
              onScan={handleScan}
              scanSpeed={scanSpeed}
              onSpeedChange={setScanSpeed}
              isPaused={isPaused}
              onPauseToggle={() => setIsPaused(!isPaused)}
            />
            
            {/* Right: Liquidity Bot Settings */}
            <LiquidityBotPanel
              settings={settings}
              saving={saving}
              onUpdateField={updateField}
              onSave={handleSaveSettings}
              isActive={isBotActive}
              onToggleActive={handleToggleBotActive}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
