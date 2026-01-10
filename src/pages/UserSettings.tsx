import React, { forwardRef, useState } from "react";
import TradingHeader from "@/components/trading/TradingHeader";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { WalletConnect } from "@/components/WalletConnect";
import {
  Settings,
  Wallet,
  Zap,
  Save,
  Copy,
  Users,
  TrendingUp,
} from "lucide-react";

const UserSettings = forwardRef<HTMLDivElement, object>(function UserSettings(_props, ref) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("sniping");

  const [snipingSettings, setSnipingSettings] = useState({
    maxSlippage: "5",
    defaultBuyAmount: "0.1",
    autoBuy: false,
    autoSell: false,
    stopLoss: "20",
    takeProfit: "100",
  });

  const [copyTradeSettings, setCopyTradeSettings] = useState({
    enabled: false,
    walletAddress: "",
    maxPerTrade: "0.5",
    copyPercentage: "50",
  });

  const tabs = [
    { id: "sniping", label: "Sniping Settings", icon: Zap },
    { id: "copytrade", label: "Copy Trading", icon: Users },
    { id: "wallet", label: "Wallet", icon: Wallet },
  ];

  const { wallet, connectPhantom, disconnect } = useWallet();

  const handleConnectWallet = async () => {
    if (wallet.isConnected) {
      await disconnect();
    } else {
      await connectPhantom();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TradingHeader
        walletConnected={wallet.isConnected}
        walletAddress={wallet.address || undefined}
        network={wallet.network}
        onConnectWallet={handleConnectWallet}
      />

      <main className="relative pt-20 md:pt-24 pb-8">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 rounded-lg bg-primary/10">
              <Settings className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                My Settings
              </h1>
              <p className="text-muted-foreground">
                Manage your sniping, copy-trading, and wallet settings
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
              {/* Sniping Settings Tab */}
              {activeTab === "sniping" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="glass rounded-xl p-5">
                    <h2 className="text-lg font-semibold text-foreground mb-2">
                      Sniping Settings
                    </h2>
                    <p className="text-sm text-muted-foreground mb-6">
                      Configure your personal trading parameters for token sniping.
                    </p>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">
                          Max Slippage (%)
                        </label>
                        <input
                          type="number"
                          value={snipingSettings.maxSlippage}
                          onChange={(e) =>
                            setSnipingSettings({
                              ...snipingSettings,
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
                          value={snipingSettings.defaultBuyAmount}
                          onChange={(e) =>
                            setSnipingSettings({
                              ...snipingSettings,
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
                          value={snipingSettings.stopLoss}
                          onChange={(e) =>
                            setSnipingSettings({
                              ...snipingSettings,
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
                          value={snipingSettings.takeProfit}
                          onChange={(e) =>
                            setSnipingSettings({
                              ...snipingSettings,
                              takeProfit: e.target.value,
                            })
                          }
                          className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                        />
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-border">
                      <h3 className="font-medium text-foreground mb-4">
                        Automation
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
                              setSnipingSettings({
                                ...snipingSettings,
                                autoBuy: !snipingSettings.autoBuy,
                              })
                            }
                            className={`w-12 h-7 rounded-full relative transition-colors ${
                              snipingSettings.autoBuy ? "bg-primary" : "bg-muted"
                            }`}
                          >
                            <div
                              className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                                snipingSettings.autoBuy
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
                              setSnipingSettings({
                                ...snipingSettings,
                                autoSell: !snipingSettings.autoSell,
                              })
                            }
                            className={`w-12 h-7 rounded-full relative transition-colors ${
                              snipingSettings.autoSell ? "bg-primary" : "bg-muted"
                            }`}
                          >
                            <div
                              className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                                snipingSettings.autoSell
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
                      Save Sniping Settings
                    </Button>
                  </div>
                </div>
              )}

              {/* Copy Trading Tab */}
              {activeTab === "copytrade" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="glass rounded-xl p-5">
                    <h2 className="text-lg font-semibold text-foreground mb-2">
                      Copy Trading
                    </h2>
                    <p className="text-sm text-muted-foreground mb-6">
                      Follow successful traders and automatically copy their trades.
                    </p>

                    <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg mb-6">
                      <div>
                        <p className="font-medium text-foreground">Enable Copy Trading</p>
                        <p className="text-sm text-muted-foreground">
                          Automatically mirror trades from followed wallets
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setCopyTradeSettings({
                            ...copyTradeSettings,
                            enabled: !copyTradeSettings.enabled,
                          })
                        }
                        className={`w-12 h-7 rounded-full relative transition-colors ${
                          copyTradeSettings.enabled ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <div
                          className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                            copyTradeSettings.enabled
                              ? "translate-x-6"
                              : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">
                          Wallet Address to Follow
                        </label>
                        <input
                          type="text"
                          value={copyTradeSettings.walletAddress}
                          onChange={(e) =>
                            setCopyTradeSettings({
                              ...copyTradeSettings,
                              walletAddress: e.target.value,
                            })
                          }
                          placeholder="Enter wallet address..."
                          className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-lg text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                        />
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground mb-2 block">
                            Max Per Trade (SOL)
                          </label>
                          <input
                            type="number"
                            value={copyTradeSettings.maxPerTrade}
                            onChange={(e) =>
                              setCopyTradeSettings({
                                ...copyTradeSettings,
                                maxPerTrade: e.target.value,
                              })
                            }
                            className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground mb-2 block">
                            Copy Percentage (%)
                          </label>
                          <input
                            type="number"
                            value={copyTradeSettings.copyPercentage}
                            onChange={(e) =>
                              setCopyTradeSettings({
                                ...copyTradeSettings,
                                copyPercentage: e.target.value,
                              })
                            }
                            className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button variant="glow">
                      <Save className="w-4 h-4" />
                      Save Copy Trade Settings
                    </Button>
                  </div>
                </div>
              )}

              {/* Wallet Tab */}
              {activeTab === "wallet" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="glass rounded-xl p-5">
                    <h2 className="text-lg font-semibold text-foreground mb-2">
                      Wallet Connection
                    </h2>
                    <p className="text-sm text-muted-foreground mb-6">
                      Connect your wallet to execute trades. Your private keys never leave your wallet.
                    </p>

                    <WalletConnect />

                    <div className="mt-6 pt-6 border-t border-border">
                      <h3 className="font-medium text-foreground mb-3">Supported Wallets</h3>
                      <div className="grid sm:grid-cols-3 gap-3">
                        <div className="p-3 bg-secondary/30 rounded-lg text-center">
                          <span className="text-2xl mb-2 block">👻</span>
                          <p className="text-sm font-medium text-foreground">Phantom</p>
                          <p className="text-xs text-muted-foreground">Solana</p>
                        </div>
                        <div className="p-3 bg-secondary/30 rounded-lg text-center">
                          <span className="text-2xl mb-2 block">🦊</span>
                          <p className="text-sm font-medium text-foreground">MetaMask</p>
                          <p className="text-xs text-muted-foreground">ETH / BSC</p>
                        </div>
                        <div className="p-3 bg-secondary/30 rounded-lg text-center">
                          <span className="text-2xl mb-2 block">🔗</span>
                          <p className="text-sm font-medium text-foreground">WalletConnect</p>
                          <p className="text-xs text-muted-foreground">Multi-chain</p>
                        </div>
                      </div>
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
});

UserSettings.displayName = 'UserSettings';

export default UserSettings;
