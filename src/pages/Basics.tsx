import { useState, useMemo } from "react";
import PublicLayout from "@/components/layout/PublicLayout";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  BookOpen, Zap, Shield, TrendingUp, Bot, Target, 
  ChevronRight, ChevronDown, Wallet, BarChart3, AlertTriangle,
  Lightbulb, GraduationCap, Search, Star, Clock,
  Lock, Eye, Cpu, Users, Layers, ArrowRight, Info,
  Crosshair, Gauge, ToggleLeft, Filter
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Platform Guide sections ──
const platformGuide = [
  {
    id: "what-is",
    icon: Zap,
    title: "What is Alpha Meme Sniper AI?",
    badge: "Start Here",
    badgeColor: "bg-success/15 text-success border-success/30",
    content: `Alpha Meme Sniper AI is an institutional-grade automated trading platform for Solana meme tokens. It combines real-time blockchain monitoring, AI-powered risk analysis, and automated execution to detect and trade new token launches within seconds.`,
    proTip: "Connect your wallet and start in Demo Mode first to learn the system risk-free before committing real funds.",
    glossary: [
      { term: "Sniper Bot", def: "An automated program that detects and trades new token launches faster than manual traders." },
      { term: "Non-Custodial", def: "Your private keys stay in your wallet — we never access your funds." },
    ],
  },
  {
    id: "early-entry",
    icon: Target,
    title: "How Early Entry (#2–#5) Strategy Works",
    badge: "Core Strategy",
    badgeColor: "bg-primary/15 text-primary border-primary/30",
    content: `The Early Entry strategy targets buyer positions #2 through #5 on new token launches. Being among the first buyers maximizes profit potential while our AI validates the token in real-time. The bot monitors mempool activity and detects liquidity pool creation events to execute trades at optimal timing.`,
    proTip: "Position #2-#3 carries the highest reward but also the highest risk. Start with positions #4-#5 as a beginner.",
    glossary: [
      { term: "Buyer Position", def: "Your order in the queue of buyers for a new token. Lower = earlier entry." },
      { term: "Mempool", def: "The waiting area for unconfirmed transactions on the blockchain." },
    ],
  },
  {
    id: "risk-protection",
    icon: Shield,
    title: "Risk Protection System",
    badge: "Critical",
    badgeColor: "bg-warning/15 text-warning border-warning/30",
    content: `The multi-layer risk engine runs 22+ validation checks before every trade: LP integrity verification, sell route testing, wallet cluster detection, deployer reputation scoring, honeypot detection, volume authenticity analysis, and holder entropy checks. Each layer can independently block a trade.`,
    proTip: "Never disable LP integrity or sell route validation — these are your primary defense against rug pulls.",
    glossary: [
      { term: "LP Integrity", def: "Verifies that the liquidity pool is legitimate and not designed to trap buyers." },
      { term: "Cluster Detection", def: "Identifies groups of wallets controlled by the same entity to detect manipulation." },
    ],
  },
  {
    id: "liquidity-tax",
    icon: Eye,
    title: "Liquidity & Hidden Tax Explained",
    badge: "Important",
    badgeColor: "bg-accent/15 text-accent border-accent/30",
    content: `Liquidity is the pool of funds that enables trading. Low liquidity means high slippage (price impact per trade). Hidden sell taxes are coded into token contracts to steal a percentage of every sale. Our system tests actual sell routes before buying to detect these traps.`,
    proTip: "Set minimum liquidity to $10,000+ for auto-trades. Below this, price manipulation is trivially easy.",
    glossary: [
      { term: "Slippage", def: "The difference between expected price and actual execution price." },
      { term: "Sell Tax", def: "A hidden fee coded into the token contract that takes a percentage of every sale." },
    ],
  },
  {
    id: "blocked-tokens",
    icon: AlertTriangle,
    title: "Why Tokens Get Blocked",
    badge: "Safety",
    badgeColor: "bg-destructive/15 text-destructive border-destructive/30",
    content: `Tokens are blocked when they fail validation checks: honeypot detection (can't sell), high sell tax (>10%), deployer has rug history, liquidity pool is too small or unlocked, suspicious wallet clustering, failed sell route simulation, or circuit breaker triggered from recent losses.`,
    proTip: "Check the Scanner's rejection log to understand why tokens were blocked — it's a great learning tool.",
    glossary: [
      { term: "Honeypot", def: "A token contract that allows buying but prevents selling — a guaranteed loss." },
      { term: "Circuit Breaker", def: "Automatic trading pause after consecutive losses or detected rug pulls." },
    ],
  },
  {
    id: "capital-preservation",
    icon: Lock,
    title: "Capital Preservation Mode",
    badge: "Advanced",
    badgeColor: "bg-primary/15 text-primary border-primary/30",
    content: `Capital Preservation Mode automatically reduces trade sizes and increases validation strictness after losses. It implements a drawdown-based throttle: as losses accumulate, the system progressively tightens risk parameters. When the circuit breaker triggers, all automated trading pauses until manually reset.`,
    proTip: "Enable Capital Preservation with a 20% drawdown threshold — it will save you during bad market conditions.",
    glossary: [
      { term: "Drawdown", def: "The peak-to-trough decline in your portfolio value during a specific period." },
      { term: "Throttle", def: "Gradually reducing trade frequency or size based on risk conditions." },
    ],
  },
  {
    id: "auto-vs-manual",
    icon: ToggleLeft,
    title: "Auto vs Manual Mode",
    badge: "Modes",
    badgeColor: "bg-accent/15 text-accent border-accent/30",
    content: `Auto Mode: The bot autonomously discovers, validates, and trades tokens based on your configured parameters. Manual Mode: You review trade signals and approve/reject each trade individually. Both modes use the same validation engine — the difference is execution control. Demo Mode simulates trades without real funds.`,
    proTip: "Start with Manual Mode for a week to learn which signals the bot generates, then switch to Auto with tight risk limits.",
    glossary: [
      { term: "Trade Signal", def: "An opportunity identified by the bot that passes initial filters but awaits execution." },
      { term: "Demo Mode", def: "Simulated trading using virtual funds — perfect for learning without risk." },
    ],
  },
];

// ── Education Hub ──
const educationArticles = [
  { title: "Meme Coin Basics", level: "Beginner", time: "5 min", tags: ["fundamentals", "solana"], desc: "Understand what meme coins are, how they work on Solana, and the key terminology every trader needs." },
  { title: "Rug Pull Detection 101", level: "Beginner", time: "8 min", tags: ["safety", "rug-pulls"], desc: "Learn the warning signs of rug pulls and how Alpha Meme Sniper's AI catches them before you trade." },
  { title: "Understanding LP & Liquidity", level: "Beginner", time: "6 min", tags: ["liquidity", "defi"], desc: "How liquidity pools work, why they matter, and what 'locked liquidity' really means for your safety." },
  { title: "Wallet Clustering Analysis", level: "Intermediate", time: "10 min", tags: ["analysis", "wallets"], desc: "How the platform detects coordinated wallet groups that manipulate token prices and volumes." },
  { title: "Deployer Reputation Scoring", level: "Intermediate", time: "7 min", tags: ["risk", "deployers"], desc: "The algorithm behind deployer trust scores and how past behavior predicts future rug probability." },
  { title: "Slippage, Depth & Quote Validation", level: "Intermediate", time: "9 min", tags: ["trading", "execution"], desc: "How the bot validates trade routes, checks quote depth, and ensures you get fair execution prices." },
  { title: "Holder Entropy & Distribution", level: "Advanced", time: "12 min", tags: ["analysis", "entropy"], desc: "Statistical analysis of token holder distribution to detect artificial concentration patterns." },
  { title: "Volume Authenticity Detection", level: "Advanced", time: "11 min", tags: ["analysis", "wash-trading"], desc: "Identifying wash trading, circular trades, and fake volume through on-chain transaction analysis." },
  { title: "Priority Fees & MEV Strategy", level: "Advanced", time: "15 min", tags: ["strategy", "mev"], desc: "Optimize your transaction priority fees to compete with MEV bots and get better execution." },
];

const levelColors: Record<string, string> = {
  Beginner: "bg-success/15 text-success border-success/30",
  Intermediate: "bg-accent/15 text-accent border-accent/30",
  Advanced: "bg-primary/15 text-primary border-primary/30",
};

// ── FAQ ──
const faqs = [
  { q: "What wallets are supported?", a: "Phantom, Solflare, and other Solana-compatible wallets via the standard wallet adapter." },
  { q: "How fast is the sniper bot?", a: "Sub-second detection with priority fee optimization. Typical entry within 1-3 blocks of liquidity addition." },
  { q: "Is my private key safe?", a: "We never access your private keys. All transactions are signed locally in your wallet extension." },
  { q: "What are validation rules?", a: "22+ automated checks including honeypot detection, deployer reputation, LP integrity, and volume authenticity analysis." },
  { q: "How does the circuit breaker work?", a: "Automatically pauses trading after consecutive losses, rug pulls, or excessive drawdown within a configurable time window." },
  { q: "Can I run multiple bots?", a: "Yes, configure max concurrent trades in your sniper settings. Each position is independently managed with its own TP/SL." },
];

function GlossaryTerm({ term, def }: { term: string; def: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="border-b border-dashed border-primary/40 text-primary cursor-help text-xs font-medium">{term}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        <p><strong>{term}:</strong> {def}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function Basics() {
  const [search, setSearch] = useState("");
  const [eduFilter, setEduFilter] = useState<string>("All");
  const { user } = useAuth();

  const Layout = user ? AppLayout : PublicLayout;

  const filteredGuide = useMemo(() => 
    platformGuide.filter(g => 
      g.title.toLowerCase().includes(search.toLowerCase()) || 
      g.content.toLowerCase().includes(search.toLowerCase())
    ), [search]);

  const filteredArticles = useMemo(() => 
    educationArticles.filter(a => {
      const matchSearch = a.title.toLowerCase().includes(search.toLowerCase()) || a.desc.toLowerCase().includes(search.toLowerCase());
      const matchLevel = eduFilter === "All" || a.level === eduFilter;
      return matchSearch && matchLevel;
    }), [search, eduFilter]);

  // Quick links differ based on auth status
  const quickLinks = user
    ? [
        { to: "/scanner", icon: Crosshair, label: "Open Scanner", desc: "Start scanning tokens" },
        { to: "/sniper-settings", icon: Bot, label: "Bot Settings", desc: "Configure your bot" },
        { to: "/risk", icon: Shield, label: "Risk Settings", desc: "Manage risk rules" },
      ]
    : [
        { to: "/pricing", icon: Star, label: "View Pricing", desc: "See subscription plans" },
        { to: "/auth", icon: Crosshair, label: "Get Started", desc: "Create your account" },
        { to: "/contact", icon: Shield, label: "Contact Us", desc: "Questions? Reach out" },
      ];

  return (
    <Layout>
      <div className="container mx-auto max-w-[1200px] px-4 py-10 sm:py-14">
        {/* Hero + Search */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search guides, articles, glossary..."
                className="pl-9 bg-secondary/50 border-border/50"
              />
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary">
                <BookOpen className="w-3 h-3 mr-1" /> 7 Guides
              </Badge>
              <Badge variant="outline" className="bg-accent/10 border-accent/30 text-accent">
                <Layers className="w-3 h-3 mr-1" /> 9 Articles
              </Badge>
            </div>
          </div>
        </div>

        {/* ── PLATFORM GUIDE ── */}
        <section className="mb-12">
          <h2 className="text-heading text-foreground mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Platform Guide
          </h2>

          <Accordion type="multiple" className="space-y-2">
            {filteredGuide.map((section) => {
              const Icon = section.icon;
              return (
                <AccordionItem key={section.id} value={section.id} className="border border-border/40 rounded-xl overflow-hidden bg-card/60">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-secondary/30 [&[data-state=open]]:bg-secondary/20">
                    <div className="flex items-center gap-3 text-left">
                      <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">{section.title}</span>
                      <Badge variant="outline" className={`${section.badgeColor} text-[10px] ml-auto mr-2`}>
                        {section.badge}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 pt-2">
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">{section.content}</p>
                    
                    {/* Pro Tip */}
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/5 border border-accent/20 mb-4">
                      <Star className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-accent mb-0.5">Pro Tip</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{section.proTip}</p>
                      </div>
                    </div>

                    {/* Glossary */}
                    {section.glossary.length > 0 && (
                      <div className="flex flex-wrap gap-3">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Key Terms:</span>
                        {section.glossary.map((g) => (
                          <GlossaryTerm key={g.term} term={g.term} def={g.def} />
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </section>

        {/* ── EDUCATION HUB ── */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-heading text-foreground flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-accent" />
              Education Hub
            </h2>
            <div className="flex gap-1.5">
              {["All", "Beginner", "Intermediate", "Advanced"].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setEduFilter(lvl)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    eduFilter === lvl
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredArticles.map((article) => (
              <Card key={article.title} className="bg-card border-border/50 hover:border-primary/20 transition-all group cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className={`${levelColors[article.level]} text-[10px]`}>
                      {article.level}
                    </Badge>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="w-3 h-3" /> {article.time}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1.5 group-hover:text-primary transition-colors">{article.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed text-clamp-2 mb-3">{article.desc}</p>
                  <div className="flex flex-wrap gap-1">
                    {article.tags.map((tag) => (
                      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">#{tag}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ── QUICK LINKS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-12">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.to} to={link.to}>
                <Card className="bg-card border-border/50 hover:border-primary/30 transition-all group cursor-pointer">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{link.label}</p>
                      <p className="text-xs text-muted-foreground">{link.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* ── FAQ ── */}
        <section>
          <h2 className="text-heading text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Frequently Asked Questions
          </h2>
          <Accordion type="multiple" className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-border/40 rounded-xl overflow-hidden bg-card/60">
                <AccordionTrigger className="px-4 py-3 text-sm font-medium text-foreground hover:no-underline hover:bg-secondary/30">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3 pt-1 text-xs text-muted-foreground leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Upgrade CTA */}
        <Card className="mt-10 bg-gradient-to-r from-primary/10 via-card to-accent/10 border-primary/20">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-bold text-foreground mb-2">Ready to Go Pro?</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-lg mx-auto">
              Unlock advanced strategies, priority execution, and AI-powered analytics to maximize your meme token trading edge.
            </p>
            <Link to="/pricing">
              <button className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors inline-flex items-center gap-2">
                View Upgrade Options <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
