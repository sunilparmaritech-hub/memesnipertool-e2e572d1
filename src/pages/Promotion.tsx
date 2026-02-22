import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import headerLogo from "@/assets/header-logo.png";
import {
  Zap,
  Shield,
  BarChart3,
  Bot,
  Target,
  Rocket,
  ChevronDown,
  ChevronUp,
  Check,
  Star,
  Crown,
  TrendingUp,
  Eye,
  Clock,
  Layers,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: Target,
    title: "Real-Time Token Sniping",
    description: "Detect new tokens on Solana within seconds of launch and execute trades before the crowd.",
  },
  {
    icon: Shield,
    title: "AI Risk Analysis",
    description: "Automated honeypot detection, rug-pull scoring, and liquidity lock verification on every token.",
  },
  {
    icon: Bot,
    title: "Automated Trading Bot",
    description: "Set take-profit & stop-loss, and let the bot execute trades 24/7 with zero manual intervention.",
  },
  {
    icon: Eye,
    title: "Wallet Intelligence",
    description: "Track smart-money wallets, copy top traders, and cluster analysis for insider detection.",
  },
  {
    icon: Layers,
    title: "Multi-RPC Redundancy",
    description: "Never miss a trade. Failover across multiple RPC endpoints for maximum uptime.",
  },
  {
    icon: TrendingUp,
    title: "Advanced Charting",
    description: "Live price charts, liquidity depth, and volume analysis — all in one dashboard.",
  },
];

const testimonials = [
  {
    name: "CryptoAlpha",
    location: "Solana Trader",
    saved: "12x ROI in 1 Month",
    quote: "Alpha MemeSniper AI caught a token 3 seconds after launch. I 12x'd my bag before most people even saw it. This tool is insane.",
  },
  {
    name: "DeFi Whale",
    location: "Professional Trader",
    saved: "Saved 40+ Hours/Week",
    quote: "I used to manually scan for tokens 8 hours a day. Now the bot does it all. The risk analysis alone has saved me from dozens of rug pulls.",
  },
  {
    name: "MemeKing",
    location: "Community Leader",
    saved: "500% Portfolio Growth",
    quote: "The wallet intelligence feature is a game-changer. I follow the smart money and my portfolio has grown 5x since I started using it.",
  },
];

const faqs = [
  {
    q: "What is Alpha MemeSniper AI?",
    a: "Alpha MemeSniper AI is an AI-powered platform for discovering, analyzing, and trading meme tokens on Solana. It combines real-time token scanning, automated risk analysis, and one-click trading into a single dashboard.",
  },
  {
    q: "Do I need to connect a wallet?",
    a: "Yes, you'll connect your Solana wallet (like Phantom) to execute trades. You can also use Demo Mode to explore the platform risk-free without connecting a wallet.",
  },
  {
    q: "How does the AI risk analysis work?",
    a: "Our AI scans every token for honeypot contracts, rug-pull indicators, liquidity lock status, ownership renouncement, and buy/sell tax. Each token gets a risk score from 0-100 so you can make informed decisions.",
  },
  {
    q: "Can I cancel my subscription anytime?",
    a: "Absolutely! You can cancel your subscription anytime from Settings. Your plan stays active until the end of the billing period with a 3-day grace period on failed payments.",
  },
  {
    q: "What payment methods are accepted?",
    a: "We accept all major credit/debit cards and crypto payments. Subscriptions auto-renew monthly or yearly based on your chosen plan.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes! The Free plan gives you 5 token validations per day, delayed feed access, and community access. Upgrade anytime to unlock real-time sniping and automation.",
  },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    icon: Star,
    color: "text-muted-foreground",
    features: ["5 validations/day", "Delayed feed (30s)", "Community access", "Demo mode"],
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month",
    icon: Zap,
    color: "text-primary",
    popular: true,
    features: ["200 validations/day", "Real-time feed", "Auto trading", "Early Trust Mode", "Wallet intelligence", "50 auto executions/day"],
  },
  {
    name: "Elite",
    price: "$149",
    period: "/month",
    icon: Crown,
    color: "text-purple-400",
    features: ["Unlimited validations", "Priority execution", "Multi-RPC", "Advanced clustering", "Capital preservation", "Premium support"],
  },
];

export default function Promotion() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/40">
        <div className="container mx-auto px-4 flex items-center justify-between h-16">
          <Link to="/">
            <img src={headerLogo} alt="Alpha MemeSniper AI" className="h-[42px] sm:h-[54px] w-auto max-w-[270px] sm:max-w-[330px] object-contain" />
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="glow-primary">Get Started Free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 relative">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <Badge variant="outline" className="mb-6 text-primary border-primary/30 px-4 py-1.5">
            <Rocket className="w-3.5 h-3.5 mr-1.5" />
            AI-Powered Meme Token Sniping
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Snipe Meme Tokens<br />
            <span className="text-gradient">Before They Moon</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Real-time token scanning, AI risk analysis, and automated trading on Solana. 
            Discover tokens in seconds, not minutes. Trade smarter with Alpha MemeSniper AI.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" className="glow-primary text-base px-8 py-6">
                Start Sniping Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <a href="#features">
              <Button variant="outline" size="lg" className="text-base px-8 py-6">
                See How It Works
              </Button>
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-4">No credit card required • Free plan available</p>
        </div>
      </section>

      {/* Key Benefits Banner */}
      <section className="py-12 border-y border-border/30 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "< 3s", label: "Token Detection" },
              { value: "100+", label: "Tokens Scanned/hr" },
              { value: "24/7", label: "Automated Trading" },
              { value: "99.9%", label: "Uptime" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl sm:text-3xl font-bold text-gradient">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Powerful <span className="text-gradient">Features</span> to Dominate
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Everything you need to find, analyze, and trade meme tokens faster than anyone else.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <Card key={f.title} className="bg-card/60 border-border/40 hover:border-primary/30 transition-all group">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <f.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-secondary/10 border-y border-border/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground">Three simple steps to start sniping</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: "01", title: "Connect Wallet", desc: "Link your Phantom or Solana wallet in one click. Or start with Demo Mode.", icon: Zap },
              { step: "02", title: "Configure Bot", desc: "Set trade amount, take-profit, stop-loss, and risk preferences.", icon: BarChart3 },
              { step: "03", title: "Auto Snipe", desc: "The AI scans, validates, and executes trades automatically 24/7.", icon: Rocket },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <s.icon className="w-7 h-7 text-primary" />
                </div>
                <Badge variant="outline" className="mb-3 text-primary border-primary/30">{s.step}</Badge>
                <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              What Our <span className="text-gradient">Snipers</span> Say
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {testimonials.map((t) => (
              <Card key={t.name} className="bg-card/60 border-border/40">
                <CardContent className="p-6">
                  <Badge variant="outline" className="mb-4 text-primary border-primary/30">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {t.saved}
                  </Badge>
                  <p className="text-sm text-muted-foreground mb-4 italic">"{t.quote}"</p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                      {t.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.location}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-secondary/10 border-y border-border/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              One Simple Plan for <span className="text-gradient">Maximum Edge</span>
            </h2>
            <p className="text-muted-foreground">Choose the plan that fits your trading style</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <Card key={plan.name} className={`relative overflow-hidden bg-card/60 border-border/40 ${plan.popular ? 'ring-1 ring-primary/40 border-primary/40' : ''}`}>
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-0.5 rounded-bl-lg">
                    MOST POPULAR
                  </div>
                )}
                <CardContent className="p-6 pt-8">
                  <div className="flex items-center gap-2 mb-3">
                    <plan.icon className={`w-5 h-5 ${plan.color}`} />
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                  </div>
                  <div className="mb-6">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <ul className="space-y-2.5 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth">
                    <Button className="w-full" variant={plan.popular ? 'default' : 'outline'}>
                      {plan.name === "Free" ? "Get Started" : "Subscribe Now"}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-border/40 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/30 transition-colors"
                >
                  <span className="font-medium text-sm">{faq.q}</span>
                  {openFaq === i ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-muted-foreground animate-fade-in">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-secondary/10 border-t border-border/30">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to <span className="text-gradient">Snipe</span>?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of traders using Alpha MemeSniper AI to find the next 100x meme token.
          </p>
          <Link to="/auth">
            <Button size="lg" className="glow-primary text-base px-10 py-6">
              Start Trading Now
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-border/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <img src={headerLogo} alt="Alpha MemeSniper AI" className="h-[36px] w-auto object-contain" />
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <Link to="/auth" className="hover:text-foreground transition-colors">Sign In</Link>
              <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Plans</a>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-border/20 text-center">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Alpha MemeSniper AI. All rights reserved. Trading involves risk. Past performance does not guarantee future results.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
