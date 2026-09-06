import { toast } from "@/shared/hooks/use-toast";
import { logError, toUserFacingError } from "@/shared/lib/errorLogger";

/**
 * Error toast that (a) never leaks raw PostgREST/SQL/RLS text to users and
 * (b) logs the raw error to activity_logs/Sentry for debugging.
 *
 * Use instead of `toast({ title, description: err.message, variant: "destructive" })`.
 */
export function errorToast(
  title: string,
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): void {
  logError(title, error);
  toast({
    title,
    description: toUserFacingError(error, fallback),
    variant: "destructive",
  });
}
