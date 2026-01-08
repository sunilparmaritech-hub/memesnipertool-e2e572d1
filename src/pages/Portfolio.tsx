import Header from "@/components/Header";
import StatsCard from "@/components/StatsCard";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, DollarSign, PieChart, BarChart3, Wallet } from "lucide-react";

const holdings = [
  {
    name: "Pepe The Frog",
    symbol: "PEPE",
    amount: "12,500,000",
    value: "$154.25",
    pnl: "+$89.50",
    pnlPercent: 138.2,
    avgBuy: "$0.00000052",
  },
  {
    name: "Degen Cat",
    symbol: "DCAT",
    amount: "5,200,000",
    value: "$16.69",
    pnl: "-$3.21",
    pnlPercent: -16.1,
    avgBuy: "$0.00000382",
  },
  {
    name: "Moon Rocket",
    symbol: "MOON",
    amount: "890,000",
    value: "$40.58",
    pnl: "+$28.40",
    pnlPercent: 233.5,
    avgBuy: "$0.00001367",
  },
];

const recentTrades = [
  { type: "buy", token: "PEPE", amount: "5M", value: "$25.50", time: "2h ago" },
  { type: "sell", token: "WOJAK", amount: "2M", value: "$18.20", time: "4h ago" },
  { type: "buy", token: "MOON", amount: "500K", value: "$12.30", time: "6h ago" },
  { type: "buy", token: "DCAT", amount: "1M", value: "$3.80", time: "12h ago" },
];

const Portfolio = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/3 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <main className="relative pt-20 md:pt-24 pb-8">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Portfolio
            </h1>
            <p className="text-muted-foreground">
              Track your holdings and trading performance
            </p>
          </div>

          {/* Portfolio Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatsCard
              title="Total Value"
              value="$211.52"
              change="+$114.69"
              changeType="positive"
              icon={Wallet}
            />
            <StatsCard
              title="Total P&L"
              value="+118.3%"
              change="24h"
              changeType="positive"
              icon={TrendingUp}
            />
            <StatsCard
              title="Holdings"
              value="3"
              changeType="neutral"
              icon={PieChart}
            />
            <StatsCard
              title="Total Trades"
              value="47"
              change="+12 this week"
              changeType="positive"
              icon={BarChart3}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Holdings */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Holdings</h2>
              <div className="space-y-3">
                {holdings.map((holding, index) => (
                  <div
                    key={index}
                    className="glass rounded-xl p-4 hover:border-primary/30 transition-all animate-fade-in"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">
                            {holding.symbol[0]}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{holding.name}</h3>
                          <p className="text-sm text-muted-foreground font-mono">
                            ${holding.symbol}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground font-mono">
                          {holding.value}
                        </p>
                        <p
                          className={`text-sm font-mono ${
                            holding.pnlPercent >= 0 ? "text-success" : "text-destructive"
                          }`}
                        >
                          {holding.pnl} ({holding.pnlPercent >= 0 ? "+" : ""}
                          {holding.pnlPercent.toFixed(1)}%)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex gap-4">
                        <span className="text-muted-foreground">
                          Amount:{" "}
                          <span className="text-foreground font-mono">{holding.amount}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Avg Buy:{" "}
                          <span className="text-foreground font-mono">{holding.avgBuy}</span>
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          Buy
                        </Button>
                        <Button variant="destructive" size="sm">
                          Sell
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Trades */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Recent Trades</h2>
              <div className="glass rounded-xl p-4">
                <div className="space-y-3">
                  {recentTrades.map((trade, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            trade.type === "buy"
                              ? "bg-success/10 text-success"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {trade.type.toUpperCase()}
                        </span>
                        <div>
                          <p className="font-medium text-foreground font-mono">
                            ${trade.token}
                          </p>
                          <p className="text-xs text-muted-foreground">{trade.amount}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm text-foreground">{trade.value}</p>
                        <p className="text-xs text-muted-foreground">{trade.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" className="w-full mt-4 text-primary">
                  View All Trades
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Portfolio;
