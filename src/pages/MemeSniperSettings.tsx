import React, { forwardRef, useState } from 'react';
import AppLayout from "@/components/layout/AppLayout";
import ValidationRuleTogglesPanel from "@/components/settings/ValidationRuleToggles";
import TokenStateStats from "@/components/settings/TokenStateStats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useSniperSettings } from "@/hooks/useSniperSettings";
import { useTokenStateManager } from "@/hooks/useTokenStateManager";
import { useScannerStore } from "@/stores/scannerStore";
import { isValidSolanaAddress } from "@/lib/sniperValidation";
import {
  Save,
  Loader2,
  Shield,
  Plus,
  X,
  Star,
  Info,
  Bot,
  Database,
  Crosshair,
  Gauge,
  Target,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

const MemeSniperSettings = forwardRef<HTMLDivElement, object>(function MemeSniperSettings(_props, ref) {
  const { settings, loading, saving, saveSettings, updateField } = useSniperSettings();
  const { clearRejectedTokens } = useTokenStateManager();
  const { maxPoolSize, setMaxPoolSize } = useScannerStore();
  const [newBlacklistToken, setNewBlacklistToken] = useState('');
  const [newWhitelistToken, setNewWhitelistToken] = useState('');

  const handleSave = async () => {
    if (!settings) return;
    try {
      await saveSettings(settings);
      await clearRejectedTokens();
      toast.success('Settings saved — rejected token cache cleared for re-evaluation');
    } catch {
      // Error already handled in hook
    }
  };

  const addToBlacklist = () => {
    if (!settings || !newBlacklistToken.trim()) return;
    const trimmed = newBlacklistToken.trim();
    if (!isValidSolanaAddress(trimmed)) { toast.error('Invalid Solana token address format'); return; }
    if (settings.token_blacklist.includes(trimmed)) { toast.error('Token already in blacklist'); return; }
    updateField('token_blacklist', [...settings.token_blacklist, trimmed]);
    setNewBlacklistToken('');
    toast.success('Token added to blacklist');
  };

  const removeFromBlacklist = (token: string) => {
    if (!settings) return;
    updateField('token_blacklist', settings.token_blacklist.filter(t => t !== token));
    toast.success('Token removed from blacklist');
  };

  const addToWhitelist = () => {
    if (!settings || !newWhitelistToken.trim()) return;
    const trimmed = newWhitelistToken.trim();
    if (!isValidSolanaAddress(trimmed)) { toast.error('Invalid Solana token address format'); return; }
    if (settings.token_whitelist.includes(trimmed)) { toast.error('Token already in whitelist'); return; }
    updateField('token_whitelist', [...settings.token_whitelist, trimmed]);
    setNewWhitelistToken('');
    toast.success('Token added to whitelist');
  };

  const removeFromWhitelist = (token: string) => {
    if (!settings) return;
    updateField('token_whitelist', settings.token_whitelist.filter(t => t !== token));
    toast.success('Token removed from whitelist');
  };

  const priorities = [
    { value: 'normal' as const, label: 'Normal', desc: 'Standard fees' },
    { value: 'fast' as const, label: 'Fast', desc: 'Higher priority' },
    { value: 'turbo' as const, label: 'Turbo', desc: 'Max speed' },
  ];

  const categories = [
    { value: 'animals', label: 'Animals' },
    { value: 'parody', label: 'Parody' },
    { value: 'trend', label: 'Trending' },
    { value: 'utility', label: 'Utility' },
  ];

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center pt-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!settings) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center pt-12">
          <p className="text-muted-foreground">Please sign in to access settings.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto max-w-[1600px] px-2 sm:px-3 md:px-5 py-2 sm:py-3 space-y-3 sm:space-y-4">
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} variant="glow" size="sm">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Settings
          </Button>
        </div>

        {/* ── SECTION 1: Trading Parameters ── */}
        <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Trading Parameters</h3>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {/* Trade Amount */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Trade Amount</span>
                <Badge variant="outline" className="tabular-nums font-bold">{settings.trade_amount} SOL</Badge>
              </div>
              <Slider
                value={[settings.trade_amount]}
                onValueChange={([val]) => updateField('trade_amount', val)}
                min={0.01} max={5} step={0.01}
              />
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>0.01</span><span>1</span><span>2.5</span><span>5 SOL</span>
              </div>
            </div>

            {/* Min Liquidity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Min Liquidity</span>
                <Badge variant="outline" className="tabular-nums font-bold">{settings.min_liquidity} SOL</Badge>
              </div>
              <Slider
                value={[settings.min_liquidity]}
                onValueChange={([val]) => updateField('min_liquidity', val)}
                min={1} max={500} step={1}
              />
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>1</span><span>100</span><span>250</span><span>500 SOL</span>
              </div>
            </div>

            {/* Slippage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Slippage Tolerance</span>
                <Badge variant="outline" className="tabular-nums font-bold">{settings.slippage_tolerance ?? 15}%</Badge>
              </div>
              <Slider
                value={[settings.slippage_tolerance ?? 15]}
                onValueChange={([val]) => updateField('slippage_tolerance', val)}
                min={1} max={50} step={1}
              />
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>1%</span><span>15%</span><span>30%</span><span>50%</span>
              </div>
            </div>

            {/* Take Profit */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Take Profit</span>
                <Badge variant="outline" className="tabular-nums font-bold text-success">{settings.profit_take_percentage}%</Badge>
              </div>
              <Slider
                value={[settings.profit_take_percentage]}
                onValueChange={([val]) => updateField('profit_take_percentage', val)}
                min={10} max={1000} step={5}
              />
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>10%</span><span>100%</span><span>500%</span><span>1000%</span>
              </div>
            </div>

            {/* Stop Loss */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Stop Loss</span>
                <Badge variant="outline" className="tabular-nums font-bold text-destructive">{settings.stop_loss_percentage}%</Badge>
              </div>
              <Slider
                value={[settings.stop_loss_percentage]}
                onValueChange={([val]) => updateField('stop_loss_percentage', val)}
                min={5} max={90} step={1}
              />
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>5%</span><span>20%</span><span>50%</span><span>90%</span>
              </div>
            </div>

            {/* Max Concurrent */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Max Concurrent</span>
                <Badge variant="outline" className="tabular-nums font-bold">{settings.max_concurrent_trades}</Badge>
              </div>
              <Slider
                value={[settings.max_concurrent_trades]}
                onValueChange={([val]) => updateField('max_concurrent_trades', val)}
                min={1} max={20} step={1}
              />
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>1</span><span>5</span><span>10</span><span>20</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 2: Speed & Filters ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {/* Priority */}
          <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Execution Speed</h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-2">
                {priorities.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => updateField('priority', p.value)}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      settings.priority === p.value
                        ? 'bg-primary/15 border-primary/40 text-primary'
                        : 'bg-secondary/30 border-border/30 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <p className="text-sm font-bold">{p.label}</p>
                    <p className="text-[10px]">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Category Filters + Pool Size */}
          <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Filters & Pool</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <span className="text-xs text-muted-foreground mb-2 block">Category Filters</span>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const active = settings.category_filters.includes(cat.value);
                    return (
                      <button
                        key={cat.value}
                        onClick={() => {
                          const next = active
                            ? settings.category_filters.filter(c => c !== cat.value)
                            : [...settings.category_filters, cat.value];
                          if (next.length > 0) updateField('category_filters', next);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          active
                            ? 'bg-primary/15 border-primary/30 text-primary'
                            : 'bg-secondary/30 border-border/30 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Database className="w-3.5 h-3.5" /> Max Pool Size
                  </span>
                  <Badge variant="outline" className="tabular-nums font-semibold text-xs">{maxPoolSize}</Badge>
                </div>
                <Slider
                  value={[maxPoolSize]}
                  onValueChange={([val]) => setMaxPoolSize(val)}
                  min={50} max={500} step={25}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 3: Token Lists ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {/* Blacklist */}
          <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-destructive" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Blacklist</h3>
              </div>
              {settings.token_blacklist.length > 0 && (
                <Badge variant="destructive" className="text-[10px]">{settings.token_blacklist.length}</Badge>
              )}
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Token address..."
                  value={newBlacklistToken}
                  onChange={(e) => setNewBlacklistToken(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addToBlacklist()}
                  className="font-mono text-sm bg-secondary/30"
                />
                <Button size="icon" onClick={addToBlacklist} variant="destructive">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {settings.token_blacklist.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No tokens blacklisted</p>
                ) : (
                  settings.token_blacklist.map((token) => (
                    <div key={token} className="flex items-center justify-between p-2 bg-destructive/10 rounded-lg border border-destructive/20">
                      <span className="font-mono text-xs text-foreground truncate flex-1">{token.slice(0, 8)}...{token.slice(-6)}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/20" onClick={() => removeFromBlacklist(token)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Whitelist */}
          <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-success" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Whitelist</h3>
              </div>
              {settings.token_whitelist.length > 0 && (
                <Badge className="bg-success/20 text-success text-[10px]">{settings.token_whitelist.length}</Badge>
              )}
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Token address..."
                  value={newWhitelistToken}
                  onChange={(e) => setNewWhitelistToken(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addToWhitelist()}
                  className="font-mono text-sm bg-secondary/30"
                />
                <Button size="icon" onClick={addToWhitelist} className="bg-success hover:bg-success/90">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {settings.token_whitelist.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No tokens whitelisted</p>
                ) : (
                  settings.token_whitelist.map((token) => (
                    <div key={token} className="flex items-center justify-between p-2 bg-success/10 rounded-lg border border-success/20">
                      <span className="font-mono text-xs text-foreground truncate flex-1">{token.slice(0, 8)}...{token.slice(-6)}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-success hover:text-success hover:bg-success/20" onClick={() => removeFromWhitelist(token)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 4: Token Processing Stats ── */}
        <TokenStateStats />

        {/* ── SECTION 5: Validation Rules (2-column on desktop) ── */}
        <ValidationRuleTogglesPanel
          toggles={settings.validation_rule_toggles}
          onToggle={(ruleKey, enabled) => {
            updateField('validation_rule_toggles', {
              ...settings.validation_rule_toggles,
              [ruleKey]: enabled,
            });
          }}
        />
      </div>
    </AppLayout>
  );
});

export default MemeSniperSettings;
