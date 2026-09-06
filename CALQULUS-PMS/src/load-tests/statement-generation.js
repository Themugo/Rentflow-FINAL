/**
 * Load Test - Statement Generation Endpoints
 * 
 * Tests the performance and reliability of statement generation:
 * - Property statement generation
 * - Tenant statement generation
 * - Bulk statement generation
 * - PDF generation performance
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 5 },    // Ramp up to 5 users
    { duration: '1m', target: 20 },   // Ramp up to 20 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s (PDF generation is slower)
    http_req_failed: ['rate<0.05'],    // Error rate must be below 5%
    errors: ['rate<0.05'],             // Custom error rate below 5%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5173';

// Test data
const testPropertyId = 'test-property-id';
const testTenantId = 'test-tenant-id';
const testStartDate = '2024-01-01';
const testEndDate = '2024-01-31';

export default function () {
  // Test property statement generation
  const propertyStatementResponse = http.get(
    `${BASE_URL}/api/statements/property/${testPropertyId}?start_date=${testStartDate}&end_date=${testEndDate}&format=pdf`,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const propertyStatementSuccess = check(propertyStatementResponse, {
    'Property statement status is 200': (r) => r.status === 200,
    'Property statement response time < 2s': (r) => r.timings.duration < 2000,
    'Property statement has content-type': (r) => r.headers['Content-Type'] && r.headers['Content-Type'].includes('application/pdf'),
  });

  errorRate.add(!propertyStatementSuccess);

  // Test tenant statement generation
  const tenantStatementResponse = http.get(
    `${BASE_URL}/api/statements/tenant/${testTenantId}?start_date=${testStartDate}&end_date=${testEndDate}&format=pdf`,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const tenantStatementSuccess = check(tenantStatementResponse, {
    'Tenant statement status is 200': (r) => r.status === 200,
    'Tenant statement response time < 2s': (r) => r.timings.duration < 2000,
    'Tenant statement has content-type': (r) => r.headers['Content-Type'] && r.headers['Content-Type'].includes('application/pdf'),
  });

  errorRate.add(!tenantStatementSuccess);

  // Test bulk statement generation
  const bulkStatementResponse = http.post(
    `${BASE_URL}/api/statements/bulk`,
    JSON.stringify({
      property_ids: [testPropertyId],
      start_date: testStartDate,
      end_date: testEndDate,
      format: 'pdf',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const bulkStatementSuccess = check(bulkStatementResponse, {
    'Bulk statement status is 200': (r) => r.status === 200,
    'Bulk statement response time < 5s': (r) => r.timings.duration < 5000,
  });

  errorRate.add(!bulkStatementSuccess);

  sleep(2); // Pause between iterations (longer for PDF generation)
}

export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data),
  };
}
