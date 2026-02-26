import PublicLayout from "@/components/layout/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import logoImg from "@/assets/logo.png";
import { 
  Shield, Zap, Bot, Target, Users, Globe, 
  Lock, Cpu, BarChart3, CheckCircle, TrendingUp, Eye,
  Rocket, Calendar, Star, ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";

const stats = [
  { value: "22+", label: "Validation Checks", icon: Shield },
  { value: "<1s", label: "Detection Speed", icon: Zap },
  { value: "24/7", label: "Bot Monitoring", icon: Bot },
  { value: "100%", label: "Non-Custodial", icon: Lock },
];

const features = [
  { icon: Target, title: "Precision Sniping", desc: "Sub-second detection of new token launches with buyer position targeting." },
  { icon: Shield, title: "Multi-Layer Risk Engine", desc: "Deployer reputation, honeypot detection, LP verification, wallet clustering." },
  { icon: Cpu, title: "AI-Powered Analysis", desc: "ML models analyze token patterns, deployer behavior, and market conditions." },
  { icon: BarChart3, title: "Advanced Portfolio", desc: "Real-time P&L, automated TP/SL, and comprehensive trade history." },
  { icon: Eye, title: "Circuit Breaker", desc: "Automatic trading halt on consecutive losses to preserve capital." },
  { icon: TrendingUp, title: "Copy Trading", desc: "Follow successful traders and mirror their positions automatically." },
];

const values = [
  { title: "Security First", desc: "Non-custodial architecture. Your keys, your crypto. We never access your funds.", icon: Lock },
  { title: "Transparency", desc: "Every validation rule, risk check, and trade decision is logged and auditable.", icon: Eye },
  { title: "Innovation", desc: "Continuously evolving algorithms to stay ahead of new rug pull techniques.", icon: Cpu },
  { title: "Community", desc: "Built by traders, for traders. Your feedback shapes the product roadmap.", icon: Users },
];

const roadmap = [
  { quarter: "Q1 2025", title: "Platform Launch", desc: "Core sniper engine, 22+ validation rules, basic portfolio tracking", status: "done" },
  { quarter: "Q2 2025", title: "AI Risk Engine v2", desc: "Machine learning-based deployer scoring, holder entropy analysis", status: "done" },
  { quarter: "Q3 2025", title: "Copy Trading & Multi-RPC", desc: "Follow top traders, redundant RPC routing for reliability", status: "current" },
  { quarter: "Q4 2025", title: "Mobile App & Cross-Chain", desc: "Native mobile experience, Ethereum & Base chain support", status: "upcoming" },
  { quarter: "Q1 2026", title: "Social Intelligence", desc: "Twitter/Telegram sentiment analysis, social-driven trade signals", status: "upcoming" },
];

const trustSignals = [
  "Open-source validation engine",
  "All trades signed locally in your wallet",
  "No access to private keys or seed phrases",
  "Real-time audit log for every decision",
  "Circuit breaker protects against cascading losses",
  "Community-driven development roadmap",
];

export default function AboutUs() {
  return (
    <PublicLayout>
      <div className="container mx-auto max-w-[1200px] px-4 py-10 sm:py-14">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-5">
            <img src={logoImg} alt="Alpha Meme Sniper AI" className="w-20 h-20 rounded-2xl object-contain glow-primary" />
          </div>
          <h1 className="text-display text-foreground mb-3">Alpha Meme Sniper AI</h1>
          <p className="text-body text-muted-foreground max-w-2xl mx-auto mb-5">
            The most advanced AI-powered meme token sniper on Solana. Real-time detection, 
            multi-layer risk analysis, and automated execution for the ultimate trading edge.
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary">Solana Native</Badge>
            <Badge variant="outline" className="bg-accent/10 border-accent/30 text-accent">AI Powered</Badge>
            <Badge variant="outline" className="bg-success/10 border-success/30 text-success">Non-Custodial</Badge>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="bg-card border-border/50 text-center">
                <CardContent className="p-5">
                  <Icon className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="text-value-lg text-foreground">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">{s.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Platform Capabilities */}
        <h2 className="text-heading text-foreground mb-5 flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" /> Platform Capabilities
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title} className="bg-card border-border/50 hover:border-primary/20 transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-1">{f.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── ROADMAP TIMELINE ── */}
        <h2 className="text-heading text-foreground mb-5 flex items-center gap-2">
          <Rocket className="w-5 h-5 text-accent" /> Product Roadmap
        </h2>
        <div className="relative mb-12">
          {/* Timeline line */}
          <div className="absolute left-4 sm:left-6 top-0 bottom-0 w-px bg-border/50" />
          <div className="space-y-4">
            {roadmap.map((item) => (
              <div key={item.quarter} className="relative pl-12 sm:pl-16">
                {/* Dot */}
                <div className={`absolute left-2.5 sm:left-4.5 top-3 w-3 h-3 rounded-full border-2 ${
                  item.status === "done" ? "bg-success border-success" : item.status === "current" ? "bg-primary border-primary animate-pulse" : "bg-muted border-border"
                }`} />
                <Card className={`bg-card border-border/50 ${item.status === "current" ? "border-primary/30" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`text-[10px] ${
                        item.status === "done" ? "bg-success/10 text-success border-success/30" : 
                        item.status === "current" ? "bg-primary/10 text-primary border-primary/30" : 
                        "bg-secondary text-muted-foreground border-border"
                      }`}>
                        <Calendar className="w-3 h-3 mr-1" />
                        {item.quarter}
                      </Badge>
                      {item.status === "current" && (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">In Progress</Badge>
                      )}
                      {item.status === "done" && (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[10px]">
                          <CheckCircle className="w-3 h-3 mr-1" /> Complete
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>

        {/* Mission + Values */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          <Card className="bg-card border-border/50">
            <CardContent className="p-6">
              <h2 className="text-heading text-foreground mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-accent" /> Our Mission
              </h2>
              <p className="text-body text-muted-foreground leading-relaxed mb-4">
                To democratize access to meme token trading by providing institutional-grade tools 
                to everyday traders. We believe the best defense against rug pulls is a smarter offense — 
                AI-driven analysis that catches what human eyes miss.
              </p>
              <div className="space-y-2">
                {["Level the playing field for retail traders", "Eliminate rug pull losses through AI", "Make professional trading accessible"].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle className="w-4 h-4 text-success shrink-0" /> {item}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {values.map((v) => {
              const Icon = v.icon;
              return (
                <Card key={v.title} className="bg-card border-border/50">
                  <CardContent className="p-4">
                    <Icon className="w-5 h-5 text-primary mb-2" />
                    <h3 className="text-sm font-semibold text-foreground mb-1">{v.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{v.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* ── TRUST SIGNALS ── */}
        <Card className="bg-card border-primary/20 mb-10">
          <CardContent className="p-6">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Why Trust Alpha Meme Sniper AI?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {trustSignals.map((s) => (
                <div key={s} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" /> {s}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Disclaimer */}
        <Card className="bg-card border-warning/20">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground leading-relaxed text-center">
              <strong className="text-warning">Disclaimer:</strong> Alpha Meme Sniper AI is a trading tool, not financial advice. 
              Meme token trading is extremely high-risk. Past performance does not guarantee future results. 
              Only trade with funds you can afford to lose. DYOR.
            </p>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
