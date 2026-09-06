/**
 * Load Test - Messaging Endpoints
 * 
 * Tests the performance and reliability of messaging endpoints:
 * - SMS sending (Twilio)
 * - Email sending (Resend)
 * - WhatsApp messaging
 * - Bulk notification sending
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '2m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 0 },     // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests must complete below 1s
    http_req_failed: ['rate<0.05'],    // Error rate must be below 5%
    errors: ['rate<0.05'],             // Custom error rate below 5%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5173';

// Test data
const smsPayload = {
  to: '+254700000000',
  message: 'Test SMS message for load testing',
};

const emailPayload = {
  to: 'test@example.com',
  subject: 'Test Email for Load Testing',
  html: '<h1>Test Email</h1><p>This is a test email for load testing.</p>',
};

const whatsappPayload = {
  to: '+254700000000',
  message: 'Test WhatsApp message for load testing',
};

const bulkNotificationPayload = {
  recipients: [
    { type: 'sms', to: '+254700000001', message: 'Test SMS 1' },
    { type: 'email', to: 'test1@example.com', subject: 'Test Email 1', html: '<p>Test</p>' },
    { type: 'sms', to: '+254700000002', message: 'Test SMS 2' },
  ],
};

export default function () {
  // Test SMS sending
  const smsResponse = http.post(
    `${BASE_URL}/api/messaging/sms`,
    JSON.stringify(smsPayload),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const smsSuccess = check(smsResponse, {
    'SMS status is 200': (r) => r.status === 200,
    'SMS response time < 1s': (r) => r.timings.duration < 1000,
  });

  errorRate.add(!smsSuccess);

  // Test email sending
  const emailResponse = http.post(
    `${BASE_URL}/api/messaging/email`,
    JSON.stringify(emailPayload),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const emailSuccess = check(emailResponse, {
    'Email status is 200': (r) => r.status === 200,
    'Email response time < 1s': (r) => r.timings.duration < 1000,
  });

  errorRate.add(!emailSuccess);

  // Test WhatsApp messaging
  const whatsappResponse = http.post(
    `${BASE_URL}/api/messaging/whatsapp`,
    JSON.stringify(whatsappPayload),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const whatsappSuccess = check(whatsappResponse, {
    'WhatsApp status is 200': (r) => r.status === 200,
    'WhatsApp response time < 1s': (r) => r.timings.duration < 1000,
  });

  errorRate.add(!whatsappSuccess);

  // Test bulk notification sending
  const bulkResponse = http.post(
    `${BASE_URL}/api/messaging/bulk`,
    JSON.stringify(bulkNotificationPayload),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const bulkSuccess = check(bulkResponse, {
    'Bulk notification status is 200': (r) => r.status === 200,
    'Bulk notification response time < 2s': (r) => r.timings.duration < 2000,
  });

  errorRate.add(!bulkSuccess);

  sleep(1); // Pause between iterations
}

export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data),
  };
}
