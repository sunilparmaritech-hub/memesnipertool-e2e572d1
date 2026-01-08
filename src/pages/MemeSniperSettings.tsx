import { useState } from 'react';
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSniperSettings, SnipingPriority } from "@/hooks/useSniperSettings";
import {
  Crosshair,
  Save,
  Loader2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Layers,
  Zap,
  Filter,
  Shield,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";

const CATEGORY_OPTIONS = [
  { id: 'animals', label: 'Animals', emoji: '🐕' },
  { id: 'parody', label: 'Parody', emoji: '🎭' },
  { id: 'trend', label: 'Trend', emoji: '📈' },
  { id: 'utility', label: 'Utility', emoji: '⚙️' },
];

const PRIORITY_OPTIONS: { value: SnipingPriority; label: string; description: string }[] = [
  { value: 'normal', label: 'Normal', description: 'Standard transaction priority' },
  { value: 'fast', label: 'Fast', description: 'Higher gas for faster execution' },
  { value: 'turbo', label: 'Turbo', description: 'Maximum speed, highest fees' },
];

const MemeSniperSettings = () => {
  const { settings, loading, saving, saveSettings, updateField } = useSniperSettings();
  const [newBlacklistToken, setNewBlacklistToken] = useState('');
  const [newWhitelistToken, setNewWhitelistToken] = useState('');

  const handleSave = async () => {
    if (!settings) return;
    try {
      await saveSettings(settings);
    } catch {
      // Error already handled in hook
    }
  };

  const toggleCategory = (categoryId: string) => {
    if (!settings) return;
    const current = settings.category_filters;
    const updated = current.includes(categoryId)
      ? current.filter(c => c !== categoryId)
      : [...current, categoryId];
    updateField('category_filters', updated);
  };

  const addToBlacklist = () => {
    if (!settings || !newBlacklistToken.trim()) return;
    if (settings.token_blacklist.includes(newBlacklistToken.trim())) {
      toast.error('Token already in blacklist');
      return;
    }
    updateField('token_blacklist', [...settings.token_blacklist, newBlacklistToken.trim()]);
    setNewBlacklistToken('');
  };

  const removeFromBlacklist = (token: string) => {
    if (!settings) return;
    updateField('token_blacklist', settings.token_blacklist.filter(t => t !== token));
  };

  const addToWhitelist = () => {
    if (!settings || !newWhitelistToken.trim()) return;
    if (settings.token_whitelist.includes(newWhitelistToken.trim())) {
      toast.error('Token already in whitelist');
      return;
    }
    updateField('token_whitelist', [...settings.token_whitelist, newWhitelistToken.trim()]);
    setNewWhitelistToken('');
  };

  const removeFromWhitelist = (token: string) => {
    if (!settings) return;
    updateField('token_whitelist', settings.token_whitelist.filter(t => t !== token));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center pt-32">
          <p className="text-muted-foreground">Please sign in to access settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/3 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <main className="relative pt-20 md:pt-24 pb-8">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <Crosshair className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  Meme Sniper Settings
                </h1>
                <p className="text-muted-foreground">
                  Configure your token sniping parameters
                </p>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} variant="glow">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Settings
            </Button>
          </div>

          <div className="grid gap-6">
            {/* Trading Parameters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Trading Parameters
                </CardTitle>
                <CardDescription>Set your core trading values</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min_liquidity">Minimum Liquidity (SOL)</Label>
                    <Input
                      id="min_liquidity"
                      type="number"
                      value={settings.min_liquidity}
                      onChange={(e) => updateField('min_liquidity', parseFloat(e.target.value) || 0)}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">Min pool liquidity to consider</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trade_amount">Trade Amount (SOL)</Label>
                    <Input
                      id="trade_amount"
                      type="number"
                      step="0.01"
                      value={settings.trade_amount}
                      onChange={(e) => updateField('trade_amount', parseFloat(e.target.value) || 0)}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">Amount per trade</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_concurrent">Max Concurrent Trades</Label>
                    <Input
                      id="max_concurrent"
                      type="number"
                      min="1"
                      max="20"
                      value={settings.max_concurrent_trades}
                      onChange={(e) => updateField('max_concurrent_trades', parseInt(e.target.value) || 1)}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">Simultaneous open positions</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Profit & Loss Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Profit & Loss Settings
                </CardTitle>
                <CardDescription>Configure your exit strategy</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="profit_take" className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      Take Profit (%)
                    </Label>
                    <Input
                      id="profit_take"
                      type="number"
                      min="1"
                      value={settings.profit_take_percentage}
                      onChange={(e) => updateField('profit_take_percentage', parseFloat(e.target.value) || 0)}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">Auto-sell when profit reaches this %</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stop_loss" className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-500" />
                      Stop Loss (%)
                    </Label>
                    <Input
                      id="stop_loss"
                      type="number"
                      min="1"
                      max="100"
                      value={settings.stop_loss_percentage}
                      onChange={(e) => updateField('stop_loss_percentage', parseFloat(e.target.value) || 0)}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">Auto-sell when loss reaches this %</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sniping Priority */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Sniping Priority
                </CardTitle>
                <CardDescription>Set transaction speed priority</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-3">
                  {PRIORITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => updateField('priority', option.value)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        settings.priority === option.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-secondary/30 hover:bg-secondary/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className={`h-4 w-4 ${
                          option.value === 'turbo' ? 'text-red-500' :
                          option.value === 'fast' ? 'text-yellow-500' : 'text-muted-foreground'
                        }`} />
                        <span className="font-semibold text-foreground">{option.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Category Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-primary" />
                  Meme Token Categories
                </CardTitle>
                <CardDescription>Select which token categories to scan</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {CATEGORY_OPTIONS.map((category) => {
                    const isActive = settings.category_filters.includes(category.id);
                    return (
                      <button
                        key={category.id}
                        onClick={() => toggleCategory(category.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all ${
                          isActive
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
                        }`}
                      >
                        <span>{category.emoji}</span>
                        <span className="font-medium">{category.label}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Token Blacklist & Whitelist */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Blacklist */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-red-500" />
                    Token Blacklist
                  </CardTitle>
                  <CardDescription>Tokens to never buy</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Token address..."
                      value={newBlacklistToken}
                      onChange={(e) => setNewBlacklistToken(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addToBlacklist()}
                      className="font-mono text-sm"
                    />
                    <Button size="icon" onClick={addToBlacklist} variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {settings.token_blacklist.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No tokens blacklisted</p>
                    ) : (
                      settings.token_blacklist.map((token) => (
                        <Badge key={token} variant="destructive" className="gap-1 font-mono text-xs">
                          {token.slice(0, 8)}...{token.slice(-4)}
                          <button onClick={() => removeFromBlacklist(token)}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Whitelist */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-500" />
                    Token Whitelist
                  </CardTitle>
                  <CardDescription>Priority tokens to always consider</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Token address..."
                      value={newWhitelistToken}
                      onChange={(e) => setNewWhitelistToken(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addToWhitelist()}
                      className="font-mono text-sm"
                    />
                    <Button size="icon" onClick={addToWhitelist} variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {settings.token_whitelist.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No tokens whitelisted</p>
                    ) : (
                      settings.token_whitelist.map((token) => (
                        <Badge key={token} variant="outline" className="gap-1 font-mono text-xs border-green-500/50 text-green-500">
                          {token.slice(0, 8)}...{token.slice(-4)}
                          <button onClick={() => removeFromWhitelist(token)}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MemeSniperSettings;
