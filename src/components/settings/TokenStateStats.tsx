import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTokenStateManager, TokenState } from '@/hooks/useTokenStateManager';
import { Trash2, Loader2, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface StatItem {
  label: string;
  state: TokenState;
  count: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}

export default function TokenStateStats() {
  const { getStateCounts, clearTokensByState, reload, loading } = useTokenStateManager();
  const [counts, setCounts] = useState({ newCount: 0, pendingCount: 0, tradedCount: 0, rejectedCount: 0, total: 0 });
  const [clearing, setClearing] = useState<TokenState | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refreshCounts = () => {
    setCounts(getStateCounts());
  };

  useEffect(() => {
    refreshCounts();
    const interval = setInterval(refreshCounts, 3000);
    return () => clearInterval(interval);
  }, [getStateCounts]);

  const handleClear = async (state: TokenState, label: string) => {
    setClearing(state);
    try {
      const cleared = await clearTokensByState(state);
      toast.success(`Cleared ${cleared} ${label} record${cleared !== 1 ? 's' : ''}`);
      refreshCounts();
    } catch {
      toast.error(`Failed to clear ${label} records`);
    } finally {
      setClearing(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await reload();
    refreshCounts();
    setRefreshing(false);
    toast.success('Token states refreshed');
  };

  const stats: StatItem[] = [
    {
      label: 'Traded',
      state: 'TRADED',
      count: counts.tradedCount,
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/20',
    },
    {
      label: 'Rejected',
      state: 'REJECTED',
      count: counts.rejectedCount,
      icon: XCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive/20',
    },
    {
      label: 'Pending',
      state: 'PENDING',
      count: counts.pendingCount,
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/20',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Token Processing Records</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="gap-1.5"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const isClearing = clearing === stat.state;

          return (
            <Card key={stat.state} className={`${stat.borderColor} border`}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-md ${stat.bgColor}`}>
                      <Icon className={`w-4 h-4 ${stat.color}`} />
                    </div>
                    <span className="text-sm font-medium text-foreground">{stat.label}</span>
                  </div>
                  <Badge variant="outline" className={`font-mono ${stat.color} border-current/20`}>
                    {stat.count}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                  onClick={() => handleClear(stat.state, stat.label)}
                  disabled={isClearing || stat.count === 0}
                >
                  {isClearing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  Clear {stat.label}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
