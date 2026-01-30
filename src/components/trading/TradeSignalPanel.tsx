import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTradeSignals, TradeSignal } from '@/hooks/useTradeSignals';
import { useWallet } from '@/hooks/useWallet';
import { useAppMode } from '@/contexts/AppModeContext';
import { 
  Zap, 
  Clock, 
  AlertTriangle, 
  X, 
  Loader2,
  TrendingUp,
  Droplets,
  Target
} from 'lucide-react';

interface TradeSignalCardProps {
  signal: TradeSignal;
  onExecute: (signal: TradeSignal) => void;
  onCancel: (signalId: string) => void;
  isExecuting: boolean;
  walletConnected: boolean;
}

function TradeSignalCard({ 
  signal, 
  onExecute, 
  onCancel, 
  isExecuting,
  walletConnected 
}: TradeSignalCardProps) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateTimeLeft = () => {
      const expires = new Date(signal.expires_at);
      const now = new Date();
      const diff = expires.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft('Expired');
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [signal.expires_at]);

  const isExpired = timeLeft === 'Expired';

  return (
    <div className={`p-2.5 rounded-lg border ${isExpired ? 'border-border/30 opacity-50' : 'border-primary/40 bg-primary/5'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="font-bold text-sm truncate">{signal.token_symbol}</span>
            {signal.is_pump_fun && (
              <Badge variant="secondary" className="text-[8px] px-1 h-4">Pump</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <Droplets className="h-2.5 w-2.5 text-blue-400" />
              {signal.liquidity.toFixed(0)}
            </span>
            <span className="flex items-center gap-0.5">
              <Target className="h-2.5 w-2.5 text-success" />
              {signal.trade_amount}
            </span>
            <span className="flex items-center gap-0.5">
              <AlertTriangle className={`h-2.5 w-2.5 ${signal.risk_score > 60 ? 'text-destructive' : 'text-warning'}`} />
              {signal.risk_score}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5">
          <div className={`flex items-center gap-0.5 text-[10px] ${isExpired ? 'text-muted-foreground' : 'text-primary'}`}>
            <Clock className="h-2.5 w-2.5" />
            <span className="font-mono">{timeLeft}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => onCancel(signal.id)}
            disabled={isExecuting || isExpired}
          >
            <X className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => onExecute(signal)}
            disabled={isExecuting || isExpired || !walletConnected}
          >
            {isExecuting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Zap className="h-3 w-3 mr-0.5" />
                Execute
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function TradeSignalPanel() {
  const { signals, loading, executing, executeSignal, cancelSignal, pendingCount } = useTradeSignals();
  const { wallet } = useWallet();
  const { mode } = useAppMode();
  const isDemo = mode === 'demo';

  if (loading) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border/40">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">TRADE SIGNALS</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/40">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">TRADE SIGNALS</span>
            {pendingCount > 0 && (
              <Badge variant="default" className="text-[9px] h-4 px-1.5">
                {pendingCount} pending
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      
      <CardContent className="px-3 pb-3 pt-0">
        {signals.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-[10px]">No pending trade signals</p>
            <p className="text-[9px] mt-0.5 text-muted-foreground/70">Approved tokens will appear here</p>
          </div>
        ) : (
          <ScrollArea className="h-[200px] pr-2">
            <div className="space-y-1.5">
              {signals.map(signal => (
                <TradeSignalCard
                  key={signal.id}
                  signal={signal}
                  onExecute={executeSignal}
                  onCancel={cancelSignal}
                  isExecuting={executing === signal.id}
                  walletConnected={wallet.isConnected}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
