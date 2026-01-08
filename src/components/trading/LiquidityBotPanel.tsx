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
  Clock,
  BarChart3,
  Shield,
  Loader2,
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
      <div className="bg-card rounded-xl border border-border p-6 flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
    <div className="bg-card rounded-xl border border-border overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <Power className={`w-5 h-5 ${isActive ? 'text-success' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-lg">Liquidity Bot</h2>
              <p className="text-xs text-muted-foreground">
                {isActive ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Settings2 className="w-4 h-4" />
            </Button>
            <Switch
              checked={isActive}
              onCheckedChange={onToggleActive}
            />
          </div>
        </div>
        
        {/* Auto Entry/Exit Toggles */}
        <div className="flex items-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Auto Entry</span>
            <Switch
              checked={autoEntry}
              onCheckedChange={setAutoEntry}
              className="data-[state=checked]:bg-success"
            />
          </div>
          <div className="flex items-center gap-2">
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
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Min Liquidity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="w-4 h-4" />
              Min Liquidity (SOL)
            </div>
            <span className="text-success font-bold">{settings.min_liquidity}</span>
          </div>
          <Slider
            value={[settings.min_liquidity]}
            onValueChange={([v]) => onUpdateField('min_liquidity', v)}
            min={50}
            max={1000}
            step={10}
            className="[&_[role=slider]]:bg-success [&_[role=slider]]:border-success [&_.range]:bg-success"
          />
        </div>
        
        {/* Target Buyer Position */}
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Users className="w-4 h-4" />
            Target Buyer Position
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((pos) => (
              <button
                key={pos}
                onClick={() => setTargetBuyerPosition(pos)}
                className={`py-2 rounded-lg font-semibold text-sm transition-colors ${
                  targetBuyerPosition === pos
                    ? 'bg-success text-success-foreground'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Bot enters when becoming the 2 or 3 buyer
          </p>
        </div>
        
        {/* Take Profit & Stop Loss */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TrendingUp className="w-4 h-4 text-success" />
                Take Profit
              </div>
              <span className="text-success font-bold">{settings.profit_take_percentage}%</span>
            </div>
            <Slider
              value={[settings.profit_take_percentage]}
              onValueChange={([v]) => onUpdateField('profit_take_percentage', v)}
              min={10}
              max={500}
              step={5}
              className="[&_[role=slider]]:bg-success [&_[role=slider]]:border-success [&_.range]:bg-success"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TrendingDown className="w-4 h-4 text-destructive" />
                Stop Loss
              </div>
              <span className="text-destructive font-bold">{settings.stop_loss_percentage}%</span>
            </div>
            <Slider
              value={[settings.stop_loss_percentage]}
              onValueChange={([v]) => onUpdateField('stop_loss_percentage', v)}
              min={5}
              max={50}
              step={1}
              className="[&_[role=slider]]:bg-destructive [&_[role=slider]]:border-destructive [&_.range]:bg-destructive"
            />
          </div>
        </div>
        
        {/* Buy Amount */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="w-4 h-4" />
              Buy Amount (SOL)
            </div>
            <span className="text-foreground font-bold">{settings.trade_amount}</span>
          </div>
          <Slider
            value={[settings.trade_amount * 10]}
            onValueChange={([v]) => onUpdateField('trade_amount', v / 10)}
            min={1}
            max={50}
            step={1}
            className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary [&_.range]:bg-primary"
          />
        </div>
        
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <div className="text-success font-bold text-lg">5%</div>
            <div className="text-xs text-muted-foreground">Slippage</div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <div className="text-success font-bold text-lg">5m</div>
            <div className="text-xs text-muted-foreground">Max Age</div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <div className="text-primary font-bold text-lg">{settings.max_concurrent_trades}</div>
            <div className="text-xs text-muted-foreground">Max Trades</div>
          </div>
        </div>
      </div>
      
      {/* Safety Analysis Section */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-success" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Safety Analysis</h3>
            <p className="text-xs text-muted-foreground">Token risk assessment</p>
          </div>
        </div>
        
        {/* Safety Score Gauge */}
        <div className="relative pt-2">
          <div className="text-xs text-muted-foreground mb-2">Safety Score</div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-destructive via-warning to-success rounded-full transition-all duration-500"
              style={{ width: `${safetyScore}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0</span>
            <span className="text-success font-semibold">{safetyScore}%</span>
            <span>100</span>
          </div>
        </div>
        
        {/* Save Button */}
        <Button 
          className="w-full mt-4" 
          variant="glow"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
