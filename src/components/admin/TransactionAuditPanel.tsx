import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Search, 
  RefreshCw,
  Loader2,
  FileWarning,
  DollarSign,
  Wallet,
  Skull,
  Trash2
} from 'lucide-react';
import { useTransactionAudit, type AuditResult, type TokenRiskAssessment } from '@/hooks/useTransactionAudit';

export function TransactionAuditPanel() {
  const { 
    loading, 
    results, 
    fakeTrades,
    fullAudit, 
    auditTransactions, 
    validatePnl, 
    detectFakeTokens,
    findFakeTrades,
    cleanupFakeTrades,
  } = useTransactionAudit();
  const [selectedTab, setSelectedTab] = useState('summary');
  const [cleaningUp, setCleaningUp] = useState(false);

  // Find fake trades on mount
  useEffect(() => {
    findFakeTrades();
  }, [findFakeTrades]);

  const handleFullAudit = async () => {
    await fullAudit(200);
  };

  const handleCleanupFakeTrades = async () => {
    setCleaningUp(true);
    try {
      await cleanupFakeTrades();
    } finally {
      setCleaningUp(false);
    }
  };

  const getStatusIcon = (status: AuditResult['status']) => {
    switch (status) {
      case 'VALID':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'MISMATCH':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'NOT_FOUND':
        return <Search className="h-4 w-4 text-muted-foreground" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getRiskBadge = (status: TokenRiskAssessment['status']) => {
    switch (status) {
      case 'SAFE':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500">SAFE</Badge>;
      case 'RISKY':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">RISKY</Badge>;
      case 'SCAM':
        return <Badge variant="destructive">SCAM</Badge>;
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Transaction Integrity Audit</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleFullAudit} 
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Auditing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Run Full Audit
                </>
              )}
            </Button>
          </div>
        </div>
        <CardDescription>
          Validate on-chain transactions, reconcile P&L, and detect fake tokens
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Fake Trades Alert */}
        {fakeTrades.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>🚨 {fakeTrades.length} Fake Trades Detected</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-3">
                Found {fakeTrades.length} trades without on-chain signatures. 
                These were likely created by old backfill logic and don't represent real transactions.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {fakeTrades.slice(0, 5).map(t => (
                  <Badge key={t.id} variant="outline" className="text-xs">
                    {t.token_symbol} ({t.trade_type})
                  </Badge>
                ))}
                {fakeTrades.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{fakeTrades.length - 5} more
                  </Badge>
                )}
              </div>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleCleanupFakeTrades}
                disabled={cleaningUp}
                className="gap-2"
              >
                {cleaningUp ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Remove Fake Trades
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!results && !loading && fakeTrades.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click "Run Full Audit" to verify all transactions</p>
            <p className="text-sm mt-2">This will check on-chain data against stored records</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-muted-foreground">Verifying transactions on-chain...</p>
            <p className="text-sm text-muted-foreground mt-2">This may take a few minutes</p>
          </div>
        )}

        {results && (
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="summary" className="gap-1">
                <Shield className="h-4 w-4" />
                Summary
              </TabsTrigger>
              <TabsTrigger value="transactions" className="gap-1">
                <FileWarning className="h-4 w-4" />
                Transactions
              </TabsTrigger>
              <TabsTrigger value="pnl" className="gap-1">
                <DollarSign className="h-4 w-4" />
                P&L
              </TabsTrigger>
              <TabsTrigger value="risks" className="gap-1">
                <Skull className="h-4 w-4" />
                Risks
              </TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-green-500">
                      {results.summary.valid}
                    </div>
                    <p className="text-sm text-muted-foreground">Valid</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-yellow-500">
                      {results.summary.mismatches}
                    </div>
                    <p className="text-sm text-muted-foreground">Corrected</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-muted-foreground">
                      {results.summary.notFound}
                    </div>
                    <p className="text-sm text-muted-foreground">Not Found</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-red-500">
                      {results.fakeTokens.filter(t => t.status === 'SCAM').length}
                    </div>
                    <p className="text-sm text-muted-foreground">Scam Tokens</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="mt-4">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Audit Progress</span>
                    <span className="text-sm text-muted-foreground">
                      {results.summary.totalAudited} transactions
                    </span>
                  </div>
                  <Progress 
                    value={(results.summary.valid / Math.max(results.summary.totalAudited, 1)) * 100} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {((results.summary.valid / Math.max(results.summary.totalAudited, 1)) * 100).toFixed(1)}% integrity score
                  </p>
                </CardContent>
              </Card>

              {results.walletReconciliation && (
                <Card className="mt-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Wallet Reconciliation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Spent</p>
                        <p className="font-mono text-red-500">
                          -{results.walletReconciliation.totalSolSpent.toFixed(4)} SOL
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Received</p>
                        <p className="font-mono text-green-500">
                          +{results.walletReconciliation.totalSolReceived.toFixed(4)} SOL
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Net Flow</p>
                        <p className={`font-mono ${results.walletReconciliation.netSolFlow >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {results.walletReconciliation.netSolFlow >= 0 ? '+' : ''}
                          {results.walletReconciliation.netSolFlow.toFixed(4)} SOL
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="transactions" className="mt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {results.transactions.filter(t => t.status !== 'VALID').map((tx, idx) => (
                    <Card key={idx} className="p-3">
                      <div className="flex items-start gap-3">
                        {getStatusIcon(tx.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono truncate">
                              {tx.signature.slice(0, 20)}...
                            </code>
                            <Badge variant="outline" className="text-xs">
                              {tx.status}
                            </Badge>
                          </div>
                          {tx.issues.length > 0 && (
                            <ul className="text-xs text-muted-foreground mt-1">
                              {tx.issues.map((issue, i) => (
                                <li key={i}>• {issue}</li>
                              ))}
                            </ul>
                          )}
                          {Object.keys(tx.corrections).length > 0 && (
                            <p className="text-xs text-green-500 mt-1">
                              ✓ Auto-corrected: {Object.keys(tx.corrections).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                  {results.transactions.filter(t => t.status !== 'VALID').length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p>All transactions verified successfully</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="pnl" className="mt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {results.pnlCorrections.map((correction, idx) => (
                    <Card key={idx} className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{correction.tokenSymbol}</p>
                          <code className="text-xs text-muted-foreground">
                            {correction.tokenAddress.slice(0, 16)}...
                          </code>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">
                            <span className="text-muted-foreground line-through mr-2">
                              {correction.storedPnl.toFixed(4)}
                            </span>
                            <span className={correction.calculatedPnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                              {correction.calculatedPnl.toFixed(4)} SOL
                            </span>
                          </p>
                          <Badge variant="outline" className="text-xs bg-yellow-500/10">
                            CORRECTED
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {results.pnlCorrections.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p>All P&L values are accurate</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="risks" className="mt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {results.fakeTokens.map((token, idx) => (
                    <Card key={idx} className="p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{token.tokenSymbol}</p>
                            {getRiskBadge(token.status)}
                          </div>
                          <code className="text-xs text-muted-foreground">
                            {token.tokenAddress.slice(0, 20)}...
                          </code>
                          <ul className="text-xs text-red-400 mt-2">
                            {token.flags.map((flag, i) => (
                              <li key={i}>⚠️ {flag}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {results.fakeTokens.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Shield className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p>No suspicious tokens detected</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
