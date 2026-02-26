import PublicLayout from "@/components/layout/PublicLayout";
import { ShieldCheck, Wallet, Lock, ArrowRight, Server, UserCheck, Scale } from "lucide-react";

const disclosurePoints = [
  {
    icon: Wallet,
    title: "You Control Your Wallet",
    description: "Alpha Meme Sniper AI never stores, accesses, or controls your private keys. Your wallet (e.g., Phantom) remains entirely under your control at all times. Every transaction requires your explicit wallet signature.",
  },
  {
    icon: Lock,
    title: "No Custody of Assets",
    description: "We do not hold, pool, or manage any user funds. There are no platform-controlled wallets or escrow accounts. Your digital assets remain in your personal wallet throughout all interactions with our platform.",
  },
  {
    icon: Server,
    title: "Technology Provider Only",
    description: "Alpha Meme Sniper AI is a software automation and analytics tool. We provide trade intelligence, risk analysis, and execution automation — but every trade is executed directly through your connected wallet on the Solana blockchain.",
  },
  {
    icon: Scale,
    title: "No Exchange or Intermediary",
    description: "We do not operate as a Virtual Digital Asset (VDA) exchange, trading platform, or fund manager. We do not facilitate fiat on/off ramps, intermediate fund transfers, or act as a counterparty to any trade.",
  },
  {
    icon: UserCheck,
    title: "User Responsibility",
    description: "You are solely responsible for your trading decisions, wallet security, and compliance with applicable laws in your jurisdiction. You acknowledge that meme token trading carries extreme risk and that past performance does not guarantee future results.",
  },
];

export default function NonCustodialDisclosure() {
  return (
    <PublicLayout>
      <div className="container mx-auto max-w-4xl px-4 py-12 space-y-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Non-Custodial Disclosure</h1>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Understanding how Alpha Meme Sniper AI operates as a non-custodial platform. 
            Your keys, your crypto, your responsibility.
          </p>
        </div>

        {/* Legal Positioning Statement */}
        <div className="p-6 rounded-xl border-2 border-primary/20 bg-primary/5 space-y-3">
          <h2 className="text-lg font-bold text-foreground">Legal Positioning Statement</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Alpha Meme Sniper AI is a <strong className="text-foreground">non-custodial technology intelligence platform</strong> that 
            provides automated token discovery, risk analysis, and trade execution facilitation on the Solana blockchain. 
            The platform operates exclusively as a <strong className="text-foreground">software automation layer</strong> — 
            it does not custody assets, control private keys, operate fiat on/off ramps, intermediate fund transfers, 
            or act as an exchange counterparty. All trades are executed directly through the user's personal wallet 
            with explicit user authorization via wallet signature.
          </p>
        </div>

        {/* Risk Classification */}
        <div className="p-5 rounded-xl border border-border bg-card/50 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Risk Classification Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-success/10 border border-success/20">
              <p className="text-xs font-semibold text-success mb-1">What We Are</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-1.5"><ArrowRight className="w-3 h-3 text-success shrink-0" /> Software automation tool</li>
                <li className="flex items-center gap-1.5"><ArrowRight className="w-3 h-3 text-success shrink-0" /> Analytics & intelligence provider</li>
                <li className="flex items-center gap-1.5"><ArrowRight className="w-3 h-3 text-success shrink-0" /> Non-custodial execution facilitator</li>
                <li className="flex items-center gap-1.5"><ArrowRight className="w-3 h-3 text-success shrink-0" /> Technology service provider</li>
              </ul>
            </div>
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-xs font-semibold text-destructive mb-1">What We Are NOT</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-1.5"><ArrowRight className="w-3 h-3 text-destructive shrink-0" /> Not a VDA exchange</li>
                <li className="flex items-center gap-1.5"><ArrowRight className="w-3 h-3 text-destructive shrink-0" /> Not a custodial platform</li>
                <li className="flex items-center gap-1.5"><ArrowRight className="w-3 h-3 text-destructive shrink-0" /> Not a fund manager</li>
                <li className="flex items-center gap-1.5"><ArrowRight className="w-3 h-3 text-destructive shrink-0" /> Not a financial intermediary</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Disclosure Points */}
        <div className="space-y-4">
          {disclosurePoints.map((point, i) => (
            <div key={i} className="flex gap-4 p-5 rounded-xl border border-border bg-card/50">
              <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <point.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">{point.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{point.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Liability Limitation */}
        <div className="p-5 rounded-xl border border-warning/20 bg-warning/5 space-y-2">
          <h3 className="text-sm font-semibold text-warning">Liability Limitation</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Alpha Meme Sniper AI, its operators, and affiliates shall not be liable for any losses, damages, or claims 
            arising from: (a) user trading decisions, (b) wallet security breaches, (c) blockchain network failures, 
            (d) smart contract vulnerabilities, (e) token rug pulls or scams, (f) regulatory actions in any jurisdiction. 
            The platform is provided "as-is" without warranty of any kind. Users acknowledge and accept all risks 
            associated with cryptocurrency trading and automation tools.
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
