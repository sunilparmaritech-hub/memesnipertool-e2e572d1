import Header from "@/components/Header";
import TokenCard from "@/components/TokenCard";
import { Button } from "@/components/ui/button";
import { Search, Filter, RefreshCw, SlidersHorizontal, Sparkles } from "lucide-react";
import { useState } from "react";

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
  {
    name: "Frog Coin",
    symbol: "FROG",
    price: "$0.00000567",
    priceChange: 89.4,
    volume: "$3.4M",
    liquidity: "$920K",
    holders: 5670,
    age: "1h 10m",
    riskScore: "low" as const,
  },
  {
    name: "Ape Together",
    symbol: "APE2",
    price: "$0.00000123",
    priceChange: -5.7,
    volume: "$1.8M",
    liquidity: "$560K",
    holders: 2340,
    age: "4h 20m",
    riskScore: "medium" as const,
  },
];

const Scanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [filter, setFilter] = useState("all");

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => setIsScanning(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <main className="relative pt-20 md:pt-24 pb-8">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                Token Scanner
              </h1>
              <p className="text-muted-foreground">
                Real-time scanning of new meme tokens across multiple chains
              </p>
            </div>
            <Button
              variant="glow"
              onClick={handleScan}
              disabled={isScanning}
              className="min-w-[140px]"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
              {isScanning ? "Scanning..." : "Scan Now"}
            </Button>
          </div>

          {/* Filters Bar */}
          <div className="glass rounded-xl p-4 mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name, symbol, or contract..."
                  className="w-full h-11 pl-10 pr-4 bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                />
              </div>

              {/* Filter Buttons */}
              <div className="flex flex-wrap gap-2">
                {["all", "new", "trending", "low-risk"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                      filter === f
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {f === "all" ? "All Tokens" : f.replace("-", " ")}
                  </button>
                ))}
                <Button variant="outline" size="sm" className="h-10">
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Advanced
                </Button>
              </div>
            </div>

            {/* Active Filters */}
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              <span className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full border border-primary/20">
                Min Liquidity: $100K
              </span>
              <span className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full border border-primary/20">
                Chain: Solana
              </span>
              <span className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full border border-primary/20">
                Age: {"<"} 24h
              </span>
            </div>
          </div>

          {/* AI Insights Banner */}
          <div className="glass rounded-xl p-4 mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground text-sm">AI Insight</h3>
                <p className="text-muted-foreground text-sm">
                  3 new tokens matching your criteria detected. PEPE showing unusual whale activity.
                </p>
              </div>
              <Button variant="ghost" size="sm" className="text-primary">
                View Details
              </Button>
            </div>
          </div>

          {/* Token Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockTokens.map((token, index) => (
              <TokenCard key={index} {...token} />
            ))}
          </div>

          {/* Load More */}
          <div className="text-center mt-8">
            <Button variant="outline" size="lg">
              Load More Tokens
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Scanner;
