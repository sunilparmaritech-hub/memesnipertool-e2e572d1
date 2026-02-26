import PublicLayout from "@/components/layout/PublicLayout";
import { Shield, AlertTriangle, Eye, Lock, Globe, FileText } from "lucide-react";

const sections = [
  {
    icon: Shield,
    title: "1. Platform Classification",
    content: `Alpha Meme Sniper AI operates as a non-custodial technology intelligence and automation platform. We do not custody, pool, or manage user funds. We do not operate fiat on/off ramps, intermediate fund transfers, or act as an exchange counterparty. All transactions are executed directly through user-controlled wallets (e.g., Phantom). As such, Alpha Meme Sniper AI functions as a software automation layer and analytics facilitator — not a Virtual Digital Asset (VDA) exchange or financial intermediary.`,
  },
  {
    icon: Eye,
    title: "2. AML Awareness Policy",
    content: `While our non-custodial architecture significantly reduces regulatory exposure under India's Prevention of Money Laundering Act (PMLA) and FIU-IND guidelines, we maintain a proactive, risk-aware approach to anti-money laundering. We implement wallet risk screening against known sanctions lists and illicit wallet databases. We block interactions with sanctioned or high-risk wallets. We log suspicious activity internally for review. We utilize blockchain risk scoring to assess wallet and token safety.`,
  },
  {
    icon: Lock,
    title: "3. Wallet Risk Screening",
    content: `All wallet addresses interacting with our platform are screened against: OFAC Specially Designated Nationals (SDN) list, known illicit wallet databases, blockchain intelligence risk scoring APIs. Wallets flagged as high-risk are automatically blocked from platform services. Medium-risk wallets may face restricted access to advanced automation features.`,
  },
  {
    icon: AlertTriangle,
    title: "4. Transaction Monitoring",
    content: `As a non-custodial platform, we do not monitor private wallet balances. However, we do monitor: platform-triggered trade executions, abnormal automation patterns (e.g., excessive high-frequency execution), repetitive wallet cycling patterns, and behavioral anomalies that may indicate misuse. Suspicious patterns are flagged internally and may result in account restrictions.`,
  },
  {
    icon: Globe,
    title: "5. Geo-Restrictions",
    content: `Access to Alpha Meme Sniper AI is restricted in jurisdictions subject to comprehensive international sanctions, including but not limited to: Iran, North Korea, Cuba, Syria, and regions of Crimea, Donetsk, and Luhansk. We implement IP-based country detection and wallet pattern analysis to enforce these restrictions. Users attempting to circumvent geo-restrictions may have their accounts permanently suspended.`,
  },
  {
    icon: FileText,
    title: "6. User Verification Tiers",
    content: `We implement a tiered usage system with progressive verification: Tier 0 (Basic Access) — email verification and basic platform access. Tier 1 (Enhanced Access) — higher automation limits with additional verification. Tier 2 (Advanced Features) — full platform capabilities with enhanced identity verification for high-usage accounts. Each tier progressively adds verification requirements while maintaining a privacy-conscious approach.`,
  },
];

export default function AmlPolicy() {
  return (
    <PublicLayout>
      <div className="container mx-auto max-w-4xl px-4 py-12 space-y-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">AML & Risk Policy</h1>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Our anti-money laundering awareness policy and risk-based monitoring framework. 
            Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}.
          </p>
        </div>

        <div className="space-y-6">
          {sections.map((section, i) => (
            <div key={i} className="p-5 rounded-xl border border-border bg-card/50 space-y-3">
              <div className="flex items-center gap-2.5">
                <section.icon className="w-5 h-5 text-primary shrink-0" />
                <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{section.content}</p>
            </div>
          ))}
        </div>

        <div className="p-5 rounded-xl border border-warning/20 bg-warning/5 space-y-2">
          <h3 className="text-sm font-semibold text-warning">Incident Response</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            In the event of a suspected compliance incident, our internal team will: (1) immediately restrict the affected account, 
            (2) preserve all relevant logs, (3) conduct an internal review within 48 hours, and (4) cooperate with law enforcement 
            authorities if required. For regulatory inquiries, contact: <a href="mailto:compliance@alphamemesniper.com" className="text-primary hover:underline">compliance@alphamemesniper.com</a>
          </p>
        </div>

        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
            <strong>Data Retention:</strong> Platform interaction logs are retained for a period of 5 years in accordance with 
            applicable regulatory requirements. Wallet screening results and risk assessments are maintained for audit purposes. 
            Users may request access to their own activity logs through their account settings.
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
