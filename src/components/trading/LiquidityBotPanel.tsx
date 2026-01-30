import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SniperSettings } from "@/hooks/useSniperSettings";
import { useDebouncedCallback } from "@/hooks/useDebounce";
import { TRADING_LIMITS, validateSniperSettings, clampValue } from "@/lib/validation";
import { 
  Settings2,
  DollarSign,
  Loader2,
  Target,
  Bot,
  HelpCircle,
  AlertCircle,
  Shield,
  Wallet,
} from "lucide-react";

interface LiquidityBotPanelProps {
  settings: SniperSettings | null;
  saving: boolean;
  onUpdateField: <K extends keyof SniperSettings>(field: K, value: SniperSettings[K]) => void;
  onSave: () => void;
  isActive: boolean;
  onToggleActive: (active: boolean) => void;
  autoEntryEnabled: boolean;
  onAutoEntryChange: (enabled: boolean) => void;
  autoExitEnabled: boolean;
  onAutoExitChange: (enabled: boolean) => void;
  isDemo?: boolean;
  walletConnected?: boolean;
  walletAddress?: string | null;
  walletBalance?: string | null;
}

export default function LiquidityBotPanel({
  settings,
  saving,
  onUpdateField,
  onSave,
  isActive,
  onToggleActive,
  autoEntryEnabled,
  onAutoEntryChange,
  autoExitEnabled,
  onAutoExitChange,
  isDemo = false,
  walletConnected = false,
  walletAddress = null,
  walletBalance = null,
}: LiquidityBotPanelProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  const debouncedSave = useDebouncedCallback(() => {
    if (settings) {
      const validation = validateSniperSettings(settings);
      if (validation.isValid) {
        setValidationError(null);
      } else {
        setValidationError(validation.error || null);
      }
    }
  }, 500);

  const handleUpdateField = useCallback(<K extends keyof SniperSettings>(field: K, value: SniperSettings[K]) => {
    let clampedValue = value;
    if (field === 'min_liquidity' && typeof value === 'number') {
      clampedValue = clampValue(value, TRADING_LIMITS.MIN_LIQUIDITY.min, TRADING_LIMITS.MIN_LIQUIDITY.max) as SniperSettings[K];
    } else if (field === 'trade_amount' && typeof value === 'number') {
      clampedValue = clampValue(value, TRADING_LIMITS.TRADE_AMOUNT.min, TRADING_LIMITS.TRADE_AMOUNT.max) as SniperSettings[K];
    } else if (field === 'profit_take_percentage' && typeof value === 'number') {
      clampedValue = clampValue(value, TRADING_LIMITS.TAKE_PROFIT.min, TRADING_LIMITS.TAKE_PROFIT.max) as SniperSettings[K];
    } else if (field === 'stop_loss_percentage' && typeof value === 'number') {
      clampedValue = clampValue(value, TRADING_LIMITS.STOP_LOSS.min, TRADING_LIMITS.STOP_LOSS.max) as SniperSettings[K];
    }
    
    onUpdateField(field, clampedValue);
    debouncedSave();
  }, [onUpdateField, debouncedSave]);

  if (!settings) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border/40">
        <CardContent className="p-8 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Loading settings...</p>
        </CardContent>
      </Card>
    );
  }

  const safetyScore = Math.min(100, Math.max(0, 
    100 - (settings.stop_loss_percentage || 20) + 
    (settings.min_liquidity > 200 ? 20 : 0) +
    (settings.max_concurrent_trades <= 3 ? 10 : 0)
  ));

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/40 overflow-hidden">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">BOT SETTINGS</span>
          </div>
          <Switch
            checked={isActive}
            onCheckedChange={onToggleActive}
            className="data-[state=checked]:bg-success scale-90"
          />
        </CardTitle>
      </CardHeader>
      
      <CardContent className="px-3 pb-3 space-y-3">
        {/* Wallet Status */}
        <div className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${
          walletConnected 
            ? 'bg-success/10 border-success/30' 
            : 'bg-muted/20 border-border/40'
        }`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            walletConnected ? 'bg-success/20' : 'bg-muted/30'
          }`}>
            <Wallet className={`w-4 h-4 ${walletConnected ? 'text-success' : 'text-muted-foreground'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] font-medium ${walletConnected ? 'text-success' : 'text-muted-foreground'}`}>
              {walletConnected ? 'Wallet Connected' : 'No Wallet'}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {walletConnected 
                ? `${walletAddress?.slice(0, 4)}...${walletAddress?.slice(-3)} • ${walletBalance}`
                : isDemo ? 'Demo mode' : 'Connect for live trading'}
            </p>
          </div>
        </div>
        
        {/* Auto Entry/Exit Toggles */}
        <div className="flex items-center gap-3 p-2.5 bg-secondary/30 rounded-lg">
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-[10px] text-muted-foreground">Auto Entry</span>
            <Switch
              checked={autoEntryEnabled}
              onCheckedChange={onAutoEntryChange}
              className="data-[state=checked]:bg-success scale-75"
            />
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-[10px] text-muted-foreground">Auto Exit</span>
            <Switch
              checked={autoExitEnabled}
              onCheckedChange={onAutoExitChange}
              className="data-[state=checked]:bg-success scale-75"
            />
          </div>
        </div>
        
        {/* Validation Error */}
        {validationError && (
          <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-lg border border-destructive/20">
            <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
            <span className="text-[9px] text-destructive">{validationError}</span>
          </div>
        )}

        {/* Min Liquidity */}
        <div className="p-2.5 bg-secondary/30 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3 h-3 text-primary" />
              <span className="text-[10px] text-muted-foreground font-medium">Min Liquidity (SOL)</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground/50 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="text-xs">Minimum liquidity pool size required.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <span className="text-primary font-bold text-sm tabular-nums">{settings.min_liquidity}</span>
          </div>
          <Slider
            value={[settings.min_liquidity]}
            onValueChange={([v]) => handleUpdateField('min_liquidity', v)}
            min={TRADING_LIMITS.MIN_LIQUIDITY.min}
            max={1000}
            step={10}
            className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
          />
        </div>
        
        {/* Target Positions */}
        <div className="p-2.5 bg-secondary/30 rounded-lg">
          <div className="flex items-center gap-1.5 mb-2">
            <Target className="w-3 h-3 text-primary" />
            <span className="text-[10px] text-muted-foreground font-medium">Target Positions</span>
            <span className="text-[9px] text-muted-foreground/70">(multi-select)</span>
          </div>
          <div className="grid grid-cols-5 gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((pos) => {
              const isSelected = settings.target_buyer_positions?.includes(pos);
              return (
                <button
                  key={pos}
                  onClick={() => {
                    const current = settings.target_buyer_positions || [2, 3];
                    const updated = isSelected
                      ? current.filter(p => p !== pos)
                      : [...current, pos].sort((a, b) => a - b);
                    if (updated.length > 0) {
                      handleUpdateField('target_buyer_positions', updated);
                    }
                  }}
                  className={`py-1.5 rounded font-semibold text-[10px] transition-all ${
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  #{pos}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-5 gap-1">
            {[6, 7, 8, 9, 10].map((pos) => {
              const isSelected = settings.target_buyer_positions?.includes(pos);
              return (
                <button
                  key={pos}
                  onClick={() => {
                    const current = settings.target_buyer_positions || [2, 3];
                    const updated = isSelected
                      ? current.filter(p => p !== pos)
                      : [...current, pos].sort((a, b) => a - b);
                    if (updated.length > 0) {
                      handleUpdateField('target_buyer_positions', updated);
                    }
                  }}
                  className={`py-1.5 rounded font-semibold text-[10px] transition-all ${
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  #{pos}
                </button>
              );
            })}
          </div>
          <p className="text-[9px] text-muted-foreground mt-1.5 text-center">
            Enter as buyer by Rx
          </p>
        </div>
        
        {/* Safety Percentage */}
        <div className="p-2.5 bg-secondary/30 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-success" />
              <span className="text-[10px] text-muted-foreground font-medium">Safety Percentage</span>
            </div>
            <span className={`font-bold text-sm tabular-nums ${safetyScore >= 70 ? 'text-success' : safetyScore >= 40 ? 'text-warning' : 'text-destructive'}`}>
              {safetyScore}%
            </span>
          </div>
          <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                safetyScore >= 70 ? 'bg-success' : safetyScore >= 40 ? 'bg-warning' : 'bg-destructive'
              }`}
              style={{ width: `${safetyScore}%` }}
            />
          </div>
        </div>
        
        {/* Save Button */}
        <Button 
          className="w-full h-9 text-sm" 
          variant="default"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
