import { useEffect, useRef, useState } from "react";
import { MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/hooks/use-toast";
import { errorToast } from "@/shared/lib/errorToast";

const COOLDOWN_SECONDS = 60;

interface ResendVerificationButtonProps {
  email: string | null | undefined;
  redirectTo?: string;
}

/**
 * Resends the signup verification email. Success copy is deliberately
 * generic so the response cannot confirm whether an address is registered.
 */
export function ResendVerificationButton({ email, redirectTo }: ResendVerificationButtonProps) {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldownLeft(COOLDOWN_SECONDS);
    timerRef.current = setInterval(() => {
      setCooldownLeft((left) => {
        if (left <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return left - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (!email || isSending || cooldownLeft > 0) return;
    setIsSending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      });
      if (error) throw error;
      toast({
        title: "Verification email sent",
        description: "If this address has an unverified account, a new link is on its way.",
      });
      startCooldown();
    } catch (error) {
      errorToast("Could not resend verification email", error, "Try again in a moment.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleResend}
      disabled={!email || isSending || cooldownLeft > 0}
      className="gap-1.5"
    >
      <MailCheck className="h-4 w-4" aria-hidden />
      {isSending
        ? "Sending…"
        : cooldownLeft > 0
          ? `Resend in ${cooldownLeft}s`
          : "Resend verification email"}
    </Button>
  );
}
