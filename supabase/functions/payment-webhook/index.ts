import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();

    // Helius webhook sends an array of transactions
    const transactions = Array.isArray(body) ? body : [body];

    // Fetch admin payment wallet
    const { data: walletSetting } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'payment_wallet')
      .single();

    const adminWallet = (walletSetting?.setting_value as any)?.address;
    if (!adminWallet) {
      console.error('No admin payment wallet configured');
      return new Response(JSON.stringify({ error: 'No payment wallet configured' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;

    for (const tx of transactions) {
      try {
        const signature = tx.signature || tx.transaction?.signatures?.[0];
        if (!signature) continue;

        // Check if already processed
        const { data: existing } = await supabase
          .from('credit_transactions')
          .select('id, status')
          .eq('tx_hash', signature)
          .single();

        if (existing?.status === 'confirmed') continue;

        // Check for SOL transfer to admin wallet
        const nativeTransfers = tx.nativeTransfers || [];
        const relevantTransfer = nativeTransfers.find(
          (t: any) => t.toUserAccount === adminWallet
        );

        if (!relevantTransfer) continue;

        const amountSol = relevantTransfer.amount / 1e9; // lamports to SOL
        const senderWallet = relevantTransfer.fromUserAccount;

        // Find matching pending transaction
        let txRecord = existing;
        
        if (!txRecord) {
          // Try to find by sender wallet and approximate amount
          const { data: pendingTx } = await supabase
            .from('credit_transactions')
            .select('*')
            .eq('sender_wallet', senderWallet)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (pendingTx && Math.abs(pendingTx.amount_sol - amountSol) < 0.001) {
            txRecord = pendingTx;
            // Update tx hash
            await supabase
              .from('credit_transactions')
              .update({ tx_hash: signature })
              .eq('id', txRecord.id);
          }
        }

        if (!txRecord) {
          console.log(`No matching pending transaction for ${signature}`);
          continue;
        }

        // Find the pack to determine credits
        const { data: pack } = await supabase
          .from('credit_packs')
          .select('credits, bonus_credits')
          .eq('id', txRecord.pack_id)
          .single();

        const totalCredits = pack ? pack.credits + pack.bonus_credits : Math.floor(amountSol * 1000);

        // Add credits atomically
        await supabase.rpc('add_credits', {
          _user_id: txRecord.user_id,
          _amount: totalCredits,
          _tx_id: txRecord.id,
        });

        processed++;
        console.log(`Credited ${totalCredits} to user ${txRecord.user_id} for tx ${signature}`);
      } catch (txError) {
        console.error('Error processing transaction:', txError);
      }
    }

    return new Response(JSON.stringify({ success: true, processed }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 200, // Return 200 so Helius doesn't retry
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
