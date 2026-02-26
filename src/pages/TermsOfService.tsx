import PublicLayout from "@/components/layout/PublicLayout";

export default function TermsOfService() {
  return (
    <PublicLayout>
      <div className="container mx-auto max-w-[900px] px-4 py-10 sm:py-14">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

        <div className="prose prose-sm prose-invert max-w-none space-y-6 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using Alpha Meme Sniper AI ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, you must not use the Platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Description of Service</h2>
            <p>Alpha Meme Sniper AI is an automated trading tool and informational platform for Solana-based tokens. The Platform provides real-time token scanning, AI-powered risk analysis, and automated trade execution based on user-configured parameters.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Eligibility</h2>
            <p>You must be at least 18 years old and legally permitted to use cryptocurrency trading tools in your jurisdiction. You are responsible for ensuring compliance with local laws and regulations.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Account Responsibilities</h2>
            <p>You are responsible for maintaining the security of your account credentials and wallet. You must not share your account or use the Platform for unlawful purposes. We reserve the right to suspend accounts that violate these terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Non-Custodial Nature</h2>
            <p>The Platform is non-custodial. We never store, control, or have access to your private keys, seed phrases, or cryptocurrency funds. All transactions are signed locally in your wallet extension.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. No Financial Advice</h2>
            <p>The Platform does not provide financial, investment, or trading advice. All information, signals, and automated actions are for informational and automation purposes only. You should consult a qualified financial advisor before making investment decisions.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Subscription & Billing</h2>
            <p>Paid plans are billed on a recurring basis (monthly or yearly) through Stripe. You may cancel at any time; access continues until the end of the billing period. Refunds are handled on a case-by-case basis.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Alpha Meme Sniper AI and its operators shall not be liable for any direct, indirect, incidental, or consequential damages arising from your use of the Platform, including but not limited to trading losses, missed opportunities, or technical failures.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Disclaimer of Warranties</h2>
            <p>The Platform is provided "as is" and "as available" without warranties of any kind. We do not guarantee uninterrupted access, accuracy of data, or profitability of trades.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">10. Changes to Terms</h2>
            <p>We reserve the right to update these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">11. Contact</h2>
            <p>For questions about these Terms, contact us at <a href="mailto:support@alphamemesniper.ai" className="text-primary hover:underline">support@alphamemesniper.ai</a>.</p>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
