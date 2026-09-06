/**
 * _shared/mpesaTracking.ts
 *
 * M-Pesa payment tracking and monitoring for CALQULUS PMS.
 *
 * Provides specialized tracking for M-Pesa payment operations,
 * success rates, callback failures, and payment analytics.
 *
 * Usage:
 *   import { trackMpesaPayment, getMpesaStats, createMpesaReport } from "../_shared/mpesaTracking.ts";
 *
 *   trackMpesaPayment("initiate", "success", { amount: 5000, phone: "2547..." });
 *   const stats = getMpesaStats();
 */

export interface MpesaPaymentEvent {
  id: string;
  timestamp: string;
  operation: "initiate" | "callback" | "query" | "validate";
  status: "success" | "failure" | "pending" | "timeout";
  amount?: number;
  phoneNumber?: string;
  merchantRequestId?: string;
  checkoutRequestId?: string;
  resultCode?: string;
  resultDesc?: string;
  duration?: number;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface MpesaStats {
  totalPayments: number;
  successRate: number;
  failureRate: number;
  pendingRate: number;
  timeoutRate: number;
  averageAmount: number;
  totalAmount: number;
  operationsByType: Record<string, number>;
  statusByOperation: Record<string, Record<string, number>>;
  recentPayments: MpesaPaymentEvent[];
  topFailureReasons: Array<{ reason: string; count: number }>;
  successRateByHour: Array<{ hour: string; rate: number; count: number }>;
}

// In-memory M-Pesa payment storage (in production, this would be a database)
const mpesaPaymentStore = new Map<string, MpesaPaymentEvent[]>();

/**
 * Generate a unique payment event ID
 */
function generatePaymentEventId(): string {
  return crypto.randomUUID();
}

/**
 * Track an M-Pesa payment event
 */
export function trackMpesaPayment(
  operation: MpesaPaymentEvent["operation"],
  status: MpesaPaymentEvent["status"],
  metadata: {
    amount?: number;
    phoneNumber?: string;
    merchantRequestId?: string;
    checkoutRequestId?: string;
    resultCode?: string;
    resultDesc?: string;
    duration?: number;
    correlationId?: string;
    [key: string]: any;
  } = {}
): string {
  const eventId = generatePaymentEventId();
  const timestamp = new Date().toISOString();

  const paymentEvent: MpesaPaymentEvent = {
    id: eventId,
    timestamp,
    operation,
    status,
    amount: metadata.amount,
    phoneNumber: metadata.phoneNumber,
    merchantRequestId: metadata.merchantRequestId,
    checkoutRequestId: metadata.checkoutRequestId,
    resultCode: metadata.resultCode,
    resultDesc: metadata.resultDesc,
    duration: metadata.duration,
    correlationId: metadata.correlationId,
    metadata,
  };

  const operationKey = `mpesa_${operation}`;
  if (!mpesaPaymentStore.has(operationKey)) {
    mpesaPaymentStore.set(operationKey, []);
  }

  const events = mpesaPaymentStore.get(operationKey)!;
  events.push(paymentEvent);

  // Keep only last 1000 events per operation
  if (events.length > 1000) {
    events.shift();
  }

  // Log important events
  if (status === "failure" || status === "timeout") {
    console.error(`[MPESA_TRACKING] ${operation.toUpperCase()} ${status.toUpperCase()}: ${metadata.resultDesc || "Unknown error"}`, {
      eventId,
      operation,
      status,
      amount: metadata.amount,
      phoneNumber: metadata.phoneNumber,
      correlationId: metadata.correlationId,
    });
  }

  return eventId;
}

/**
 * Get M-Pesa payment statistics
 */
export function getMpesaStats(timeRange?: { start: Date; end: Date }): MpesaStats {
  const allEvents: MpesaPaymentEvent[] = [];

  for (const events of mpesaPaymentStore.values()) {
    allEvents.push(...events);
  }

  let filteredEvents = allEvents;
  if (timeRange) {
    filteredEvents = allEvents.filter(event => {
      const eventTime = new Date(event.timestamp);
      return eventTime >= timeRange.start && eventTime <= timeRange.end;
    });
  }

  const totalPayments = filteredEvents.length;
  const successCount = filteredEvents.filter(e => e.status === "success").length;
  const failureCount = filteredEvents.filter(e => e.status === "failure").length;
  const pendingCount = filteredEvents.filter(e => e.status === "pending").length;
  const timeoutCount = filteredEvents.filter(e => e.status === "timeout").length;

  const successRate = totalPayments > 0 ? (successCount / totalPayments) * 100 : 0;
  const failureRate = totalPayments > 0 ? (failureCount / totalPayments) * 100 : 0;
  const pendingRate = totalPayments > 0 ? (pendingCount / totalPayments) * 100 : 0;
  const timeoutRate = totalPayments > 0 ? (timeoutCount / totalPayments) * 100 : 0;

  // Calculate average and total amounts
  const paymentsWithAmount = filteredEvents.filter(e => e.amount !== undefined);
  const totalAmount = paymentsWithAmount.reduce((sum, e) => sum + (e.amount || 0), 0);
  const averageAmount = paymentsWithAmount.length > 0 ? totalAmount / paymentsWithAmount.length : 0;

  // Group by operation type
  const operationsByType: Record<string, number> = {};
  filteredEvents.forEach(event => {
    operationsByType[event.operation] = (operationsByType[event.operation] || 0) + 1;
  });

  // Group status by operation
  const statusByOperation: Record<string, Record<string, number>> = {};
  filteredEvents.forEach(event => {
    if (!statusByOperation[event.operation]) {
      statusByOperation[event.operation] = {};
    }
    statusByOperation[event.operation][event.status] = (statusByOperation[event.operation][event.status] || 0) + 1;
  });

  // Get recent payments
  const recentPayments = filteredEvents.slice(-20);

  // Get top failure reasons
  const failureReasons = new Map<string, number>();
  filteredEvents
    .filter(e => e.status === "failure" && e.resultDesc)
    .forEach(event => {
      const reason = event.resultDesc || "Unknown";
      failureReasons.set(reason, (failureReasons.get(reason) || 0) + 1);
    });

  const topFailureReasons = Array.from(failureReasons.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Calculate success rate by hour
  const successRateByHour: Array<{ hour: string; rate: number; count: number }> = [];
  const hourlyData = new Map<string, { success: number; total: number }>();

  filteredEvents.forEach(event => {
    const hour = new Date(event.timestamp).toISOString().substring(0, 13); // YYYY-MM-DDTHH
    if (!hourlyData.has(hour)) {
      hourlyData.set(hour, { success: 0, total: 0 });
    }
    const data = hourlyData.get(hour)!;
    data.total++;
    if (event.status === "success") {
      data.success++;
    }
  });

  Array.from(hourlyData.entries()).forEach(([hour, data]) => {
    successRateByHour.push({
      hour,
      rate: data.total > 0 ? (data.success / data.total) * 100 : 0,
      count: data.total,
    });
  });

  successRateByHour.sort((a, b) => a.hour.localeCompare(b.hour));

  return {
    totalPayments,
    successRate,
    failureRate,
    pendingRate,
    timeoutRate,
    averageAmount,
    totalAmount,
    operationsByType,
    statusByOperation,
    recentPayments,
    topFailureReasons,
    successRateByHour,
  };
}

/**
 * Get M-Pesa callback failure statistics
 */
export function getCallbackFailureStats(timeRange?: { start: Date; end: Date }): {
  totalCallbacks: number;
  successfulCallbacks: number;
  failedCallbacks: number;
  failureRate: number;
  commonFailureCodes: Array<{ code: string; count: number; description: string }>;
  averageCallbackLatency: number;
} {
  const callbackEvents = mpesaPaymentStore.get("mpesa_callback") || [];
  
  let filteredEvents = callbackEvents;
  if (timeRange) {
    filteredEvents = callbackEvents.filter(event => {
      const eventTime = new Date(event.timestamp);
      return eventTime >= timeRange.start && eventTime <= timeRange.end;
    });
  }

  const totalCallbacks = filteredEvents.length;
  const successfulCallbacks = filteredEvents.filter(e => e.status === "success").length;
  const failedCallbacks = filteredEvents.filter(e => e.status === "failure").length;
  const failureRate = totalCallbacks > 0 ? (failedCallbacks / totalCallbacks) * 100 : 0;

  // Get common failure codes
  const failureCodes = new Map<string, { count: number; description: string }>();
  filteredEvents
    .filter(e => e.status === "failure" && e.resultCode)
    .forEach(event => {
      const code = event.resultCode || "Unknown";
      const description = event.resultDesc || "No description";
      failureCodes.set(code, {
        count: (failureCodes.get(code)?.count || 0) + 1,
        description,
      });
    });

  const commonFailureCodes = Array.from(failureCodes.entries())
    .map(([code, data]) => ({ code, count: data.count, description: data.description }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Calculate average callback latency
  const eventsWithDuration = filteredEvents.filter(e => e.duration !== undefined);
  const averageCallbackLatency = eventsWithDuration.length > 0
    ? eventsWithDuration.reduce((sum, e) => sum + (e.duration || 0), 0) / eventsWithDuration.length
    : 0;

  return {
    totalCallbacks,
    successfulCallbacks,
    failedCallbacks,
    failureRate,
    commonFailureCodes,
    averageCallbackLatency,
  };
}

/**
 * Create an M-Pesa payment report
 */
export function createMpesaReport(timeRange: { start: Date; end: Date }): {
  summary: string;
  stats: MpesaStats;
  callbackStats: ReturnType<typeof getCallbackFailureStats>;
  recommendations: string[];
} {
  const stats = getMpesaStats(timeRange);
  const callbackStats = getCallbackFailureStats(timeRange);
  const recommendations: string[] = [];

  // Generate recommendations based on stats
  if (stats.successRate < 90) {
    recommendations.push("Low M-Pesa success rate detected: Review Paystack API configuration and network connectivity");
  }

  if (stats.failureRate > 10) {
    recommendations.push("High M-Pesa failure rate: Investigate common failure reasons and implement fixes");
  }

  if (stats.timeoutRate > 5) {
    recommendations.push("High timeout rate: Check Paystack API response times and implement retry logic");
  }

  if (callbackStats.failureRate > 15) {
    recommendations.push("High callback failure rate: Review callback URL configuration and ensure it's publicly accessible");
  }

  if (stats.topFailureReasons.length > 0 && stats.topFailureReasons[0].count > 10) {
    recommendations.push(`Top failure reason: "${stats.topFailureReasons[0].reason}" - Address this issue first`);
  }

  const summary = `M-Pesa Payment Report (${timeRange.start.toISOString()} to ${timeRange.end.toISOString()}): ${stats.totalPayments} payments, ${stats.successRate.toFixed(1)}% success rate`;

  return {
    summary,
    stats,
    callbackStats,
    recommendations,
  };
}

/**
 * Clear old M-Pesa payment events (for memory management)
 */
export function clearOldMpesaEvents(olderThanHours: number = 24): number {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  let cleared = 0;

  for (const [operationKey, events] of mpesaPaymentStore.entries()) {
    const originalLength = events.length;
    const filtered = events.filter(event => new Date(event.timestamp) >= cutoff);
    mpesaPaymentStore.set(operationKey, filtered);
    cleared += originalLength - filtered.length;
  }

  return cleared;
}

/**
 * Track M-Pesa payment initiation with automatic success/failure tracking
 */
export function trackMpesaInitiation(
  phoneNumber: string,
  amount: number,
  merchantRequestId: string,
  checkoutRequestId: string,
  correlationId?: string
): string {
  return trackMpesaPayment("initiate", "pending", {
    phoneNumber,
    amount,
    merchantRequestId,
    checkoutRequestId,
    correlationId,
  });
}

/**
 * Track M-Pesa callback receipt
 */
export function trackMpesaCallback(
  merchantRequestId: string,
  checkoutRequestId: string,
  resultCode: string,
  resultDesc: string,
  duration?: number,
  correlationId?: string
): string {
  const status = resultCode === "0" ? "success" : "failure";
  return trackMpesaPayment("callback", status, {
    merchantRequestId,
    checkoutRequestId,
    resultCode,
    resultDesc,
    duration,
    correlationId,
  });
}

/**
 * Update existing payment event status
 */
export function updateMpesaPaymentStatus(
  eventId: string,
  newStatus: MpesaPaymentEvent["status"],
  additionalMetadata?: Record<string, any>
): boolean {
  for (const events of mpesaPaymentStore.values()) {
    const event = events.find(e => e.id === eventId);
    if (event) {
      event.status = newStatus;
      if (additionalMetadata) {
        event.metadata = { ...event.metadata, ...additionalMetadata };
      }
      return true;
    }
  }
  return false;
}

/**
 * Get payment events by merchant request ID
 */
export function getPaymentEventsByMerchantRequestId(merchantRequestId: string): MpesaPaymentEvent[] {
  const events: MpesaPaymentEvent[] = [];
  
  for (const paymentEvents of mpesaPaymentStore.values()) {
    events.push(...paymentEvents.filter(e => e.merchantRequestId === merchantRequestId));
  }
  
  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Get payment events by checkout request ID
 */
export function getPaymentEventsByCheckoutRequestId(checkoutRequestId: string): MpesaPaymentEvent[] {
  const events: MpesaPaymentEvent[] = [];
  
  for (const paymentEvents of mpesaPaymentStore.values()) {
    events.push(...paymentEvents.filter(e => e.checkoutRequestId === checkoutRequestId));
  }
  
  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}
