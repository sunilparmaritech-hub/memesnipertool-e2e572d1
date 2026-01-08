import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Bell, 
  Wallet, 
  User, 
  LogOut,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TradingHeaderProps {
  walletConnected?: boolean;
  walletAddress?: string;
  network?: string;
  onConnectWallet?: () => void;
}

export default function TradingHeader({
  walletConnected = false,
  walletAddress,
  network = "Solana",
  onConnectWallet,
}: TradingHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const displayAddress = walletAddress 
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Search Bar */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tokens, addresses..."
                className="pl-10 bg-secondary/50 border-border/50 focus:border-primary"
              />
            </div>
          </div>
          
          {/* Right Side Actions */}
          <div className="flex items-center gap-3 ml-auto">
            {/* Notifications */}
            <Button variant="ghost" size="icon" className="text-muted-foreground relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-success rounded-full" />
            </Button>
            
            {/* Network Badge */}
            <Badge variant="outline" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-success" />
              {network}
            </Badge>
            
            {/* Connect Wallet Button */}
            <Button 
              variant={walletConnected ? "outline" : "glow"}
              onClick={onConnectWallet}
              className="min-w-[140px]"
            >
              <Wallet className="w-4 h-4 mr-2" />
              {walletConnected ? displayAddress : "Select Wallet"}
            </Button>
            
            {/* User Menu */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <span className="hidden sm:inline text-sm text-foreground">
                      {user.email?.split('@')[0] || 'User'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link to="/portfolio">Portfolio</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/sniper-settings">Settings</Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/admin">Admin Panel</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/admin/analytics">Analytics</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {/* Mobile Menu Toggle */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border animate-fade-in">
            <div className="space-y-2">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search tokens..."
                  className="pl-10 bg-secondary/50"
                />
              </div>
              <Link 
                to="/portfolio" 
                className="block px-4 py-2 text-foreground hover:bg-secondary rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                Portfolio
              </Link>
              <Link 
                to="/sniper-settings" 
                className="block px-4 py-2 text-foreground hover:bg-secondary rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                Settings
              </Link>
              <Link 
                to="/risk" 
                className="block px-4 py-2 text-foreground hover:bg-secondary rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                Risk Management
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
