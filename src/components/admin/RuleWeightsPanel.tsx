/**
 * Admin Rule Weights Panel
 *
 * Allows admins to configure category weights for the probabilistic
 * scoring engine and hard thresholds for kill-switch rules.
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { Save, Loader2, BarChart3, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_CATEGORY_WEIGHTS, type CategoryWeights } from "@/lib/probabilisticScoring";

const CATEGORY_LABELS: Record<keyof CategoryWeights, { label: string; desc: string; color: string }> = {
  structural_safety:   { label: 'Structural Safety',   desc: 'Freeze authority, sell route, LP integrity, sell tax', color: 'text-destructive' },
  liquidity_health:    { label: 'Liquidity Health',    desc: 'Min liquidity, stability, quote depth, capital preservation', color: 'text-primary' },
  deployer_risk:       { label: 'Deployer Risk',       desc: 'Reputation, behavior, rug probability', color: 'text-warning' },
  market_authenticity: { label: 'Market Authenticity', desc: 'Holder entropy, volume, buyer & wallet clusters', color: 'text-accent' },
  market_positioning:  { label: 'Market Positioning',  desc: 'Buyer position, price sanity, liquidity aging', color: 'text-success' },
};

interface Thresholds {
  autoMinScore: number;
  manualMinScore: number;
  rugHardBlock: number;
  rugReduceSize: number;
  confidenceBlock: number;
  confidenceReduce: number;
  preventMatureTokensMinutes: number;
  ageAdaptiveEnabled: boolean;
}

const DEFAULT_THRESHOLDS: Thresholds = {
  autoMinScore: 60,
  manualMinScore: 50,
  rugHardBlock: 70,
  rugReduceSize: 55,
  confidenceBlock: 65,
  confidenceReduce: 80,
  preventMatureTokensMinutes: 60,
  ageAdaptiveEnabled: true,
};

export function RuleWeightsPanel() {
  const [weights, setWeights] = useState<CategoryWeights>(DEFAULT_CATEGORY_WEIGHTS);
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Weight total for validation
  const weightTotal = Object.values(weights).reduce((s, v) => s + v, 0);
  const weightsValid = Math.abs(weightTotal - 1) < 0.01;

  useEffect(() => {
    (async () => {
      const [w, t] = await Promise.all([
        supabase.from('admin_settings').select('setting_value').eq('setting_key', 'scoring_category_weights').maybeSingle(),
        supabase.from('admin_settings').select('setting_value').eq('setting_key', 'scoring_thresholds').maybeSingle(),
      ]);
      if (w.data?.setting_value) setWeights({ ...DEFAULT_CATEGORY_WEIGHTS, ...(w.data.setting_value as any) });
      if (t.data?.setting_value) setThresholds({ ...DEFAULT_THRESHOLDS, ...(t.data.setting_value as any) });
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!weightsValid) { toast.error('Weights must sum to 100%'); return; }
    setSaving(true);
    const [r1, r2] = await Promise.all([
      supabase.from('admin_settings').upsert({ setting_key: 'scoring_category_weights', setting_value: weights as any }, { onConflict: 'setting_key' }),
      supabase.from('admin_settings').upsert({ setting_key: 'scoring_thresholds', setting_value: thresholds as any }, { onConflict: 'setting_key' }),
    ]);
    setSaving(false);
    if (r1.error || r2.error) toast.error('Save failed: ' + (r1.error?.message || r2.error?.message));
    else toast.success('Scoring configuration saved');
  };

  const setWeight = (key: keyof CategoryWeights, pct: number) => {
    setWeights(w => ({ ...w, [key]: Math.round(pct) / 100 }));
  };

  const resetWeights = () => setWeights(DEFAULT_CATEGORY_WEIGHTS);

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Category Weights */}
      <Card className="glass border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> Category Weights
          </CardTitle>
          <CardDescription>
            Configure how much each category contributes to the composite risk score.
            Weights must sum to 100%.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!weightsValid && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Weights sum to {Math.round(weightTotal * 100)}% — must equal 100%
            </div>
          )}

          {(Object.keys(CATEGORY_LABELS) as Array<keyof CategoryWeights>).map(key => {
            const meta = CATEGORY_LABELS[key];
            const pct = Math.round(weights[key] * 100);
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className={`text-sm font-semibold ${meta.color}`}>{meta.label}</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{meta.desc}</p>
                  </div>
                  <span className={`text-lg font-bold tabular-nums ${meta.color}`}>{pct}%</span>
                </div>
                <Slider
                  value={[pct]}
                  onValueChange={([v]) => setWeight(key, v)}
                  min={5} max={60} step={5}
                  className="w-full"
                />
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-2">
            <span className={`text-sm font-medium ${weightsValid ? 'text-success' : 'text-destructive'}`}>
              Total: {Math.round(weightTotal * 100)}%
            </span>
            <Button variant="outline" size="sm" onClick={resetWeights}>Reset to Defaults</Button>
          </div>
        </CardContent>
      </Card>

      {/* Thresholds */}
      <Card className="glass border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Scoring Thresholds
          </CardTitle>
          <CardDescription>
            Configure minimum scores, rug probability cut-offs, and data confidence requirements.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { key: 'autoMinScore' as keyof Thresholds, label: 'Auto Trade Min Score', desc: 'Minimum composite score for automatic execution' },
              { key: 'manualMinScore' as keyof Thresholds, label: 'Manual Trade Min Score', desc: 'Minimum score for manual trade recommendation' },
              { key: 'rugHardBlock' as keyof Thresholds, label: 'Rug Hard Block Threshold', desc: 'Rug probability ≥ this → always block' },
              { key: 'rugReduceSize' as keyof Thresholds, label: 'Rug Reduce-Size Threshold', desc: 'Rug probability ≥ this → reduce position size' },
              { key: 'confidenceBlock' as keyof Thresholds, label: 'Confidence Block %', desc: 'Data confidence below this → block trade' },
              { key: 'confidenceReduce' as keyof Thresholds, label: 'Confidence Reduce %', desc: 'Data confidence below this → reduce size' },
              { key: 'preventMatureTokensMinutes' as keyof Thresholds, label: 'Max Token Age (min)', desc: 'Block tokens older than this for sniper (0 = disabled)' },
            ].map(({ key, label, desc }) => (
              <div key={key}>
                <Label className="text-sm">{label}</Label>
                <p className="text-[10px] text-muted-foreground mb-1">{desc}</p>
                <Input
                  type="number"
                  value={thresholds[key] as number}
                  onChange={e => setThresholds(t => ({ ...t, [key]: parseFloat(e.target.value) || 0 }))}
                  className="w-full"
                  min={0} max={100}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/15">
            <div>
              <Label className="text-sm">Age-Adaptive Logic</Label>
              <p className="text-[10px] text-muted-foreground">Automatically relax behavioral rules for tokens &lt;2 minutes old</p>
            </div>
            <Switch
              checked={thresholds.ageAdaptiveEnabled}
              onCheckedChange={v => setThresholds(t => ({ ...t, ageAdaptiveEnabled: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving || !weightsValid} variant="glow" className="w-full">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Save Scoring Configuration
      </Button>
    </div>
  );
}
