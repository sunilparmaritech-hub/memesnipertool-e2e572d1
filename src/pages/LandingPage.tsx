import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import logoImg from "@/assets/logo.png";
import headerLogoImg from "@/assets/header_logo.png";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Zap, Shield, Target, Bot, Eye, TrendingUp, Lock, Cpu,
  BarChart3, CheckCircle, ArrowRight, Star, Crown,
  Rocket, Users, ChevronRight, Play, Sparkles,
  Clock, Award, Layers, MessageSquare, Mail,
  ExternalLink, Coins, Gift, UserPlus,
} from "lucide-react";

const benefits = [
  { icon: Zap, title: "Sub-Second Detection", desc: "Detect new token launches within milliseconds of liquidity being added." },
  { icon: Shield, title: "22+ Risk Checks", desc: "Multi-layer AI validation engine blocks honeypots, rug pulls, and scam tokens." },
  { icon: Target, title: "Early Entry #2–#5", desc: "Be among the first buyers with precision mempool monitoring and priority execution." },
  { icon: Bot, title: "Fully Automated", desc: "Set your parameters once. The bot handles discovery, validation, and execution 24/7." },
  { icon: Lock, title: "Non-Custodial", desc: "Your keys, your crypto. We never access your private keys or seed phrases." },
  { icon: TrendingUp, title: "Smart Auto-Exit", desc: "Automated take-profit and stop-loss with trailing targets to maximize gains." },
];

const howItWorks = [
  { step: "01", title: "Connect Wallet", desc: "Link your Phantom or Solflare wallet securely. No private keys shared." },
  { step: "02", title: "Buy Credits", desc: "Purchase credit packs with SOL. No subscriptions — pay only for what you use." },
  { step: "03", title: "AI Scans & Validates", desc: "The engine monitors new tokens in real-time, running 22+ safety checks." },
  { step: "04", title: "Auto-Execute & Profit", desc: "Validated trades execute instantly. Auto-exit locks in profits automatically." },
];

const testimonials = [
  { name: "Alex T.", location: "New York", saved: "12.5 SOL", quote: "Alpha Meme Sniper caught 3 gems I would have missed. The risk engine blocked 2 rug pulls that would have wiped me out." },
  { name: "Sarah K.", location: "London", saved: "28 SOL", quote: "I've been sniping manually for months. This bot does in seconds what took me hours. The early entry feature is a game-changer." },
  { name: "Dev M.", location: "Singapore", saved: "45 SOL", quote: "The circuit breaker saved my portfolio during a rough week. Capital preservation mode is worth it alone." },
];

const products = [
  { icon: Cpu, title: "AI Risk Engine", desc: "ML-powered deployer scoring, honeypot detection, and wallet cluster analysis." },
  { icon: BarChart3, title: "Portfolio Tracker", desc: "Real-time P&L tracking with comprehensive trade history and analytics." },
  { icon: Eye, title: "Circuit Breaker", desc: "Automatic trading halt after consecutive losses to preserve your capital." },
  { icon: Users, title: "Copy Trading", desc: "Follow top-performing traders and mirror their positions automatically." },
  { icon: Layers, title: "Multi-RPC Routing", desc: "Redundant RPC connections for maximum reliability and speed." },
  { icon: Award, title: "Validation Rules", desc: "22+ configurable rules including LP integrity, sell tax, and volume authenticity." },
];

const faqs = [
  { q: "What is Alpha Meme Sniper AI?", a: "It's an institutional-grade automated trading platform for Solana meme tokens. It combines real-time blockchain monitoring, AI-powered risk analysis, and automated execution to detect and trade new token launches within seconds." },
  { q: "Is my wallet safe?", a: "Absolutely. We use a non-custodial architecture — your private keys stay in your wallet extension. All transactions are signed locally. We never have access to your funds or seed phrases." },
  { q: "How does the credit system work?", a: "Purchase credit packs with SOL — no subscriptions or recurring billing. Credits are consumed per action (token scans, auto-snipes, etc.). You get 50 free credits on signup, plus 50 more for each referral." },
  { q: "What happens in Demo Mode?", a: "Demo Mode lets you test the platform with virtual SOL. All bot logic, validation rules, and signals work identically — just without real funds at risk. Perfect for learning the system." },
  { q: "How fast is the sniper bot?", a: "Sub-second detection with priority fee optimization. Typical entry within 1-3 blocks of liquidity addition, targeting buyer positions #2 through #5." },
  { q: "What is the referral program?", a: "Share your unique referral code with friends. When they sign up using your code, you both earn 50 free credits. There's no limit to how many people you can refer!" },
];

const footerLinks = [
  { section: "Product", links: [
    { label: "Pricing", to: "/pricing" },
    { label: "Platform Guide", to: "/basics" },
    { label: "Promotions", to: "/promotions" },
  ]},
  { section: "Company", links: [
    { label: "About Us", to: "/about" },
    { label: "Contact", to: "/contact" },
  ]},
  { section: "Legal", links: [
    { label: "Terms of Service", to: "/terms" },
    { label: "Privacy Policy", to: "/privacy" },
    { label: "Risk Disclaimer", to: "/risk-disclaimer" },
  ]},
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ─── NAVBAR ─── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/30">
        <div className="container mx-auto max-w-[1400px] px-4 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center shrink-0">
            <img src={headerLogoImg} alt="Alpha Meme Sniper AI" className="h-10 sm:h-12 object-contain" />
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {[
              { label: "Features", href: "#features" },
              { label: "How It Works", href: "#how-it-works" },
              { label: "Referral", href: "#referral" },
              { label: "FAQ", href: "#faq" },
            ].map((item) => (
              <a key={item.href} href={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="text-sm">
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate("/auth")} className="gap-1.5">
              Get Started <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full" style={{ background: "var(--gradient-glow)" }} />
        </div>
        <div className="container mx-auto max-w-[1400px] relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary text-xs gap-1.5">
                <Sparkles className="w-3 h-3" /> AI-Powered Solana Meme Token Sniper
              </Badge>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                Snipe Meme Tokens
                <span className="text-gradient block mt-1">Before Everyone Else</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                The most advanced AI-powered sniping bot on Solana. Sub-second detection, 22+ safety checks, and fully automated execution — all non-custodial.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button size="lg" variant="glow" onClick={() => navigate("/auth")} className="gap-2 text-base">
                  Start Trading Free <ArrowRight className="w-4 h-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/basics")} className="gap-2 text-base">
                  <Play className="w-4 h-4" /> Learn How It Works
                </Button>
              </div>
              <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-success" /> 50 Free Credits on Signup</div>
                <div className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-success" /> No Subscription Required</div>
              </div>
            </div>

            {/* Hero visual */}
            <div className="relative hidden lg:block">
              <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-success animate-pulse" />
                    <span className="text-sm font-semibold text-foreground">Bot Active — Scanning</span>
                  </div>
                  <Badge className="bg-success/15 text-success border-success/30 text-xs">Live</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Tokens Scanned", val: "2,847" },
                    { label: "Blocked (Unsafe)", val: "2,691" },
                    { label: "Trades Executed", val: "156" },
                  ].map((s) => (
                    <div key={s.label} className="p-3 rounded-lg bg-secondary/40 text-center">
                      <p className="text-value-md text-foreground">{s.val}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[
                    { token: "$PEPE2", action: "Bought", result: "+124%", color: "text-success" },
                    { token: "$RUGX", action: "Blocked", result: "Honeypot", color: "text-destructive" },
                    { token: "$MOON", action: "Sold (TP)", result: "+67%", color: "text-success" },
                  ].map((t) => (
                    <div key={t.token} className="flex items-center justify-between px-3 py-2 rounded-lg bg-background/50">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{t.token}</span>
                        <span className="text-xs text-muted-foreground">{t.action}</span>
                      </div>
                      <span className={`text-sm font-bold ${t.color}`}>{t.result}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -bottom-8 -right-8 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-accent/10 blur-3xl" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── STATS BAR ─── */}
      <section className="border-y border-border/30 bg-card/30">
        <div className="container mx-auto max-w-[1400px] px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { val: "22+", label: "Safety Checks", icon: Shield },
              { val: "<1s", label: "Detection Speed", icon: Zap },
              { val: "24/7", label: "Automated Monitoring", icon: Bot },
              { val: "100%", label: "Non-Custodial", icon: Lock },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex flex-col items-center gap-2">
                  <Icon className="w-6 h-6 text-primary" />
                  <p className="text-value-lg text-foreground">{s.val}</p>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{s.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── KEY BENEFITS ─── */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-[1400px]">
          <div className="text-center mb-12 space-y-3">
            <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary text-xs">Key Benefits</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              What You Get with <span className="text-gradient">Alpha Meme Sniper AI</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Institutional-grade tools designed for meme token traders. Sign up in minutes and get 50 free credits to start trading.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {benefits.map((b) => {
              const Icon = b.icon;
              return (
                <Card key={b.title} className="bg-card/60 border-border/30 hover:border-primary/30 transition-all group">
                  <CardContent className="p-6">
                    <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 w-fit mb-4 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground mb-2">{b.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="py-20 px-4 bg-card/20 border-y border-border/20">
        <div className="container mx-auto max-w-[1400px]">
          <div className="text-center mb-12 space-y-3">
            <Badge variant="outline" className="bg-accent/10 border-accent/30 text-accent text-xs">See How It Works</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Start Sniping in <span className="text-gradient-accent">4 Simple Steps</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((step, i) => (
              <div key={step.step} className="relative">
                <div className="p-6 rounded-xl border border-border/30 bg-card/40 hover:border-primary/30 transition-all h-full">
                  <div className="text-4xl font-bold text-primary/20 mb-3">{step.step}</div>
                  <h3 className="text-base font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
                {i < howItWorks.length - 1 && (
                  <ChevronRight className="hidden lg:block absolute top-1/2 -right-3 w-6 h-6 text-border" />
                )}
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Button size="lg" variant="glow" onClick={() => navigate("/auth")} className="gap-2">
              Get Started Now <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ─── REFERRAL PROGRAMME ─── */}
      <section id="referral" className="py-20 px-4">
        <div className="container mx-auto max-w-[1400px]">
          <div className="text-center mb-12 space-y-3">
            <Badge variant="outline" className="bg-accent/10 border-accent/30 text-accent text-xs gap-1">
              <Gift className="w-3 h-3" /> Referral Programme
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Refer Friends, <span className="text-gradient-accent">Earn Free Credits</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Share your unique referral code and earn 50 free credits for every friend who signs up. Your friend gets 50 credits too — everyone wins!
            </p>
          </div>

          {/* Referral steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {[
              { icon: UserPlus, title: "Sign Up & Get Your Code", desc: "Create your free account and receive a unique 8-character referral code instantly.", color: "text-primary" },
              { icon: Gift, title: "Share With Friends", desc: "Send your referral link to friends, post it on social media, or share in trading groups.", color: "text-accent" },
              { icon: Coins, title: "Both Earn 50 Credits", desc: "When your friend signs up with your code, you both receive 50 free credits — no limits!", color: "text-success" },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.title} className="bg-card/60 border-border/30 hover:border-primary/30 transition-all text-center">
                  <CardContent className="p-6">
                    <div className={`p-3 rounded-xl bg-primary/10 border border-primary/20 w-fit mx-auto mb-4`}>
                      <Icon className={`w-7 h-7 ${s.color}`} />
                    </div>
                    <h3 className="text-base font-semibold text-foreground mb-2">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* CTA */}
          <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/5 via-card to-primary/5 p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-accent via-primary to-accent" />
            <div className="relative z-10 space-y-4">
              <div className="inline-flex items-center gap-2 bg-success/10 border border-success/20 rounded-full px-4 py-1.5 text-sm font-semibold text-success">
                <Gift className="w-4 h-4" /> 50 Free Credits on Signup + 50 Per Referral
              </div>
              <h3 className="text-2xl font-bold text-foreground">Start Earning Free Credits Today</h3>
              <p className="text-muted-foreground max-w-lg mx-auto text-sm">
                Sign up now to get your referral code and start sharing. There's no cap — refer as many friends as you want!
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button size="lg" variant="glow" onClick={() => navigate("/auth")} className="gap-2">
                  Sign Up & Get Your Code <ArrowRight className="w-4 h-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/promotions")} className="gap-2">
                  View Referral Dashboard
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="py-20 px-4 bg-card/20 border-y border-border/20">
        <div className="container mx-auto max-w-[1400px]">
          <div className="text-center mb-12 space-y-3">
            <Badge variant="outline" className="bg-success/10 border-success/30 text-success text-xs">Testimonials</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              What Our <span className="text-gradient">Happy Traders</span> Say
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {testimonials.map((t) => (
              <Card key={t.name} className="bg-card/60 border-border/30">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.location}</p>
                    </div>
                    <Badge className="ml-auto bg-success/10 text-success border-success/30 text-xs gap-1">
                      <TrendingUp className="w-3 h-3" /> Saved {t.saved}
                    </Badge>
                  </div>
                  <div className="flex gap-0.5 mb-3">
                    {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-accent text-accent" />)}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed italic">"{t.quote}"</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES / PRODUCTS ─── */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-[1400px]">
          <div className="text-center mb-12 space-y-3">
            <Badge variant="outline" className="bg-accent/10 border-accent/30 text-accent text-xs gap-1">
              <Sparkles className="w-3 h-3" /> Powerful Features
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Everything You Need to <span className="text-gradient-accent">Trade Smarter</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="flex items-start gap-4 p-5 rounded-xl border border-border/30 bg-card/40 hover:border-primary/20 transition-all">
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">{p.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── PRICING CTA ─── */}
      <section id="pricing" className="py-20 px-4 bg-card/20 border-y border-border/20">
        <div className="container mx-auto max-w-[1400px]">
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card/80 to-primary/5 p-8 sm:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--gradient-glow)" }} />
            <div className="relative z-10 space-y-5">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
                Pay-As-You-Go with <span className="text-gradient">SOL Credits</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                No subscriptions. Buy credit packs with SOL and only pay for what you use. Get 50 free credits on signup to start trading immediately.
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button size="lg" variant="glow" onClick={() => navigate("/pricing")} className="gap-2 text-base">
                  <Coins className="w-4 h-4" /> View Credit Packs
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/auth")} className="gap-2 text-base">
                  Try Free — 50 Credits
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="py-20 px-4">
        <div className="container mx-auto max-w-[800px]">
          <div className="text-center mb-10 space-y-3">
            <h2 className="text-3xl font-bold text-foreground">Frequently Asked Questions</h2>
          </div>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-border/40 rounded-xl overflow-hidden bg-card/60 px-4">
                <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline py-4">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-border/30 bg-card/30 py-12 px-4">
        <div className="container mx-auto max-w-[1400px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-10">
            <div className="lg:col-span-2 space-y-4">
              <img src={headerLogoImg} alt="Alpha Meme Sniper AI" className="h-10 object-contain" />
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                The most advanced AI-powered meme token sniper on Solana. Real-time detection, multi-layer risk analysis, and automated execution.
              </p>
              <div className="flex gap-3">
                <a href="https://discord.gg/alphamemesniperai" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Discord">
                  <MessageSquare className="w-4 h-4" />
                </a>
                <a href="https://x.com/alpha_ai_sniper" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Twitter/X">
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a href="https://instagram.com/alphamemesniperai" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Instagram">
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a href="mailto:support@alphamemesniper.com" className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Email Support">
                  <Mail className="w-4 h-4" />
                </a>
              </div>
            </div>

            {footerLinks.map((section) => (
              <div key={section.section}>
                <h4 className="text-sm font-semibold text-foreground mb-3">{section.section}</h4>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <Link to={link.to} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-border/30 pt-6">
            <p className="text-xs text-muted-foreground/60 leading-relaxed text-center max-w-4xl mx-auto">
              <strong className="text-warning/60">Disclaimer:</strong> Alpha Meme Sniper AI is a trading tool, not financial advice. Meme token trading is extremely high-risk. Past performance does not guarantee future results. Only trade with funds you can afford to lose. DYOR. All trades are executed through your own wallet — we never have access to your private keys.
            </p>
            <p className="text-xs text-muted-foreground/40 text-center mt-4">
              © {new Date().getFullYear()} Alpha Meme Sniper AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
