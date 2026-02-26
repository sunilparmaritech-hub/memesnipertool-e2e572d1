import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PublicLayout from "@/components/layout/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Gift, Users, Trophy, Rocket, Copy, Share2, 
  CheckCircle, Star, Zap, TrendingUp, Crown, ArrowRight,
  Sparkles, Coins, UserPlus
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

// Referral tiers based on count
const tiers = [
  { name: "Bronze", min: 1, max: 4, bonus: 50, icon: Star, color: "text-warning", bg: "bg-warning/10 border-warning/20" },
  { name: "Silver", min: 5, max: 14, bonus: 50, icon: Trophy, color: "text-muted-foreground", bg: "bg-secondary border-border" },
  { name: "Gold", min: 15, max: 49, bonus: 50, icon: Crown, color: "text-accent", bg: "bg-accent/10 border-accent/20" },
  { name: "Diamond", min: 50, max: Infinity, bonus: 50, icon: Zap, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
];

function getCurrentTier(referralCount: number) {
  return tiers.find(t => referralCount >= t.min && referralCount <= t.max) || null;
}

function getNextTier(referralCount: number) {
  const currentIdx = tiers.findIndex(t => referralCount >= t.min && referralCount <= t.max);
  if (currentIdx < tiers.length - 1) return tiers[currentIdx + 1];
  return null;
}

export default function Promotions() {
  const { user } = useAuth();
  const { balance } = useCredits();
  const [copied, setCopied] = useState(false);

  // Fetch referral stats from profile
  const { data: profile } = useQuery({
    queryKey: ["referral-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("referral_code, total_referrals, referral_earnings")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Fetch referral list
  const { data: referrals = [] } = useQuery({
    queryKey: ["my-referrals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("referrals")
        .select("id, referred_id, created_at, bonus_credited")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const referralCode = profile?.referral_code || (user?.id ? user.id.slice(0, 8).toUpperCase() : "SIGNUP");
  const referralLink = `${window.location.origin}/auth?ref=${referralCode}`;
  const totalReferrals = profile?.total_referrals || 0;
  const totalEarnings = profile?.referral_earnings || 0;
  const currentTier = getCurrentTier(totalReferrals);
  const nextTier = getNextTier(totalReferrals);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({ title: "Copied!", description: "Referral link copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  const Layout = user ? AppLayout : PublicLayout;

  return (
    <Layout>
      <div className="container mx-auto max-w-[1200px] px-4 py-10 sm:py-14">
        {/* Hero */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/20">
              <Gift className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="text-display text-foreground">Refer & Earn Credits</h1>
              <p className="text-caption">Invite friends, both earn 50 credits — it's that simple</p>
            </div>
          </div>
        </div>

        {/* How it works banner */}
        <Card className="border-accent/30 bg-gradient-to-r from-accent/10 via-card to-primary/10 mb-8 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-accent via-primary to-accent" />
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/20">
                  <Sparkles className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">🎁 Referral Bonus: 50 Credits Each!</p>
                  <p className="text-xs text-muted-foreground">When someone signs up with your code, you <strong>both</strong> get 50 free credits instantly</p>
                </div>
              </div>
              <Badge className="bg-success/10 text-success border-success/30 text-xs shrink-0">
                <Coins className="w-3 h-3 mr-1" /> No Limit
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Referral Link */}
        <Card className="bg-card border-primary/20 mb-8 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
          <CardContent className="p-5 relative">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-foreground mb-1">Your Referral Link</h3>
                <p className="text-xs text-muted-foreground mb-3">Share this link — both you and your friend earn 50 credits</p>
                <div className="flex gap-2">
                  <Input value={referralLink} readOnly className="text-xs mono bg-background/50 border-border" />
                  <Button onClick={handleCopy} variant="outline" size="sm" className="shrink-0 border-primary/30 hover:bg-primary/10">
                    {copied ? <CheckCircle className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Your code:</span>
                  <Badge variant="outline" className="font-mono text-xs tracking-wider">{referralCode}</Badge>
                </div>
              </div>
              <Button onClick={handleCopy} variant="outline" size="sm" className="border-border hover:bg-secondary shrink-0">
                <Share2 className="w-4 h-4 mr-1.5" /> Share
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Total Referrals", value: totalReferrals.toString(), icon: Users, color: "text-primary" },
            { label: "Credits Earned", value: `${totalEarnings}`, icon: Coins, color: "text-accent" },
            { label: "Current Tier", value: currentTier?.name || "—", icon: Trophy, color: currentTier?.color || "text-muted-foreground" },
            { label: "Your Balance", value: balance.toLocaleString(), icon: Zap, color: "text-success" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="bg-card border-border/50">
                <CardContent className="p-4 text-center">
                  <Icon className={`w-5 h-5 ${stat.color} mx-auto mb-2`} />
                  <p className="text-value-md text-foreground">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">{stat.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* How It Works */}
        <h2 className="text-heading text-foreground mb-4 flex items-center gap-2">
          <Rocket className="w-5 h-5 text-primary" />
          How It Works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            { step: "1", icon: Share2, title: "Share Your Link", desc: "Copy your unique referral link and share it with friends, on social media, or in trading communities." },
            { step: "2", icon: UserPlus, title: "Friend Signs Up", desc: "When someone creates an account using your referral code during signup, the referral is tracked." },
            { step: "3", icon: Gift, title: "Both Earn 50 Credits", desc: "You and your friend each receive 50 credits instantly — use them for token scans, auto-snipes, and more." },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.step} className="bg-card border-border/50 hover:border-primary/30 transition-all">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary">{s.step}</div>
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tier System */}
        <h2 className="text-heading text-foreground mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-accent" />
          Referral Tiers
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            const isActive = currentTier?.name === tier.name;
            return (
              <Card key={tier.name} className={`${tier.bg} transition-all hover:scale-[1.02] ${isActive ? "ring-2 ring-primary" : ""}`}>
                <CardContent className="p-5 text-center">
                  <Icon className={`w-8 h-8 ${tier.color} mx-auto mb-3`} />
                  <h3 className="text-base font-bold text-foreground">{tier.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 mb-2">
                    {tier.max === Infinity ? `${tier.min}+` : `${tier.min}-${tier.max}`} referrals
                  </p>
                  <Badge variant="outline" className="text-[10px] border-border">
                    {tier.bonus} credits per referral
                  </Badge>
                  {isActive && (
                    <p className="text-[10px] text-primary font-semibold mt-2">← Your Tier</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Referrals */}
        {user && referrals.length > 0 && (
          <>
            <h2 className="text-heading text-foreground mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Recent Referrals
            </h2>
            <Card className="bg-card border-border/50 mb-10">
              <CardContent className="p-4">
                <div className="space-y-2">
                  {referrals.slice(0, 10).map((ref, i) => (
                    <div key={ref.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/10 border border-border/10">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{i + 1}</div>
                        <div>
                          <p className="text-xs font-medium text-foreground">Referral #{totalReferrals - i}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(ref.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <Badge className="bg-success/10 text-success border-success/30 text-[10px]">
                        +50 credits
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Why Refer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Coins, title: "Free Credits", desc: "Earn 50 credits for every successful referral — no limits." },
            { icon: Users, title: "Build Network", desc: "Grow your trading community and track your referral impact." },
            { icon: TrendingUp, title: "Climb Tiers", desc: "More referrals unlock higher tier status and recognition." },
            { icon: Rocket, title: "Help Friends", desc: "Your friends also get 50 free credits to start trading immediately." },
          ].map((b) => {
            const Icon = b.icon;
            return (
              <Card key={b.title} className="bg-card border-border/50">
                <CardContent className="p-5">
                  <div className="p-2 rounded-lg bg-primary/10 w-fit mb-3">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{b.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{b.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
