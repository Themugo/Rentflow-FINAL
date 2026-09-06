import { useEffect } from "react";
import { format, addDays, differenceInCalendarDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { logError } from "@/shared/lib/errorLogger";

/** How many days ahead to scan for expiring leases */
const WINDOWS = [30, 60, 90] as const;
const MAX_DAYS = WINDOWS[WINDOWS.length - 1];

/** Only re-run the check once every 24 hours per user */
const THROTTLE_MS = 24 * 60 * 60 * 1000;
const THROTTLE_KEY = (userId: string) => `lease-expiry-check:${userId}`;

/** Skip if a notification for this lease was already created within this window */
const DEDUP_WINDOW_DAYS = 7;

interface ExpiringLease {
  id: string;
  end_date: string;
  property: string;
  unit: string | null;
  tenant_name?: string | null;
  tenants?: { name: string } | null;
}

function getWindow(daysLeft: number): 30 | 60 | 90 | null {
  for (const w of WINDOWS) {
    if (daysLeft <= w) return w;
  }
  return null;
}

function buildNotification(
  lease: ExpiringLease,
  daysLeft: number,
  userId: string,
) {
  const tenantName = lease.tenant_name ?? lease.tenants?.name ?? "Tenant";
  const unitLabel = lease.unit ? `, Unit ${lease.unit}` : "";
  const endFormatted = format(new Date(lease.end_date), "dd MMM yyyy");
  const body = `${tenantName} · ${lease.property}${unitLabel} · expires ${endFormatted}`;

  let title: string;
  let priority: string;

  if (daysLeft <= 14) {
    title = `Lease expiring in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
    priority = "urgent";
  } else if (daysLeft <= 30) {
    title = `Lease expiring in ${daysLeft} days`;
    priority = "urgent";
  } else if (daysLeft <= 60) {
    const weeks = Math.round(daysLeft / 7);
    title = `Lease expiring in ~${weeks} week${weeks === 1 ? "" : "s"}`;
    priority = "high";
  } else {
    const months = Math.round(daysLeft / 30);
    title = `Lease expiring in ~${months} month${months === 1 ? "" : "s"}`;
    priority = "normal";
  }

  return {
    user_id: userId,
    title,
    body,
    type: "reminder",
    priority,
    action_url: "/leases",
    action_label: "View lease",
    reference_id: lease.id,
    reference_type: "lease_expiry",
    source: "system",
  };
}

async function runExpiryCheck(userId: string, managerId: string) {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const maxDate = format(addDays(today, MAX_DAYS), "yyyy-MM-dd");

  // 1. Fetch active leases expiring within the window (using scalar columns to avoid RLS recursion)
  const { data: leases, error: leasesErr } = await supabase
    .from("leases")
    .select(`
      id,
      end_date,
      property,
      unit,
      tenant_name
    `)
    .eq("manager_id", managerId)
    .eq("status", "active")
    .gte("end_date", todayStr)
    .lte("end_date", maxDate)
    .order("end_date", { ascending: true });

  if (leasesErr) {
    logError("useLeaseExpiryReminders.fetchLeases", leasesErr);
    return;
  }
  if (!leases || leases.length === 0) return;

  const leaseIds = leases.map((l) => l.id);

  // 2. Fetch which ones already have a recent notification (dedup)
  const dedupCutoff = format(
    addDays(today, -DEDUP_WINDOW_DAYS),
    "yyyy-MM-dd'T'HH:mm:ss'Z'",
  );
  const { data: existing, error: existErr } = await supabase
    .from("in_app_notifications")
    .select("reference_id")
    .eq("reference_type", "lease_expiry")
    .eq("user_id", userId)
    .gte("created_at", dedupCutoff)
    .in("reference_id", leaseIds);

  if (existErr) {
    logError("useLeaseExpiryReminders.checkExisting", existErr);
    // Continue anyway — worst case we create duplicates
  }

  const alreadyNotified = new Set((existing ?? []).map((n) => n.reference_id));

  // 3. Build rows to insert (only for leases not yet notified this week)
  const toInsert = (leases as ExpiringLease[])
    .filter((l) => !alreadyNotified.has(l.id))
    .map((l) => {
      const daysLeft = differenceInCalendarDays(new Date(l.end_date), today);
      const w = getWindow(daysLeft);
      if (w === null) return null;
      return buildNotification(l, daysLeft, userId);
    })
    .filter((notification): notification is NonNullable<typeof notification> => Boolean(notification));

  if (toInsert.length === 0) return;

  // 4. Batch insert
  let insertErr: Error | null = null;
  for (const notification of toInsert) {
    const { error } = await supabase.rpc('create_in_app_notification_atomic', {
      p_user_id: notification.user_id,
      p_title: notification.title,
      p_body: notification.body,
      p_type: notification.type,
      p_action_url: notification.action_url,
      p_action_label: notification.action_label,
      p_reference_id: notification.reference_id,
      p_reference_type: notification.reference_type,
      p_priority: notification.priority,
      p_source: notification.source,
      p_manager_id: managerId,
    });
    if (error) { insertErr = error; break; }
  }

  if (insertErr) {
    logError("useLeaseExpiryReminders.insertNotifications", insertErr);
  }
}

/**
 * Silently scans for leases expiring within 30 / 60 / 90 days and creates
 * in_app_notifications so they surface in the manager's bell automatically.
 *
 * Throttled to once per 24 hours using localStorage.
 * Deduplicates against notifications created in the last 7 days.
 *
 * Mount this hook once in Dashboard.tsx — it produces no JSX.
 */
export function useLeaseExpiryReminders() {
  const { user } = useAuth();
  const { managerId } = useManagerScope();

  useEffect(() => {
    if (!user?.id || !managerId) return;

    // Throttle: skip if already ran in the last 24 h
    const key = THROTTLE_KEY(user.id);
    const lastRun = parseInt(localStorage.getItem(key) ?? "0", 10);
    if (Date.now() - lastRun < THROTTLE_MS) return;

    // Mark as running before the async work to prevent a second fire
    // while the first is still in-flight (React StrictMode double-invoke)
    localStorage.setItem(key, String(Date.now()));

    runExpiryCheck(user.id, managerId).catch((err) =>
      logError("useLeaseExpiryReminders.run", err),
    );
  }, [user?.id, managerId]);
}
