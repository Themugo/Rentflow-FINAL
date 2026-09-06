import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/shared/hooks/use-toast";
import { errorToast } from "@/shared/lib/errorToast";
import { Loader2, Eye, EyeOff, Check, X, ShieldCheck, AlertTriangle } from "lucide-react";

function RequirementItem({ met, text }: { met: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${met ? "text-green-600" : "text-muted-foreground"}`}>
      {met ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      <span>{text}</span>
    </div>
  );
}

const ActivateAccount = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [email, setEmail] = useState("");
  const [isActivated, setIsActivated] = useState(false);

  // Password requirements
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const allRequirementsMet = hasMinLength && hasUppercase && hasLowercase && hasNumber && passwordsMatch;

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setIsValidating(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc("validate_activation_token", {
          token_value: token,
        });

        if (error || !data || data.length === 0) {
          setIsValid(false);
        } else {
          setIsValid(true);
          setEmail(data[0].email);
        }
      } catch {
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!allRequirementsMet) {
      toast({ title: "Please meet all password requirements", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("activate-account", {
        body: { token, password },
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        setIsActivated(true);
        toast({ title: "Account activated successfully!" });
      } else {
        throw new Error(data?.error || "Activation failed");
      }
    } catch (err: unknown) {
      errorToast("Could not activate account", err, "Activation failed. Try again or ask your manager for a new link.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark:hero-gradient">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Validating activation link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token || !isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark:hero-gradient">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Invalid or Expired Link</CardTitle>
            <CardDescription>
              This activation link is invalid or has expired. Activation links are valid for 24 hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Please contact your property manager to request a new activation link.
            </p>
            <Button onClick={() => navigate("/tenant/login")} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isActivated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark:hero-gradient">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 rounded-full bg-green-100 dark:bg-green-900/30">
              <ShieldCheck className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle>Account Activated!</CardTitle>
            <CardDescription>
              Your account has been successfully activated. You can now log in to your tenant portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-1">Your login email:</p>
              <p className="font-medium">{email}</p>
            </div>
            <Button onClick={() => navigate("/tenant/login")} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background dark:hero-gradient">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Activate Your Account</CardTitle>
          <CardDescription>
            Set a secure password to complete your account activation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleActivate} className="space-y-4">
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Your email:</p>
              <p className="font-medium">{email}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="bg-muted/50 p-3 rounded-lg space-y-2">
              <p className="text-sm font-medium">Password Requirements:</p>
              <RequirementItem met={hasMinLength} text="At least 8 characters" />
              <RequirementItem met={hasUppercase} text="One uppercase letter" />
              <RequirementItem met={hasLowercase} text="One lowercase letter" />
              <RequirementItem met={hasNumber} text="One number" />
              <RequirementItem met={passwordsMatch} text="Passwords match" />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !allRequirementsMet}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Activate Account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivateAccount;
