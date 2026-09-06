# Test Suite Documentation

This document provides an overview of the comprehensive test suite for CALQULUS RMS.

## Test Structure

```
src/test/
├── integration/           # Integration tests for business workflows
├── api-contracts/        # API contract tests for edge functions
├── regression/           # Regression test suites for critical paths
├── property-based/       # Property-based tests using fast-check
├── benchmarks/          # Performance benchmarks
├── edge-cases/          # Edge-case validation tests
├── financial-integrity/ # Financial integrity tests
├── isolation/           # Multi-tenant isolation tests
├── *.test.ts           # Unit tests
└── setup.ts            # Test setup and utilities
```

## Test Categories

### 1. Unit Tests (`*.test.ts`)
Basic unit tests for individual functions and components.
- **Run**: `npm test`

### 2. Integration Tests (`integration/`)
Tests complete business workflows end-to-end:
- **Lease Workflow** (`lease-workflow.test.ts`): Lease creation, activation, renewal, termination
- **Tenant Invitation Workflow** (`tenant-invitation-workflow.test.ts`): Invitation creation, acceptance, notification
- **Run**: `npm run test:integration`

### 3. API Contract Tests (`api-contracts/`)
Tests for edge function API contracts:
- **M-Pesa API** (`mpesa-api-contracts.test.ts`): STK push, callbacks, validation
- **Tenant Invitation API** (`tenant-invitation-api-contracts.test.ts`): Invitation endpoints, notifications
- **Run**: `npm run test:api-contracts`

### 4. Regression Test Suites (`regression/`)
Comprehensive regression tests ensuring no breaking changes:
- **Authentication** (`auth-regression.test.ts`): Login, session, RBAC, permissions
- **Payments** (`payment-regression.test.ts`): Invoice, payments, allocation, refunds
- **Run**: `npm run test:regression`

### 5. Property-Based Tests (`property-based/`)
Uses fast-check to test function invariants with generated inputs:
- **Financial Calculations** (`financial-calculations.property.test.ts`): Balance, allocation, fees
- **Run**: `npm run test:property-based`

### 6. Performance Benchmarks (`benchmarks/`)
Benchmarks for critical operations:
- **Performance Benchmarks** (`performance-benchmarks.test.ts`): Query speed, calculation speed
- **Run**: `npm run test:benchmarks`

### 7. Edge-Case Validation (`edge-cases/`)
Tests for boundary conditions and error scenarios:
- **Validation Edge Cases** (`validation-edge-cases.test.ts`): Phone, email, amounts, UUIDs
- **Run**: `npm run test:edge-cases`

### 8. Financial Integrity (`financial-integrity/`)
Tests for financial transaction integrity:
- Double-entry validation
- Duplicate prevention
- Reconciliation
- Rollback handling
- **Run**: `npm run test:financial`

### 9. Multi-Tenant Isolation (`isolation/`)
Tests for tenant data separation:
- Tenant separation
- Agency isolation
- Landlord access control
- **Run**: `npm run test:isolation`

## Running Tests

### Run All Tests
```bash
npm run test:all
```

### Run Critical Tests (Fast)
```bash
npm run test:critical
```

### Run Specific Category
```bash
npm run test:integration    # Integration tests
npm run test:regression     # Regression tests
npm run test:edge-cases     # Edge-case tests
npm run test:property-based # Property-based tests
npm run test:benchmarks     # Performance benchmarks
```

### Run with Watch Mode
```bash
npm run test:watch          # Watch all
npm run test:watch src/test/integration  # Watch integration
```

### Run E2E Tests
```bash
npm run test:e2e            # All browsers
npm run test:e2e:ci         # CI mode (Chromium only)
npm run test:e2e:headed     # Headed mode
```

## Test Coverage Goals

| Category | Target Coverage | Priority |
|----------|----------------|----------|
| Authentication | 90% | Critical |
| Payments | 95% | Critical |
| Leasing | 85% | High |
| Tenant Management | 80% | High |
| API Contracts | 80% | High |
| Edge Cases | 100% | High |

## Performance Targets

| Operation | Target | Maximum |
|-----------|--------|---------|
| Balance calculation | 100,000 ops/sec | 0.01ms |
| Payment allocation (100) | 10,000 ops/sec | 0.1ms |
| Invoice report (100) | 1,000 ops/sec | 1ms |
| Search (1000 items) | 100 ops/sec | 10ms |

## Best Practices

1. **Test Isolation**: Each test should be independent and not rely on state from other tests
2. **Descriptive Names**: Test names should clearly describe what they test
3. **Single Responsibility**: Each test should verify one behavior
4. **Fast Execution**: Unit tests should run in milliseconds
5. **Real Data**: Use realistic test data that matches production scenarios
6. **Edge Cases**: Always test boundary conditions and error scenarios
7. **Performance**: Include performance benchmarks for critical operations

## Continuous Integration

Tests run automatically on:
- Every pull request
- Every push to main branch
- Nightly full test suite

## Debugging Failed Tests

1. Check the test output for the specific failure
2. Use `npm run test:watch` to run tests in watch mode
3. Add `console.log` statements to debug
4. Run only the failing test with focused patterns

```bash
# Run specific test file
npm test -- src/test/integration/lease-workflow.test.ts

# Run tests matching pattern
npm test -- --grep "should calculate"

# Run with verbose output
npm test -- --reporter=verbose
```
