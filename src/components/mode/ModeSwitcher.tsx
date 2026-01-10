import { useAppMode } from "@/contexts/AppModeContext";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { FlaskConical, Radio } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ModeSwitcher() {
  const { mode, setMode, isLive } = useAppMode();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary/50 border border-border/50">
          <div className={`flex items-center gap-1.5 ${!isLive ? 'text-warning' : 'text-muted-foreground'}`}>
            <FlaskConical className="w-3.5 h-3.5" />
            <span className="text-xs font-medium hidden sm:inline">Demo</span>
          </div>
          <Switch
            checked={isLive}
            onCheckedChange={(checked) => setMode(checked ? 'live' : 'demo')}
            className="data-[state=checked]:bg-success data-[state=unchecked]:bg-warning h-5 w-9"
          />
          <div className={`flex items-center gap-1.5 ${isLive ? 'text-success' : 'text-muted-foreground'}`}>
            <Radio className="w-3.5 h-3.5" />
            <span className="text-xs font-medium hidden sm:inline">Live</span>
          </div>
          {!isLive && (
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px] px-1.5 py-0 hidden md:flex">
              TEST
            </Badge>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="font-medium mb-1">{isLive ? 'Live Mode' : 'Demo Mode'}</p>
        <p className="text-xs text-muted-foreground">
          {isLive 
            ? 'Connected to real APIs and wallet. Trades will execute with real funds.'
            : 'Using simulated data. No real trades will be executed. Perfect for testing strategies.'}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
