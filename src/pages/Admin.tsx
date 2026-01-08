import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Settings,
  Key,
  Shield,
  Bell,
  Zap,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface ApiConfig {
  name: string;
  key: string;
  endpoint: string;
  status: "connected" | "disconnected" | "error";
  description: string;
}

const Admin = () => {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState("api");
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([
    {
      name: "DexScreener API",
      key: "dex_sk_**********************",
      endpoint: "https://api.dexscreener.com/latest",
      status: "connected",
      description: "Token data and price feeds",
    },
    {
      name: "Jupiter Aggregator",
      key: "",
      endpoint: "https://quote-api.jup.ag/v6",
      status: "disconnected",
      description: "Swap routing and execution",
    },
    {
      name: "Birdeye API",
      key: "be_**********************",
      endpoint: "https://public-api.birdeye.so",
      status: "connected",
      description: "Token analytics and holder data",
    },
    {
      name: "Helius RPC",
      key: "",
      endpoint: "",
      status: "disconnected",
      description: "Solana RPC for transaction submission",
    },
  ]);

  const [tradingSettings, setTradingSettings] = useState({
    maxSlippage: "5",
    defaultBuyAmount: "0.1",
    autoBuy: false,
    autoSell: false,
    stopLoss: "20",
    takeProfit: "100",
  });

  const toggleShowKey = (name: string) => {
    setShowKeys((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const tabs = [
    { id: "api", label: "API Settings", icon: Key },
    { id: "trading", label: "Trading", icon: Zap },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Shield },
  ];

  const statusStyles = {
    connected: "bg-success/10 text-success border-success/20",
    disconnected: "bg-muted text-muted-foreground border-border",
    error: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/3 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <main className="relative pt-20 md:pt-24 pb-8">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 rounded-lg bg-primary/10">
              <Settings className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Admin Settings
              </h1>
              <p className="text-muted-foreground">
                Configure APIs, trading parameters, and security
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-4 gap-6">
            {/* Sidebar Tabs */}
            <div className="lg:col-span-1">
              <div className="glass rounded-xl p-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                      activeTab === tab.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content Area */}
            <div className="lg:col-span-3">
              {/* API Settings Tab */}
              {activeTab === "api" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="glass rounded-xl p-5">
                    <h2 className="text-lg font-semibold text-foreground mb-2">
                      External API Configuration
                    </h2>
                    <p className="text-sm text-muted-foreground mb-6">
                      Configure API endpoints for token scanning, trading, and data feeds.
                      All trades are executed through these external APIs.
                    </p>

                    <div className="space-y-4">
                      {apiConfigs.map((api, index) => (
                        <div
                          key={index}
                          className="p-4 bg-secondary/30 rounded-lg border border-border"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-foreground">
                                  {api.name}
                                </h3>
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-medium border ${
                                    statusStyles[api.status]
                                  }`}
                                >
                                  {api.status}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {api.description}
                              </p>
                            </div>
                            {api.status === "connected" ? (
                              <CheckCircle className="w-5 h-5 text-success" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">
                                API Endpoint
                              </label>
                              <input
                                type="text"
                                value={api.endpoint}
                                placeholder="https://api.example.com"
                                className="w-full h-10 px-3 bg-background border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">
                                API Key
                              </label>
                              <div className="relative">
                                <input
                                  type={showKeys[api.name] ? "text" : "password"}
                                  value={api.key}
                                  placeholder="Enter your API key"
                                  className="w-full h-10 px-3 pr-10 bg-background border border-border rounded-lg text-foreground text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                                />
                                <button
                                  onClick={() => toggleShowKey(api.name)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                  {showKeys[api.name] ? (
                                    <EyeOff className="w-4 h-4" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-end mt-4">
                            <Button variant="outline" size="sm">
                              Test Connection
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button variant="glow">
                      <Save className="w-4 h-4" />
                      Save API Settings
                    </Button>
                  </div>
                </div>
              )}

              {/* Trading Tab */}
              {activeTab === "trading" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="glass rounded-xl p-5">
                    <h2 className="text-lg font-semibold text-foreground mb-2">
                      Trading Parameters
                    </h2>
                    <p className="text-sm text-muted-foreground mb-6">
                      Configure default trading parameters and automation settings.
                    </p>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">
                          Max Slippage (%)
                        </label>
                        <input
                          type="number"
                          value={tradingSettings.maxSlippage}
                          onChange={(e) =>
                            setTradingSettings({
                              ...tradingSettings,
                              maxSlippage: e.target.value,
                            })
                          }
                          className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">
                          Default Buy Amount (SOL)
                        </label>
                        <input
                          type="number"
                          value={tradingSettings.defaultBuyAmount}
                          onChange={(e) =>
                            setTradingSettings({
                              ...tradingSettings,
                              defaultBuyAmount: e.target.value,
                            })
                          }
                          className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">
                          Stop Loss (%)
                        </label>
                        <input
                          type="number"
                          value={tradingSettings.stopLoss}
                          onChange={(e) =>
                            setTradingSettings({
                              ...tradingSettings,
                              stopLoss: e.target.value,
                            })
                          }
                          className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">
                          Take Profit (%)
                        </label>
                        <input
                          type="number"
                          value={tradingSettings.takeProfit}
                          onChange={(e) =>
                            setTradingSettings({
                              ...tradingSettings,
                              takeProfit: e.target.value,
                            })
                          }
                          className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                        />
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-border">
                      <h3 className="font-medium text-foreground mb-4">
                        Automation Settings
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                          <div>
                            <p className="font-medium text-foreground">Auto-Buy</p>
                            <p className="text-sm text-muted-foreground">
                              Automatically buy tokens matching your criteria
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              setTradingSettings({
                                ...tradingSettings,
                                autoBuy: !tradingSettings.autoBuy,
                              })
                            }
                            className={`w-12 h-7 rounded-full relative transition-colors ${
                              tradingSettings.autoBuy ? "bg-primary" : "bg-muted"
                            }`}
                          >
                            <div
                              className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                                tradingSettings.autoBuy
                                  ? "translate-x-6"
                                  : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                          <div>
                            <p className="font-medium text-foreground">Auto-Sell</p>
                            <p className="text-sm text-muted-foreground">
                              Automatically sell at stop-loss or take-profit
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              setTradingSettings({
                                ...tradingSettings,
                                autoSell: !tradingSettings.autoSell,
                              })
                            }
                            className={`w-12 h-7 rounded-full relative transition-colors ${
                              tradingSettings.autoSell ? "bg-primary" : "bg-muted"
                            }`}
                          >
                            <div
                              className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                                tradingSettings.autoSell
                                  ? "translate-x-6"
                                  : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button variant="glow">
                      <Save className="w-4 h-4" />
                      Save Trading Settings
                    </Button>
                  </div>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === "notifications" && (
                <div className="glass rounded-xl p-5 animate-fade-in">
                  <h2 className="text-lg font-semibold text-foreground mb-2">
                    Notification Settings
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Configure how you receive alerts and notifications.
                  </p>
                  <div className="space-y-4">
                    {[
                      "New token alerts",
                      "Price movement alerts",
                      "Trade execution",
                      "Whale activity",
                    ].map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg"
                      >
                        <span className="text-foreground">{item}</span>
                        <button className="w-12 h-7 bg-primary rounded-full relative">
                          <div className="absolute top-1 translate-x-6 w-5 h-5 bg-white rounded-full" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === "security" && (
                <div className="glass rounded-xl p-5 animate-fade-in">
                  <h2 className="text-lg font-semibold text-foreground mb-2">
                    Security Settings
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Manage security preferences and wallet permissions.
                  </p>

                  <div className="p-4 bg-success/5 border border-success/20 rounded-lg mb-6">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-success" />
                      <div>
                        <p className="font-medium text-success">Non-Custodial Mode</p>
                        <p className="text-sm text-muted-foreground">
                          Your wallet keys are never stored. All transactions require your
                          signature.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                      <div>
                        <p className="font-medium text-foreground">
                          Transaction Confirmation
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Require confirmation for all trades
                        </p>
                      </div>
                      <button className="w-12 h-7 bg-primary rounded-full relative">
                        <div className="absolute top-1 translate-x-6 w-5 h-5 bg-white rounded-full" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                      <div>
                        <p className="font-medium text-foreground">Max Trade Limit</p>
                        <p className="text-sm text-muted-foreground">
                          Set maximum SOL per trade
                        </p>
                      </div>
                      <input
                        type="number"
                        defaultValue="1"
                        className="w-24 h-10 px-3 bg-background border border-border rounded-lg text-foreground font-mono text-right focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Admin;
