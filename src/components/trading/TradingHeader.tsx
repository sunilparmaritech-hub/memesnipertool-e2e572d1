import React, { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import logoImg from "@/assets/logo.png";
import headerLogoImg from "@/assets/header_logo.png";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  LogOut,
  ChevronDown,
  Zap,
  LayoutDashboard,
  Briefcase,
  Shield,
  Settings,
  Crown,
  BarChart3,
  Bot,
  BookOpen,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NotificationBell from "@/components/notifications/NotificationBell";
import WalletConnectionModal from "@/components/wallet/WalletConnectionModal";
import ModeSwitcher from "@/components/mode/ModeSwitcher";
import { useBotContext } from "@/contexts/BotContext";
import SubscriptionBadge from "@/components/dashboard/SubscriptionBadge";
import { useDisplayUnit } from "@/contexts/DisplayUnitContext";

interface TradingHeaderProps {
  walletConnected?: boolean;
  walletAddress?: string;
  network?: string;
  onConnectWallet?: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
}

const TradingHeader = forwardRef<HTMLElement, TradingHeaderProps>(function TradingHeader({
  walletConnected = false,
  walletAddress,
  network = "Solana",
  onConnectWallet,
}, ref) {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { botState } = useBotContext();
  const { solPrice, solPriceLoading } = useDisplayUnit();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const displayAddress = walletAddress 
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  // Navigation items with icons
  const getNavItems = (): NavItem[] => {
    const baseItems: NavItem[] = [
      { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
      { label: "Scanner", path: "/scanner", icon: Zap },
      { label: "Portfolio", path: "/portfolio", icon: Briefcase },
      { label: "Risk", path: "/risk", icon: Shield },
      { label: "Settings", path: "/sniper-settings", icon: Settings },
      { label: "Guide", path: "/basics", icon: BookOpen },
    ];

    if (isAdmin) {
      baseItems.push({ label: "Admin", path: "/admin", icon: Crown });
    }

    return baseItems;
  };

  const navItems = getNavItems();

  return (
    <header ref={ref} className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/40 safe-area-top">
      <div className="container mx-auto px-2 sm:px-3 lg:px-4 max-w-[1600px]">
        <div className="flex items-center justify-between h-12 sm:h-14">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center shrink-0">
            <img src={headerLogoImg} alt="Alpha Meme Sniper AI" className="h-8 sm:h-10 object-contain" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-0.5 mx-4 overflow-x-auto scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? "bg-primary/12 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          
          {/* Right Side Actions */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* SOL Price - compact */}
            <Badge variant="outline" className="hidden md:flex items-center gap-1 px-1.5 py-0.5 bg-secondary/20 border-border/30 text-[10px]">
              <span className="text-muted-foreground">SOL</span>
              <span className="font-mono font-medium text-foreground">
                {solPriceLoading ? '…' : `$${solPrice.toFixed(2)}`}
              </span>
            </Badge>

            {/* Subscription Badge */}
            <div className="hidden md:flex">
              <SubscriptionBadge />
            </div>
            
            {/* Mode Switcher */}
            <ModeSwitcher />
            
            {/* Notifications */}
            <Link to="/notifications" className="hidden sm:flex">
              <NotificationBell />
            </Link>
            
            {/* Bot Status Indicator */}
            <Link to="/scanner" className="hidden md:flex">
              <Badge 
                variant="outline" 
                className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer transition-colors text-[10px] ${
                  botState.isBotActive 
                    ? 'bg-success/8 border-success/25 hover:bg-success/15' 
                    : 'bg-secondary/40 hover:bg-secondary/60'
                }`}
              >
                <Bot className={`w-3 h-3 ${botState.isBotActive ? 'text-success' : 'text-muted-foreground'}`} />
                {botState.isBotActive && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
                  </span>
                )}
                <span className={`font-medium ${botState.isBotActive ? 'text-success' : 'text-muted-foreground'}`}>
                  {botState.isBotActive ? (botState.isPaused ? 'Paused' : 'Active') : 'Off'}
                </span>
              </Badge>
            </Link>
            
            {/* Connect Wallet Button */}
            <WalletConnectionModal />
            
            {/* User Menu */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="xs" className="flex items-center gap-1 px-1.5 hover:bg-secondary/50">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/25 to-primary/10 flex items-center justify-center border border-primary/15">
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <ChevronDown className="w-3 h-3 text-muted-foreground hidden sm:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 bg-card border-border">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-xs text-muted-foreground">Signed in as</p>
                    <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                  </div>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link to="/portfolio" className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Portfolio
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link to="/sniper-settings" className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Bot Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link to="/settings" className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Account
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link to="/admin" className="flex items-center gap-2">
                          <Crown className="w-4 h-4 text-warning" />
                          Admin Panel
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link to="/admin/analytics" className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4" />
                          Analytics
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
          </div>
        </div>
      </div>
    </header>
  );
});

TradingHeader.displayName = 'TradingHeader';

export default TradingHeader;
