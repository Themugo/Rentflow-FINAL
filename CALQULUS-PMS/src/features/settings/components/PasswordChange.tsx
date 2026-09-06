import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { Progress } from "@/shared/components/ui/progress";

export const PasswordChange = () => {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (password.length >= 8) score += 25;
    if (/[a-z]/.test(password)) score += 25;
    if (/[A-Z]/.test(password)) score += 25;
    if (/[0-9]/.test(password)) score += 12.5;
    if (/[^a-zA-Z0-9]/.test(password)) score += 12.5;

    if (score <= 25) return { score, label: "Weak", color: "bg-destructive" };
    if (score <= 50) return { score, label: "Fair", color: "bg-warning/70" };
    if (score <= 75) return { score, label: "Good", color: "bg-warning" };
    return { score, label: "Strong", color: "bg-success" };
  };

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) return "Password must be at least 8 characters";
    if (!/[a-z]/.test(password)) return "Password must include a lowercase letter";
    if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter";
    if (!/[0-9]/.test(password)) return "Password must include a number";
    if (!/[^a-zA-Z0-9]/.test(password)) return "Password must include a special character";
    return null;
  };

  const handleChangePassword = async () => {
    const validationError = validatePassword(newPassword);
    if (validationError) {
      toast({
        title: "Invalid Password",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully.",
      });

      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to change password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const strength = getPasswordStrength(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  return (
    <Card className="card-shadow animate-fade-in" style={{ animationDelay: "75ms" }}>
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Change Password
        </CardTitle>
        <CardDescription>Update your account password</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          {newPassword && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Password strength:</span>
                <span className={strength.score >= 75 ? "text-green-600" : "text-muted-foreground"}>
                  {strength.label}
                </span>
              </div>
              <Progress value={strength.score} className={`h-1 ${strength.color}`} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
          />
          {confirmPassword && (
            <p className={`text-xs ${passwordsMatch ? "text-green-600" : "text-destructive"}`}>
              {passwordsMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
            </p>
          )}
        </div>

        <ul className="text-xs text-muted-foreground space-y-1">
          <li className={newPassword.length >= 8 ? "text-green-600" : ""}>
            • At least 8 characters
          </li>
          <li className={/[a-z]/.test(newPassword) ? "text-green-600" : ""}>
            • One lowercase letter
          </li>
          <li className={/[A-Z]/.test(newPassword) ? "text-green-600" : ""}>
            • One uppercase letter
          </li>
          <li className={/[0-9]/.test(newPassword) ? "text-green-600" : ""}>
            • One number
          </li>
          <li className={/[^a-zA-Z0-9]/.test(newPassword) ? "text-green-600" : ""}>
            • One special character
          </li>
        </ul>

        <div className="flex justify-end">
          <Button
            onClick={handleChangePassword}
            disabled={saving || !newPassword || !confirmPassword}
            size="sm"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Change Password
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
