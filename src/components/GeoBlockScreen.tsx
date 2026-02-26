import { ShieldAlert, Globe } from "lucide-react";

interface GeoBlockScreenProps {
  country: string | null;
}

export default function GeoBlockScreen({ country }: GeoBlockScreenProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Access Restricted</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Alpha Meme Sniper AI is not available in {country || "your region"} due to 
            regulatory restrictions and international sanctions compliance.
          </p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card/50 text-left space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Why am I seeing this?</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            We comply with OFAC sanctions and international regulatory requirements. 
            Access from sanctioned jurisdictions is automatically restricted to ensure 
            legal compliance. If you believe this is an error, please contact{" "}
            <a href="mailto:compliance@alphamemesniper.com" className="text-primary hover:underline">
              compliance@alphamemesniper.com
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}
