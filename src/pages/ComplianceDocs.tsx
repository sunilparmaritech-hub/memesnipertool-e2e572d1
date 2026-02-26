import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Eye, AlertTriangle, Database, FileText, Clock } from "lucide-react";

export default function ComplianceDocs() {
  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Internal Compliance Documentation</h1>
        <p className="text-muted-foreground">
          Alpha Meme Sniper — Non-Custodial Platform Compliance Package
        </p>
      </div>

      <Tabs defaultValue="aml" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="aml"><Shield className="w-4 h-4 mr-1" />AML Policy</TabsTrigger>
          <TabsTrigger value="monitoring"><Eye className="w-4 h-4 mr-1" />Monitoring</TabsTrigger>
          <TabsTrigger value="screening"><AlertTriangle className="w-4 h-4 mr-1" />Screening</TabsTrigger>
          <TabsTrigger value="incident"><FileText className="w-4 h-4 mr-1" />Incident Response</TabsTrigger>
          <TabsTrigger value="retention"><Database className="w-4 h-4 mr-1" />Data Retention</TabsTrigger>
          <TabsTrigger value="inquiry"><Clock className="w-4 h-4 mr-1" />Regulatory Inquiry</TabsTrigger>
        </TabsList>

        <TabsContent value="aml">
          <Card>
            <CardHeader><CardTitle>Simplified AML Awareness Policy</CardTitle></CardHeader>
            <CardContent className="prose prose-invert max-w-none space-y-4 text-sm">
              <h3 className="text-lg font-semibold text-foreground">1. Purpose</h3>
              <p className="text-muted-foreground">This policy establishes Alpha Meme Sniper's commitment to anti-money laundering awareness as a non-custodial technology provider. While the platform does not meet the regulatory definition of a Reporting Entity under India's PMLA framework, it voluntarily adopts risk-conscious practices.</p>
              
              <h3 className="text-lg font-semibold text-foreground">2. Scope</h3>
              <p className="text-muted-foreground">Applies to all platform-facilitated wallet interactions, automated trade executions, and user accounts. Does NOT extend to on-chain activity outside platform-triggered actions.</p>
              
              <h3 className="text-lg font-semibold text-foreground">3. Key Principles</h3>
              <ul className="text-muted-foreground list-disc pl-4 space-y-1">
                <li>No custody of user assets at any point</li>
                <li>Wallet-level sanctions screening before execution</li>
                <li>Automated blocking of flagged/sanctioned addresses</li>
                <li>Internal logging of suspicious behavioral patterns</li>
                <li>Geo-restriction enforcement for OFAC-sanctioned jurisdictions</li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground">4. Risk-Based Approach</h3>
              <p className="text-muted-foreground">The platform applies a tiered verification model (Tier 0–2) proportional to usage intensity. Higher automation limits require additional verification steps including email confirmation, IP logging, and optional device fingerprinting.</p>

              <h3 className="text-lg font-semibold text-foreground">5. Reporting</h3>
              <p className="text-muted-foreground">While not obligated as a non-custodial provider, the platform maintains internal suspicious activity logs and will cooperate with law enforcement requests through proper legal channels.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring">
          <Card>
            <CardHeader><CardTitle>Risk-Based Monitoring Policy</CardTitle></CardHeader>
            <CardContent className="prose prose-invert max-w-none space-y-4 text-sm">
              <h3 className="text-lg font-semibold text-foreground">1. Monitoring Scope</h3>
              <p className="text-muted-foreground">The platform monitors only platform-triggered activities. Private wallet balances and external transactions are NOT monitored.</p>

              <h3 className="text-lg font-semibold text-foreground">2. Behavioral Anomaly Detection</h3>
              <ul className="text-muted-foreground list-disc pl-4 space-y-1">
                <li><strong>Excessive automation:</strong> &gt;100 auto-executions/day flagged for review</li>
                <li><strong>Rapid wallet cycling:</strong> &gt;5 wallet connections/hour triggers alert</li>
                <li><strong>High-frequency patterns:</strong> &gt;20 trades/minute flagged as abnormal</li>
                <li><strong>Repetitive token targeting:</strong> Same token bought/sold &gt;10x in 24h</li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground">3. Alert Classification</h3>
              <ul className="text-muted-foreground list-disc pl-4 space-y-1">
                <li><strong>INFO:</strong> Logged, no action required</li>
                <li><strong>WARNING:</strong> Logged + internal review within 48h</li>
                <li><strong>CRITICAL:</strong> Immediate account restriction + admin notification</li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground">4. Log Structure</h3>
              <p className="text-muted-foreground">All monitoring events are stored in the system_logs table with event_category: "compliance", including user_id, event_type, severity, metadata (pattern details), and timestamp.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="screening">
          <Card>
            <CardHeader><CardTitle>Wallet Screening Documentation</CardTitle></CardHeader>
            <CardContent className="prose prose-invert max-w-none space-y-4 text-sm">
              <h3 className="text-lg font-semibold text-foreground">1. Screening Workflow</h3>
              <ol className="text-muted-foreground list-decimal pl-4 space-y-1">
                <li>User connects wallet to platform</li>
                <li>Wallet address checked against local sanctions list</li>
                <li>Risk score computed via heuristic engine (placeholder for API)</li>
                <li>Result classified: low / medium / high / sanctioned</li>
                <li>High-risk or sanctioned wallets are auto-blocked</li>
                <li>Screening result persisted with 24h TTL</li>
              </ol>

              <h3 className="text-lg font-semibold text-foreground">2. Data Sources</h3>
              <ul className="text-muted-foreground list-disc pl-4 space-y-1">
                <li>OFAC SDN list (local copy, updated periodically)</li>
                <li>Community-reported malicious wallets</li>
                <li>Future: TRM Labs / Chainalysis API integration</li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground">3. Auto-Block Criteria</h3>
              <p className="text-muted-foreground">Wallets with risk_score ≥ 70 or is_sanctioned = true are immediately blocked from platform-triggered executions. Users are notified and may contact support for false positive review.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incident">
          <Card>
            <CardHeader><CardTitle>Incident Response Plan</CardTitle></CardHeader>
            <CardContent className="prose prose-invert max-w-none space-y-4 text-sm">
              <h3 className="text-lg font-semibold text-foreground">1. Incident Categories</h3>
              <ul className="text-muted-foreground list-disc pl-4 space-y-1">
                <li><strong>Security Breach:</strong> Unauthorized access to platform systems</li>
                <li><strong>Compliance Violation:</strong> Sanctioned wallet bypass, screening failure</li>
                <li><strong>Data Exposure:</strong> Unintended disclosure of user data</li>
                <li><strong>System Failure:</strong> Circuit breaker failure, emergency stop malfunction</li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground">2. Response Steps</h3>
              <ol className="text-muted-foreground list-decimal pl-4 space-y-1">
                <li><strong>Detect:</strong> Automated monitoring alerts or user report</li>
                <li><strong>Contain:</strong> Activate emergency stop if trading-related</li>
                <li><strong>Assess:</strong> Determine scope, affected users, data exposure</li>
                <li><strong>Remediate:</strong> Apply fix, update screening lists, patch vulnerability</li>
                <li><strong>Notify:</strong> Inform affected users within 72 hours if data exposed</li>
                <li><strong>Document:</strong> Full incident report in system_logs</li>
              </ol>

              <h3 className="text-lg font-semibold text-foreground">3. Escalation Path</h3>
              <p className="text-muted-foreground">CRITICAL incidents → Admin notification → Emergency stop → Legal review within 24h</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retention">
          <Card>
            <CardHeader><CardTitle>Data Retention Policy</CardTitle></CardHeader>
            <CardContent className="prose prose-invert max-w-none space-y-4 text-sm">
              <h3 className="text-lg font-semibold text-foreground">1. Retained Data Categories</h3>
              <ul className="text-muted-foreground list-disc pl-4 space-y-1">
                <li><strong>User profiles:</strong> Retained while account is active + 2 years after deletion</li>
                <li><strong>Trade history:</strong> Retained for 5 years (regulatory best practice)</li>
                <li><strong>Wallet screening results:</strong> 24h active cache, archived for 1 year</li>
                <li><strong>System/compliance logs:</strong> Retained for 3 years</li>
                <li><strong>Session/IP data:</strong> Retained for 90 days</li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground">2. Data NOT Collected</h3>
              <ul className="text-muted-foreground list-disc pl-4 space-y-1">
                <li>Private keys or seed phrases</li>
                <li>Wallet balances or external transaction history</li>
                <li>Personal identification documents (unless Tier 2 enhanced)</li>
                <li>Biometric data</li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground">3. Deletion Requests</h3>
              <p className="text-muted-foreground">Users may request account deletion via support. Profile data is anonymized within 30 days. Compliance logs are retained per regulatory requirements regardless of deletion requests.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inquiry">
          <Card>
            <CardHeader><CardTitle>Regulatory Inquiry Response Template</CardTitle></CardHeader>
            <CardContent className="prose prose-invert max-w-none space-y-4 text-sm">
              <h3 className="text-lg font-semibold text-foreground">1. Initial Response (Within 48h)</h3>
              <div className="bg-muted/30 p-4 rounded-lg text-muted-foreground">
                <p className="italic">"Alpha Meme Sniper operates as a non-custodial technology platform providing blockchain analytics and trade automation tools. We do not custody user assets, control private keys, operate fiat on/off ramps, or intermediate fund transfers. All transactions are executed directly through user-controlled wallets."</p>
              </div>

              <h3 className="text-lg font-semibold text-foreground">2. Information We Can Provide</h3>
              <ul className="text-muted-foreground list-disc pl-4 space-y-1">
                <li>User email and registration date</li>
                <li>Platform-triggered trade logs with timestamps</li>
                <li>Wallet addresses connected to accounts</li>
                <li>Wallet screening results and risk scores</li>
                <li>IP/country access logs</li>
                <li>Behavioral anomaly flags</li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground">3. Information We Cannot Provide</h3>
              <ul className="text-muted-foreground list-disc pl-4 space-y-1">
                <li>Wallet balances or holdings (non-custodial)</li>
                <li>Transaction details outside platform scope</li>
                <li>Identity documents (unless Tier 2 verified)</li>
                <li>Fund flow analysis (no custody or pooling)</li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground">4. Legal Requirements</h3>
              <p className="text-muted-foreground">All regulatory inquiries must be accompanied by proper legal documentation (court order, FIU directive, or equivalent). Routine requests are processed within 15 business days. Emergency requests (terrorism, imminent threat) are expedited within 72 hours.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
