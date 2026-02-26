import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppModeProvider } from "@/contexts/AppModeContext";
import { DemoPortfolioProvider } from "@/contexts/DemoPortfolioContext";
import { BotProvider } from "@/contexts/BotContext";
import { DisplayUnitProvider } from "@/contexts/DisplayUnitContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SessionExpiryWarning } from "@/components/session/SessionExpiryWarning";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useGeoRestriction } from "@/hooks/useGeoRestriction";
import GeoBlockScreen from "@/components/GeoBlockScreen";

// Eagerly loaded (critical path)
import LandingPage from "./pages/LandingPage";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";

// Lazy loaded (heavy pages)
const Scanner = lazy(() => import("./pages/Scanner"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const Pricing = lazy(() => import("./pages/Pricing"));
const UserSettings = lazy(() => import("./pages/UserSettings"));
const MemeSniperSettings = lazy(() => import("./pages/MemeSniperSettings"));
const RiskCompliance = lazy(() => import("./pages/RiskCompliance"));
const Notifications = lazy(() => import("./pages/Notifications"));
const TokenDetail = lazy(() => import("./pages/TokenDetail"));
const Basics = lazy(() => import("./pages/Basics"));
const Promotions = lazy(() => import("./pages/Promotions"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const RiskDisclaimer = lazy(() => import("./pages/RiskDisclaimer"));
const AmlPolicy = lazy(() => import("./pages/AmlPolicy"));
const NonCustodialDisclosure = lazy(() => import("./pages/NonCustodialDisclosure"));
const ComplianceDocs = lazy(() => import("./pages/ComplianceDocs"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">Loading…</span>
      </div>
    </div>
  );
}

function SuspenseWrap({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

function GeoGate({ children }: { children: React.ReactNode }) {
  const { isBlocked, country, loading } = useGeoRestriction();
  if (loading) return null;
  if (isBlocked) return <GeoBlockScreen country={country} />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppModeProvider>
        <DisplayUnitProvider>
          <DemoPortfolioProvider>
            <BotProvider>
            <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <GeoGate>
            <SessionExpiryWarning />
            <OfflineIndicator />
            <ErrorBoundary>
            <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/basics" element={<SuspenseWrap><Basics /></SuspenseWrap>} />
            <Route path="/promotions" element={<SuspenseWrap><Promotions /></SuspenseWrap>} />
            <Route path="/about" element={<SuspenseWrap><AboutUs /></SuspenseWrap>} />
            <Route path="/contact" element={<SuspenseWrap><ContactUs /></SuspenseWrap>} />
            <Route path="/pricing" element={<SuspenseWrap><Pricing /></SuspenseWrap>} />
            <Route path="/terms" element={<SuspenseWrap><TermsOfService /></SuspenseWrap>} />
            <Route path="/privacy" element={<SuspenseWrap><PrivacyPolicy /></SuspenseWrap>} />
            <Route path="/risk-disclaimer" element={<SuspenseWrap><RiskDisclaimer /></SuspenseWrap>} />
            <Route path="/aml-policy" element={<SuspenseWrap><AmlPolicy /></SuspenseWrap>} />
            <Route path="/non-custodial-disclosure" element={<SuspenseWrap><NonCustodialDisclosure /></SuspenseWrap>} />
            <Route path="/compliance-docs" element={<SuspenseWrap><ComplianceDocs /></SuspenseWrap>} />

            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route
              path="/scanner"
              element={
                <ProtectedRoute>
                  <SuspenseWrap><Scanner /></SuspenseWrap>
                </ProtectedRoute>
              }
            />
            <Route
              path="/portfolio"
              element={
                <ProtectedRoute>
                  <SuspenseWrap><Portfolio /></SuspenseWrap>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SuspenseWrap><UserSettings /></SuspenseWrap>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sniper-settings"
              element={
                <ProtectedRoute>
                  <SuspenseWrap><MemeSniperSettings /></SuspenseWrap>
                </ProtectedRoute>
              }
            />
            <Route
              path="/risk"
              element={
                <ProtectedRoute>
                  <SuspenseWrap><RiskCompliance /></SuspenseWrap>
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <SuspenseWrap><Notifications /></SuspenseWrap>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <SuspenseWrap><Admin /></SuspenseWrap>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <ProtectedRoute requireAdmin>
                  <SuspenseWrap><AdminAnalytics /></SuspenseWrap>
                </ProtectedRoute>
              }
            />
            <Route
              path="/token/:address"
              element={
                <ProtectedRoute>
                  <SuspenseWrap><TokenDetail /></SuspenseWrap>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
            </Routes>
            </ErrorBoundary>
            </GeoGate>
          </AuthProvider>
        </BrowserRouter>
            </BotProvider>
          </DemoPortfolioProvider>
        </DisplayUnitProvider>
      </AppModeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
