import { supabase } from "@/integrations/supabase/client";

/** Append-only payment audit events. Financial state changes belong to the canonical payment RPCs. */
export const paymentLogger = {
  async logPayment(data: {
    paymentId: string;
    eventType: string;
    eventData?: Record<string, unknown>;
  }) {
    const { data: paymentLog, error } = await supabase.rpc("append_payment_log_atomic", {
      p_payment_id: data.paymentId,
      p_event_type: data.eventType,
      p_event_data: data.eventData ?? {},
    });

    if (error) throw error;
    return paymentLog;
  },

  async markVerified(paymentId: string) {
    await this.logPayment({
      paymentId,
      eventType: "verified",
    });
    return true;
  },
};
