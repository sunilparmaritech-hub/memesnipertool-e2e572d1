import { useState, useCallback } from "react";
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
  Users,
  TrendingUp,
  TrendingDown,
  Zap,
  Shield,
  Loader2,
  Target,
  Bot,
  HelpCircle,
  AlertCircle,
} from "lucide-react";

interface LiquidityBotPanelProps {
  settings: SniperSettings | null;
  saving: boolean;
  onUpdateField: <K extends keyof SniperSettings>(field: K, value: SniperSettings[K]) => void;
  onSave: () => void;
  isActive: boolean;
  onToggleActive: (active: boolean) => void;
  isDemo?: boolean;
}

export default function LiquidityBotPanel({
  settings,
  saving,
  onUpdateField,
  onSave,
  isActive,
  onToggleActive,
  isDemo = false,
}: LiquidityBotPanelProps) {
  const [autoEntry, setAutoEntry] = useState(true);
  const [autoExit, setAutoExit] = useState(true);
  const [targetBuyerPosition, setTargetBuyerPosition] = useState(2);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Debounced save for auto-saving on slider changes
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

  // Validated update function
  const handleUpdateField = useCallback(<K extends keyof SniperSettings>(field: K, value: SniperSettings[K]) => {
    // Apply clamping for numeric fields
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
      <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 p-8 flex flex-col items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  // Calculate safety score based on settings
  const safetyScore = Math.min(100, Math.max(0, 
    100 - (settings.stop_loss_percentage || 20) + 
    (settings.min_liquidity > 200 ? 20 : 0) +
    (settings.max_concurrent_trades <= 3 ? 10 : 0)
  ));

  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden flex flex-col">
      {/* Header - Fixed height */}
      <div className="p-4 border-b border-border/50 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-colors shrink-0 ${
              isActive 
                ? 'bg-gradient-to-br from-success/20 to-success/5 border-success/30' 
                : 'bg-secondary border-border/50'
            }`}>
              <Bot className={`w-5 h-5 ${isActive ? 'text-success' : 'text-muted-foreground'}`} />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-foreground text-lg truncate">Liquidity Bot</h2>
              <p className={`text-xs font-medium ${isActive ? 'text-success' : 'text-muted-foreground'}`}>
                {isActive ? '● Active' : '○ Inactive'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Settings2 className="w-4 h-4" />
            </Button>
            <Switch
              checked={isActive}
              onCheckedChange={onToggleActive}
              className="data-[state=checked]:bg-success"
            />
          </div>
        </div>
        
        {/* Auto Entry/Exit Toggles */}
        <div className="flex items-center gap-4 p-3 bg-secondary/40 rounded-lg">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Auto Entry</span>
            <Switch
              checked={autoEntry}
              onCheckedChange={setAutoEntry}
              className="data-[state=checked]:bg-success"
            />
          </div>
          <div className="w-px h-6 bg-border shrink-0" />
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Auto Exit</span>
            <Switch
              checked={autoExit}
              onCheckedChange={setAutoExit}
              className="data-[state=checked]:bg-success"
            />
          </div>
        </div>
      </div>
      
      {/* Settings */}
      <div className="p-4 space-y-4">
        {/* Validation Error */}
        {validationError && (
          <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-lg border border-destructive/20">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
            <span className="text-xs text-destructive">{validationError}</span>
          </div>
        )}

        {/* Min Liquidity */}
        <div className="p-3 bg-secondary/30 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs">
              <DollarSign className="w-3.5 h-3.5 text-primary" />
              <span className="text-muted-foreground font-medium">Min Liquidity (SOL)</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground/50 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="text-xs">Minimum liquidity pool size required before the bot will consider trading a token. Higher = safer but fewer opportunities.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <span className="text-primary font-bold">{settings.min_liquidity}</span>
          </div>
          <Slider
            value={[settings.min_liquidity]}
            onValueChange={([v]) => handleUpdateField('min_liquidity', v)}
            min={TRADING_LIMITS.MIN_LIQUIDITY.min}
            max={1000}
            step={10}
            className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary"
          />
        </div>
        
        {/* Target Buyer Position */}
        <div className="p-3 bg-secondary/30 rounded-xl">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-2">
            <Target className="w-3.5 h-3.5 text-primary" />
            Target Buyer Position (Momentum Entry)
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((pos) => (
              <button
                key={pos}
                onClick={() => setTargetBuyerPosition(pos)}
                className={`py-2 rounded-lg font-semibold text-xs transition-all ${
                  targetBuyerPosition === pos
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
                }`}
              >
                #{pos}
              </button>
            ))}
          </div>
        </div>
        
        {/* Take Profit & Stop Loss */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-success/10 rounded-xl border border-success/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1 text-xs">
                <TrendingUp className="w-3.5 h-3.5 text-success" />
                <span className="text-muted-foreground font-medium">TP</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground/50 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[180px]">
                    <p className="text-xs">Take Profit: Auto-sell when position gains this percentage.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-success font-bold">{settings.profit_take_percentage}%</span>
            </div>
            <Slider
              value={[settings.profit_take_percentage]}
              onValueChange={([v]) => handleUpdateField('profit_take_percentage', v)}
              min={TRADING_LIMITS.TAKE_PROFIT.min}
              max={500}
              step={5}
              className="[&_[role=slider]]:bg-success [&_[role=slider]]:border-success"
            />
          </div>
          <div className="p-3 bg-destructive/10 rounded-xl border border-destructive/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1 text-xs">
                <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                <span className="text-muted-foreground font-medium">SL</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground/50 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[180px]">
                    <p className="text-xs">Stop Loss: Auto-sell when position drops this percentage to limit losses.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-destructive font-bold">{settings.stop_loss_percentage}%</span>
            </div>
            <Slider
              value={[settings.stop_loss_percentage]}
              onValueChange={([v]) => handleUpdateField('stop_loss_percentage', v)}
              min={TRADING_LIMITS.STOP_LOSS.min}
              max={TRADING_LIMITS.STOP_LOSS.max}
              step={1}
              className="[&_[role=slider]]:bg-destructive [&_[role=slider]]:border-destructive"
            />
          </div>
        </div>
        
        {/* Buy Amount & Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-secondary/30 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1 text-xs">
                <Zap className="w-3.5 h-3.5 text-warning" />
                <span className="text-muted-foreground font-medium">Buy (SOL)</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground/50 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[180px]">
                    <p className="text-xs">Amount in SOL to spend on each trade. {isDemo ? 'Demo balance will be used.' : 'Uses your connected wallet.'}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-foreground font-bold">{settings.trade_amount}</span>
            </div>
            <Slider
              value={[settings.trade_amount * 10]}
              onValueChange={([v]) => handleUpdateField('trade_amount', v / 10)}
              min={1}
              max={50}
              step={1}
              className="[&_[role=slider]]:bg-warning [&_[role=slider]]:border-warning"
            />
          </div>
          <div className="p-3 bg-secondary/30 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1 text-xs">
                <Users className="w-3.5 h-3.5 text-primary" />
                <span className="text-muted-foreground font-medium">Max Trades</span>
              </div>
              <span className="text-foreground font-bold">{settings.max_concurrent_trades}</span>
            </div>
            <Slider
              value={[settings.max_concurrent_trades]}
              onValueChange={([v]) => handleUpdateField('max_concurrent_trades', v)}
              min={TRADING_LIMITS.MAX_CONCURRENT_TRADES.min}
              max={TRADING_LIMITS.MAX_CONCURRENT_TRADES.max}
              step={1}
              className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary"
            />
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="border-t border-border/50 p-3 shrink-0">
        {/* Safety Score */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center border border-success/20">
            <Shield className="w-4 h-4 text-success" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-medium text-foreground text-xs">Safety</span>
              <span className={`font-bold text-sm ${safetyScore >= 70 ? 'text-success' : safetyScore >= 40 ? 'text-warning' : 'text-destructive'}`}>
                {safetyScore}%
              </span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  safetyScore >= 70 ? 'bg-success' : safetyScore >= 40 ? 'bg-warning' : 'bg-destructive'
                }`}
                style={{ width: `${safetyScore}%` }}
              />
            </div>
          </div>
        </div>
        
        {/* Save Button */}
        <Button 
          className="w-full h-10" 
          variant="glow"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </Button>
      </div>
    </div>
  );
}
