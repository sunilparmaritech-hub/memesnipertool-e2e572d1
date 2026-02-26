import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TIER_CONFIG, type SubscriptionPlan } from "@/hooks/useSubscription";
import { toast } from "sonner";
import {
  Users,
  DollarSign,
  TrendingUp,
  Crown,
  Loader2,
  RefreshCw,
  ArrowUpDown,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
} from "recharts";

const PLAN_COLORS: Record<string, string> = {
  free: "hsl(var(--muted-foreground))",
  pro: "hsl(var(--primary))",
  elite: "#f59e0b",
  enterprise: "#8b5cf6",
};

const PLAN_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  free: "secondary",
  pro: "default",
  elite: "default",
  enterprise: "default",
};

interface SubRow {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  billing_interval: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  email?: string;
  display_name?: string;
}

export function SubscriptionManagementPanel() {
  const queryClient = useQueryClient();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<string>("");

  // Fetch all subscriptions with profile info
  const { data: subscriptions = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const { data: subs, error: subError } = await supabase
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false });

      if (subError) throw subError;

      // Fetch profiles for display names/emails
      const userIds = (subs || []).map((s: any) => s.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, display_name")
        .in("user_id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.user_id, p])
      );

      return (subs || []).map((s: any) => ({
        ...s,
        email: profileMap.get(s.user_id)?.email || "—",
        display_name: profileMap.get(s.user_id)?.display_name || null,
      })) as SubRow[];
    },
    staleTime: 30_000,
  });

  // Manual plan change mutation
  const changePlan = useMutation({
    mutationFn: async ({ userId, newPlan }: { userId: string; newPlan: string }) => {
      const { error } = await supabase
        .from("subscriptions")
        .update({ plan: newPlan, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      toast.success("Plan updated successfully");
      setEditingUserId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update plan");
    },
  });

  // ── Metrics ───────────────────────────────────────────────────────────────
  const planCounts: Record<string, number> = { free: 0, pro: 0, elite: 0, enterprise: 0 };
  let totalMRR = 0;
  const activeSubs = subscriptions.filter((s) => s.status === "active" || s.status === "trialing");

  for (const s of activeSubs) {
    const plan = s.plan as SubscriptionPlan;
    planCounts[plan] = (planCounts[plan] || 0) + 1;
    const tier = TIER_CONFIG[plan];
    if (tier && plan !== "free") {
      const monthly =
        s.billing_interval === "yearly"
          ? tier.price_yearly / 12
          : tier.price_monthly;
      totalMRR += monthly;
    }
  }

  const pieData = Object.entries(planCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  const paidCount = activeSubs.filter((s) => s.plan !== "free").length;
  const conversionRate = activeSubs.length > 0 ? ((paidCount / activeSubs.length) * 100).toFixed(1) : "0";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      {/* MRR Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly MRR</p>
                <p className="text-xl font-bold text-foreground">${totalMRR.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Users</p>
                <p className="text-xl font-bold text-foreground">{subscriptions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <Crown className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Paid Users</p>
                <p className="text-xl font-bold text-foreground">{paidCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Conversion</p>
                <p className="text-xl font-bold text-foreground">{conversionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan Distribution Chart + Breakdown */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Plan Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={PLAN_COLORS[entry.name.toLowerCase()] || "#888"}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No subscription data
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tier Breakdown</CardTitle>
            <CardDescription>Active subscriptions by plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {(["free", "pro", "elite", "enterprise"] as SubscriptionPlan[]).map((plan) => {
                const tier = TIER_CONFIG[plan];
                const count = planCounts[plan] || 0;
                return (
                  <div
                    key={plan}
                    className="p-4 rounded-lg bg-secondary/30 border border-border"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-foreground">{tier.name}</span>
                      <Badge variant={PLAN_BADGE_VARIANT[plan]}>{count}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {plan === "free"
                        ? "Free"
                        : plan === "enterprise"
                        ? "Custom"
                        : `$${tier.price_monthly}/mo`}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Subscriptions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4" />
              All Subscriptions
            </CardTitle>
            <CardDescription>{subscriptions.length} users</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead>Period End</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground text-sm truncate max-w-[200px]">
                            {sub.display_name || sub.email}
                          </p>
                          {sub.display_name && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {sub.email}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingUserId === sub.user_id ? (
                          <Select
                            value={pendingPlan}
                            onValueChange={setPendingPlan}
                          >
                            <SelectTrigger className="w-[120px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free">Free</SelectItem>
                              <SelectItem value="pro">Pro</SelectItem>
                              <SelectItem value="elite">Elite</SelectItem>
                              <SelectItem value="enterprise">Enterprise</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={PLAN_BADGE_VARIANT[sub.plan] || "secondary"}>
                            {TIER_CONFIG[sub.plan as SubscriptionPlan]?.name || sub.plan}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            sub.status === "active"
                              ? "bg-green-500/20 text-green-500"
                              : sub.status === "trialing"
                              ? "bg-blue-500/20 text-blue-500"
                              : "bg-red-500/20 text-red-500"
                          }`}
                        >
                          {sub.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sub.billing_interval || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sub.current_period_end
                          ? new Date(sub.current_period_end).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingUserId === sub.user_id ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingUserId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              disabled={changePlan.isPending || pendingPlan === sub.plan}
                              onClick={() =>
                                changePlan.mutate({
                                  userId: sub.user_id,
                                  newPlan: pendingPlan,
                                })
                              }
                            >
                              {changePlan.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                "Save"
                              )}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingUserId(sub.user_id);
                              setPendingPlan(sub.plan);
                            }}
                          >
                            Change Plan
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {subscriptions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No subscriptions found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
