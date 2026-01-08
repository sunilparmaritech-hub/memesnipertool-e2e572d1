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
  ChevronDown,
  Loader2,
} from "lucide-react";

interface TokenScannerPanelProps {
  tokens: ScannedToken[];
  loading: boolean;
  onScan: () => void;
  scanSpeed: 'slow' | 'normal' | 'fast';
  onSpeedChange: (speed: 'slow' | 'normal' | 'fast') => void;
  isPaused: boolean;
  onPauseToggle: () => void;
}

const formatLiquidity = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(0)}M liq`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K liq`;
  return `$${value.toFixed(0)} liq`;
};

const TokenRow = ({ token, index }: { token: ScannedToken; index: number }) => {
  const [expanded, setExpanded] = useState(false);
  const isPositive = token.priceChange24h >= 0;
  
  // Generate initials from token name
  const initials = token.symbol.slice(0, 2).toUpperCase();
  
  // Determine safety status based on risk score
  const getSafetyIcons = () => {
    const honeypotSafe = token.riskScore < 50;
    const taxSafe = token.riskScore < 40;
    const liquidityLocked = token.liquidityLocked;
    
    return (
      <div className="flex items-center gap-1.5">
        {honeypotSafe ? (
          <ShieldCheck className="w-4 h-4 text-success" />
        ) : (
          <ShieldX className="w-4 h-4 text-destructive" />
        )}
        {taxSafe ? (
          <ShieldCheck className="w-4 h-4 text-success" />
        ) : (
          <ShieldX className="w-4 h-4 text-warning" />
        )}
        {liquidityLocked ? (
          <Lock className="w-4 h-4 text-success" />
        ) : (
          <Lock className="w-4 h-4 text-muted-foreground" />
        )}
        <RefreshCw className="w-4 h-4 text-success animate-spin" style={{ animationDuration: '3s' }} />
      </div>
    );
  };

  // Generate background color based on index for avatar
  const avatarColors = [
    'bg-primary/20 text-primary',
    'bg-blue-500/20 text-blue-400',
    'bg-purple-500/20 text-purple-400',
    'bg-orange-500/20 text-orange-400',
    'bg-pink-500/20 text-pink-400',
  ];
  const avatarClass = avatarColors[index % avatarColors.length];

  // Get DEX badge
  const getDexBadge = () => {
    const dex = token.source?.toLowerCase() || 'raydium';
    if (dex.includes('jupiter')) return 'jupiter';
    if (dex.includes('raydium')) return 'raydium';
    return 'raydium';
  };

  const dexName = getDexBadge();

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <div 
        className="flex items-center gap-3 p-3 hover:bg-secondary/30 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${avatarClass}`}>
          {initials}
        </div>
        
        {/* Token Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{token.name.slice(0, 15)}</span>
            <span className="text-muted-foreground text-sm">{token.symbol}</span>
            <Badge 
              className={`text-[10px] px-1.5 py-0 ${
                dexName === 'jupiter' 
                  ? 'bg-success/20 text-success border-success/30' 
                  : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
              }`}
            >
              {dexName}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-mono">{token.address.slice(0, 4)}...{token.address.slice(-4)}</span>
            <ExternalLink className="w-3 h-3" />
          </div>
        </div>
        
        {/* Safety Icons */}
        {getSafetyIcons()}
        
        {/* Price Change */}
        <div className="text-right min-w-[80px]">
          <div className={`font-bold ${isPositive ? 'text-success' : 'text-destructive'}`}>
            {isPositive ? '+' : ''}{token.priceChange24h.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground">
            {formatLiquidity(token.liquidity)}
          </div>
        </div>
        
        {/* Expand Arrow */}
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>
      
      {/* Expanded Details */}
      {expanded && (
        <div className="px-3 pb-3 pl-16 grid grid-cols-3 gap-4 text-xs animate-fade-in">
          <div>
            <span className="text-muted-foreground">Buyers:</span>
            <span className="ml-2 text-foreground">{token.earlyBuyers}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Lock:</span>
            <span className="ml-2 text-foreground">{token.lockPercentage || 0}%</span>
          </div>
          <div>
            <span className="text-muted-foreground">Risk:</span>
            <span className={`ml-2 ${token.riskScore < 40 ? 'text-success' : token.riskScore < 70 ? 'text-warning' : 'text-destructive'}`}>
              {token.riskScore}/100
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

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
  
  const filteredTokens = tokens.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-lg">AI Token Scanner</h2>
              <p className="text-xs text-muted-foreground">Monitoring Raydium, Jupiter & Orca pools</p>
            </div>
          </div>
          
          {/* Speed Selector & Pause */}
          <div className="flex items-center gap-2">
            <div className="flex bg-secondary rounded-lg p-0.5">
              {(['slow', 'normal', 'fast'] as const).map((speed) => (
                <button
                  key={speed}
                  onClick={() => onSpeedChange(speed)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    scanSpeed === speed 
                      ? 'bg-success text-success-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {speed}
                </button>
              ))}
            </div>
            
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Filter className="w-4 h-4" />
            </Button>
            
            <Button 
              variant={isPaused ? "default" : "outline"} 
              size="sm"
              onClick={onPauseToggle}
              className={isPaused ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {isPaused ? <Play className="w-4 h-4 mr-1" /> : <Pause className="w-4 h-4 mr-1" />}
              {isPaused ? "Resume" : "Pause"}
            </Button>
          </div>
        </div>
        
        {/* Status Bar */}
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-success animate-pulse' : isPaused ? 'bg-warning' : 'bg-success'}`} />
            <span className="text-muted-foreground">
              {loading ? 'Scanning...' : isPaused ? 'Paused' : 'Active'}
            </span>
          </div>
          <span className="text-muted-foreground">•</span>
          <span className="text-foreground font-medium">{tokens.length} tokens detected</span>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-3 h-1 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full bg-success rounded-full transition-all duration-300"
            style={{ width: loading ? '60%' : '100%' }}
          />
        </div>
      </div>
      
      {/* Search */}
      <div className="p-3 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tokens, addresses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-secondary/50 border-border/50"
          />
        </div>
      </div>
      
      {/* Token List */}
      <div className="flex-1 overflow-y-auto">
        {loading && tokens.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filteredTokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Shield className="w-10 h-10 mb-2 opacity-50" />
            <p>No tokens found</p>
            <Button variant="ghost" size="sm" onClick={onScan} className="mt-2">
              Scan Now
            </Button>
          </div>
        ) : (
          filteredTokens.map((token, idx) => (
            <TokenRow key={token.id} token={token} index={idx} />
          ))
        )}
      </div>
    </div>
  );
}
