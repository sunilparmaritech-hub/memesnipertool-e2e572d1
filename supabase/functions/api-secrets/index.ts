import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapping of API types to their secret names
const API_SECRET_MAPPING: Record<string, string> = {
  birdeye: 'BIRDEYE_API_KEY',
  dextools: 'DEXTOOLS_API_KEY',
  liquidity_lock: 'LIQUIDITY_LOCK_API_KEY',
  dexscreener: 'DEXSCREENER_API_KEY',
  geckoterminal: 'GECKOTERMINAL_API_KEY',
  honeypot_rugcheck: 'HONEYPOT_API_KEY',
  trade_execution: 'TRADE_EXECUTION_API_KEY',
  rpc_provider: 'RPC_PROVIDER_API_KEY',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { action, apiType } = body;

    if (action === 'get_secret_status') {
      // Return the status of all API secrets (configured or not)
      const secretStatus: Record<string, { configured: boolean; secretName: string }> = {};
      
      for (const [type, secretName] of Object.entries(API_SECRET_MAPPING)) {
        const secretValue = Deno.env.get(secretName);
        secretStatus[type] = {
          configured: !!secretValue && secretValue.length > 0,
          secretName,
        };
      }

      return new Response(JSON.stringify({ 
        secretStatus,
        message: 'Secret status retrieved successfully',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_api_key') {
      // Get API key for a specific type (for internal edge function use only)
      if (!apiType || !API_SECRET_MAPPING[apiType]) {
        return new Response(JSON.stringify({ error: 'Invalid API type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const secretName = API_SECRET_MAPPING[apiType];
      const secretValue = Deno.env.get(secretName);

      // For security, we only return whether the key exists, not the actual key
      // The actual key should be accessed within edge functions directly
      return new Response(JSON.stringify({ 
        apiType,
        secretName,
        configured: !!secretValue && secretValue.length > 0,
        // Mask the key for display purposes
        maskedKey: secretValue ? `${secretValue.substring(0, 4)}${'•'.repeat(8)}${secretValue.substring(secretValue.length - 4)}` : null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'validate_secret') {
      // Validate a specific API secret is working
      if (!apiType || !API_SECRET_MAPPING[apiType]) {
        return new Response(JSON.stringify({ error: 'Invalid API type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const secretName = API_SECRET_MAPPING[apiType];
      const secretValue = Deno.env.get(secretName);

      if (!secretValue) {
        return new Response(JSON.stringify({ 
          valid: false,
          error: `Secret ${secretName} is not configured`,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Basic validation - check if the key format looks valid
      let isValid = true;
      let validationMessage = 'API key is configured';

      // Perform basic format checks based on API type
      if (apiType === 'birdeye' && secretValue.length < 20) {
        isValid = false;
        validationMessage = 'Birdeye API key appears too short';
      }

      return new Response(JSON.stringify({ 
        apiType,
        secretName,
        valid: isValid,
        message: validationMessage,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'list_required_secrets') {
      // Return list of required secrets for each API type
      const requiredSecrets = Object.entries(API_SECRET_MAPPING).map(([type, secretName]) => ({
        apiType: type,
        secretName,
        configured: !!Deno.env.get(secretName),
      }));

      return new Response(JSON.stringify({ 
        secrets: requiredSecrets,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('API secrets error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
