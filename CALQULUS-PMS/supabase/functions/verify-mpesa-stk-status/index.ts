import { serve } from "std/http/server.ts";
import { createClient } from "supabase/supabase-js@2";
import { requireEnv } from "../_shared/env.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { recordWebhookFailure } from "../_shared/webhookHelpers.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_KEY  = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[verify-mpesa-stk-status] ${step}`, details ?? "");
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return preflightResponse(req);
  }

  try {
    logStep('Starting payment verification');

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    const [{ data: roleRow }, { data: submanagerRow }] = await Promise.all([
      supabase.from('user_roles').select('role, tenant_id').eq('user_id', user.id).maybeSingle(),
      supabase.from('submanager_permissions').select('manager_id').eq('submanager_user_id', user.id).maybeSingle(),
    ]);

    const body = await req.json();
    // Accept both checkoutRequestId (from frontend) and reference (legacy)
    const reference = body.checkoutRequestId ?? body.reference;

    if (!reference) {
      throw new Error('Missing payment reference');
    }

    logStep('Checking transaction status', { reference });

    // Look up transaction by checkout_request_id
    const { data: transaction, error: txError } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('checkout_request_id', reference)
      .maybeSingle();

    if (txError) {
      logStep('Error fetching transaction', { error: txError.message });
      throw new Error('Failed to check payment status');
    }

    if (!transaction) {
      logStep('Transaction not found', { reference });
      return new Response(JSON.stringify({
        status: 'pending',
        message: 'Payment is being processed',
      }), {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    logStep('Transaction found', { 
      transactionId: transaction.id, 
      status: transaction.status 
    });

    const callerRole = roleRow?.role ?? null;
    const canView =
      callerRole === 'webhost' ||
      (callerRole === 'tenant' && roleRow?.tenant_id === transaction.tenant_id) ||
      transaction.manager_id === user.id ||
      (callerRole === 'submanager' && submanagerRow?.manager_id === transaction.manager_id);

    if (!canView) {
      return new Response(JSON.stringify({
        status: 'error',
        message: 'Forbidden: you can only view your own payment status',
      }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    if (transaction.status === 'completed') {
      return new Response(JSON.stringify({
        status: 'completed',
        message: 'Payment completed successfully',
        mpesaReceiptNumber: transaction.mpesa_receipt_number,
        amount: transaction.amount,
        completedAt: transaction.completed_at,
      }), {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    if (transaction.status === 'failed') {
      return new Response(JSON.stringify({
        status: 'failed',
        message: transaction.failure_reason || 'Payment failed',
      }), {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    // Still pending — check how long it has been pending
    // If >30 seconds, query Safaricom directly to get the real status.
    // This handles the case where the Daraja callback URL was misconfigured
    // or the callback was lost — the payment may have succeeded in M-Pesa
    // even though our DB still shows pending.
    const initiatedAt = transaction.initiated_at ? new Date(transaction.initiated_at).getTime() : null;
    const elapsedSeconds = initiatedAt ? (Date.now() - initiatedAt) / 1000 : 0;

    if (elapsedSeconds > 30 && transaction.manager_id) {
      logStep('DB still pending after 30s — querying Safaricom directly', { reference, elapsedSeconds });
      try {
        const invoiceIds = (() => {
          try {
            const parsed = typeof transaction.notes === 'string' && transaction.notes.startsWith('{') ? JSON.parse(transaction.notes) as { invoice_ids?: string[] } : null;
            return parsed?.invoice_ids?.length ? parsed.invoice_ids : (transaction.invoice_id ? [transaction.invoice_id] : []);
          } catch { return transaction.invoice_id ? [transaction.invoice_id] : []; }
        })();
        let canonicalAccount: Record<string, unknown> | null = null;
        if (invoiceIds.length) {
          const { data: invoiceRows } = await supabase.from('invoices').select('payment_account_id').in('id', invoiceIds);
          const accountIds = [...new Set((invoiceRows ?? []).map((row: any) => row.payment_account_id).filter(Boolean))];
          if (accountIds.length > 1) throw new Error('Selected invoices use different payment routes');
          if (accountIds[0]) {
            const { data: account } = await supabase.from('payment_collection_accounts').select('id,landlord_user_id,payment_method,paybill_number,till_number,account_reference').eq('id', accountIds[0]).maybeSingle();
            canonicalAccount = account;
          }
        }
        const queryResult = await querySafaricomSTK(supabase, reference, transaction.manager_id, canonicalAccount);
        if (queryResult) {
          logStep('Safaricom query result', queryResult);

          if (queryResult.ResultCode === '0' || queryResult.ResultCode === 0) {
            // Payment confirmed by Safaricom. The central processor owns the
            // pending -> completed transition and all financial effects.
            const mpesaReceiptNumber = queryResult.MpesaReceiptNumber ?? transaction.bank_reference ?? reference;

            const processResp = await fetch(`${SUPABASE_URL}/functions/v1/process-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
              body: JSON.stringify({
                tenantId:      transaction.tenant_id,
                managerId:     transaction.manager_id,
                amount:        Number(transaction.amount),
                paymentMethod: transaction.payment_type === 'till' ? 'mpesa_till' : 'mpesa_stk',
                paymentDate:   new Date().toISOString().slice(0, 10),
                reference:     mpesaReceiptNumber,
                invoiceId:     (() => {
                  try {
                    const parsed = typeof transaction.notes === "string" && transaction.notes.startsWith("{") ? JSON.parse(transaction.notes) as { invoice_ids?: string[] } : null;
                    return parsed?.invoice_ids?.length === 1 ? parsed.invoice_ids[0] : transaction.invoice_id;
                  } catch { return transaction.invoice_id; }
                })(),
                invoiceIds:    (() => {
                  try {
                    const parsed = typeof transaction.notes === "string" && transaction.notes.startsWith("{") ? JSON.parse(transaction.notes) as { invoice_ids?: string[] } : null;
                    return parsed?.invoice_ids?.length ? parsed.invoice_ids : undefined;
                  } catch { return undefined; }
                })(),
                unitId:        transaction.unit_id,
                propertyId:    transaction.property_id,
                unitNumber:    transaction.unit_number ?? 'N/A',
                phone:         transaction.phone_number,
                transactionId: transaction.id,
              }),
            });

            const processText = await processResp.text();
            let processJson: Record<string, unknown> | null = null;
            try {
              processJson = processText ? JSON.parse(processText) : null;
            } catch {
              processJson = null;
            }

            if (!processResp.ok || processJson?.success === false) {
              await recordWebhookFailure(
                supabase,
                'mpesa',
                mpesaReceiptNumber,
                {
                  source: 'verify-mpesa-stk-status',
                  transactionId: transaction.id,
                  checkoutRequestId: reference,
                  processPaymentError: processText.slice(0, 1000),
                },
                new Error(`process-payment returned ${processResp.status}: ${processText.slice(0, 300)}`),
              );
            }

            return new Response(JSON.stringify({
              status:             'completed',
              mpesaReceiptNumber,
              amount:             transaction.amount,
              completedAt:        new Date().toISOString(),
              source:             'safaricom_query',
            }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });

          } else if (queryResult.ResultCode !== null) {
            // Definitive failure from Safaricom
            const reason = queryResult.ResultDesc ?? 'Payment was not completed';
            const { error: failureError } = await supabase.rpc("mark_payment_transaction_failed_atomic", {
              p_transaction_id: transaction.id,
              p_failure_reason: reason,
            });
            if (failureError) throw new Error(`Failed to persist payment failure state: ${failureError.message}`);

            return new Response(JSON.stringify({
              status:        'failed',
              failureReason: reason,
              source:        'safaricom_query',
            }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
          }
        }
      } catch (queryErr) {
        logStep('Safaricom query failed — staying pending', { error: String(queryErr) });
        // Non-fatal — fall through to pending response
      }
    }

    return new Response(JSON.stringify({
      status: 'pending',
      message: 'Payment is being processed',
    }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logStep('Error', { message: errorMessage });
    return new Response(JSON.stringify({
      status: 'error',
      message: errorMessage,
    }), {
      status: 400,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});

/**
 * querySafaricomSTK — Calls the Safaricom STK Push Query API to get the
 * real status of a transaction. Used as fallback when our DB shows 'pending'
 * for >30 seconds, which likely means the callback URL was misconfigured or
 * the callback was lost in transit.
 *
 * Daraja docs: POST /mpesa/stkpushquery/v1/query
 */
async function querySafaricomSTK(
  supabase: any,
  checkoutRequestId: string,
  managerId: string,
  canonicalAccount?: Record<string, unknown> | null
): Promise<{ ResultCode: number | string | null; ResultDesc: string | null; MpesaReceiptNumber?: string } | null> {
  // Get manager's M-Pesa credentials
  let settings: any = null;
  const accountId = canonicalAccount?.id as string | undefined;
  const landlordId = canonicalAccount?.landlord_user_id as string | undefined;
  if (landlordId) {
    const { data } = await supabase.from('landlord_mpesa_settings')
      .select('consumer_key,consumer_secret,paybill_shortcode,paybill_passkey,till_shortcode,till_passkey,is_live')
      .eq('landlord_user_id',landlordId).maybeSingle();
    settings = data;
  } else {
    const { data: propertySettings } = await supabase.from('manager_mpesa_settings')
      .select('consumer_key,consumer_secret,paybill_shortcode,paybill_passkey,till_shortcode,till_passkey,is_live')
      .eq('manager_user_id',managerId).maybeSingle();
    settings = propertySettings;
  }

  if (!settings?.consumer_key || !settings?.consumer_secret) {
    throw new Error(`M-Pesa credentials not configured for payment account ${accountId ?? 'unknown'}`);
  }

  const apiBase = settings.is_live
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

  // Get OAuth token
  const credentials = btoa(`${settings.consumer_key}:${settings.consumer_secret}`);
  const tokenRes = await fetch(`${apiBase}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) throw new Error('Failed to get Safaricom OAuth token');

  // Build password (same as STK push)
  const isTill = canonicalAccount?.payment_method === 'mpesa_till';
  const shortcode = (isTill ? canonicalAccount?.till_number : canonicalAccount?.paybill_number) as string | undefined || settings.paybill_shortcode || settings.till_shortcode;
  const passkey   = isTill ? (settings.till_passkey ?? settings.passkey) : (settings.paybill_passkey ?? settings.passkey);
  if (!shortcode || !passkey) throw new Error('M-Pesa shortcode/passkey not configured');

  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const password  = btoa(`${shortcode}${passkey}${timestamp}`);

  // Query Safaricom
  const queryRes = await fetch(`${apiBase}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password:          password,
      Timestamp:         timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });

  const data = await queryRes.json();

  return {
    ResultCode:          data.ResultCode ?? null,
    ResultDesc:          data.ResultDesc ?? null,
    MpesaReceiptNumber:  data.CallbackMetadata?.Item?.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value,
  };
}
