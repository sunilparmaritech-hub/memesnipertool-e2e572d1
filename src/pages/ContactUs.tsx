import PublicLayout from "@/components/layout/PublicLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Mail, MessageSquare, Send, Clock, Shield, 
  ExternalLink, HelpCircle, Bug, Lightbulb, AlertTriangle,
  Wallet, Building, CreditCard, FileText
} from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const categories = [
  { value: "technical", label: "Technical", icon: Bug },
  { value: "billing", label: "Billing", icon: CreditCard },
  { value: "feature", label: "Feature Request", icon: Lightbulb },
  { value: "enterprise", label: "Enterprise", icon: Building },
  { value: "security", label: "Report Issue", icon: AlertTriangle },
];

const channels = [
  { icon: MessageSquare, title: "Discord Community", desc: "Join 5,000+ traders for real-time help.", action: "Join Discord", href: "https://discord.gg/alphamemesniperai", external: true },
  { icon: Mail, title: "Email Support", desc: "For account-specific issues.", action: "support@alphamemesniper.com", href: "mailto:support@alphamemesniper.com", external: false },
  { icon: ExternalLink, title: "Twitter / X", desc: "Updates and announcements.", action: "@alpha_ai_sniper", href: "https://x.com/alpha_ai_sniper", external: true },
  { icon: ExternalLink, title: "Instagram", desc: "Follow for tips and highlights.", action: "@alphamemesniperai", href: "https://instagram.com/alphamemesniperai", external: true },
];

export default function ContactUs() {
  const { user } = useAuth();
  const [category, setCategory] = useState("technical");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast({ title: "Missing fields", description: "Please fill in subject and message.", variant: "destructive" });
      return;
    }
    if (subject.length > 200 || message.length > 2000) {
      toast({ title: "Too long", description: "Subject max 200 chars, message max 2000 chars.", variant: "destructive" });
      return;
    }

    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to submit a support ticket.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("support_tickets").insert({
        user_id: user.id,
        ticket_number: ticketNumber,
        category,
        subject: subject.trim(),
        description: message.trim(),
        wallet_address: walletAddress.trim() || null,
        priority: category === "security" ? "high" : category === "enterprise" ? "medium" : "normal",
      });

      if (error) {
        console.error("Ticket submission error:", error);
        toast({ title: "Error", description: "Failed to submit ticket. Please try again.", variant: "destructive" });
      } else {
        toast({ title: "Ticket Created!", description: `ID: ${ticketNumber} — We'll respond within 24 hours.` });
        setSubject("");
        setMessage("");
        setWalletAddress("");
      }
    } catch (err) {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <div className="container mx-auto max-w-[1200px] px-4 py-10 sm:py-14">
        {/* Hero */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Contact Us</h1>
              <p className="text-sm text-muted-foreground">Get help, report issues, or share feedback</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Clock className="w-4 h-4 text-success" />
            <span className="text-xs text-muted-foreground">Average response time: <strong className="text-success">under 24 hours</strong></span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Contact Form */}
          <div className="lg:col-span-3">
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Send className="w-4 h-4 text-primary" /> Submit a Ticket
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!user && (
                  <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm mb-4">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Please <a href="/auth" className="underline font-medium">sign in</a> to submit a support ticket.
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Category */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Category</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {categories.map((cat) => {
                        const Icon = cat.icon;
                        return (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => setCategory(cat.value)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                              category === cat.value
                                ? "bg-primary/15 border-primary/30 text-primary"
                                : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {cat.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <Label htmlFor="subject" className="text-xs text-muted-foreground">Subject</Label>
                    <Input 
                      id="subject" value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Brief description of your inquiry"
                      className="mt-1 bg-background/50" maxLength={200}
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <Label htmlFor="message" className="text-xs text-muted-foreground">Description</Label>
                    <Textarea 
                      id="message" value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe your issue or feedback in detail..."
                      rows={5} className="mt-1 bg-background/50 resize-none" maxLength={2000}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1 text-right">{message.length}/2000</p>
                  </div>

                  {/* Wallet Address (optional) */}
                  <div>
                    <Label htmlFor="wallet" className="text-xs text-muted-foreground">
                      Wallet Address <span className="text-muted-foreground/50">(optional)</span>
                    </Label>
                    <div className="relative mt-1">
                      <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        id="wallet" value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                        placeholder="Solana wallet address for transaction issues"
                        className="pl-9 bg-background/50 mono text-xs"
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={submitting || !user} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    {submitting ? "Submitting..." : "Submit Ticket"}
                    <Send className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Support Channels</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {channels.map((ch) => {
                  const Icon = ch.icon;
                  return (
                    <a key={ch.title} href={ch.href} target={ch.external ? "_blank" : undefined} rel={ch.external ? "noopener noreferrer" : undefined} className="block group">
                      <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors">
                        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{ch.title}</p>
                          <p className="text-xs text-muted-foreground mb-1">{ch.desc}</p>
                          <span className="text-xs text-primary font-medium group-hover:underline">{ch.action} →</span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </CardContent>
            </Card>

            {/* Priority info */}
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-accent" /> Ticket Priority
                </h3>
                <div className="space-y-2">
                  {[
                    { label: "Security Issues", time: "< 4 hours", color: "text-destructive" },
                    { label: "Technical / Billing", time: "< 24 hours", color: "text-warning" },
                    { label: "Feature Requests", time: "< 72 hours", color: "text-primary" },
                    { label: "Enterprise", time: "< 12 hours", color: "text-accent" },
                  ].map((p) => (
                    <div key={p.label} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{p.label}</span>
                      <span className={`font-medium ${p.color}`}>{p.time}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Security Notice */}
            <Card className="bg-card border-warning/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <Shield className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Security Notice</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      We will <strong>never</strong> ask for your private keys, seed phrases, or passwords. 
                      Report suspicious messages claiming to be from our team.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
