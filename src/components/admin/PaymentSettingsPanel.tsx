import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Wallet, Save, Loader2, AlertTriangle, Shield, Plus, Trash2, Edit2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PaymentSettings {
  address: string;
  token_type: 'SOL' | 'USDC';
  min_confirmations: number;
  auto_credit: boolean;
  credit_expiry: boolean;
  expiry_days: number;
}

interface CreditPackRow {
  id: string;
  name: string;
  description: string | null;
  sol_price: number;
  credits: number;
  bonus_credits: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
  badge: string | null;
}

export default function PaymentSettingsPanel() {
  const [settings, setSettings] = useState<PaymentSettings>({
    address: '',
    token_type: 'SOL',
    min_confirmations: 1,
    auto_credit: true,
    credit_expiry: false,
    expiry_days: 90,
  });
  const [packs, setPacks] = useState<CreditPackRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingPack, setEditingPack] = useState<CreditPackRow | null>(null);
  const [showAddPack, setShowAddPack] = useState(false);

  useEffect(() => {
    loadSettings();
    loadPacks();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'payment_wallet')
      .single();
    
    if (data?.setting_value) {
      setSettings(data.setting_value as unknown as PaymentSettings);
    }
    setLoading(false);
  };

  const loadPacks = async () => {
    const { data } = await supabase
      .from('credit_packs')
      .select('*')
      .order('sort_order');
    if (data) {
      setPacks(data.map(p => ({ ...p, features: Array.isArray(p.features) ? p.features as string[] : [] })));
    }
  };

  const isValidSolanaAddress = (addr: string) => {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
  };

  const saveSettings = async () => {
    if (!settings.address || !isValidSolanaAddress(settings.address)) {
      toast.error('Please enter a valid Solana wallet address');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('admin_settings')
        .upsert({
          setting_key: 'payment_wallet',
          setting_value: settings as any,
        }, { onConflict: 'setting_key' });

      if (error) throw error;
      toast.success('Payment settings saved');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const savePack = async (pack: CreditPackRow) => {
    try {
      const { error } = await supabase
        .from('credit_packs')
        .upsert({
          id: pack.id,
          name: pack.name,
          description: pack.description,
          sol_price: pack.sol_price,
          credits: pack.credits,
          bonus_credits: pack.bonus_credits,
          features: pack.features as any,
          is_active: pack.is_active,
          sort_order: pack.sort_order,
          badge: pack.badge,
        });
      if (error) throw error;
      toast.success('Pack saved');
      loadPacks();
      setEditingPack(null);
      setShowAddPack(false);
    } catch {
      toast.error('Failed to save pack');
    }
  };

  const deletePack = async (id: string) => {
    try {
      const { error } = await supabase.from('credit_packs').delete().eq('id', id);
      if (error) throw error;
      toast.success('Pack deleted');
      loadPacks();
    } catch {
      toast.error('Failed to delete pack');
    }
  };

  const newPack: CreditPackRow = {
    id: crypto.randomUUID(),
    name: '',
    description: '',
    sol_price: 0.5,
    credits: 500,
    bonus_credits: 0,
    features: [],
    is_active: true,
    sort_order: packs.length + 1,
    badge: '🟢',
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Payment Wallet Config */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="w-5 h-5 text-primary" />
            Payment Wallet Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Admin SOL Wallet Address</label>
            <Input
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              placeholder="Enter Solana wallet address..."
              className="font-mono text-sm"
            />
            {settings.address && !isValidSolanaAddress(settings.address) && (
              <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Invalid Solana address
              </p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Token Accepted</label>
              <select
                value={settings.token_type}
                onChange={(e) => setSettings({ ...settings, token_type: e.target.value as 'SOL' | 'USDC' })}
                className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-lg text-foreground"
              >
                <option value="SOL">SOL</option>
                <option value="USDC">USDC</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Min Confirmations</label>
              <Input
                type="number"
                value={settings.min_confirmations}
                onChange={(e) => setSettings({ ...settings, min_confirmations: parseInt(e.target.value) || 1 })}
                min={1}
                max={10}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
            <div>
              <p className="font-medium text-foreground text-sm">Auto Credit Approval</p>
              <p className="text-xs text-muted-foreground">Automatically add credits after on-chain confirmation</p>
            </div>
            <Switch checked={settings.auto_credit} onCheckedChange={(v) => setSettings({ ...settings, auto_credit: v })} />
          </div>

          <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
            <div>
              <p className="font-medium text-foreground text-sm">Credit Expiry</p>
              <p className="text-xs text-muted-foreground">Credits expire after a set number of days</p>
            </div>
            <div className="flex items-center gap-2">
              {settings.credit_expiry && (
                <Input
                  type="number"
                  value={settings.expiry_days}
                  onChange={(e) => setSettings({ ...settings, expiry_days: parseInt(e.target.value) || 90 })}
                  className="w-20 h-8 text-xs"
                  min={7}
                />
              )}
              <Switch checked={settings.credit_expiry} onCheckedChange={(v) => setSettings({ ...settings, credit_expiry: v })} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="glow" onClick={saveSettings} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Payment Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Credit Packs Management */}
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 text-primary" />
            Credit Packs
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => { setEditingPack(newPack); setShowAddPack(true); }}>
            <Plus className="w-3 h-3 mr-1" /> Add Pack
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {packs.map((pack) => (
              <div key={pack.id} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                <span className="text-lg">{pack.badge}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground text-sm">{pack.name}</span>
                    {!pack.is_active && <Badge variant="outline" className="text-[9px]">Disabled</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pack.sol_price} SOL → {pack.credits.toLocaleString()} credits
                    {pack.bonus_credits > 0 && ` (+${pack.bonus_credits} bonus)`}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setEditingPack(pack)}>
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deletePack(pack.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>

          {/* Edit/Add Pack Form */}
          {editingPack && (
            <div className="mt-4 p-4 border border-border rounded-lg space-y-3">
              <h4 className="font-medium text-foreground text-sm">{showAddPack ? 'Add New Pack' : 'Edit Pack'}</h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Name</label>
                  <Input value={editingPack.name} onChange={(e) => setEditingPack({ ...editingPack, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Badge Emoji</label>
                  <Input value={editingPack.badge || ''} onChange={(e) => setEditingPack({ ...editingPack, badge: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">SOL Price</label>
                  <Input type="number" step="0.1" value={editingPack.sol_price} onChange={(e) => setEditingPack({ ...editingPack, sol_price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Credits</label>
                  <Input type="number" value={editingPack.credits} onChange={(e) => setEditingPack({ ...editingPack, credits: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Bonus Credits</label>
                  <Input type="number" value={editingPack.bonus_credits} onChange={(e) => setEditingPack({ ...editingPack, bonus_credits: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Sort Order</label>
                  <Input type="number" value={editingPack.sort_order} onChange={(e) => setEditingPack({ ...editingPack, sort_order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Features (one per line)</label>
                <textarea
                  className="w-full h-20 px-3 py-2 bg-secondary/50 border border-border rounded-lg text-foreground text-sm resize-none"
                  value={editingPack.features.join('\n')}
                  onChange={(e) => setEditingPack({ ...editingPack, features: e.target.value.split('\n').filter(Boolean) })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editingPack.is_active} onCheckedChange={(v) => setEditingPack({ ...editingPack, is_active: v })} />
                <span className="text-xs text-muted-foreground">Active</span>
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => { setEditingPack(null); setShowAddPack(false); }}>Cancel</Button>
                <Button size="sm" variant="glow" onClick={() => savePack(editingPack)}>
                  <Save className="w-3 h-3 mr-1" /> Save
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
