import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Coins, Check, Wallet, Loader2, ExternalLink } from "lucide-react";
import { useCredits, CreditPack } from "@/contexts/CreditContext";
import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/contexts/AuthContext";
import { useSolPrice } from "@/hooks/useSolPrice";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

interface BuyCreditsModalProps {
  trigger?: React.ReactNode;
}

export default function BuyCreditsModal({ trigger }: BuyCreditsModalProps) {
  const { packs, refreshCredits } = useCredits();
  const { wallet } = useWallet();
  const { user } = useAuth();
  const { price: solPrice } = useSolPrice();
  const { toast } = useToast();
  const [selectedPack, setSelectedPack] = useState<CreditPack | null>(null);
  const [processing, setProcessing] = useState(false);
  const [open, setOpen] = useState(false);

  const handlePurchase = async (pack: CreditPack) => {
    if (!user) {
      toast({ title: 'Sign in required', variant: 'destructive' });
      return;
    }
    if (!wallet.isConnected || !wallet.address) {
      toast({ title: 'Connect your wallet first', description: 'You need a connected Solana wallet to purchase credits.', variant: 'destructive' });
      return;
    }

    setSelectedPack(pack);
    setProcessing(true);

    try {
      // Fetch admin payment wallet from admin_settings
      const { data: walletSetting } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'payment_wallet')
        .single();

      const adminWallet = (walletSetting?.setting_value as any)?.address;
      if (!adminWallet) {
        toast({ title: 'Payment not configured', description: 'Admin has not configured a payment wallet yet.', variant: 'destructive' });
        return;
      }

      // Create memo for reference
      const memo = `credits:${user.id.slice(0, 8)}:${pack.id.slice(0, 8)}`;

      // Create pending transaction record
      const { data: txRecord, error: txError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: user.id,
          pack_id: pack.id,
          amount_sol: pack.sol_price,
          usd_value_at_payment: solPrice ? pack.sol_price * solPrice : null,
          credits_added: 0,
          status: 'pending' as any,
          sender_wallet: wallet.address,
          memo,
        })
        .select('id')
        .single();

      if (txError) throw txError;

      // Build and send SOL transfer
      const provider = window.solana;
      if (!provider) throw new Error('Wallet provider not found');

      const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      const fromPubkey = new PublicKey(wallet.address);
      const toPubkey = new PublicKey(adminWallet);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Math.round(pack.sol_price * LAMPORTS_PER_SOL),
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      const { signature } = await provider.signAndSendTransaction(transaction);

      // Update transaction with tx hash
      await supabase
        .from('credit_transactions')
        .update({ tx_hash: signature } as any)
        .eq('id', txRecord!.id);

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      // Add credits via RPC
      const totalCredits = pack.credits + pack.bonus_credits;
      await supabase.rpc('add_credits', {
        _user_id: user.id,
        _amount: totalCredits,
        _tx_id: txRecord!.id,
      });

      await refreshCredits();

      toast({ 
        title: '🎉 Credits Added!', 
        description: `${totalCredits.toLocaleString()} credits added to your account.` 
      });
      setOpen(false);
    } catch (err: any) {
      console.error('Purchase error:', err);
      if (err.code !== 4001) { // Not user rejection
        toast({ title: 'Purchase Failed', description: err.message || 'Transaction failed. Please try again.', variant: 'destructive' });
      }
    } finally {
      setProcessing(false);
      setSelectedPack(null);
    }
  };

  const packColors: Record<number, string> = {
    0: 'border-success/30',
    1: 'border-primary/50 ring-1 ring-primary/20',
    2: 'border-purple-500/30',
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="glow" size="sm" className="gap-1.5">
            <Coins className="w-4 h-4" />
            Buy Credits
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            Buy Credit Packs
          </DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          {packs.map((pack, idx) => {
            const usdValue = solPrice ? (pack.sol_price * solPrice).toFixed(0) : '—';
            const isProcessing = processing && selectedPack?.id === pack.id;

            return (
              <Card key={pack.id} className={`relative p-4 transition-all hover:scale-[1.02] ${packColors[idx] || 'border-border/50'}`}>
                {idx === 1 && (
                  <Badge className="absolute -top-2 right-3 text-[9px] bg-primary text-primary-foreground">
                    BEST VALUE
                  </Badge>
                )}

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{pack.badge}</span>
                    <h3 className="font-semibold text-foreground text-sm">{pack.name}</h3>
                  </div>

                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      {pack.sol_price} SOL
                    </div>
                    <p className="text-[10px] text-muted-foreground">≈ ${usdValue} USD</p>
                  </div>

                  <div className="text-sm font-medium text-primary">
                    {(pack.credits + pack.bonus_credits).toLocaleString()} credits
                    {pack.bonus_credits > 0 && (
                      <Badge variant="outline" className="ml-1.5 text-[9px] text-success border-success/30">
                        +{pack.bonus_credits} bonus
                      </Badge>
                    )}
                  </div>

                  <ul className="space-y-1.5">
                    {pack.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <Check className="w-3 h-3 mt-0.5 text-success flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Button 
                    className="w-full" 
                    size="sm"
                    variant={idx === 1 ? 'default' : 'outline'}
                    disabled={processing || !wallet.isConnected}
                    onClick={() => handlePurchase(pack)}
                  >
                    {isProcessing ? (
                      <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing...</>
                    ) : !wallet.isConnected ? (
                      <><Wallet className="w-3 h-3 mr-1" /> Connect Wallet</>
                    ) : (
                      <><Coins className="w-3 h-3 mr-1" /> Buy Now</>
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Payments are processed on-chain • Credits are added instantly after confirmation
        </p>
      </DialogContent>
    </Dialog>
  );
}
