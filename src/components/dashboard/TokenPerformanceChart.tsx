import { useMemo, useState, useCallback } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";

interface Position {
  id: string;
  token_symbol: string | null;
  token_name?: string | null;
  created_at: string;
  closed_at?: string | null;
  entry_value?: number | null;
  current_value?: number | null;
  entry_price: number;
  entry_price_usd?: number | null;
  current_price?: number | null;
  status?: string | null;
}

interface TokenPerformanceChartProps {
  positions: Position[];
  selectedPeriod: '1H' | '24H' | '7D' | '30D';
  height?: number;
}

const TOKEN_COLORS = [
  "hsl(95, 80%, 45%)",
  "hsl(42, 85%, 52%)",
  "hsl(160, 70%, 50%)",
  "hsl(30, 90%, 55%)",
  "hsl(0, 72%, 60%)",
  "hsl(180, 70%, 45%)",
  "hsl(60, 80%, 50%)",
  "hsl(120, 60%, 40%)",
];

const DEMO_TOKENS = ['JUP', 'MEW', 'WIF', 'POPCAT', 'BONK'];

function generateDemoData(selectedPeriod: string) {
  const now = new Date();
  const periods = selectedPeriod === "1H" ? 12 : selectedPeriod === "24H" ? 24 : selectedPeriod === "7D" ? 7 : 30;
  const intervalMs = selectedPeriod === "1H" ? 5 * 60 * 1000 : selectedPeriod === "24H" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  const seeds: Record<string, number> = {};
  DEMO_TOKENS.forEach((t, i) => { seeds[t] = 0.1 + i * 0.05; });

  return Array.from({ length: periods }, (_, i) => {
    const t = new Date(now.getTime() - (periods - i - 1) * intervalMs);
    const label = selectedPeriod === "1H" || selectedPeriod === "24H"
      ? t.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      : t.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const point: Record<string, any> = { date: label };
    DEMO_TOKENS.forEach((token, idx) => {
      const base = seeds[token];
      const noise = Math.sin(i * 0.8 + idx * 1.5) * 0.08 + Math.cos(i * 0.3 + idx) * 0.05;
      const trend = i * 0.003 * (idx % 2 === 0 ? 1 : -0.5);
      point[token] = Math.max(0.05, base + noise + trend);
    });
    return point;
  });
}

export default function TokenPerformanceChart({
  positions,
  selectedPeriod,
  height: _height,
}: TokenPerformanceChartProps) {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? 220 : 280;

  const { chartData, tokenSymbols } = useMemo(() => {
    const tokenMap = new Map<string, Position[]>();
    positions.forEach((p) => {
      const sym = p.token_symbol || "UNKNOWN";
      if (!tokenMap.has(sym)) tokenMap.set(sym, []);
      tokenMap.get(sym)!.push(p);
    });

    const symbols = Array.from(tokenMap.keys()).slice(0, 8);

    if (symbols.length === 0) {
      return { chartData: generateDemoData(selectedPeriod), tokenSymbols: DEMO_TOKENS };
    }

    const now = new Date();
    const periods = selectedPeriod === "1H" ? 12 : selectedPeriod === "24H" ? 24 : selectedPeriod === "7D" ? 7 : 30;
    const intervalMs = selectedPeriod === "1H" ? 5 * 60 * 1000 : selectedPeriod === "24H" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    const data: Record<string, any>[] = [];
    for (let i = 0; i < periods; i++) {
      const pointTime = new Date(now.getTime() - (periods - i - 1) * intervalMs);
      const label = selectedPeriod === "1H" || selectedPeriod === "24H"
        ? pointTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
        : pointTime.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      const point: Record<string, any> = { date: label };
      symbols.forEach((sym) => {
        const tokenPositions = tokenMap.get(sym) || [];
        let value = 0;
        tokenPositions.forEach((pos) => {
          const created = new Date(pos.created_at);
          const closed = pos.closed_at ? new Date(pos.closed_at) : null;
          if (created <= pointTime && (!closed || closed > pointTime)) {
            value += pos.current_value ?? pos.entry_value ?? 0;
          }
        });
        point[sym] = value;
      });
      data.push(point);
    }
    return { chartData: data, tokenSymbols: symbols };
  }, [positions, selectedPeriod]);

  const [hiddenTokens, setHiddenTokens] = useState<Set<string>>(new Set());

  const toggleToken = useCallback((sym: string) => {
    setHiddenTokens(prev => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      return next;
    });
  }, []);

  const visibleTokens = tokenSymbols.filter(s => !hiddenTokens.has(s));

  const formatYAxis = (value: number) => {
    if (value >= 1) return `${value.toFixed(1)}`;
    if (value >= 0.01) return `${value.toFixed(3)}`;
    return `${value.toFixed(4)}`;
  };

  const renderTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg p-2.5 shadow-lg text-xs">
        <p className="text-muted-foreground mb-1 font-medium text-[10px]">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center gap-2 py-0.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-foreground font-medium text-[10px]">{entry.name}</span>
            <span className="text-muted-foreground ml-auto tabular-nums text-[10px]">
              {(entry.value as number).toFixed(4)} SOL
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <defs>
            {tokenSymbols.map((sym, idx) => (
              <linearGradient key={sym} id={`area-grad-${sym}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TOKEN_COLORS[idx % TOKEN_COLORS.length]} stopOpacity={0.55} />
                <stop offset="40%" stopColor={TOKEN_COLORS[idx % TOKEN_COLORS.length]} stopOpacity={0.2} />
                <stop offset="100%" stopColor={TOKEN_COLORS[idx % TOKEN_COLORS.length]} stopOpacity={0.0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 12% 14%)" vertical={false} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 9, fill: "hsl(100 12% 45%)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 9, fill: "hsl(100 12% 45%)" }}
            tickFormatter={formatYAxis}
            width={50}
          />
          <Tooltip content={renderTooltip} />
          {visibleTokens.map((sym, _) => {
            const idx = tokenSymbols.indexOf(sym);
            return (
              <Area
                key={sym}
                type="monotone"
                dataKey={sym}
                stroke={TOKEN_COLORS[idx % TOKEN_COLORS.length]}
                strokeWidth={2}
                fill={`url(#area-grad-${sym})`}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>

      {/* Interactive token legend - centered with checkboxes */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 pt-3 px-1">
        {tokenSymbols.map((sym, idx) => {
          const isHidden = hiddenTokens.has(sym);
          return (
            <label
              key={sym}
              onClick={() => toggleToken(sym)}
              className={`flex items-center gap-1.5 text-[10px] font-medium cursor-pointer px-2 py-1 rounded transition-all ${
                isHidden ? 'opacity-40' : 'opacity-100'
              } hover:bg-secondary/30`}
            >
              <span
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  isHidden 
                    ? 'border-muted-foreground/30 bg-transparent' 
                    : 'border-transparent'
                }`}
                style={{
                  backgroundColor: isHidden ? 'transparent' : TOKEN_COLORS[idx % TOKEN_COLORS.length],
                }}
              >
                {!isHidden && (
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5L4.5 7.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
              <span className={isHidden ? 'text-muted-foreground line-through' : 'text-foreground'}>
                {sym}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
