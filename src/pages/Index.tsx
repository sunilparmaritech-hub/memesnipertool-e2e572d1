import Header from "@/components/Header";
import TokenCard from "@/components/TokenCard";
import StatsCard from "@/components/StatsCard";
import LiveFeed from "@/components/LiveFeed";
import { Button } from "@/components/ui/button";
import { Search, Filter, Zap, TrendingUp, DollarSign, Activity, Rocket } from "lucide-react";

const mockTokens = [
  {
    name: "Pepe The Frog",
    symbol: "PEPE",
    price: "$0.00001234",
    priceChange: 124.5,
    volume: "$12.5M",
    liquidity: "$2.8M",
    holders: 45230,
    age: "2h 15m",
    riskScore: "low" as const,
  },
  {
    name: "Wojak Finance",
    symbol: "WOJAK",
    price: "$0.00000089",
    priceChange: -12.3,
    volume: "$890K",
    liquidity: "$450K",
    holders: 1250,
    age: "45m",
    riskScore: "medium" as const,
  },
  {
    name: "Moon Rocket",
    symbol: "MOON",
    price: "$0.00000456",
    priceChange: 567.8,
    volume: "$5.2M",
    liquidity: "$1.1M",
    holders: 8900,
    age: "1h 30m",
    riskScore: "high" as const,
  },
  {
    name: "Degen Cat",
    symbol: "DCAT",
    price: "$0.00000321",
    priceChange: 45.2,
    volume: "$2.1M",
    liquidity: "$780K",
    holders: 3400,
    age: "3h 45m",
    riskScore: "low" as const,
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <main className="relative pt-20 md:pt-24 pb-8">
        <div className="container mx-auto px-4">
          {/* Hero Section */}
          <section className="py-8 md:py-12 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 animate-fade-in">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">AI-Powered Token Discovery</span>
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 animate-fade-in">
              <span className="text-foreground">Snipe Meme Tokens</span>
              <br />
              <span className="text-gradient">Before They Moon</span>
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-8 animate-fade-in">
              Real-time token scanning, risk analysis, and one-click trading powered by external APIs. Non-custodial & secure.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
              <Button variant="glow" size="xl">
                <Rocket className="w-5 h-5" />
                Start Sniping
              </Button>
              <Button variant="outline" size="xl">
                View Scanner
              </Button>
            </div>
          </section>

          {/* Stats Grid */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatsCard
              title="Tokens Scanned"
              value="12,847"
              change="+124 today"
              changeType="positive"
              icon={Activity}
            />
            <StatsCard
              title="Profitable Trades"
              value="89.2%"
              change="+2.1%"
              changeType="positive"
              icon={TrendingUp}
            />
            <StatsCard
              title="Total Volume"
              value="$4.2M"
              change="+$892K"
              changeType="positive"
              icon={DollarSign}
            />
            <StatsCard
              title="Active Wallets"
              value="2,341"
              change="+156"
              changeType="positive"
              icon={Zap}
            />
          </section>

          {/* Main Content */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Token List */}
            <div className="lg:col-span-2 space-y-4">
              {/* Search & Filter */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search tokens..."
                    className="w-full h-11 pl-10 pr-4 bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                  />
                </div>
                <Button variant="outline" className="h-11 px-4">
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </div>

              {/* Token Grid */}
              <div className="grid sm:grid-cols-2 gap-4">
                {mockTokens.map((token, index) => (
                  <TokenCard key={index} {...token} />
                ))}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <LiveFeed />
              
              {/* Quick Actions */}
              <div className="glass rounded-xl p-4 md:p-5">
                <h3 className="font-semibold text-foreground mb-4">Quick Settings</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <span className="text-sm text-muted-foreground">Auto-Buy</span>
                    <div className="w-10 h-6 bg-primary/20 rounded-full relative cursor-pointer">
                      <div className="absolute left-1 top-1 w-4 h-4 bg-primary rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <span className="text-sm text-muted-foreground">Max Slippage</span>
                    <span className="font-mono text-sm text-foreground">5%</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <span className="text-sm text-muted-foreground">Default Buy</span>
                    <span className="font-mono text-sm text-foreground">0.1 SOL</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
