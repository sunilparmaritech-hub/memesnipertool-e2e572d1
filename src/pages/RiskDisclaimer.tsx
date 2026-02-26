import PublicLayout from "@/components/layout/PublicLayout";
import { AlertTriangle, Shield, TrendingUp, Wallet, Scale } from "lucide-react";

const sections = [
  {
    icon: AlertTriangle,
    title: "High-Risk Activity",
    content: "Trading meme tokens and cryptocurrencies is extremely high-risk. Prices can drop to zero within minutes. You should only trade with funds you can afford to lose entirely. The volatile nature of meme tokens means that substantial losses are not only possible but common.",
  },
  {
    icon: TrendingUp,
    title: "No Guarantee of Returns",
    content: "Past performance of the Platform, its AI models, or any displayed metrics do not guarantee future results. Historical win rates, profit percentages, and performance statistics are for informational purposes only. Market conditions change rapidly and unpredictably.",
  },
  {
    icon: Shield,
    title: "Automated Trading Risks",
    content: "While our bot includes 22+ validation checks and risk protection features, no automated system can eliminate all risks. Smart contract exploits, blockchain congestion, API failures, and novel rug pull techniques may bypass our detection systems. The bot operates based on pre-configured parameters and cannot predict unforeseen events.",
  },
  {
    icon: Wallet,
    title: "Wallet & Transaction Risks",
    content: "Blockchain transactions are irreversible. Once a trade is executed and confirmed on-chain, it cannot be undone. Slippage, front-running, and MEV attacks may result in worse execution prices than expected. Network congestion may delay or fail transactions.",
  },
  {
    icon: Scale,
    title: "Regulatory Notice",
    content: "Cryptocurrency trading may be subject to regulation in your jurisdiction. It is your responsibility to determine whether using this Platform complies with applicable laws. We do not provide legal or tax advice. Consult qualified professionals for guidance on regulatory compliance and tax obligations.",
  },
];

export default function RiskDisclaimer() {
  return (
    <PublicLayout>
      <div className="container mx-auto max-w-[900px] px-4 py-10 sm:py-14">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-7 h-7 text-warning" />
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Risk Disclaimer</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 mb-8">
          <p className="text-sm text-destructive font-medium leading-relaxed">
            ⚠️ <strong>IMPORTANT:</strong> Meme token trading carries extreme risk. You may lose 100% of your invested capital. 
            Alpha Meme Sniper AI is a tool to assist with trading — it does not guarantee profits and cannot prevent all losses. 
            Do Your Own Research (DYOR) before every trade.
          </p>
        </div>

        <div className="space-y-6">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.title} className="flex gap-4 p-5 rounded-xl border border-border/40 bg-card/40">
                <Icon className="w-6 h-6 text-warning shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-2">{section.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 p-5 rounded-xl border border-border/40 bg-card/40">
          <h2 className="text-base font-semibold text-foreground mb-2">Acknowledgment</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            By using Alpha Meme Sniper AI, you acknowledge that you have read, understood, and accepted this Risk Disclaimer in its entirety. 
            You confirm that you are trading at your own risk and that Alpha Meme Sniper AI and its operators bear no responsibility for any financial losses incurred through the use of the Platform.
          </p>
        </div>

        <p className="text-xs text-muted-foreground mt-6 text-center">
          For questions, contact <a href="mailto:support@alphamemesniper.com" className="text-primary hover:underline">support@alphamemesniper.com</a>.
        </p>
      </div>
    </PublicLayout>
  );
}
