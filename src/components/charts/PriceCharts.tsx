import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface PriceChartProps {
  data: { time: string; price: number }[];
  height?: number;
  showGrid?: boolean;
  color?: string;
}

export const PriceChart = ({ data, height = 120, showGrid = false, color = '#22c55e' }: PriceChartProps) => {
  const isPositive = data.length >= 2 && data[data.length - 1].price >= data[0].price;
  const chartColor = color || (isPositive ? '#22c55e' : '#ef4444');

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />}
        <XAxis 
          dataKey="time" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis 
          hide 
          domain={['auto', 'auto']}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          formatter={(value: number) => [`$${value.toFixed(8)}`, 'Price']}
        />
        <defs>
          <linearGradient id={`gradient-${chartColor}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={chartColor} stopOpacity={0.3}/>
            <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="price"
          stroke={chartColor}
          strokeWidth={2}
          fill={`url(#gradient-${chartColor})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

interface PortfolioChartProps {
  data: { date: string; value: number; pnl: number }[];
  height?: number;
}

export const PortfolioChart = ({ data, height = 200 }: PortfolioChartProps) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis 
          dataKey="date" 
          axisLine={false} 
          tickLine={false}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis 
          axisLine={false} 
          tickLine={false}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          formatter={(value: number, name: string) => [
            `$${value.toFixed(2)}`,
            name === 'value' ? 'Portfolio Value' : 'P&L'
          ]}
        />
        <defs>
          <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#portfolioGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
