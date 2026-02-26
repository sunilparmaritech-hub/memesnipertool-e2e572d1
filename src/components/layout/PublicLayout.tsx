import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import headerLogoImg from "@/assets/header_logo.png";
import { ArrowRight, MessageSquare, ExternalLink, Mail } from "lucide-react";

interface PublicLayoutProps {
  children: ReactNode;
}

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
    { label: "AML & Risk Policy", to: "/aml-policy" },
    { label: "Non-Custodial Disclosure", to: "/non-custodial-disclosure" },
  ]},
];

export default function PublicLayout({ children }: PublicLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/30">
        <div className="container mx-auto max-w-[1400px] px-4 flex items-center justify-between h-14">
          <Link to="/" className="flex items-center shrink-0">
            <img src={headerLogoImg} alt="Alpha Meme Sniper AI" className="h-8 sm:h-10 object-contain" />
          </Link>
          <nav className="hidden md:flex items-center gap-5">
            {[
              { label: "About", to: "/about" },
              { label: "Pricing", to: "/pricing" },
              { label: "Guide", to: "/basics" },
              { label: "Contact", to: "/contact" },
            ].map((item) => (
              <Link key={item.to} to={item.to} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
                {item.label}
              </Link>
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

      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 bg-card/30 py-10 px-4">
        <div className="container mx-auto max-w-[1400px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-8">
            <div className="lg:col-span-2 space-y-3">
              <img src={headerLogoImg} alt="Alpha Meme Sniper AI" className="h-8 object-contain" />
              <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
                AI-powered meme token sniper on Solana. Real-time detection, multi-layer risk analysis, and automated execution.
              </p>
              <div className="flex gap-2">
                <a href="https://discord.gg/alphamemesniperai" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Discord">
                  <MessageSquare className="w-3.5 h-3.5" />
                </a>
                <a href="https://x.com/alpha_ai_sniper" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Twitter/X">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a href="https://instagram.com/alphamemesniperai" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Instagram">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a href="mailto:support@alphamemesniper.com" className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Email Support">
                  <Mail className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
            {footerLinks.map((section) => (
              <div key={section.section}>
                <h4 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">{section.section}</h4>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <Link to={link.to} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-border/30 pt-5">
            <p className="text-[10px] text-muted-foreground/60 leading-relaxed text-center max-w-3xl mx-auto">
              <strong className="text-warning/60">Disclaimer:</strong> Alpha Meme Sniper AI is a trading tool, not financial advice. 
              Meme token trading is extremely high-risk. Only trade with funds you can afford to lose. DYOR.
            </p>
            <p className="text-[10px] text-muted-foreground/40 text-center mt-3">
              © {new Date().getFullYear()} Alpha Meme Sniper AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
