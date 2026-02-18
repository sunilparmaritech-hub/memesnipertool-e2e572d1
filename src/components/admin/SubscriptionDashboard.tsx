import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DollarSign, Users, TrendingUp, CreditCard, 
  Crown, Zap, Star, Loader2, Ban, ArrowUpCircle, ArrowDownCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CouponManagement from "./CouponManagement";

interface SubStats {
  total: number;
  free: number;
  pro: number;
  elite: number;
  mrr: number;
  pastDue: number;
}

interface SubRow {
  id: string;
  user_id: string;
  tier: string;
  status: string;
  billing_interval: string | null;
  current_period_end: string | null;
  email?: string;
}

export default function SubscriptionDashboard() {
  const { toast } = useToast();
  const [stats, setStats] = useState<SubStats>({ total: 0, free: 0, pro: 0, elite: 0, mrr: 0, pastDue: 0 });
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: allSubs } = await supabase.from('subscriptions').select('*');
      if (!allSubs) return;

      const free = allSubs.filter(s => s.tier === 'free').length;
      const pro = allSubs.filter(s => s.tier === 'pro').length;
      const elite = allSubs.filter(s => s.tier === 'elite').length;
      const pastDue = allSubs.filter(s => s.status === 'past_due').length;
      const mrr = pro * 49 + elite * 149;

      setStats({ total: allSubs.length, free, pro, elite, mrr, pastDue });

      // Fetch profiles for emails
      const { data: profiles } = await supabase.from('profiles').select('user_id, email');
      const emailMap = new Map((profiles || []).map(p => [p.user_id, p.email]));

      setSubs(allSubs.map(s => ({
        ...s,
        email: emailMap.get(s.user_id) || 'Unknown',
      })) as SubRow[]);
    } catch (err) {
      console.error('Failed to fetch subscription data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const changeTier = async (userId: string, newTier: string) => {
    const { error } = await supabase
      .from('subscriptions')
      .update({ tier: newTier as 'free' | 'pro' | 'elite', status: 'active' as const })
      .eq('user_id', userId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Updated', description: `User moved to ${newTier}` });
      fetchData();
    }
  };

  const suspendUser = async (userId: string) => {
    await supabase.from('subscriptions').update({ status: 'canceled' }).eq('user_id', userId);
    toast({ title: 'Suspended', description: 'Subscription canceled' });
    fetchData();
  };

  const statCards = [
    { label: 'MRR', value: `$${stats.mrr.toLocaleString()}`, icon: DollarSign, color: 'text-success' },
    { label: 'Subscribers', value: stats.total, icon: Users, color: 'text-primary' },
    { label: 'Pro', value: stats.pro, icon: Zap, color: 'text-blue-400' },
    { label: 'Elite', value: stats.elite, icon: Crown, color: 'text-purple-400' },
    { label: 'Free', value: stats.free, icon: Star, color: 'text-muted-foreground' },
    { label: 'Past Due', value: stats.pastDue, icon: CreditCard, color: 'text-destructive' },
  ];

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                <span className="text-[10px] text-muted-foreground">{s.label}</span>
              </div>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coupon Management */}
      <CouponManagement />

      {/* Subscriber Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            All Subscribers
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Email</TableHead>
                    <TableHead className="text-[10px]">Tier</TableHead>
                    <TableHead className="text-[10px]">Status</TableHead>
                    <TableHead className="text-[10px]">Billing</TableHead>
                    <TableHead className="text-[10px]">Expires</TableHead>
                    <TableHead className="text-[10px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs">{s.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${
                          s.tier === 'elite' ? 'border-purple-400/30 text-purple-400' :
                          s.tier === 'pro' ? 'border-blue-400/30 text-blue-400' :
                          'border-border text-muted-foreground'
                        }`}>
                          {s.tier}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.status === 'active' ? 'default' : 'destructive'} className="text-[10px]">
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{s.billing_interval || '—'}</TableCell>
                      <TableCell className="text-xs">
                        {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Select onValueChange={(v) => changeTier(s.user_id, v)}>
                            <SelectTrigger className="h-6 w-20 text-[10px]"><SelectValue placeholder="Tier" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free">Free</SelectItem>
                              <SelectItem value="pro">Pro</SelectItem>
                              <SelectItem value="elite">Elite</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => suspendUser(s.user_id)}>
                            <Ban className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
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
