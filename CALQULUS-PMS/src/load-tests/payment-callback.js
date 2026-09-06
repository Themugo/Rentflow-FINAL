/**
 * Load Test - Payment Callback Endpoints
 * 
 * Tests the performance and reliability of payment callback endpoints:
 * - M-Pesa STK push callback
 * - Stripe webhook handling
 * - Bank transfer notification
 * - Concurrent callback processing
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
    http_req_duration: ['p(95)<500'],  // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.05'],    // Error rate must be below 5%
    errors: ['rate<0.05'],             // Custom error rate below 5%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5173';

// Test data
const mpesaCallback = {
  Body: {
    stkCallback: {
      MerchantRequestID: 'test-merchant-request',
      CheckoutRequestID: 'test-checkout-request',
      ResultCode: 0,
      ResultDesc: 'The service request is processed successfully',
      CallbackMetadata: {
        Item: [
          { Name: 'Amount', Value: 10000 },
          { Name: 'MpesaReceiptNumber', Value: 'QWE123456' },
          { Name: 'TransactionDate', Value: '20240102120000' },
          { Name: 'PhoneNumber', Value: '+254700000000' },
        ],
      },
    },
  },
};

const stripeWebhook = {
  id: 'evt_test_webhook_id',
  object: 'event',
  api_version: '2023-10-16',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: 'pi_test_payment_intent',
      object: 'payment_intent',
      amount: 10000,
      currency: 'kes',
      status: 'succeeded',
    },
  },
  type: 'payment_intent.succeeded',
};

const bankNotification = {
  transaction_id: 'BANK123456',
  account_number: '****1234',
  amount: 10000,
  transaction_date: '2024-01-02T12:00:00Z',
  reference: 'RENT-PAYMENT',
  status: 'completed',
};

export default function () {
  // Test M-Pesa callback endpoint
  const mpesaResponse = http.post(
    `${BASE_URL}/api/payments/mpesa/callback`,
    JSON.stringify(mpesaCallback),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const mpesaSuccess = check(mpesaResponse, {
    'M-Pesa callback status is 200': (r) => r.status === 200,
    'M-Pesa callback response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!mpesaSuccess);

  // Test Stripe webhook endpoint
  const stripeResponse = http.post(
    `${BASE_URL}/api/payments/stripe/webhook`,
    JSON.stringify(stripeWebhook),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const stripeSuccess = check(stripeResponse, {
    'Stripe webhook status is 200': (r) => r.status === 200,
    'Stripe webhook response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!stripeSuccess);

  // Test bank notification endpoint
  const bankResponse = http.post(
    `${BASE_URL}/api/payments/bank/notification`,
    JSON.stringify(bankNotification),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const bankSuccess = check(bankResponse, {
    'Bank notification status is 200': (r) => r.status === 200,
    'Bank notification response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!bankSuccess);

  sleep(1); // Pause between iterations
}

export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data),
  };
}
