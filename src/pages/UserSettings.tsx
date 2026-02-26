import React, { forwardRef, useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits, CREDIT_COSTS } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User, Wallet, Coins, Save, Loader2, Mail, Calendar, LogOut, ShoppingCart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

// ─── Profile Tab ────────────────────────────────────────────
function ProfileTab() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { wallet, connectPhantom, disconnect } = useWallet();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
        setLoaded(true);
      });
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error("Failed to update profile");
    else toast.success("Profile updated");
  };

  const handleConnectWallet = async () => {
    if (wallet.isConnected) await disconnect();
    else await connectPhantom();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="space-y-6">
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-primary" />
          <h2 className="text-subheading text-foreground">Personal Information</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Email</label>
            <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg border border-border">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground text-sm">{user?.email ?? "—"}</span>
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Display Name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Enter display name" disabled={!loaded} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Member Since</label>
            <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg border border-border">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground text-sm">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}
              </span>
            </div>
          </div>
          <Button onClick={handleSaveProfile} disabled={saving} variant="glow" className="w-full sm:w-auto">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Profile
          </Button>
        </div>
      </div>

      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="w-5 h-5 text-primary" />
          <h2 className="text-subheading text-foreground">Wallet</h2>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${wallet.isConnected ? "bg-success/20" : "bg-warning/20"}`}>
              <Wallet className={`w-5 h-5 ${wallet.isConnected ? "text-success" : "text-warning"}`} />
            </div>
            <div>
              <p className="font-medium text-foreground">{wallet.isConnected ? "Connected" : "Not Connected"}</p>
              <p className="text-sm text-muted-foreground">
                {wallet.isConnected ? `${wallet.address?.slice(0, 6)}...${wallet.address?.slice(-4)}` : "Connect wallet for live trading"}
              </p>
            </div>
          </div>
          <Button variant={wallet.isConnected ? "outline" : "default"} onClick={handleConnectWallet}>
            {wallet.isConnected ? "Disconnect" : "Connect"}
          </Button>
        </div>
      </div>

      <Button variant="destructive" onClick={handleSignOut} className="w-full sm:w-auto">
        <LogOut className="w-4 h-4 mr-2" /> Sign Out
      </Button>
    </div>
  );
}

// ─── Credits Tab ────────────────────────────────────────────
function CreditsTab() {
  const { balance, credits, transactions, creditsLoading, txLoading, isAdmin, CREDIT_COSTS } = useCredits();
  const navigate = useNavigate();

  const estimatedSnipes = Math.floor(balance / (CREDIT_COSTS.auto_execution || 5));

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Coins className="w-5 h-5 text-primary" />
          <h2 className="text-subheading text-foreground">Credit Balance</h2>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div>
            <span className="text-3xl font-bold text-foreground">{balance.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground ml-2">credits</span>
          </div>
          {balance <= 0 && (
            <Badge variant="destructive">Empty</Badge>
          )}
          {balance > 0 && balance < 50 && (
            <Badge className="bg-warning/20 text-warning border-warning/30">Low</Badge>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-secondary/50 text-center">
            <p className="text-xs text-muted-foreground">Total Purchased</p>
            <p className="text-lg font-bold text-foreground">{(credits?.total_credits_purchased ?? 0).toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50 text-center">
            <p className="text-xs text-muted-foreground">Total Used</p>
            <p className="text-lg font-bold text-foreground">{(credits?.total_credits_used ?? 0).toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50 text-center">
            <p className="text-xs text-muted-foreground">Est. Snipes Left</p>
            <p className="text-lg font-bold text-primary">{estimatedSnipes}</p>
          </div>
        </div>

        <Button variant="glow" onClick={() => navigate("/pricing")} className="w-full sm:w-auto">
          <ShoppingCart className="w-4 h-4 mr-2" /> Buy More Credits
        </Button>
      </div>

      {/* Credit Costs */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Credit Costs Per Action</h3>
        <div className="space-y-2">
          {Object.entries(CREDIT_COSTS).map(([action, cost]) => (
            <div key={action} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
              <span className="text-sm text-muted-foreground capitalize">{action.replace(/_/g, " ")}</span>
              <Badge variant="outline" className="text-xs">{cost} credit{cost > 1 ? "s" : ""}</Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      {transactions.length > 0 && (
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Purchase History</h3>
          <div className="space-y-2">
            {transactions.slice(0, 10).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div>
                  <a
                    href={`https://solscan.io/tx/${tx.tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-primary hover:underline"
                  >
                    {tx.tx_hash.slice(0, 8)}...{tx.tx_hash.slice(-6)}
                  </a>
                  <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">+{tx.credits_added} credits</p>
                  <p className="text-[10px] text-muted-foreground">{Number(tx.amount_sol).toFixed(4)} SOL</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Account Page ──────────────────────────────────────
const UserSettings = forwardRef<HTMLDivElement, object>(function UserSettings(_props, ref) {
  return (
    <AppLayout>
      <div className="container mx-auto max-w-[1600px] px-2 sm:px-3 md:px-5 py-2 sm:py-3" ref={ref}>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-lg bg-primary/10">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-display text-foreground">Account</h1>
            <p className="text-caption">Manage your profile & credits</p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="mb-6 w-full sm:w-auto">
            <TabsTrigger value="profile" className="gap-1.5">
              <User className="w-4 h-4" /> Profile
            </TabsTrigger>
            <TabsTrigger value="credits" className="gap-1.5">
              <Coins className="w-4 h-4" /> Credits
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileTab />
          </TabsContent>
          <TabsContent value="credits">
            <CreditsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
});

export default UserSettings;
