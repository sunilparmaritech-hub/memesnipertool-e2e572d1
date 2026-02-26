import PublicLayout from "@/components/layout/PublicLayout";

export default function PrivacyPolicy() {
  return (
    <PublicLayout>
      <div className="container mx-auto max-w-[900px] px-4 py-10 sm:py-14">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

        <div className="prose prose-sm prose-invert max-w-none space-y-6 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Information We Collect</h2>
            <p><strong className="text-foreground">Account Information:</strong> Email address and hashed password when you create an account.</p>
            <p><strong className="text-foreground">Wallet Address:</strong> Public wallet address when you connect your wallet (we never access private keys).</p>
            <p><strong className="text-foreground">Usage Data:</strong> Trade history, bot configurations, platform interactions, and analytics data.</p>
            <p><strong className="text-foreground">Technical Data:</strong> IP address, browser type, device information, and cookies for session management.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. How We Use Your Information</h2>
            <p>We use your information to: provide and maintain the Platform; process subscriptions and billing; improve our AI models and validation engine; send important service notifications; and provide customer support.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Data Storage & Security</h2>
            <p>Your data is stored securely using industry-standard encryption. We use Supabase for database management with row-level security policies. Payment data is processed by Stripe and never stored on our servers.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Third-Party Services</h2>
            <p>We use the following third-party services: Stripe (payment processing), Helius & Birdeye (blockchain data APIs), and Jupiter (trade execution routing). Each service has its own privacy policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Data Retention</h2>
            <p>We retain your account data for as long as your account is active. Trade history and analytics data are retained for 12 months after account closure. You may request deletion of your data at any time.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Your Rights</h2>
            <p>You have the right to: access your personal data; request correction of inaccurate data; request deletion of your data; export your trade history; and opt out of non-essential communications.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Cookies</h2>
            <p>We use essential cookies for authentication and session management. No third-party tracking cookies are used. You can manage cookie preferences through your browser settings.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Contact</h2>
            <p>For privacy-related inquiries, contact us at <a href="mailto:support@alphamemesniper.com" className="text-primary hover:underline">support@alphamemesniper.com</a>.</p>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
