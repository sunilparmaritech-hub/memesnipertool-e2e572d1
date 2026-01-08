import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { useDisclaimerAcknowledgment } from "@/hooks/useDisclaimerAcknowledgment";
import DisclaimerDialog from "@/components/DisclaimerDialog";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedRouteProps) => {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  const { hasAcknowledged, isLoading: disclaimerLoading, acknowledgeDisclaimer } = useDisclaimerAcknowledgment();

  if (loading || disclaimerLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Show disclaimer dialog if user hasn't acknowledged yet
  if (hasAcknowledged === false) {
    return (
      <>
        <DisclaimerDialog open={true} onAcknowledge={acknowledgeDisclaimer} />
        <div className="min-h-screen bg-background" />
      </>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
