import { ReactNode } from "react";
import TradingHeader from "@/components/trading/TradingHeader";
import MobileTabNav from "@/components/navigation/MobileTabNav";
import { useWallet } from "@/hooks/useWallet";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { wallet, connectPhantom, disconnect } = useWallet();

  const handleConnectWallet = async () => {
    if (wallet.isConnected) {
      await disconnect();
    } else {
      await connectPhantom();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <TradingHeader
        walletConnected={wallet.isConnected}
        walletAddress={wallet.address || undefined}
        network={wallet.network}
        onConnectWallet={handleConnectWallet}
      />
      {/* Main content: pt-14 for header, pb-16 on mobile for bottom nav */}
      <main className="pt-14 lg:pt-16 pb-16 lg:pb-6 flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </main>
      {/* Mobile bottom tab navigation */}
      <MobileTabNav />
    </div>
  );
}
