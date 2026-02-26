import { useMemo, forwardRef } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface RiskExposureChartProps {
  positions: {
    id: string;
    token_symbol: string | null;
    entry_value?: number | null;
    profit_loss_percent?: number | null;
  }[];
}

const RISK_COLORS = {
  'Low': 'hsl(95, 80%, 45%)',
  'Medium': 'hsl(42, 85%, 52%)',
  'High': 'hsl(30, 90%, 55%)',
  'Critical': 'hsl(0, 72%, 51%)',
};

const CUSTOM_LABEL = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, payload }: any) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const displayPercent = payload?.percent ?? Math.round(percent * 100);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
      {`${displayPercent}%`}
    </text>
  );
};

const RiskExposureChart = forwardRef<HTMLDivElement, RiskExposureChartProps>(function RiskExposureChart({ positions }, ref) {
  const riskData = useMemo(() => {
    if (positions.length === 0) {
      return [
        { name: 'Medium', value: 40, percent: 40 },
        { name: 'Low', value: 30, percent: 30 },
        { name: 'High', value: 20, percent: 20 },
        { name: 'Critical', value: 10, percent: 10 },
      ];
    }
    let low = 0, med = 0, high = 0, critical = 0;
    positions.forEach(p => {
      const pnl = Math.abs(p.profit_loss_percent ?? 0);
      const val = p.entry_value ?? 1;
      if (pnl <= 5) low += val;
      else if (pnl <= 15) med += val;
      else if (pnl <= 30) high += val;
      else critical += val;
    });
    const total = low + med + high + critical || 1;
    return [
      { name: 'Medium', value: med, percent: Math.round((med / total) * 100) },
      { name: 'Low', value: low, percent: Math.round((low / total) * 100) },
      { name: 'High', value: high, percent: Math.round((high / total) * 100) },
      { name: 'Critical', value: critical, percent: Math.round((critical / total) * 100) },
    ].filter(d => d.value > 0);
  }, [positions]);

  return (
    <div ref={ref} className="rounded-xl border border-border/30 bg-card/40 overflow-hidden flex flex-col h-[340px]">
      <div className="px-4 py-3 border-b border-border/20">
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground whitespace-nowrap">Risk Exposure</h3>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-2">
        <div className="w-full" style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={riskData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={75}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
                label={CUSTOM_LABEL}
                labelLine={false}
              >
                {riskData.map((entry) => (
                  <Cell key={entry.name} fill={RISK_COLORS[entry.name as keyof typeof RISK_COLORS] || 'hsl(var(--muted))'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(140 18% 8%)',
                  border: '1px solid hsl(140 12% 18%)',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
                formatter={(value: number, name: string) => [`${name}`, '']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
          {riskData.map((item) => (
            <div key={item.name} className="flex items-center gap-1 text-[9px] whitespace-nowrap">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: RISK_COLORS[item.name as keyof typeof RISK_COLORS] }} />
              <span className="text-muted-foreground font-medium">{item.percent}% {item.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default RiskExposureChart;
