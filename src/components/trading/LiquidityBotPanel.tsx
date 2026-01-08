import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { SniperSettings } from "@/hooks/useSniperSettings";
import { 
  Power, 
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
} from "lucide-react";

interface LiquidityBotPanelProps {
  settings: SniperSettings | null;
  saving: boolean;
  onUpdateField: <K extends keyof SniperSettings>(field: K, value: SniperSettings[K]) => void;
  onSave: () => void;
  isActive: boolean;
  onToggleActive: (active: boolean) => void;
}

export default function LiquidityBotPanel({
  settings,
  saving,
  onUpdateField,
  onSave,
  isActive,
  onToggleActive,
}: LiquidityBotPanelProps) {
  const [autoEntry, setAutoEntry] = useState(true);
  const [autoExit, setAutoExit] = useState(true);
  const [targetBuyerPosition, setTargetBuyerPosition] = useState(2);

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
    <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-colors ${
              isActive 
                ? 'bg-gradient-to-br from-success/20 to-success/5 border-success/30' 
                : 'bg-secondary border-border/50'
            }`}>
              <Bot className={`w-5 h-5 ${isActive ? 'text-success' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-lg">Liquidity Bot</h2>
              <p className={`text-xs font-medium ${isActive ? 'text-success' : 'text-muted-foreground'}`}>
                {isActive ? '● Active' : '○ Inactive'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
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
            <span className="text-sm text-muted-foreground">Auto Entry</span>
            <Switch
              checked={autoEntry}
              onCheckedChange={setAutoEntry}
              className="data-[state=checked]:bg-success"
            />
          </div>
          <div className="w-px h-6 bg-border" />
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm text-muted-foreground">Auto Exit</span>
            <Switch
              checked={autoExit}
              onCheckedChange={setAutoExit}
              className="data-[state=checked]:bg-success"
            />
          </div>
        </div>
      </div>
      
      {/* Settings */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Min Liquidity */}
        <div className="p-4 bg-secondary/30 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground font-medium">Min Liquidity (SOL)</span>
            </div>
            <span className="text-primary font-bold text-lg">{settings.min_liquidity}</span>
          </div>
          <Slider
            value={[settings.min_liquidity]}
            onValueChange={([v]) => onUpdateField('min_liquidity', v)}
            min={50}
            max={1000}
            step={10}
            className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>50 SOL</span>
            <span>1000 SOL</span>
          </div>
        </div>
        
        {/* Target Buyer Position */}
        <div className="p-4 bg-secondary/30 rounded-xl">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium mb-3">
            <Target className="w-4 h-4 text-primary" />
            Target Buyer Position
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((pos) => (
              <button
                key={pos}
                onClick={() => setTargetBuyerPosition(pos)}
                className={`py-2.5 rounded-lg font-semibold text-sm transition-all ${
                  targetBuyerPosition === pos
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
                }`}
              >
                #{pos}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Bot enters when becoming buyer #{targetBuyerPosition}
          </p>
        </div>
        
        {/* Take Profit & Stop Loss */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-success/10 rounded-xl border border-success/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-sm">
                <TrendingUp className="w-4 h-4 text-success" />
                <span className="text-muted-foreground font-medium">Take Profit</span>
              </div>
              <span className="text-success font-bold text-lg">{settings.profit_take_percentage}%</span>
            </div>
            <Slider
              value={[settings.profit_take_percentage]}
              onValueChange={([v]) => onUpdateField('profit_take_percentage', v)}
              min={10}
              max={500}
              step={5}
              className="[&_[role=slider]]:bg-success [&_[role=slider]]:border-success"
            />
          </div>
          <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-sm">
                <TrendingDown className="w-4 h-4 text-destructive" />
                <span className="text-muted-foreground font-medium">Stop Loss</span>
              </div>
              <span className="text-destructive font-bold text-lg">{settings.stop_loss_percentage}%</span>
            </div>
            <Slider
              value={[settings.stop_loss_percentage]}
              onValueChange={([v]) => onUpdateField('stop_loss_percentage', v)}
              min={5}
              max={50}
              step={1}
              className="[&_[role=slider]]:bg-destructive [&_[role=slider]]:border-destructive"
            />
          </div>
        </div>
        
        {/* Buy Amount */}
        <div className="p-4 bg-secondary/30 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm">
              <Zap className="w-4 h-4 text-warning" />
              <span className="text-muted-foreground font-medium">Buy Amount (SOL)</span>
            </div>
            <span className="text-foreground font-bold text-lg">{settings.trade_amount}</span>
          </div>
          <Slider
            value={[settings.trade_amount * 10]}
            onValueChange={([v]) => onUpdateField('trade_amount', v / 10)}
            min={1}
            max={50}
            step={1}
            className="[&_[role=slider]]:bg-warning [&_[role=slider]]:border-warning"
          />
        </div>
        
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-secondary/40 rounded-xl p-3 text-center">
            <div className="text-primary font-bold text-lg">5%</div>
            <div className="text-xs text-muted-foreground">Slippage</div>
          </div>
          <div className="bg-secondary/40 rounded-xl p-3 text-center">
            <div className="text-primary font-bold text-lg">5m</div>
            <div className="text-xs text-muted-foreground">Max Age</div>
          </div>
          <div className="bg-secondary/40 rounded-xl p-3 text-center">
            <div className="text-primary font-bold text-lg">{settings.max_concurrent_trades}</div>
            <div className="text-xs text-muted-foreground">Max Trades</div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="border-t border-border/50 p-4">
        {/* Safety Score */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center border border-success/20">
            <Shield className="w-5 h-5 text-success" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-foreground text-sm">Safety Score</h3>
              <span className={`font-bold ${safetyScore >= 70 ? 'text-success' : safetyScore >= 40 ? 'text-warning' : 'text-destructive'}`}>
                {safetyScore}%
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
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
          className="w-full h-12" 
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
