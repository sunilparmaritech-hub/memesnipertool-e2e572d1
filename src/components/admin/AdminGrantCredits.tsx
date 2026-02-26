import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Gift, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface FoundUser {
  user_id: string;
  email: string | null;
  display_name: string | null;
  credit_balance: number;
}

export function AdminGrantCredits() {
  const [searchEmail, setSearchEmail] = useState("");
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [searching, setSearching] = useState(false);
  const [creditsToGrant, setCreditsToGrant] = useState("");
  const [granting, setGranting] = useState(false);

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setFoundUser(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, email, display_name, credit_balance")
      .ilike("email", `%${searchEmail.trim()}%`)
      .limit(1)
      .maybeSingle();
    setSearching(false);
    if (error || !data) {
      toast.error("User not found");
      return;
    }
    setFoundUser(data as FoundUser);
  };

  const handleGrant = async () => {
    if (!foundUser || !creditsToGrant) return;
    const amount = parseInt(creditsToGrant);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid credit amount");
      return;
    }
    setGranting(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        credit_balance: foundUser.credit_balance + amount,
        total_credits_purchased: amount, // increment via raw value since we can't do atomic add via client
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", foundUser.user_id);

    if (error) {
      toast.error("Failed to grant credits: " + error.message);
    } else {
      toast.success(`Granted ${amount} credits to ${foundUser.email}`);
      setFoundUser({ ...foundUser, credit_balance: foundUser.credit_balance + amount });
      setCreditsToGrant("");
    }
    setGranting(false);
  };

  return (
    <Card className="glass border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Gift className="w-5 h-5" /> Grant Credits to User
        </CardTitle>
        <CardDescription>Search for a user by email and add credits to their account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Search by email..."
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={searching || !searchEmail.trim()} variant="outline">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {foundUser && (
          <div className="p-4 rounded-lg bg-secondary/30 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground text-sm">{foundUser.email}</p>
                <p className="text-xs text-muted-foreground">{foundUser.display_name || "No display name"}</p>
              </div>
              <Badge variant="outline" className="text-xs">
                Balance: {foundUser.credit_balance}
              </Badge>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs">Credits to add</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 100"
                  value={creditsToGrant}
                  onChange={(e) => setCreditsToGrant(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button
                onClick={handleGrant}
                disabled={granting || !creditsToGrant}
                variant="glow"
                className="mt-auto"
              >
                {granting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Gift className="w-4 h-4 mr-1" />}
                Grant
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
