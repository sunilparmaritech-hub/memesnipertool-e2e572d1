import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tag, Plus, Trash2, Loader2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  duration: string;
  max_redemptions: number | null;
  redemption_count: number;
  tier_restriction: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export default function CouponManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [newCode, setNewCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'flat'>('percent');
  const [discountValue, setDiscountValue] = useState('10');
  const [duration, setDuration] = useState<'once' | 'three_months' | 'lifetime'>('once');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [tierRestriction, setTierRestriction] = useState<string>('any');
  const [expiresAt, setExpiresAt] = useState('');

  const fetchCoupons = async () => {
    const { data, error } = await supabase
      .from('coupon_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setCoupons(data as Coupon[]);
    setLoading(false);
  };

  useEffect(() => { fetchCoupons(); }, []);

  const createCoupon = async () => {
    if (!newCode.trim() || !discountValue) return;
    setCreating(true);
    try {
      const { error } = await supabase.from('coupon_codes').insert([{
        code: newCode.trim().toUpperCase(),
        discount_type: discountType as 'percent' | 'flat',
        discount_value: parseFloat(discountValue),
        duration: duration as 'once' | 'three_months' | 'lifetime',
        max_redemptions: maxRedemptions ? parseInt(maxRedemptions) : null,
        tier_restriction: (tierRestriction === 'any' ? null : tierRestriction) as 'free' | 'pro' | 'elite' | null,
        expires_at: expiresAt || null,
        created_by: user?.id,
      }]);

      if (error) throw error;
      toast({ title: 'Coupon Created', description: `Code: ${newCode.toUpperCase()}` });
      setShowForm(false);
      setNewCode('');
      setDiscountValue('10');
      fetchCoupons();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const toggleCoupon = async (id: string, active: boolean) => {
    await supabase.from('coupon_codes').update({ is_active: active }).eq('id', id);
    fetchCoupons();
  };

  const deleteCoupon = async (id: string) => {
    await supabase.from('coupon_codes').delete().eq('id', id);
    fetchCoupons();
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" />
              Coupon Management
            </CardTitle>
            <Button size="sm" onClick={() => setShowForm(!showForm)} className="h-7 text-xs">
              <Plus className="w-3 h-3 mr-1" />
              New Coupon
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {showForm && (
            <div className="p-3 bg-secondary/30 rounded-lg mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Code</label>
                  <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="LAUNCH50" className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Discount Type</label>
                  <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percentage</SelectItem>
                      <SelectItem value="flat">Flat Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">
                    {discountType === 'percent' ? 'Discount %' : 'Discount $'}
                  </label>
                  <Input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Duration</label>
                  <Select value={duration} onValueChange={(v: any) => setDuration(v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">1 Month</SelectItem>
                      <SelectItem value="three_months">3 Months</SelectItem>
                      <SelectItem value="lifetime">Lifetime</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Max Redemptions</label>
                  <Input type="number" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} placeholder="Unlimited" className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Tier Restriction</label>
                  <Select value={tierRestriction} onValueChange={setTierRestriction}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any Tier</SelectItem>
                      <SelectItem value="pro">Pro Only</SelectItem>
                      <SelectItem value="elite">Elite Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-muted-foreground mb-1 block">Expires At (optional)</label>
                  <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="h-7 text-xs">Cancel</Button>
                <Button size="sm" onClick={createCoupon} disabled={creating} className="h-7 text-xs">
                  {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Create'}
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : coupons.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No coupons created yet</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Code</TableHead>
                    <TableHead className="text-[10px]">Discount</TableHead>
                    <TableHead className="text-[10px]">Duration</TableHead>
                    <TableHead className="text-[10px]">Used</TableHead>
                    <TableHead className="text-[10px]">Status</TableHead>
                    <TableHead className="text-[10px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs font-mono">
                        <div className="flex items-center gap-1">
                          {c.code}
                          <button onClick={() => { navigator.clipboard.writeText(c.code); toast({ title: 'Copied!' }); }}>
                            <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.discount_type === 'percent' ? `${c.discount_value}%` : `$${c.discount_value}`}
                      </TableCell>
                      <TableCell className="text-xs capitalize">{c.duration.replace('_', ' ')}</TableCell>
                      <TableCell className="text-xs">
                        {c.redemption_count}{c.max_redemptions ? `/${c.max_redemptions}` : ''}
                      </TableCell>
                      <TableCell>
                        <Switch checked={c.is_active} onCheckedChange={(v) => toggleCoupon(c.id, v)} />
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => deleteCoupon(c.id)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
