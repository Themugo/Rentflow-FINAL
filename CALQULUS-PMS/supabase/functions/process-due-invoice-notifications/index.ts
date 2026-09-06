import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
import { rejectUnlessServiceOrCron } from "../_shared/assertCaller.ts";
const logStep = (step: string, details?: Record<string, unknown>) => {
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  // No frontend code calls this directly — only the scheduled cron job.
  // Previously any authenticated user could trigger this platform-wide
  // invoice-notification sweep (which itself calls send-payment-push-notification
  // / send-invoice-due-push-notification for every due/overdue invoice);
  // lock to service-role/cron since no legitimate user-JWT caller exists.
  const denied = rejectUnlessServiceOrCron(req);
  if (denied) return denied;


  try {
    logStep("Starting due invoice notification processing");

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get dates for notification thresholds
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Fetch pending invoices that are due soon or overdue
    const { data: invoices, error: invoicesError } = await supabaseAdmin
      .from("invoices")
      .select(`
        id,
        invoice_number,
        amount,
        due_date,
        status,
        tenant_id,
        tenants!inner (
          id,
          name,
          email,
          property,
          unit,
          property_id
        )
      `)
      .eq("status", "pending")
      .lte("due_date", sevenDaysFromNow.toISOString().split("T")[0])
      .order("due_date", { ascending: true });

    if (invoicesError) {
      logStep("Failed to fetch invoices", { error: invoicesError.message });
      return new Response(JSON.stringify({ error: "Failed to fetch invoices" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (!invoices || invoices.length === 0) {
      logStep("No due invoices found");
      return new Response(JSON.stringify({ success: true, message: "No invoices to process", processed: 0 }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    logStep("Found invoices to process", { count: invoices.length });

    const results: { success: number; failed: number; skipped: number } = { 
      success: 0, 
      failed: 0, 
      skipped: 0 
    };

    for (const invoice of invoices) {
      try {
        const tenant = invoice.tenants as any;
        if (!tenant?.email) {
          logStep("Skipping invoice - no tenant email", { invoiceNumber: invoice.invoice_number });
          results.skipped++;
          continue;
        }

        const dueDate = new Date(invoice.due_date);
        dueDate.setHours(0, 0, 0, 0);
        
        const diffTime = dueDate.getTime() - today.getTime();
        const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const isOverdue = daysUntilDue < 0;

        // Only send notifications for specific thresholds
        const shouldNotify = isOverdue || 
                            daysUntilDue === 0 || 
                            daysUntilDue === 1 || 
                            daysUntilDue === 3 || 
                            daysUntilDue === 7;

        if (!shouldNotify) {
          results.skipped++;
          continue;
        }

        // Call the push notification function
        const pushPayload = {
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantEmail: tenant.email,
          propertyName: tenant.property || "Property",
          unit: tenant.unit,
          amount: invoice.amount,
          invoiceNumber: invoice.invoice_number,
          dueDate: invoice.due_date,
          daysUntilDue: Math.max(0, daysUntilDue),
          isOverdue
        };

        const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-invoice-due-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify(pushPayload),
        });

        if (pushResponse.ok) {
          logStep("Push notification sent", { 
            invoiceNumber: invoice.invoice_number,
            tenant: tenant.name,
            daysUntilDue,
            isOverdue
          });
          results.success++;
        } else {
          const errorText = await pushResponse.text();
          logStep("Push notification failed", { 
            invoiceNumber: invoice.invoice_number,
            error: errorText
          });
          results.failed++;
        }

      } catch (invoiceError) {
        logStep("Error processing invoice", { 
          invoiceNumber: invoice.invoice_number,
          error: invoiceError instanceof Error ? invoiceError.message : String(invoiceError)
        });
        results.failed++;
      }
    }

    logStep("Due invoice notification processing complete", results);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Processed ${invoices.length} invoices`,
      results 
    }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Error in process-due-invoice-notifications", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
