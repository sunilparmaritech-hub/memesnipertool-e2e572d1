import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { getApiKey } from "../_shared/api-keys.ts";
import { checkRateLimit, rateLimitResponse, GENERIC_LIMIT } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BIRDEYE_BASE = 'https://public-api.birdeye.so';

const BIRDEYE_LIMIT = { ...GENERIC_LIMIT, maxRequests: 15, windowMs: 60_000, functionName: 'birdeye-proxy' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limit by auth user or IP
    const authHeader = req.headers.get('Authorization') || '';
    const rateLimitKey = authHeader.replace('Bearer ', '').slice(0, 20) || 'anon';
    const rl = checkRateLimit(rateLimitKey, BIRDEYE_LIMIT);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);
    // Use shared getApiKey - checks admin-saved DB key first, then env fallback
    const apiKey = await getApiKey('birdeye');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Birdeye API key not configured. Set it in Admin > API Settings.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { endpoint, tokenAddress } = await req.json();

    if (!endpoint || !tokenAddress) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing endpoint or tokenAddress' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let url: string;
    switch (endpoint) {
      case 'token_overview':
        url = `${BIRDEYE_BASE}/defi/token_overview?address=${tokenAddress}`;
        break;
      case 'token_security':
        url = `${BIRDEYE_BASE}/defi/token_security?address=${tokenAddress}`;
        break;
      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown endpoint: ${endpoint}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const response = await fetch(url, {
      headers: {
        'X-API-KEY': apiKey,
        'x-chain': 'solana',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[birdeye-proxy] API error ${response.status}:`, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Birdeye API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({ success: true, data: data.data || data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[birdeye-proxy] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
