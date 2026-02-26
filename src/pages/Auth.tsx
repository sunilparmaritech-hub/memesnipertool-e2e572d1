import React, { forwardRef, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Lock, AlertCircle, CheckCircle, ArrowLeft, Loader2, Gift } from "lucide-react";
import headerLogoImg from "@/assets/header_logo.png";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

type AuthMode = "login" | "signup" | "forgot-password";

const AuthFormSkeleton = () => (
  <div className="space-y-5">
    <div className="space-y-2">
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-12 w-full" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-12 w-full" />
    </div>
    <Skeleton className="h-12 w-full" />
  </div>
);

const Auth = forwardRef<HTMLDivElement, object>(function Auth(_props, ref) {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Pre-fill referral code from URL
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      setReferralCode(ref.toUpperCase());
      setMode("signup");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading) {
      setIsInitializing(false);
    }
  }, [authLoading]);

  useEffect(() => {
    if (user && !authLoading) {
      navigate("/dashboard");
    }
  }, [user, navigate, authLoading]);

  const validateEmail = () => {
    try {
      emailSchema.parse(email);
      return true;
    } catch (e) {
      if (e instanceof z.ZodError) {
        setError(e.errors[0].message);
        return false;
      }
    }
    return false;
  };

  const validateInputs = () => {
    if (!validateEmail()) return false;

    if (mode !== "forgot-password") {
      try {
        passwordSchema.parse(password);
      } catch (e) {
        if (e instanceof z.ZodError) {
          setError(e.errors[0].message);
          return false;
        }
      }
    }

    return true;
  };

  const handleForgotPassword = async () => {
    if (!validateEmail()) return;

    setIsLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess("Password reset email sent! Check your inbox and follow the link to reset your password.");
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const processReferral = async () => {
    if (!referralCode.trim()) return;
    try {
      await supabase.functions.invoke("process-referral", {
        body: { referralCode: referralCode.trim().toUpperCase() },
      });
    } catch (err) {
      console.error("Referral processing error:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validateInputs()) return;

    if (mode === "forgot-password") {
      await handleForgotPassword();
      return;
    }

    setIsLoading(true);

    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            setError("Invalid email or password. Please try again.");
          } else {
            setError(error.message);
          }
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          if (error.message.includes("already registered")) {
            setError("This email is already registered. Please sign in instead.");
          } else {
            setError(error.message);
          }
        } else {
          // Store referral code for after email verification
          if (referralCode.trim()) {
            localStorage.setItem("pending_referral_code", referralCode.trim().toUpperCase());
          }
          setSuccess("Account created! Please check your email to verify your address before signing in. " + 
            (referralCode.trim() ? "Your referral bonus of 50 credits will be applied after verification." : ""));
          setMode("login");
          setPassword("");
          setReferralCode("");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Process pending referral after login
  useEffect(() => {
    if (user && !authLoading) {
      const pendingCode = localStorage.getItem("pending_referral_code");
      if (pendingCode) {
        localStorage.removeItem("pending_referral_code");
        processReferral().catch(console.error);
      }
    }
  }, [user, authLoading]);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError("");
    setSuccess("");
  };

  const getTitle = () => {
    switch (mode) {
      case "login": return "Welcome Back";
      case "signup": return "Create Account";
      case "forgot-password": return "Reset Password";
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case "login": return "Sign in to access your dashboard";
      case "signup": return "Join the community of meme token snipers";
      case "forgot-password": return "Enter your email to receive a reset link";
    }
  };

  const getButtonText = () => {
    switch (mode) {
      case "login": return "Sign In";
      case "signup": return "Create Account";
      case "forgot-password": return "Send Reset Link";
    }
  };

  if (isInitializing || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        </div>
        <div className="w-full max-w-md relative animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <img src={headerLogoImg} alt="Alpha Meme Sniper AI" className="h-14 object-contain" />
            </div>
            <Skeleton className="h-8 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>
          <div className="glass rounded-xl p-6 md:p-8">
            <AuthFormSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <img src={headerLogoImg} alt="Alpha Meme Sniper AI" className="h-14 object-contain" />
          </div>
           <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1.5">
            {getTitle()}
          </h1>
          <p className="text-caption">
            {getSubtitle()}
          </p>
        </div>

        {/* Referral banner */}
        {mode === "signup" && referralCode && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm animate-fade-in">
            <Gift className="w-4 h-4 flex-shrink-0" />
            <span>Referral code <strong>{referralCode}</strong> applied — you'll both earn <strong>50 credits</strong>!</span>
          </div>
        )}

        <div className="glass rounded-xl p-6 md:p-8">
          {mode === "forgot-password" && (
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </button>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg text-success text-sm animate-fade-in">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                {success}
              </div>
            )}

            {/* Email Input */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-12 pl-10 pr-4 bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Input */}
            {mode !== "forgot-password" && (
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 pl-10 pr-4 bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            {/* Referral Code - Only show on signup */}
            {mode === "signup" && (
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Referral Code <span className="text-muted-foreground/50">(optional)</span>
                </label>
                <div className="relative">
                  <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="e.g. A1B2C3D4"
                    maxLength={8}
                    className="w-full h-12 pl-10 pr-4 bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase font-mono tracking-wider"
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            {/* Forgot Password Link */}
            {mode === "login" && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => switchMode("forgot-password")}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                  disabled={isLoading}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <Button
              type="submit"
              variant="glow"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Please wait...
                </>
              ) : (
                getButtonText()
              )}
            </Button>
          </form>

          {mode !== "forgot-password" && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => switchMode(mode === "login" ? "signup" : "login")}
                className="text-sm text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                disabled={isLoading}
              >
                {mode === "login"
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
});

Auth.displayName = 'Auth';

export default Auth;
