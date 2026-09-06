/**
 * Performance Benchmarks
 * 
 * Benchmarks for critical operations:
 * - Database query performance
 * - Payment processing
 * - Statement generation
 * - Data aggregation
 * 
 * Run with: npm test -- src/test/benchmarks/performance-benchmarks.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { generateUUID } from "../setup";

// ── Benchmark Utilities ────────────────────────────────────────────────────────

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalMs: number;
  averageMs: number;
  minMs: number;
  maxMs: number;
  opsPerSecond: number;
}

function benchmark<T>(
  name: string,
  fn: () => T,
  iterations = 1000,
  warmupIterations = 100
): BenchmarkResult & { result: T } {
  // Warmup
  for (let i = 0; i < warmupIterations; i++) {
    fn();
  }

  const times: number[] = [];
  let result: T;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    result = fn();
    const end = performance.now();
    times.push(end - start);
  }

  const totalMs = times.reduce((a, b) => a + b, 0);
  const averageMs = totalMs / iterations;
  const minMs = Math.min(...times);
  const maxMs = Math.max(...times);
  const opsPerSecond = 1000 / averageMs;

  return {
    name,
    iterations,
    totalMs,
    averageMs,
    minMs,
    maxMs,
    opsPerSecond,
    result: result!,
  };
}

function logBenchmark(result: BenchmarkResult) {
  console.warn(`\n📊 ${result.name}`);
  console.warn(`   Iterations: ${result.iterations}`);
  console.warn(`   Total: ${result.totalMs.toFixed(2)}ms`);
  console.warn(`   Average: ${result.averageMs.toFixed(4)}ms`);
  console.warn(`   Min: ${result.minMs.toFixed(4)}ms`);
  console.warn(`   Max: ${result.maxMs.toFixed(4)}ms`);
  console.warn(`   Ops/sec: ${result.opsPerSecond.toFixed(2)}`);
}

// ── Test Data Generators ──────────────────────────────────────────────────────

function generateLargeInvoiceList(count: number): Array<{
  id: string;
  amount: number;
  paid_amount: number;
  due_date: string;
}> {
  return Array.from({ length: count }, (_, i) => ({
    id: generateUUID(),
    amount: 15000 + (i % 10) * 1000,
    paid_amount: Math.floor(Math.random() * 15000),
    due_date: new Date(Date.now() + (i - 30) * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

function generateLargePaymentList(count: number): Array<{
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
}> {
  return Array.from({ length: count }, (_, i) => ({
    id: generateUUID(),
    invoice_id: generateUUID(),
    amount: 10000 + (i % 20) * 500,
    payment_date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

// ── Operations Under Test ──────────────────────────────────────────────────────

function calculateBalanceDue(invoice: { amount: number; paid_amount: number }): number {
  return Math.max(0, invoice.amount - invoice.paid_amount);
}

function allocatePayment(
  invoices: Array<{ id: string; balance_due: number }>,
  paymentAmount: number
): { applied: number; remaining: number } {
  let remaining = paymentAmount;
  let applied = 0;
  
  for (const invoice of invoices) {
    if (remaining <= 0) break;
    const allocation = Math.min(remaining, invoice.balance_due);
    remaining -= allocation;
    applied += allocation;
  }
  
  return { applied, remaining };
}

function aggregatePaymentsByMonth(
  payments: Array<{ amount: number; payment_date: string }>
): Record<string, number> {
  const aggregated: Record<string, number> = {};
  
  for (const payment of payments) {
    const month = payment.payment_date.substring(0, 7); // YYYY-MM
    aggregated[month] = (aggregated[month] || 0) + payment.amount;
  }
  
  return aggregated;
}

function calculateOccupancyRate(
  units: Array<{ status: "occupied" | "vacant" | "maintenance" }>
): number {
  if (units.length === 0) return 0;
  const occupied = units.filter(u => u.status === "occupied").length;
  return (occupied / units.length) * 100;
}

function searchTenants(
  tenants: Array<{ full_name: string; email: string; phone: string }>,
  query: string
): Array<{ full_name: string; email: string }> {
  const lowerQuery = query.toLowerCase();
  return tenants
    .filter(t => 
      t.full_name.toLowerCase().includes(lowerQuery) ||
      t.email.toLowerCase().includes(lowerQuery) ||
      t.phone.includes(query)
    )
    .map(t => ({ full_name: t.full_name, email: t.email }));
}

function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function generateInvoiceReport(
  invoices: Array<{
    id: string;
    amount: number;
    status: string;
    due_date: string;
  }>
): { total: number; pending: number; paid: number; overdue: number } {
  let total = 0;
  let pending = 0;
  let paid = 0;
  let overdue = 0;
  const today = new Date().getTime();

  for (const invoice of invoices) {
    total += invoice.amount;
    
    if (invoice.status === "paid") {
      paid += invoice.amount;
    } else if (invoice.status === "pending") {
      pending += invoice.amount;
    } else if (invoice.status === "overdue" || new Date(invoice.due_date).getTime() < today) {
      overdue += invoice.amount;
    }
  }

  return { total, pending, paid, overdue };
}

function calculateRevenueByProperty(
  payments: Array<{ property_id: string; amount: number }>
): Record<string, number> {
  const revenue: Record<string, number> = {};
  
  for (const payment of payments) {
    revenue[payment.property_id] = (revenue[payment.property_id] || 0) + payment.amount;
  }
  
  return revenue;
}

function findDuplicateTransactions(
  transactions: Array<{ transaction_id: string; amount: number }>
): Array<{ transaction_id: string; count: number }> {
  const counts: Record<string, number> = {};
  
  for (const tx of transactions) {
    counts[tx.transaction_id] = (counts[tx.transaction_id] || 0) + 1;
  }
  
  return Object.entries(counts)
    .filter(([_, count]) => count > 1)
    .map(([transaction_id, count]) => ({ transaction_id, count }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Performance Benchmarks", () => {
  
  describe("Financial Calculations", () => {
    it("should benchmark balance due calculation", () => {
      const result = benchmark(
        "Balance Due Calculation",
        () => calculateBalanceDue({ amount: 25000, paid_amount: 10000 }),
        10000
      );
      
      logBenchmark(result);
      
      // Balance calculation should be very fast
      expect(result.averageMs).toBeLessThan(0.01);
    });

    it("should benchmark payment allocation for 100 invoices", () => {
      const invoices = generateLargeInvoiceList(100).map(inv => ({
        ...inv,
        balance_due: calculateBalanceDue(inv),
      }));
      
      const result = benchmark(
        "Payment Allocation (100 invoices)",
        () => allocatePayment(invoices, 50000),
        1000
      );
      
      logBenchmark(result);
      
      expect(result.averageMs).toBeLessThan(1);
    });

    it("should benchmark payment allocation for 1000 invoices", () => {
      const invoices = generateLargeInvoiceList(1000).map(inv => ({
        ...inv,
        balance_due: calculateBalanceDue(inv),
      }));
      
      const result = benchmark(
        "Payment Allocation (1000 invoices)",
        () => allocatePayment(invoices, 500000),
        100
      );
      
      logBenchmark(result);
      
      expect(result.averageMs).toBeLessThan(10);
    });
  });

  describe("Aggregation Operations", () => {
    it("should benchmark payment aggregation by month (100 payments)", () => {
      const payments = generateLargePaymentList(100);
      
      const result = benchmark(
        "Payment Aggregation by Month (100)",
        () => aggregatePaymentsByMonth(payments),
        1000
      );
      
      logBenchmark(result);
      expect(result.averageMs).toBeLessThan(1);
    });

    it("should benchmark payment aggregation by month (1000 payments)", () => {
      const payments = generateLargePaymentList(1000);
      
      const result = benchmark(
        "Payment Aggregation by Month (1000)",
        () => aggregatePaymentsByMonth(payments),
        100
      );
      
      logBenchmark(result);
      expect(result.averageMs).toBeLessThan(10);
    });

    it("should benchmark occupancy rate calculation (100 units)", () => {
      const units = Array.from({ length: 100 }, (_, i) => ({
        status: i % 4 === 0 ? "vacant" : "occupied" as const,
      }));
      
      const result = benchmark(
        "Occupancy Rate (100 units)",
        () => calculateOccupancyRate(units),
        10000
      );
      
      logBenchmark(result);
      expect(result.averageMs).toBeLessThan(0.1);
    });

    it("should benchmark revenue by property calculation", () => {
      const payments = Array.from({ length: 500 }, (_, i) => ({
        property_id: `prop-${i % 20}`,
        amount: 10000 + Math.random() * 10000,
      }));
      
      const result = benchmark(
        "Revenue by Property (500 payments, 20 properties)",
        () => calculateRevenueByProperty(payments),
        100
      );
      
      logBenchmark(result);
      expect(result.averageMs).toBeLessThan(5);
    });
  });

  describe("Search Operations", () => {
    it("should benchmark tenant search (100 tenants)", () => {
      const tenants = Array.from({ length: 100 }, (_, i) => ({
        full_name: `Tenant ${i}`,
        email: `tenant${i}@example.com`,
        phone: `2547${String(i).padStart(7, "0")}`,
      }));
      
      const result = benchmark(
        "Tenant Search (100 tenants, 'Tenant')",
        () => searchTenants(tenants, "Tenant"),
        1000
      );
      
      logBenchmark(result);
      expect(result.averageMs).toBeLessThan(5);
    });

    it("should benchmark tenant search (1000 tenants)", () => {
      const tenants = Array.from({ length: 1000 }, (_, i) => ({
        full_name: `Tenant ${i}`,
        email: `tenant${i}@example.com`,
        phone: `2547${String(i).padStart(7, "0")}`,
      }));
      
      const result = benchmark(
        "Tenant Search (1000 tenants, 'Tenant')",
        () => searchTenants(tenants, "Tenant"),
        100
      );
      
      logBenchmark(result);
      expect(result.averageMs).toBeLessThan(50);
    });
  });

  describe("Pagination", () => {
    it("should benchmark pagination (1000 items, page 1)", () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
      
      const result = benchmark(
        "Pagination (1000 items, page 1, 20/page)",
        () => paginate(items, 1, 20),
        10000
      );
      
      logBenchmark(result);
      expect(result.averageMs).toBeLessThan(0.1);
    });

    it("should benchmark pagination (10000 items, page 50)", () => {
      const items = Array.from({ length: 10000 }, (_, i) => ({ id: i }));
      
      const result = benchmark(
        "Pagination (10000 items, page 50, 20/page)",
        () => paginate(items, 50, 20),
        1000
      );
      
      logBenchmark(result);
      expect(result.averageMs).toBeLessThan(1);
    });
  });

  describe("Report Generation", () => {
    it("should benchmark invoice report (100 invoices)", () => {
      const invoices = Array.from({ length: 100 }, (_, i) => ({
        id: generateUUID(),
        amount: 10000 + Math.random() * 20000,
        status: ["pending", "paid", "overdue"][i % 3],
        due_date: new Date(Date.now() + (i - 30) * 24 * 60 * 60 * 1000).toISOString(),
      }));
      
      const result = benchmark(
        "Invoice Report Generation (100 invoices)",
        () => generateInvoiceReport(invoices),
        1000
      );
      
      logBenchmark(result);
      expect(result.averageMs).toBeLessThan(5);
    });

    it("should benchmark invoice report (1000 invoices)", () => {
      const invoices = Array.from({ length: 1000 }, (_, i) => ({
        id: generateUUID(),
        amount: 10000 + Math.random() * 20000,
        status: ["pending", "paid", "overdue"][i % 3],
        due_date: new Date(Date.now() + (i - 30) * 24 * 60 * 60 * 1000).toISOString(),
      }));
      
      const result = benchmark(
        "Invoice Report Generation (1000 invoices)",
        () => generateInvoiceReport(invoices),
        100
      );
      
      logBenchmark(result);
      expect(result.averageMs).toBeLessThan(50);
    });
  });

  describe("Duplicate Detection", () => {
    it("should benchmark duplicate transaction detection (100 transactions)", () => {
      const transactions = Array.from({ length: 100 }, (_, i) => ({
        transaction_id: `TXN-${i % 50}`, // 50 unique, 100 total
        amount: 10000,
      }));
      
      const result = benchmark(
        "Duplicate Detection (100 transactions)",
        () => findDuplicateTransactions(transactions),
        1000
      );
      
      logBenchmark(result);
      expect(result.averageMs).toBeLessThan(5);
    });

    it("should benchmark duplicate transaction detection (1000 transactions)", () => {
      const transactions = Array.from({ length: 1000 }, (_, i) => ({
        transaction_id: `TXN-${i % 200}`, // 200 unique, 1000 total
        amount: 10000,
      }));
      
      const result = benchmark(
        "Duplicate Detection (1000 transactions)",
        () => findDuplicateTransactions(transactions),
        100
      );
      
      logBenchmark(result);
      expect(result.averageMs).toBeLessThan(50);
    });
  });

  describe("Performance Targets", () => {
    it("should meet 1000 ops/sec for simple calculations", () => {
      const result = benchmark(
        "Simple Balance Calculation",
        () => calculateBalanceDue({ amount: 25000, paid_amount: 10000 }),
        1000
      );
      
      expect(result.opsPerSecond).toBeGreaterThan(100000);
    });

    it("should meet 100 ops/sec for invoice report generation", () => {
      const invoices = Array.from({ length: 100 }, (_, i) => ({
        id: generateUUID(),
        amount: 10000,
        status: "pending",
        due_date: new Date().toISOString(),
      }));
      
      const result = benchmark(
        "Invoice Report (100)",
        () => generateInvoiceReport(invoices),
        100
      );
      
      expect(result.opsPerSecond).toBeGreaterThan(100);
    });
  });
});

// ── Summary Report ─────────────────────────────────────────────────────────────

describe("Benchmark Summary", () => {
  it("should generate comprehensive benchmark summary", () => {
    console.warn("\n" + "=".repeat(60));
    console.warn("PERFORMANCE BENCHMARK SUMMARY");
    console.warn("=".repeat(60));
    
    // Quick benchmarks
    const quickCalc = benchmark("Quick Balance Calculation", 
      () => calculateBalanceDue({ amount: 25000, paid_amount: 10000 }), 1000);
    console.warn(`\n✅ Balance Calculation: ${quickCalc.opsPerSecond.toFixed(0)} ops/sec`);
    
    const search100 = benchmark("Search 100 items",
      () => searchTenants(Array.from({ length: 100 }, (_, i) => ({
        full_name: `Tenant ${i}`, email: `t${i}@e.com`, phone: "254700000000"
      })), "Tenant"), 1000);
    console.warn(`✅ Search 100 items: ${search100.averageMs.toFixed(4)}ms avg`);
    
    const pagination = benchmark("Paginate 1000 items",
      () => paginate(Array.from({ length: 1000 }, (_, i) => i), 10, 20), 1000);
    console.warn(`✅ Pagination 1000 items: ${pagination.averageMs.toFixed(4)}ms avg`);
    
    console.warn("\n" + "=".repeat(60));
    
    expect(true).toBe(true); // Always pass - this is informational
  });
});
