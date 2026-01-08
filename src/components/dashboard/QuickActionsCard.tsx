import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Activity, Shield, Settings } from "lucide-react";
import { Link } from "react-router-dom";

interface QuickActionsCardProps {
  onOpenScanner?: () => void;
}

export default function QuickActionsCard({ onOpenScanner }: QuickActionsCardProps) {
  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {onOpenScanner && (
          <Button 
            variant="outline" 
            className="w-full justify-start h-11 text-sm" 
            onClick={onOpenScanner}
          >
            <Bot className="w-4 h-4 mr-2.5 text-primary" />
            Open Token Scanner
          </Button>
        )}
        <Link to="/portfolio" className="block">
          <Button variant="outline" className="w-full justify-start h-11 text-sm">
            <Activity className="w-4 h-4 mr-2.5 text-blue-400" />
            View Portfolio
          </Button>
        </Link>
        <Link to="/sniper-settings" className="block">
          <Button variant="outline" className="w-full justify-start h-11 text-sm">
            <Settings className="w-4 h-4 mr-2.5 text-purple-400" />
            Bot Settings
          </Button>
        </Link>
        <Link to="/risk" className="block">
          <Button variant="outline" className="w-full justify-start h-11 text-sm">
            <Shield className="w-4 h-4 mr-2.5 text-orange-400" />
            Risk Management
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
