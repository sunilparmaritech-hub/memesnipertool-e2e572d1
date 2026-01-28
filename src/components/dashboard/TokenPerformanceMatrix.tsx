import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { cn } from "@/lib/utils";

type Period = '1H' | '24H' | '7D' | '30D';

interface TokenData {
  symbol: string;
  color: string;
  enabled: boolean;
}

interface TokenPerformanceMatrixProps {
  positions?: Array<{
    token_symbol: string;
    created_at: string;
    current_value: number;
    entry_value: number;
  }>;
}

const defaultTokens: TokenData[] = [
  { symbol: 'JUP', color: '#22c55e', enabled: true },
  { symbol: 'MEW', color: '#6366f1', enabled: true },
  { symbol: 'WIF', color: '#f59e0b', enabled: true },
  { symbol: 'POPCAT', color: '#ec4899', enabled: true },
  { symbol: 'BONK', color: '#8b5cf6', enabled: false },
];

// Generate sample data for the chart
const generateChartData = (period: Period, tokens: TokenData[]) => {
  const now = new Date();
  const points = period === '1H' ? 12 : period === '24H' ? 24 : period === '7D' ? 7 : 30;
  const intervalMs = period === '1H' ? 5 * 60 * 1000 : period === '24H' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  
  const data = [];
  
  for (let i = 0; i < points; i++) {
    const time = new Date(now.getTime() - (points - 1 - i) * intervalMs);
    const label = period === '1H' || period === '24H'
      ? time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    const point: Record<string, any> = { time: label };
    
    tokens.forEach((token) => {
      // Generate realistic-looking random walk data
      const baseValue = 0.15 + Math.random() * 0.2;
      const variance = Math.sin(i * 0.5) * 0.1 + Math.cos(i * 0.3) * 0.05;
      point[token.symbol] = parseFloat((baseValue + variance + (Math.random() - 0.5) * 0.05).toFixed(4));
    });
    
    data.push(point);
  }
  
  return data;
};

export default function TokenPerformanceMatrix({ positions = [] }: TokenPerformanceMatrixProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('24H');
  const [tokens, setTokens] = useState<TokenData[]>(defaultTokens);
  
  const chartData = useMemo(() => generateChartData(selectedPeriod, tokens), [selectedPeriod, tokens]);
  
  const toggleToken = (symbol: string) => {
    setTokens(prev => prev.map(t => 
      t.symbol === symbol ? { ...t, enabled: !t.enabled } : t
    ));
  };

  const formatYAxis = (value: number) => `${value.toFixed(3)} SOL`;

  return (
    <Card className="border-0 bg-gradient-to-br from-card/90 to-card/60 backdrop-blur-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Token Performance Matrix
          </CardTitle>
          <div className="flex gap-1 bg-secondary/60 rounded-lg p-0.5">
            {(['1H', '24H', '7D', '30D'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  period === selectedPeriod 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis 
                dataKey="time" 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={formatYAxis}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              {tokens.filter(t => t.enabled).map((token) => (
                <Line
                  key={token.symbol}
                  type="monotone"
                  dataKey={token.symbol}
                  stroke={token.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Token Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border/30">
          {tokens.map((token) => (
            <label
              key={token.symbol}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={token.enabled}
                onCheckedChange={() => toggleToken(token.symbol)}
                className="data-[state=checked]:bg-transparent data-[state=checked]:border-current"
                style={{ borderColor: token.color, color: token.color }}
              />
              <div className="flex items-center gap-1.5">
                <div 
                  className="w-3 h-0.5 rounded-full"
                  style={{ backgroundColor: token.color }}
                />
                <span className="text-xs font-medium text-muted-foreground">{token.symbol}</span>
              </div>
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
