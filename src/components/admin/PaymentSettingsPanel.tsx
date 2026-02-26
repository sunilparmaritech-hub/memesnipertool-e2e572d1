import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Wallet, Shield, Settings, Plus, Trash2, Save, Coins, Package, RefreshCw, ExternalLink, CheckCircle2, Clock, XCircle, Pencil, X, Check, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditDefinitionsPanel } from "./CreditDefinitionsPanel";
import { AdminGrantCredits } from "./AdminGrantCredits";

// Solana address validation (base58, 32-44 chars)
const isValidSolanaAddress = (addr: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);

interface PaymentConfig {
  receiving_wallet: string;
  accepted_tokens: string[];
  required_confirmations: number;
  helius_webhook_secret: string;
  auto_credit: boolean;
  credit_expiry_enabled: boolean;
}

const DEFAULT_CONFIG: PaymentConfig = {
  receiving_wallet: "",
  accepted_tokens: ["SOL"],
  required_confirmations: 1,
  helius_webhook_secret: "",
  auto_credit: true,
  credit_expiry_enabled: false,
};

// Fetch SOL balance for a wallet address via edge function
async function fetchWalletBalance(address: string): Promise<number | null> {
  try {
    const { data, error } = await supabase.functions.invoke('solana-balance', {
      body: { publicKey: address },
    });
    if (error || !data) return null;
    return data.balanceSol ?? null;
  } catch {
    return null;
  }
}

export function PaymentSettingsPanel() {
  const [config, setConfig] = useState<PaymentConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [editPack, setEditPack] = useState({ name: "", sol_price: "", credits_amount: "", bonus_credits: "" });
  const queryClient = useQueryClient();

  // ── Payment Config ──────────────────────────────────────────
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("admin_settings")
        .select("setting_value")
        .eq("setting_key", "payment_settings")
        .maybeSingle();
      if (data?.setting_value) {
        const loaded = { ...DEFAULT_CONFIG, ...(data.setting_value as any) };
        setConfig(loaded);
        // Auto-fetch balance if wallet is set
        if (loaded.receiving_wallet && isValidSolanaAddress(loaded.receiving_wallet)) {
          loadWalletBalance(loaded.receiving_wallet);
        }
      }
    } catch (err) {
      console.error("Error fetching payment config:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadWalletBalance = async (address: string) => {
    setBalanceLoading(true);
    const bal = await fetchWalletBalance(address);
    setWalletBalance(bal);
    setBalanceLoading(false);
  };

  const handleSaveConfig = async () => {
    if (config.receiving_wallet && !isValidSolanaAddress(config.receiving_wallet)) {
      toast.error("Invalid Solana wallet address");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("admin_settings")
        .upsert({ setting_key: "payment_settings", setting_value: config as any }, { onConflict: "setting_key" });
      if (error) throw error;
      toast.success("Payment settings saved");
      // Refresh balance after save
      if (config.receiving_wallet && isValidSolanaAddress(config.receiving_wallet)) {
        loadWalletBalance(config.receiving_wallet);
      }
    } catch (err: any) {
      toast.error("Failed to save: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  // ── Credit Packs CRUD ───────────────────────────────────────
  const { data: packs = [], isLoading: packsLoading } = useQuery({
    queryKey: ["admin-credit-packs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_packs")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const [newPack, setNewPack] = useState({ name: "", sol_price: "", credits_amount: "", bonus_credits: "0" });

  const addPack = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("credit_packs").insert({
        name: newPack.name,
        sol_price: parseFloat(newPack.sol_price),
        credits_amount: parseInt(newPack.credits_amount),
        bonus_credits: parseInt(newPack.bonus_credits) || 0,
        sort_order: packs.length + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-credit-packs"] });
      setNewPack({ name: "", sol_price: "", credits_amount: "", bonus_credits: "0" });
      toast.success("Credit pack added");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updatePack = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; sol_price: number; credits_amount: number; bonus_credits: number } }) => {
      const { error } = await supabase.from("credit_packs").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-credit-packs"] });
      setEditingPackId(null);
      toast.success("Credit pack updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const togglePack = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("credit_packs").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-credit-packs"] }),
  });

  const deletePack = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("credit_packs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-credit-packs"] });
      toast.success("Pack deleted");
    },
  });

  const startEditing = (pack: any) => {
    setEditingPackId(pack.id);
    setEditPack({
      name: pack.name,
      sol_price: String(pack.sol_price),
      credits_amount: String(pack.credits_amount),
      bonus_credits: String(pack.bonus_credits),
    });
  };

  const saveEdit = () => {
    if (!editingPackId) return;
    updatePack.mutate({
      id: editingPackId,
      data: {
        name: editPack.name,
        sol_price: parseFloat(editPack.sol_price),
        credits_amount: parseInt(editPack.credits_amount),
        bonus_credits: parseInt(editPack.bonus_credits) || 0,
      },
    });
  };

  // ── Recent Transactions with user & pack details ─────────────
  const { data: recentTxs = [], refetch: refetchTxs } = useQuery({
    queryKey: ["admin-credit-txs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("*, credit_packs(name, credits_amount, bonus_credits)")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;

      const userIds = [...new Set((data || []).map((tx: any) => tx.user_id).filter(Boolean))];
      let profileMap: Record<string, { email: string | null; display_name: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, email, display_name")
          .in("user_id", userIds);
        if (profiles) {
          profileMap = Object.fromEntries(profiles.map((p: any) => [p.user_id, { email: p.email, display_name: p.display_name }]));
        }
      }

      return (data || []).map((tx: any) => ({
        ...tx,
        user_email: profileMap[tx.user_id]?.email || null,
        user_name: profileMap[tx.user_id]?.display_name || null,
        pack_name: tx.credit_packs?.name || null,
      }));
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/helius-payment-webhook`;
  const walletValid = config.receiving_wallet && isValidSolanaAddress(config.receiving_wallet);
  const walletInvalid = config.receiving_wallet && !isValidSolanaAddress(config.receiving_wallet);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Payment Configuration */}
      <Card className="glass border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Wallet className="w-5 h-5" /> SOL Payment Settings
          </CardTitle>
          <CardDescription>Configure the receiving wallet and payment verification</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Admin Receiving Wallet (Solana)</Label>
            <Input
              value={config.receiving_wallet}
              onChange={(e) => setConfig({ ...config, receiving_wallet: e.target.value })}
              placeholder="Enter Solana wallet address..."
              className="font-mono text-sm mt-1"
            />
            {walletInvalid && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Invalid Solana address format (must be 32-44 base58 characters)
              </p>
            )}
            {walletValid && (
              <div className="mt-2 flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border">
                <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-success font-medium">Valid Solana Address</p>
                  {balanceLoading ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading balance...
                    </p>
                  ) : walletBalance !== null ? (
                    <p className="text-sm font-bold text-foreground">
                      Balance: {walletBalance.toFixed(4)} SOL
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Balance unavailable</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => loadWalletBalance(config.receiving_wallet)}
                  disabled={balanceLoading}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${balanceLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Required Confirmations</Label>
              <Input
                type="number"
                min={1}
                max={32}
                value={config.required_confirmations}
                onChange={(e) => setConfig({ ...config, required_confirmations: parseInt(e.target.value) || 1 })}
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Number of Solana block confirmations before a payment is verified. Higher = more secure, slower.
              </p>
            </div>
            <div>
              <Label>Helius Webhook Secret</Label>
              <Input
                type="password"
                value={config.helius_webhook_secret}
                onChange={(e) => setConfig({ ...config, helius_webhook_secret: e.target.value })}
                placeholder="Optional auth token"
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Secret token to verify incoming Helius webhook calls are authentic. Set this in your Helius dashboard.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-secondary/30 border border-border">
            <Label className="text-xs text-muted-foreground">Helius Webhook URL</Label>
            <p className="text-xs font-mono text-foreground break-all mt-1">{webhookUrl}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Configure this URL in your Helius dashboard to monitor the admin wallet for incoming transfers.
            </p>
          </div>

          <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
            <div>
              <Label className="font-medium">Auto Credit Approval</Label>
              <p className="text-xs text-muted-foreground">Automatically add credits after verification</p>
            </div>
            <Switch checked={config.auto_credit} onCheckedChange={(c) => setConfig({ ...config, auto_credit: c })} />
          </div>

          <Button onClick={handleSaveConfig} disabled={saving} variant="glow" className="w-full sm:w-auto">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Payment Settings
          </Button>
        </CardContent>
      </Card>

      {/* Credit Packs Management */}
      <Card className="glass border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Package className="w-5 h-5" /> Credit Packs
          </CardTitle>
          <CardDescription>Manage credit pack offerings for users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing packs */}
          <div className="space-y-2">
            {packs.map((pack: any) => (
              <div key={pack.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border gap-2">
                {editingPackId === pack.id ? (
                  /* Edit mode */
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Input
                      value={editPack.name}
                      onChange={(e) => setEditPack({ ...editPack, name: e.target.value })}
                      placeholder="Name"
                      className="h-8 text-sm"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={editPack.sol_price}
                      onChange={(e) => setEditPack({ ...editPack, sol_price: e.target.value })}
                      placeholder="SOL Price"
                      className="h-8 text-sm"
                    />
                    <Input
                      type="number"
                      value={editPack.credits_amount}
                      onChange={(e) => setEditPack({ ...editPack, credits_amount: e.target.value })}
                      placeholder="Credits"
                      className="h-8 text-sm"
                    />
                    <Input
                      type="number"
                      value={editPack.bonus_credits}
                      onChange={(e) => setEditPack({ ...editPack, bonus_credits: e.target.value })}
                      placeholder="Bonus"
                      className="h-8 text-sm"
                    />
                  </div>
                ) : (
                  /* View mode */
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Coins className="w-4 h-4 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{pack.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {pack.sol_price} SOL → {pack.credits_amount} credits
                        {pack.bonus_credits > 0 && ` + ${pack.bonus_credits} bonus`}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {editingPackId === pack.id ? (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={saveEdit} disabled={updatePack.isPending}>
                        {updatePack.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingPackId(null)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Badge variant={pack.is_active ? "default" : "secondary"} className="text-[10px]">
                        {pack.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Switch
                        checked={pack.is_active}
                        onCheckedChange={(active) => togglePack.mutate({ id: pack.id, active })}
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => startEditing(pack)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => {
                          if (confirm(`Delete "${pack.name}" pack?`)) deletePack.mutate(pack.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Add new pack */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Input
              placeholder="Name"
              value={newPack.name}
              onChange={(e) => setNewPack({ ...newPack, name: e.target.value })}
            />
            <Input
              placeholder="SOL Price"
              type="number"
              step="0.01"
              value={newPack.sol_price}
              onChange={(e) => setNewPack({ ...newPack, sol_price: e.target.value })}
            />
            <Input
              placeholder="Credits"
              type="number"
              value={newPack.credits_amount}
              onChange={(e) => setNewPack({ ...newPack, credits_amount: e.target.value })}
            />
            <Input
              placeholder="Bonus"
              type="number"
              value={newPack.bonus_credits}
              onChange={(e) => setNewPack({ ...newPack, bonus_credits: e.target.value })}
            />
            <Button
              onClick={() => addPack.mutate()}
              disabled={!newPack.name || !newPack.sol_price || !newPack.credits_amount || addPack.isPending}
              className="h-10"
            >
              {addPack.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card className="glass border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Shield className="w-5 h-5" /> Recent Credit Transactions
            </CardTitle>
            <CardDescription>All user payment transactions and credit allocations</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchTxs()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2.5 pr-3 text-muted-foreground font-medium">User</th>
                  <th className="py-2.5 pr-3 text-muted-foreground font-medium">Pack</th>
                  <th className="py-2.5 pr-3 text-muted-foreground font-medium">TX Hash</th>
                  <th className="py-2.5 pr-3 text-muted-foreground font-medium">Sender → Receiver</th>
                  <th className="py-2.5 pr-3 text-muted-foreground font-medium text-right">SOL</th>
                  <th className="py-2.5 pr-3 text-muted-foreground font-medium text-right">Credits</th>
                  <th className="py-2.5 pr-3 text-muted-foreground font-medium">Status</th>
                  <th className="py-2.5 text-muted-foreground font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentTxs.map((tx: any) => {
                  const isConfirmed = tx.status === "confirmed";
                  const isFailed = tx.status === "failed";
                  const StatusIcon = isConfirmed ? CheckCircle2 : isFailed ? XCircle : Clock;
                  const statusColor = isConfirmed ? "text-success" : isFailed ? "text-destructive" : "text-warning";
                  
                  return (
                    <tr key={tx.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="py-2.5 pr-3">
                        <div className="min-w-[120px]">
                          <p className="text-foreground text-xs font-medium truncate max-w-[160px]">
                            {tx.user_name || "—"}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                            {tx.user_email || tx.user_id?.slice(0, 8) + "..."}
                          </p>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                          {tx.pack_name || "Manual"}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs">
                        <a
                          href={`https://solscan.io/tx/${tx.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {tx.tx_hash?.slice(0, 8)}...{tx.tx_hash?.slice(-4)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-[10px] text-muted-foreground">
                        <div>
                          {tx.sender_wallet && tx.sender_wallet !== "unknown"
                            ? `${tx.sender_wallet.slice(0, 4)}...${tx.sender_wallet.slice(-4)}`
                            : "—"}
                        </div>
                        <div className="text-[9px]">
                          → {tx.recipient_wallet ? `${tx.recipient_wallet.slice(0, 4)}...${tx.recipient_wallet.slice(-4)}` : "—"}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-right text-foreground font-medium">
                        {Number(tx.amount_sol).toFixed(6)}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <span className="text-foreground font-semibold">{tx.credits_added}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon className={`w-3.5 h-3.5 ${statusColor}`} />
                          <span className={`text-xs font-medium capitalize ${statusColor}`}>
                            {tx.status}
                          </span>
                          {tx.failure_reason && (
                            <span className="text-[9px] text-destructive" title={tx.failure_reason}>
                              ⓘ
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
                {recentTxs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No transactions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Credit Cost Definitions */}
      <CreditDefinitionsPanel />

      {/* Admin Grant Credits */}
      <AdminGrantCredits />
    </div>
  );
}
