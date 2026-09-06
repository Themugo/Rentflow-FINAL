/**
 * _shared/journeyTracking.ts
 *
 * User journey tracking for CALQULUS PMS edge functions.
 *
 * Provides comprehensive user journey tracking including session management,
 * step tracking, conversion funnels, and user behavior analytics.
 *
 * Usage:
 *   import { trackJourneyStep, getJourneyStats, createJourneyReport } from "../_shared/journeyTracking.ts";
 *
 *   trackJourneyStep("payment", "initiate", { userId: "123", amount: 5000 });
 *   const stats = getJourneyStats();
 */

export interface JourneyStep {
  id: string;
  timestamp: string;
  journeyType: string;
  stepName: string;
  userId?: string;
  sessionId?: string;
  success: boolean;
  duration?: number;
  metadata?: Record<string, any>;
  correlationId?: string;
}

export interface JourneyStats {
  totalJourneys: number;
  completedJourneys: number;
  abandonedJourneys: number;
  completionRate: number;
  averageJourneyDuration: number;
  journeysByType: Record<string, number>;
  stepsByType: Record<string, Record<string, number>>;
  recentJourneys: JourneyStep[];
  conversionFunnels: Record<string, Array<{ step: string; count: number; dropoffRate: number }>>;
  averageStepDuration: Record<string, Record<string, number>>;
}

// In-memory journey storage (in production, this would be a database)
const journeyStore = new Map<string, JourneyStep[]>();

/**
 * Generate a unique journey step ID
 */
function generateJourneyStepId(): string {
  return crypto.randomUUID();
}

/**
 * Track a journey step
 */
export function trackJourneyStep(
  journeyType: string,
  stepName: string,
  metadata: {
    userId?: string;
    sessionId?: string;
    success?: boolean;
    duration?: number;
    correlationId?: string;
    [key: string]: any;
  } = {}
): string {
  const stepId = generateJourneyStepId();
  const timestamp = new Date().toISOString();
  const success = metadata.success !== undefined ? metadata.success : true;

  const journeyStep: JourneyStep = {
    id: stepId,
    timestamp,
    journeyType,
    stepName,
    userId: metadata.userId,
    sessionId: metadata.sessionId,
    success,
    duration: metadata.duration,
    correlationId: metadata.correlationId,
    metadata,
  };

  const journeyKey = journeyType;
  if (!journeyStore.has(journeyKey)) {
    journeyStore.set(journeyKey, []);
  }

  const steps = journeyStore.get(journeyKey)!;
  steps.push(journeyStep);

  // Keep only last 1000 steps per journey type
  if (steps.length > 1000) {
    steps.shift();
  }

  // Log failed steps
  if (!success) {
    console.warn(`[JOURNEY_TRACKING] Failed step: ${journeyType} - ${stepName}`, {
      stepId,
      journeyType,
      stepName,
      userId: metadata.userId,
      sessionId: metadata.sessionId,
      correlationId: metadata.correlationId,
    });
  }

  return stepId;
}

/**
 * Get journey statistics
 */
export function getJourneyStats(timeRange?: { start: Date; end: Date }): JourneyStats {
  const allSteps: JourneyStep[] = [];

  for (const steps of journeyStore.values()) {
    allSteps.push(...steps);
  }

  let filteredSteps = allSteps;
  if (timeRange) {
    filteredSteps = allSteps.filter(step => {
      const stepTime = new Date(step.timestamp);
      return stepTime >= timeRange.start && stepTime <= timeRange.end;
    });
  }

  // Group by session to count journeys
  const sessions = new Map<string, { steps: JourneyStep[]; journeyType: string }>();
  filteredSteps.forEach(step => {
    const sessionId = step.sessionId || step.userId || "anonymous";
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, { steps: [], journeyType: step.journeyType });
    }
    sessions.get(sessionId)!.steps.push(step);
  });

  const totalJourneys = sessions.size;
  let completedJourneys = 0;
  let abandonedJourneys = 0;
  let totalJourneyDuration = 0;

  sessions.forEach(({ steps, journeyType }) => {
    const lastStep = steps[steps.length - 1];
    const firstStep = steps[0];
    
    // Define completion based on journey type
    const completionSteps: Record<string, string[]> = {
      payment: ["initiate", "callback", "confirm"],
      tenant_onboarding: ["invite", "signup", "activate"],
      lease_management: ["create", "sign", "activate"],
    };

    const expectedSteps = completionSteps[journeyType] || [];
    const isCompleted = expectedSteps.length > 0 && 
      expectedSteps.every(expectedStep => steps.some(s => s.stepName === expectedStep && s.success));

    if (isCompleted) {
      completedJourneys++;
    } else {
      abandonedJourneys++;
    }

    // Calculate journey duration
    if (firstStep && lastStep) {
      const duration = new Date(lastStep.timestamp).getTime() - new Date(firstStep.timestamp).getTime();
      totalJourneyDuration += duration;
    }
  });

  const completionRate = totalJourneys > 0 ? (completedJourneys / totalJourneys) * 100 : 0;
  const averageJourneyDuration = totalJourneys > 0 ? totalJourneyDuration / totalJourneys : 0;

  // Group by journey type
  const journeysByType: Record<string, number> = {};
  sessions.forEach(({ journeyType }) => {
    journeysByType[journeyType] = (journeysByType[journeyType] || 0) + 1;
  });

  // Group steps by journey type
  const stepsByType: Record<string, Record<string, number>> = {};
  filteredSteps.forEach(step => {
    if (!stepsByType[step.journeyType]) {
      stepsByType[step.journeyType] = {};
    }
    stepsByType[step.journeyType][step.stepName] = (stepsByType[step.journeyType][step.stepName] || 0) + 1;
  });

  // Get recent journeys
  const recentJourneys = filteredSteps.slice(-20);

  // Calculate conversion funnels
  const conversionFunnels: Record<string, Array<{ step: string; count: number; dropoffRate: number }>> = {};
  
  // Define funnel steps for each journey type
  const funnelSteps: Record<string, string[]> = {
    payment: ["initiate", "callback", "confirm"],
    tenant_onboarding: ["invite", "signup", "activate"],
    lease_management: ["create", "sign", "activate"],
  };

  Object.entries(funnelSteps).forEach(([journeyType, steps]) => {
    const funnel: Array<{ step: string; count: number; dropoffRate: number }> = [];
    let previousCount = 0;

    steps.forEach((stepName, index) => {
      const stepCount = filteredSteps.filter(s => 
        s.journeyType === journeyType && s.stepName === stepName && s.success
      ).length;

      const dropoffRate = previousCount > 0 ? ((previousCount - stepCount) / previousCount) * 100 : 0;
      
      funnel.push({
        step: stepName,
        count: stepCount,
        dropoffRate,
      });

      previousCount = stepCount;
    });

    conversionFunnels[journeyType] = funnel;
  });

  // Calculate average step duration
  const averageStepDuration: Record<string, Record<string, number>> = {};
  const stepDurations = new Map<string, { total: number; count: number }>();

  filteredSteps.forEach(step => {
    if (step.duration !== undefined) {
      const key = `${step.journeyType}:${step.stepName}`;
      if (!stepDurations.has(key)) {
        stepDurations.set(key, { total: 0, count: 0 });
      }
      const data = stepDurations.get(key)!;
      data.total += step.duration;
      data.count++;
    }
  });

  stepDurations.forEach((data, key) => {
    const [journeyType, stepName] = key.split(":");
    if (!averageStepDuration[journeyType]) {
      averageStepDuration[journeyType] = {};
    }
    averageStepDuration[journeyType][stepName] = data.total / data.count;
  });

  return {
    totalJourneys,
    completedJourneys,
    abandonedJourneys,
    completionRate,
    averageJourneyDuration,
    journeysByType,
    stepsByType,
    recentJourneys,
    conversionFunnels,
    averageStepDuration,
  };
}

/**
 * Get journey statistics for a specific journey type
 */
export function getJourneyStatsByType(journeyType: string, timeRange?: { start: Date; end: Date }): {
  totalJourneys: number;
  completedJourneys: number;
  abandonedJourneys: number;
  completionRate: number;
  averageJourneyDuration: number;
  steps: Record<string, number>;
  recentSteps: JourneyStep[];
  funnel: Array<{ step: string; count: number; dropoffRate: number }>;
} {
  const journeySteps = journeyStore.get(journeyType) || [];
  
  let filteredSteps = journeySteps;
  if (timeRange) {
    filteredSteps = journeySteps.filter(step => {
      const stepTime = new Date(step.timestamp);
      return stepTime >= timeRange.start && stepTime <= timeRange.end;
    });
  }

  // Group by session
  const sessions = new Map<string, JourneyStep[]>();
  filteredSteps.forEach(step => {
    const sessionId = step.sessionId || step.userId || "anonymous";
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, []);
    }
    sessions.get(sessionId)!.push(step);
  });

  const totalJourneys = sessions.size;
  let completedJourneys = 0;
  let abandonedJourneys = 0;
  let totalJourneyDuration = 0;

  sessions.forEach(steps => {
    const lastStep = steps[steps.length - 1];
    const firstStep = steps[0];
    
    // Define completion steps for this journey type
    const completionSteps: Record<string, string[]> = {
      payment: ["initiate", "callback", "confirm"],
      tenant_onboarding: ["invite", "signup", "activate"],
      lease_management: ["create", "sign", "activate"],
    };

    const expectedSteps = completionSteps[journeyType] || [];
    const isCompleted = expectedSteps.length > 0 && 
      expectedSteps.every(expectedStep => steps.some(s => s.stepName === expectedStep && s.success));

    if (isCompleted) {
      completedJourneys++;
    } else {
      abandonedJourneys++;
    }

    if (firstStep && lastStep) {
      const duration = new Date(lastStep.timestamp).getTime() - new Date(firstStep.timestamp).getTime();
      totalJourneyDuration += duration;
    }
  });

  const completionRate = totalJourneys > 0 ? (completedJourneys / totalJourneys) * 100 : 0;
  const averageJourneyDuration = totalJourneys > 0 ? totalJourneyDuration / totalJourneys : 0;

  // Group by step
  const steps: Record<string, number> = {};
  filteredSteps.forEach(step => {
    steps[step.stepName] = (steps[step.stepName] || 0) + 1;
  });

  // Calculate funnel
  const funnelSteps: Record<string, string[]> = {
    payment: ["initiate", "callback", "confirm"],
    tenant_onboarding: ["invite", "signup", "activate"],
    lease_management: ["create", "sign", "activate"],
  };

  const expectedFunnelSteps = funnelSteps[journeyType] || [];
  const funnel: Array<{ step: string; count: number; dropoffRate: number }> = [];
  let previousCount = 0;

  expectedFunnelSteps.forEach(stepName => {
    const stepCount = filteredSteps.filter(s => s.stepName === stepName && s.success).length;
    const dropoffRate = previousCount > 0 ? ((previousCount - stepCount) / previousCount) * 100 : 0;
    
    funnel.push({
      step: stepName,
      count: stepCount,
      dropoffRate,
    });

    previousCount = stepCount;
  });

  return {
    totalJourneys,
    completedJourneys,
    abandonedJourneys,
    completionRate,
    averageJourneyDuration,
    steps,
    recentSteps: filteredSteps.slice(-10),
    funnel,
  };
}

/**
 * Create a journey tracking report
 */
export function createJourneyReport(timeRange: { start: Date; end: Date }): {
  summary: string;
  stats: JourneyStats;
  journeyTypeStats: Record<string, ReturnType<typeof getJourneyStatsByType>>;
  recommendations: string[];
} {
  const stats = getJourneyStats(timeRange);
  const journeyTypeStats: Record<string, ReturnType<typeof getJourneyStatsByType>> = {};
  const recommendations: string[] = [];

  // Get stats for each journey type
  for (const journeyType of journeyStore.keys()) {
    journeyTypeStats[journeyType] = getJourneyStatsByType(journeyType, timeRange);
  }

  // Generate recommendations
  if (stats.completionRate < 70) {
    recommendations.push("Low journey completion rate: Review funnel steps and identify dropoff points");
  }

  if (stats.averageJourneyDuration > 300000) { // > 5 minutes
    recommendations.push("Long average journey duration: Optimize user experience and reduce friction");
  }

  // Journey-specific recommendations
  if (journeyTypeStats["payment"]) {
    const paymentStats = journeyTypeStats["payment"];
    if (paymentStats.completionRate < 80) {
      recommendations.push("Payment journey completion rate is low: Review payment flow and reduce friction");
    }
    
    const initiateStep = paymentStats.funnel.find(f => f.step === "initiate");
    const callbackStep = paymentStats.funnel.find(f => f.step === "callback");
    if (initiateStep && callbackStep && callbackStep.dropoffRate > 30) {
      recommendations.push("High dropoff from initiate to callback: Review M-Pesa integration and callback handling");
    }
  }

  if (journeyTypeStats["tenant_onboarding"]) {
    const onboardingStats = journeyTypeStats["tenant_onboarding"];
    if (onboardingStats.completionRate < 60) {
      recommendations.push("Tenant onboarding completion rate is low: Simplify signup process and improve activation flow");
    }
  }

  const summary = `Journey Tracking Report (${timeRange.start.toISOString()} to ${timeRange.end.toISOString()}): ${stats.totalJourneys} journeys, ${stats.completionRate.toFixed(1)}% completion rate`;

  return {
    summary,
    stats,
    journeyTypeStats,
    recommendations,
  };
}

/**
 * Clear old journey steps (for memory management)
 */
export function clearOldJourneySteps(olderThanHours: number = 24): number {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  let cleared = 0;

  for (const [journeyType, steps] of journeyStore.entries()) {
    const originalLength = steps.length;
    const filtered = steps.filter(step => new Date(step.timestamp) >= cutoff);
    journeyStore.set(journeyType, filtered);
    cleared += originalLength - filtered.length;
  }

  return cleared;
}

/**
 * Track a complete user journey with automatic step tracking
 */
export function trackJourney(
  journeyType: string,
  steps: Array<{ name: string; duration?: number; success?: boolean; metadata?: Record<string, any> }>,
  userId?: string,
  sessionId?: string
): string {
  const correlationId = crypto.randomUUID();
  
  steps.forEach((step, index) => {
    trackJourneyStep(journeyType, step.name, {
      userId,
      sessionId,
      success: step.success,
      duration: step.duration,
      correlationId,
      ...step.metadata,
    });
  });

  return correlationId;
}

/**
 * Get user journey history
 */
export function getUserJourneyHistory(userId: string, timeRange?: { start: Date; end: Date }): JourneyStep[] {
  const allSteps: JourneyStep[] = [];

  for (const steps of journeyStore.values()) {
    allSteps.push(...steps.filter(s => s.userId === userId));
  }

  if (!timeRange) {
    return allSteps.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  return allSteps
    .filter(step => {
      const stepTime = new Date(step.timestamp);
      return stepTime >= timeRange.start && stepTime <= timeRange.end;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Get session journey history
 */
export function getSessionJourneyHistory(sessionId: string, timeRange?: { start: Date; end: Date }): JourneyStep[] {
  const allSteps: JourneyStep[] = [];

  for (const steps of journeyStore.values()) {
    allSteps.push(...steps.filter(s => s.sessionId === sessionId));
  }

  if (!timeRange) {
    return allSteps.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  return allSteps
    .filter(step => {
      const stepTime = new Date(step.timestamp);
      return stepTime >= timeRange.start && stepTime <= timeRange.end;
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Get journey dropoff analysis
 */
export function getJourneyDropoffAnalysis(journeyType: string): Array<{
  step: string;
  count: number;
  dropoffCount: number;
  dropoffRate: number;
  commonDropoffReasons: Array<{ reason: string; count: number }>;
}> {
  const journeySteps = journeyStore.get(journeyType) || [];
  
  // Define funnel steps
  const funnelSteps: Record<string, string[]> = {
    payment: ["initiate", "callback", "confirm"],
    tenant_onboarding: ["invite", "signup", "activate"],
    lease_management: ["create", "sign", "activate"],
  };

  const expectedSteps = funnelSteps[journeyType] || [];
  const dropoffAnalysis: Array<{
    step: string;
    count: number;
    dropoffCount: number;
    dropoffRate: number;
    commonDropoffReasons: Array<{ reason: string; count: number }>;
  }> = [];

  let previousCount = 0;

  expectedSteps.forEach((stepName, index) => {
    const stepCount = journeySteps.filter(s => s.stepName === stepName).length;
    const dropoffCount = previousCount - stepCount;
    const dropoffRate = previousCount > 0 ? (dropoffCount / previousCount) * 100 : 0;

    // Get common dropoff reasons
    const failedSteps = journeySteps.filter(s => s.stepName === stepName && !s.success);
    const reasonCounts = new Map<string, number>();
    
    failedSteps.forEach(step => {
      const reason = step.metadata?.error || step.metadata?.failureReason || "Unknown";
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    });

    const commonDropoffReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    dropoffAnalysis.push({
      step: stepName,
      count: stepCount,
      dropoffCount,
      dropoffRate,
      commonDropoffReasons,
    });

    previousCount = stepCount;
  });

  return dropoffAnalysis;
}
