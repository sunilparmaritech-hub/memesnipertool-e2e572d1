import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useApiConfigurations, ApiConfiguration, ApiType, ApiStatus } from '@/hooks/useApiConfigurations';
import { Plus, Pencil, Trash2, Eye, EyeOff, RefreshCw, Loader2, HelpCircle, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// API Documentation with requirement levels, help notes, and error solutions
const API_INFO: Record<ApiType, {
  label: string;
  required: boolean;
  description: string;
  helpNotes: string;
  defaultUrl: string;
  requiresKey: boolean;
  alternatives?: string[];
  commonErrors: { pattern: string; solution: string }[];
}> = {
  dexscreener: {
    label: 'DexScreener API',
    required: true,
    description: 'Primary API for fetching real-time token data, pairs, and liquidity information across multiple chains.',
    helpNotes: 'Free tier available. No API key required for basic usage. Rate limit: 300 requests/min. Get from: https://docs.dexscreener.com',
    defaultUrl: 'https://api.dexscreener.com',
    requiresKey: false,
    commonErrors: [
      { pattern: 'pairs.slice is not a function', solution: 'API response format changed. The scanner has been updated to handle different response structures. Try running a scan again.' },
      { pattern: 'rate limit', solution: 'Reduce scan frequency or wait a few minutes. DexScreener allows 300 requests/min.' },
      { pattern: '429', solution: 'Rate limited. Wait 1-2 minutes before scanning again.' },
      { pattern: '503', solution: 'DexScreener is temporarily unavailable. Try again in a few minutes.' },
    ],
  },
  geckoterminal: {
    label: 'GeckoTerminal API',
    required: false,
    description: 'Alternative/backup API for token data. Provides OHLCV data and pool information.',
    helpNotes: 'Free API, no key required. Good backup for DexScreener. Rate limit: 30 requests/min. Docs: https://www.geckoterminal.com/dex-api',
    defaultUrl: 'https://api.geckoterminal.com',
    requiresKey: false,
    alternatives: ['dexscreener'],
    commonErrors: [
      { pattern: '429', solution: 'Rate limited. GeckoTerminal has a 30 req/min limit. Wait before retrying.' },
      { pattern: 'timeout', solution: 'Network timeout. Check your internet connection or try again.' },
    ],
  },
  birdeye: {
    label: 'Birdeye API',
    required: true,
    description: 'Essential for Solana token analytics, price feeds, and wallet tracking.',
    helpNotes: 'API key required. Free tier: 100 req/min. Get your key at: https://birdeye.so/api (requires Solana wallet to sign up)',
    defaultUrl: 'https://public-api.birdeye.so',
    requiresKey: true,
    commonErrors: [
      { pattern: '401', solution: 'Invalid or missing API key. Get a free key at birdeye.so/api and configure it.' },
      { pattern: '403', solution: 'API key expired or revoked. Generate a new key at birdeye.so/api.' },
      { pattern: 'API key required', solution: 'Add your Birdeye API key in the configuration. Sign up at birdeye.so to get one.' },
    ],
  },
  dextools: {
    label: 'Dextools / RapidAPI',
    required: false,
    description: 'Optional premium API for advanced token scoring and pair analysis.',
    helpNotes: 'Paid API via RapidAPI. Subscribe at: https://rapidapi.com/dextools. Use X-RapidAPI-Key header.',
    defaultUrl: 'https://public-api.dextools.io',
    requiresKey: true,
    alternatives: ['dexscreener', 'geckoterminal'],
    commonErrors: [
      { pattern: '401', solution: 'Invalid RapidAPI key. Subscribe at rapidapi.com/dextools and add your key.' },
      { pattern: '402', solution: 'RapidAPI subscription required or quota exceeded. Check your subscription.' },
    ],
  },
  honeypot_rugcheck: {
    label: 'Honeypot/Rugcheck API',
    required: true,
    description: 'Critical for token safety checks - detects honeypots, rugs, and malicious contracts.',
    helpNotes: 'Free API, no key needed. Essential for risk management. Docs: https://honeypot.is/docs',
    defaultUrl: 'https://api.honeypot.is',
    requiresKey: false,
    commonErrors: [
      { pattern: 'timeout', solution: 'Honeypot API can be slow. The scanner will continue with other tokens.' },
      { pattern: '503', solution: 'Service temporarily unavailable. Token risk scores may be estimated.' },
    ],
  },
  liquidity_lock: {
    label: 'Liquidity Lock API',
    required: false,
    description: 'Verifies if token liquidity is locked. Used for additional safety scoring.',
    helpNotes: 'Optional but recommended. Team Finance API key may be needed for full access. Alternative: Check on-chain directly.',
    defaultUrl: 'https://api.team.finance',
    requiresKey: true,
    alternatives: ['On-chain verification'],
    commonErrors: [
      { pattern: '401', solution: 'API key may be required for Team Finance. Consider on-chain verification as alternative.' },
    ],
  },
  trade_execution: {
    label: 'Trade Execution (Jupiter)',
    required: true,
    description: 'Jupiter Aggregator for executing trades on Solana with best price routing.',
    helpNotes: 'Free API, no key needed for quotes. For ultra-fast trades, get referral key at: https://station.jup.ag',
    defaultUrl: 'https://api.jup.ag',
    requiresKey: false,
    commonErrors: [
      { pattern: 'dns error', solution: 'DNS resolution failed. This is a network issue. The endpoint URL has been updated to use api.jup.ag which is more reliable.' },
      { pattern: 'failed to lookup', solution: 'Network connectivity issue. Ensure the base URL is set to https://api.jup.ag' },
      { pattern: '403', solution: 'Access denied. Jupiter may have rate limits. Wait a moment and try again.' },
      { pattern: '429', solution: 'Rate limited by Jupiter. Reduce scan frequency.' },
    ],
  },
  rpc_provider: {
    label: 'Solana RPC Provider',
    required: true,
    description: 'Required for all blockchain interactions - reading data and sending transactions.',
    helpNotes: 'Free public RPC has rate limits. For production, use: Helius, QuickNode, or Alchemy. Get free RPC at: https://helius.xyz',
    defaultUrl: 'https://api.mainnet-beta.solana.com',
    requiresKey: false,
    commonErrors: [
      { pattern: '429', solution: 'Public RPC rate limited. Consider using Helius or QuickNode for better limits.' },
      { pattern: 'timeout', solution: 'RPC node is slow. Try a different provider like helius.xyz or quicknode.com.' },
    ],
  },
};

// Helper to find error solution
const findErrorSolution = (apiType: ApiType, errorMessage: string): string | null => {
  const apiInfo = API_INFO[apiType];
  if (!apiInfo) return null;
  
  const lowerError = errorMessage.toLowerCase();
  for (const err of apiInfo.commonErrors) {
    if (lowerError.includes(err.pattern.toLowerCase())) {
      return err.solution;
    }
  }
  return null;
};

const STATUS_COLORS: Record<ApiStatus, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  inactive: 'bg-muted text-muted-foreground border-muted',
  error: 'bg-destructive/20 text-destructive border-destructive/30',
  rate_limited: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

interface ApiFormData {
  api_type: ApiType;
  api_name: string;
  base_url: string;
  api_key_encrypted: string;
  is_enabled: boolean;
  rate_limit_per_minute: number;
  status: ApiStatus;
}

const defaultFormData: ApiFormData = {
  api_type: 'dexscreener',
  api_name: '',
  base_url: '',
  api_key_encrypted: '',
  is_enabled: true,
  rate_limit_per_minute: 60,
  status: 'inactive',
};

export function ApiSettingsModule() {
  const { configurations, loading, addConfiguration, updateConfiguration, deleteConfiguration, toggleEnabled, fetchConfigurations } = useApiConfigurations();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ApiConfiguration | null>(null);
  const [formData, setFormData] = useState<ApiFormData>(defaultFormData);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenDialog = (config?: ApiConfiguration) => {
    if (config) {
      setEditingConfig(config);
      setFormData({
        api_type: config.api_type,
        api_name: config.api_name,
        base_url: config.base_url,
        api_key_encrypted: config.api_key_encrypted || '',
        is_enabled: config.is_enabled,
        rate_limit_per_minute: config.rate_limit_per_minute,
        status: config.status,
      });
    } else {
      setEditingConfig(null);
      setFormData(defaultFormData);
    }
    setIsDialogOpen(true);
  };

  const handleApiTypeChange = (value: ApiType) => {
    const info = API_INFO[value];
    setFormData(prev => ({
      ...prev,
      api_type: value,
      api_name: prev.api_name || info.label,
      base_url: prev.base_url || info.defaultUrl,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editingConfig) {
        await updateConfiguration(editingConfig.id, formData);
      } else {
        await addConfiguration(formData);
      }
      setIsDialogOpen(false);
      setFormData(defaultFormData);
      setEditingConfig(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this API configuration?')) {
      await deleteConfiguration(id);
    }
  };

  const toggleShowApiKey = (id: string) => {
    setShowApiKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const maskApiKey = (key: string | null) => {
    if (!key) return '—';
    if (key.length <= 8) return '••••••••';
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
  };

  // Check which required APIs are configured
  const requiredApis = Object.entries(API_INFO).filter(([_, info]) => info.required);
  const configuredTypes = configurations.map(c => c.api_type);
  const missingRequired = requiredApis.filter(([type]) => !configuredTypes.includes(type as ApiType));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">API Settings</h2>
            <p className="text-muted-foreground">Manage external API configurations for the application</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchConfigurations()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add API
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                  <DialogTitle>{editingConfig ? 'Edit API Configuration' : 'Add New API Configuration'}</DialogTitle>
                  <DialogDescription>
                    Configure the API settings. API keys are stored securely.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="api_type">API Type</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Select the type of API you want to configure. Required APIs are essential for core functionality.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select
                      value={formData.api_type}
                      onValueChange={handleApiTypeChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select API type" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(API_INFO).map(([value, info]) => (
                          <SelectItem key={value} value={value}>
                            <div className="flex items-center gap-2">
                              <span>{info.label}</span>
                              {info.required ? (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0">Required</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">Optional</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Show API info box */}
                    {formData.api_type && (
                      <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-2">
                        <div className="flex items-start gap-2">
                          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <div>
                            <p className="text-foreground font-medium">{API_INFO[formData.api_type].description}</p>
                            <p className="text-muted-foreground mt-1">{API_INFO[formData.api_type].helpNotes}</p>
                            {API_INFO[formData.api_type].requiresKey && (
                              <p className="text-yellow-500 mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                API key is required for this service
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="api_name">API Name</Label>
                    <Input
                      id="api_name"
                      value={formData.api_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, api_name: e.target.value }))}
                      placeholder="e.g., DexScreener Main API"
                    />
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="base_url">Base URL</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Default: {API_INFO[formData.api_type]?.defaultUrl}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id="base_url"
                      value={formData.base_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, base_url: e.target.value }))}
                      placeholder={API_INFO[formData.api_type]?.defaultUrl || "https://api.example.com"}
                    />
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="api_key">API Key</Label>
                      {API_INFO[formData.api_type]?.requiresKey ? (
                        <Badge variant="destructive" className="text-[10px]">Required</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Optional</Badge>
                      )}
                    </div>
                    <Input
                      id="api_key"
                      type="password"
                      value={formData.api_key_encrypted}
                      onChange={(e) => setFormData(prev => ({ ...prev, api_key_encrypted: e.target.value }))}
                      placeholder={API_INFO[formData.api_type]?.requiresKey ? "Enter API key (required)" : "Enter API key (optional)"}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="rate_limit">Rate Limit (per minute)</Label>
                    <Input
                      id="rate_limit"
                      type="number"
                      value={formData.rate_limit_per_minute}
                      onChange={(e) => setFormData(prev => ({ ...prev, rate_limit_per_minute: parseInt(e.target.value) || 60 }))}
                      min={1}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is_enabled"
                      checked={formData.is_enabled}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_enabled: checked }))}
                    />
                    <Label htmlFor="is_enabled">Enabled</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} disabled={isSaving || !formData.api_name || !formData.base_url}>
                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingConfig ? 'Update' : 'Add'} API
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* API Requirements Info */}
        <Alert className="border-primary/30 bg-primary/5">
          <Info className="h-4 w-4" />
          <AlertTitle>API Configuration Guide</AlertTitle>
          <AlertDescription className="mt-2">
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-[10px]">Required</Badge>
                <span className="text-sm">DexScreener, Birdeye, Honeypot/Rugcheck, Jupiter Trade, Solana RPC</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">Optional</Badge>
                <span className="text-sm">GeckoTerminal (backup), Dextools (premium), Liquidity Lock</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Status shows "inactive" until the API is successfully called. Run a token scan to verify API connectivity.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        {/* Missing Required APIs Warning */}
        {missingRequired.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Missing Required APIs</AlertTitle>
            <AlertDescription>
              The following required APIs are not configured: {missingRequired.map(([_, info]) => info.label).join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {/* APIs with Errors - Show solutions */}
        {configurations.filter(c => c.status === 'error').length > 0 && (
          <Card className="border-destructive/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                API Errors Detected
              </CardTitle>
              <CardDescription>
                The following APIs have errors. Review the suggested solutions below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {configurations
                  .filter(c => c.status === 'error')
                  .map((config) => {
                    const apiInfo = API_INFO[config.api_type];
                    return (
                      <div key={config.id} className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium text-foreground">{config.api_name}</span>
                              <Badge variant="outline" className="text-xs">{apiInfo?.label}</Badge>
                              <Badge className="bg-destructive/20 text-destructive border-destructive/30">
                                Error
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Possible Solutions:</p>
                                <ul className="mt-1 space-y-1">
                                  {apiInfo?.commonErrors.map((err, idx) => (
                                    <li key={idx} className="text-sm flex items-start gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                      <span>{err.solution}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              {config.last_checked_at && (
                                <p className="text-xs text-muted-foreground">
                                  Last checked: {new Date(config.last_checked_at).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenDialog(config)}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Switch
                              checked={config.is_enabled}
                              onCheckedChange={(checked) => toggleEnabled(config.id, checked)}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Configured APIs</CardTitle>
            <CardDescription>All external APIs used by the application. Hover over icons for help.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>API Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Base URL</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead>Rate Limit</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      Status
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Status updates when API is called during token scanning</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configurations.map((config) => {
                  const apiInfo = API_INFO[config.api_type];
                  return (
                    <TableRow key={config.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{config.api_name}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-medium">{apiInfo?.description}</p>
                              <p className="text-xs mt-1 text-muted-foreground">{apiInfo?.helpNotes}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">
                            {apiInfo?.label || config.api_type}
                          </Badge>
                          {apiInfo?.required ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                              </TooltipTrigger>
                              <TooltipContent>Required API</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>Optional API</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[200px] truncate">
                        {config.base_url}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">
                            {showApiKeys[config.id] ? config.api_key_encrypted : maskApiKey(config.api_key_encrypted)}
                          </span>
                          {config.api_key_encrypted && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => toggleShowApiKey(config.id)}
                            >
                              {showApiKeys[config.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                          )}
                          {apiInfo?.requiresKey && !config.api_key_encrypted && (
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertCircle className="h-4 w-4 text-destructive" />
                              </TooltipTrigger>
                              <TooltipContent>API key required but not configured</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{config.rate_limit_per_minute}/min</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge className={STATUS_COLORS[config.status]}>
                            {config.status}
                          </Badge>
                          {config.status === 'error' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertCircle className="h-4 w-4 text-destructive cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm">
                                <p className="font-medium text-destructive">API Error</p>
                                <p className="text-xs mt-1">
                                  Check the API Health tab for detailed error messages and solutions.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={config.is_enabled}
                            onCheckedChange={(checked) => toggleEnabled(config.id, checked)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {config.is_enabled ? 'On' : 'Off'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenDialog(config)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(config.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {configurations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No API configurations found. Add your first API to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
