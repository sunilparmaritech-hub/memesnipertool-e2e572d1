import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Save, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";

interface CreditCosts {
  token_validation: number;
  auto_execution: number;
  clustering_call: number;
  api_check: number;
  manual_trade: number;
}

const DEFAULT_COSTS: CreditCosts = {
  token_validation: 1,
  auto_execution: 5,
  clustering_call: 2,
  api_check: 1,
  manual_trade: 3,
};

const LABELS: Record<keyof CreditCosts, string> = {
  token_validation: "Token Validations",
  auto_execution: "Auto Executions",
  clustering_call: "Clustering Calls",
  api_check: "API Checks",
  manual_trade: "Manual Trades",
};

export function CreditDefinitionsPanel() {
  const [costs, setCosts] = useState<CreditCosts>(DEFAULT_COSTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("admin_settings")
        .select("setting_value")
        .eq("setting_key", "credit_cost_definitions")
        .maybeSingle();
      if (data?.setting_value && typeof data.setting_value === "object") {
        setCosts({ ...DEFAULT_COSTS, ...(data.setting_value as any) });
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("admin_settings")
      .upsert(
        { setting_key: "credit_cost_definitions", setting_value: costs as any },
        { onConflict: "setting_key" }
      );
    setSaving(false);
    if (error) toast.error("Failed to save: " + error.message);
    else toast.success("Credit definitions saved");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="glass border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Settings className="w-5 h-5" /> Credit Cost Definitions
        </CardTitle>
        <CardDescription>
          Define how many credits each action costs. 1 credit = X actions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          {(Object.keys(LABELS) as (keyof CreditCosts)[]).map((key) => (
            <div key={key}>
              <Label className="text-sm">{LABELS[key]}</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  min={1}
                  value={costs[key]}
                  onChange={(e) =>
                    setCosts({ ...costs, [key]: Math.max(1, parseInt(e.target.value) || 1) })
                  }
                  className="w-24"
                />
                <span className="text-xs text-muted-foreground">credits per action</span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 rounded-lg bg-secondary/30 border border-border text-xs text-muted-foreground">
          <strong>Example:</strong> If "Token Validations" = 1 credit, then a user with 50 credits can
          run 50 validations. If "Auto Executions" = 5, they can run 10 auto snipes.
        </div>

        <Button onClick={handleSave} disabled={saving} variant="glow" className="w-full sm:w-auto">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Credit Definitions
        </Button>
      </CardContent>
    </Card>
  );
}
