import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface SnipeHistoryEntry {
  id: string;
  time: string;
  token: string;
  tokenIcon?: string;
  action: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number;
  pnlSol: number;
  pnlPercent: number;
  duration: string;
  aiConfidence: number;
}

interface SnipeHistoryTableProps {
  entries?: SnipeHistoryEntry[];
}

const defaultEntries: SnipeHistoryEntry[] = [
  { id: '1', time: '10:05 AM', token: 'JUP', action: 'buy', entryPrice: 0.21, exitPrice: 0.22, pnlSol: 0.01, pnlPercent: 4.76, duration: '30m', aiConfidence: 92 },
  { id: '2', time: '10:05 AM', token: 'MEW', action: 'sell', entryPrice: 0.21, exitPrice: 0.22, pnlSol: 0.01, pnlPercent: 4.76, duration: '30m', aiConfidence: 92 },
  { id: '3', time: '10:05 AM', token: 'WIF', action: 'buy', entryPrice: 0.21, exitPrice: 0.22, pnlSol: 0.01, pnlPercent: 4.76, duration: '30m', aiConfidence: 92 },
  { id: '4', time: '10:05 AM', token: 'JUP', action: 'sell', entryPrice: 0.21, exitPrice: 0.22, pnlSol: -0.01, pnlPercent: -4.76, duration: '30m', aiConfidence: 92 },
  { id: '5', time: '10:05 AM', token: 'BONK', action: 'buy', entryPrice: 0.21, exitPrice: 0.22, pnlSol: 0.01, pnlPercent: 4.76, duration: '30m', aiConfidence: 92 },
];

export default function SnipeHistoryTable({ entries = defaultEntries }: SnipeHistoryTableProps) {
  return (
    <Card className="border-0 bg-gradient-to-br from-card/90 to-card/60 backdrop-blur-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Snipe History Table
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Time</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Token</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Action</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Entry Price</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Exit Price</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">P&L (SOL/%)</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Duration</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">AI Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, index) => (
                <TableRow 
                  key={entry.id} 
                  className="border-border/20 hover:bg-secondary/30 animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <TableCell className="text-xs text-muted-foreground font-mono">{entry.time}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {entry.token.slice(0, 2)}
                      </div>
                      <span className="text-xs font-semibold">{entry.token}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline"
                      className={cn(
                        "text-[10px] font-semibold uppercase",
                        entry.action === 'buy' 
                          ? 'bg-success/20 text-success border-success/30' 
                          : 'bg-primary/20 text-primary border-primary/30'
                      )}
                    >
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{entry.entryPrice.toFixed(4)} SOL</TableCell>
                  <TableCell className="text-xs font-mono">{entry.exitPrice.toFixed(4)} SOL</TableCell>
                  <TableCell>
                    <span className={cn(
                      "text-xs font-semibold",
                      entry.pnlSol >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {entry.pnlSol >= 0 ? '+' : ''}{entry.pnlSol.toFixed(2)} SOL ({entry.pnlPercent.toFixed(2)}%)
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{entry.duration}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={entry.aiConfidence} className="h-2 w-12 bg-secondary" />
                      <span className="text-xs font-semibold text-primary">{entry.aiConfidence}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
