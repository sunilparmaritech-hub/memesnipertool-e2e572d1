import { Gift, Copy, CheckCircle, Users, Coins, Share2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function DashboardReferEarn() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

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

  const referralCode = profile?.referral_code || (user?.id ? user.id.slice(0, 8).toUpperCase() : "CONNECT");
  const referralLink = `${window.location.origin}/auth?ref=${referralCode}`;
  const totalReferrals = profile?.total_referrals || 0;
  const totalEarnings = profile?.referral_earnings || 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({ title: "Copied!", description: "Referral link copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const shareData = {
      title: "Alpha Meme Sniper AI",
      text: "Join Alpha Meme Sniper AI and we both earn 50 credits! Use my referral link:",
      url: referralLink,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      handleCopy();
    }
  };

  return (
    <div className="space-y-3">
      {/* Refer & Earn */}
      <div className="rounded-xl border border-border/20 overflow-hidden" style={{ background: 'var(--gradient-card-sidebar)' }}>
        <div className="px-4 py-3 flex items-center gap-2 border-b border-border/15">
          <Gift className="w-4 h-4 text-accent" />
          <span className="text-xs font-bold uppercase tracking-widest text-foreground">Refer & Earn</span>
          <span className="text-sm">🔥</span>
        </div>
        <div className="p-4 space-y-2.5">
          <p className="text-[11px] text-muted-foreground">Share your link & both earn <strong className="text-foreground">50 credits</strong></p>
          
          {/* Stats */}
          <div className="flex gap-2">
            <div className="flex-1 p-2 rounded-md bg-secondary/20 border border-border/10 text-center">
              <Users className="w-3 h-3 text-primary mx-auto mb-0.5" />
              <p className="text-xs font-bold text-foreground">{totalReferrals}</p>
              <p className="text-[9px] text-muted-foreground">Referrals</p>
            </div>
            <div className="flex-1 p-2 rounded-md bg-secondary/20 border border-border/10 text-center">
              <Coins className="w-3 h-3 text-accent mx-auto mb-0.5" />
              <p className="text-xs font-bold text-foreground">{totalEarnings}</p>
              <p className="text-[9px] text-muted-foreground">Earned</p>
            </div>
          </div>

          <div className="flex gap-1.5">
            <div className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-secondary/30 border border-border/10 text-[10px] font-mono text-muted-foreground truncate">
              {referralLink}
            </div>
            <button
              onClick={handleCopy}
              className="shrink-0 p-1.5 rounded-md border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              {copied ? <CheckCircle className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5 text-primary" />}
            </button>
          </div>
          <button
            onClick={handleShare}
            className="w-full p-2 rounded-lg border border-accent/20 bg-accent/5 hover:bg-accent/10 transition-colors flex items-center justify-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5 text-accent" />
            <span className="text-[11px] font-semibold text-foreground">Share with Friends</span>
          </button>
          <Link to="/promotions">
            <div className="p-2.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer text-center mt-2">
              <p className="text-[11px] font-semibold text-foreground">View Referral Dashboard →</p>
            </div>
          </Link>
        </div>
      </div>

    </div>
  );
}
