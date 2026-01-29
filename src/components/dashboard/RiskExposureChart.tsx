import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface RiskExposureChartProps {
  data?: {
    name: string;
    value: number;
    color: string;
  }[];
}

const defaultData = [
  { name: 'Medium Risk', value: 40, color: '#f59e0b' },
  { name: 'Low Risk', value: 30, color: '#22c55e' },
  { name: 'High Risk', value: 20, color: '#ef4444' },
  { name: 'Critical Risk', value: 10, color: '#dc2626' },
];

const RADIAN = Math.PI / 180;

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={10}
      fontWeight="bold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function RiskExposureChart({ data = defaultData }: RiskExposureChartProps) {
  return (
    <Card className="border border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Risk Exposure Donut Chart
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '10px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-1.5">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[9px] text-muted-foreground">{item.value}% {item.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
