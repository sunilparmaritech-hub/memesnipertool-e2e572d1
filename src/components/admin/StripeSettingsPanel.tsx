import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CreditCard, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function StripeSettingsPanel() {
  const [mode, setMode] = useState<"live" | "sandbox">("live");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMode();
  }, []);

  const fetchMode = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("admin_settings")
        .select("setting_value")
        .eq("setting_key", "stripe_mode")
        .maybeSingle();

      if (data?.setting_value && typeof data.setting_value === "object" && "mode" in (data.setting_value as any)) {
        setMode((data.setting_value as any).mode === "sandbox" ? "sandbox" : "live");
      }
    } catch (err) {
      console.error("Error fetching stripe mode:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (checked: boolean) => {
    const newMode = checked ? "sandbox" : "live";

    if (newMode === "live") {
      const confirmed = confirm(
        "⚠️ Switching to LIVE mode will process real payments. Are you sure?"
      );
      if (!confirmed) return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("admin_settings")
        .upsert(
          {
            setting_key: "stripe_mode",
            setting_value: { mode: newMode },
          },
          { onConflict: "setting_key" }
        );

      if (error) throw error;

      setMode(newMode);
      toast.success(`Stripe switched to ${newMode.toUpperCase()} mode`);
    } catch (err: any) {
      toast.error("Failed to update Stripe mode: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="glass border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Stripe Payment Mode
              </CardTitle>
              <CardDescription>
                Switch between Sandbox (test) and Live (production) payment processing
              </CardDescription>
            </div>
            <Badge
              variant={mode === "live" ? "default" : "secondary"}
              className={
                mode === "live"
                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                  : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
              }
            >
              {mode === "live" ? (
                <><ShieldCheck className="w-3 h-3 mr-1" /> LIVE</>
              ) : (
                <><AlertTriangle className="w-3 h-3 mr-1" /> SANDBOX</>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle */}
          <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border">
            <div className="space-y-1">
              <Label className="text-foreground font-medium">Sandbox / Test Mode</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, all payments use Stripe test keys. No real charges are made.
              </p>
            </div>
            <Switch
              checked={mode === "sandbox"}
              onCheckedChange={handleToggle}
              disabled={saving}
            />
          </div>

          {/* Info Cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg border ${mode === "live" ? "border-green-500/30 bg-green-500/5" : "border-border bg-secondary/20"}`}>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className={`w-4 h-4 ${mode === "live" ? "text-green-400" : "text-muted-foreground"}`} />
                <span className={`font-medium ${mode === "live" ? "text-green-400" : "text-muted-foreground"}`}>
                  Live Mode
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Uses <code className="text-xs">STRIPE_SECRET_KEY</code>. Real payments are processed. Use for production.
              </p>
            </div>
            <div className={`p-4 rounded-lg border ${mode === "sandbox" ? "border-yellow-500/30 bg-yellow-500/5" : "border-border bg-secondary/20"}`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className={`w-4 h-4 ${mode === "sandbox" ? "text-yellow-400" : "text-muted-foreground"}`} />
                <span className={`font-medium ${mode === "sandbox" ? "text-yellow-400" : "text-muted-foreground"}`}>
                  Sandbox Mode
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Uses <code className="text-xs">STRIPE_SECRET_KEY_TEST</code>. Test cards only. No real charges.
              </p>
            </div>
          </div>

          {mode === "sandbox" && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-300">
              ⚠️ Sandbox mode is active. Use Stripe test card <code className="font-mono">4242 4242 4242 4242</code> for testing.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
