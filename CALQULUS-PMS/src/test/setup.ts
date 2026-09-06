import "@testing-library/jest-dom/vitest";
import { vi } from 'vitest';

// Embla-based carousels (ui/carousel) initialize ResizeObserver at mount;
// jsdom does not ship one. Minimal no-op polyfill keeps carousel renders stable.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: ResizeObserverMock,
    configurable: true,
  });
}

// jsdom does not implement matchMedia; embla resolves media-option queries.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
    configurable: true,
  });
}

// jsdom does not implement IntersectionObserver; embla uses it for
// in-view slide detection.
if (typeof globalThis.IntersectionObserver === "undefined") {
  class IntersectionObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  }
  Object.defineProperty(globalThis, "IntersectionObserver", {
    value: IntersectionObserverMock,
    configurable: true,
  });
}

// Node 26 exposes an experimental `localStorage` global that is undefined
// unless --localstorage-file is provided, shadowing jsdom's window.localStorage.
// Provide a stable in-memory polyfill so bare `localStorage` references in
// shared libs (e.g. dateFormat preferences) work under the jsdom environment.
if (typeof globalThis.localStorage === 'undefined' || globalThis.localStorage === null) {
  const store = new Map<string, string>();
  const localStorageMock: Storage = {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => void store.delete(key),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true });
}

// Mock Supabase client for unit tests
const mockAdminDeleteUser = vi.fn().mockResolvedValue({ error: null });
let userCounter = 0;
const mockAdminCreateUser = vi.fn().mockResolvedValue(() => ({
  data: { user: { id: `test-user-${++userCounter}` } },
  error: null,
}));
const mockSignUp = vi.fn().mockResolvedValue(() => ({
  data: { user: { id: `test-user-${++userCounter}` }, session: null },
  error: null,
}));
const mockSignIn = vi.fn().mockResolvedValue({
  data: { user: { id: 'test-user-id' }, session: null },
  error: null,
});
const mockSignOut = vi.fn().mockResolvedValue({ error: null });

// Mock data storage for tests
const mockDatabase = new Map<string, any[]>();

// ── Schema constraint definitions (mirrors production CHECK/FK constraints) ──
// Tables with a monetary column that must be > 0 (CHECK constraint)
const POSITIVE_AMOUNT_COLUMNS: Record<string, string> = {
  payment_transactions: 'amount',
  invoices: 'amount',
  payment_allocations: 'allocated_amount',
};

// Foreign-key relationships enforced on insert: table -> { column -> referenced table }
const FOREIGN_KEYS: Record<string, Record<string, string>> = {
  payment_transactions: { invoice_id: 'invoices' },
  payment_allocations: { transaction_id: 'payment_transactions', invoice_id: 'invoices' },
  invoices: { tenant_id: 'tenants', property_id: 'properties', unit_id: 'units' },
};

function checkConstraints(table: string, data: any): { message: string } | null {
  const amountField = POSITIVE_AMOUNT_COLUMNS[table];
  if (amountField && Object.prototype.hasOwnProperty.call(data, amountField)) {
    const value = Number(data[amountField]);
    if (!(value > 0)) {
      return {
        message: `new row for relation "${table}" violates check constraint "${table}_${amountField}_positive_check"`,
      };
    }
  }

  const fks = FOREIGN_KEYS[table];
  if (fks) {
    for (const [column, refTable] of Object.entries(fks)) {
      const value = data[column];
      if (value === undefined || value === null) continue;
      const refRows = mockDatabase.get(refTable) || [];
      const exists = refRows.some((row: any) => row.id === value);
      if (!exists) {
        return {
          message: `insert or update on table "${table}" violates foreign key constraint "${table}_${column}_fkey"`,
        };
      }
    }
  }

  return null;
}

// Parse a PostgREST-style select string for embedded relations, e.g.
// "*, invoices(*)" -> ["invoices"]
function parseRelations(selectArg?: string): string[] {
  if (!selectArg) return [];
  const matches = selectArg.matchAll(/(\w+)\s*\(/g);
  return Array.from(matches, (m) => m[1]);
}

// Resolve embedded relations for a row using FK columns named "<relation>_id"
function hydrateRelations(table: string, row: any, relations: string[]): any {
  if (!row || relations.length === 0) return row;
  const hydrated = { ...row };
  for (const relation of relations) {
    const fkColumn = `${relation.endsWith('s') ? relation.slice(0, -1) : relation}_id`;
    const fkValue = row[fkColumn];
    if (fkValue === undefined) continue;
    const relatedRows = mockDatabase.get(relation) || [];
    const match = relatedRows.find((r: any) => r.id === fkValue) || null;
    hydrated[relation] = match;
  }
  return hydrated;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      admin: {
        deleteUser: mockAdminDeleteUser,
        createUser: (...args: any[]) => ({
          data: { user: { id: `test-user-${++userCounter}` } },
          error: null,
        }),
      },
      signUp: (...args: any[]) => ({
        data: { user: { id: `test-user-${++userCounter}` }, session: null },
        error: null,
      }),
      signInWithPassword: mockSignIn,
      signOut: mockSignOut,
    },
    rpc: vi.fn((fnName: string, args: any) => {
      // Basic mock implementation for rpc calls in test environment
      return Promise.resolve({ data: null, error: null });
    }),
    storage: {
      from: vi.fn((bucket: string) => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
        download: vi.fn().mockResolvedValue({ data: new Blob(['test-content']), error: null }),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
        createSignedUrl: vi.fn().mockImplementation((path: string, expiresIn: number) =>
          Promise.resolve({
            data: { signedUrl: `https://test.supabase.co/storage/v1/object/signed/${bucket}/${path}?token=mocktoken` },
            error: null,
          })
        ),
        getPublicUrl: vi.fn().mockImplementation((path: string) => ({
          data: { publicUrl: `https://test.supabase.co/storage/v1/object/public/${bucket}/${path}` },
        })),
      })),
    },
    from: vi.fn((table: string) => {
      const tableData = mockDatabase.get(table) || [];
      return {
        select: vi.fn((selectArg?: string) => {
          const relations = parseRelations(selectArg);
          const createSelectEq = (currentFiltered: any[]) => {
            const eqFn: any = vi.fn((field: string, value: any) => {
              const filtered = currentFiltered.filter((d: any) => d[field] === value);
              return {
                eq: createSelectEq(filtered),
                single: vi.fn(() => {
                  const item = filtered[0] || null;
                  return Promise.resolve({
                    data: item ? hydrateRelations(table, item, relations) : null,
                    error: null,
                  });
                }),
                maybeSingle: vi.fn(() => {
                  const item = filtered[0] || null;
                  return Promise.resolve({
                    data: item ? hydrateRelations(table, item, relations) : null,
                    error: null,
                  });
                }),
                then: vi.fn((resolve: any) =>
                  resolve({
                    data: filtered.map((d: any) => hydrateRelations(table, d, relations)),
                    error: null,
                  })
                ),
                catch: vi.fn(() => ({ data: filtered, error: null })),
              };
            });
            return eqFn;
          };

          return {
            eq: createSelectEq(tableData),
            // Handle select without eq
            then: vi.fn((resolve: any) =>
              resolve({
                data: tableData.map((d: any) => hydrateRelations(table, d, relations)),
                error: null,
              })
            ),
            catch: vi.fn(() => ({ data: tableData, error: null })),
          };
        }),
        insert: vi.fn((data: any) => {
          const constraintError = checkConstraints(table, data);
          if (constraintError) {
            return {
              select: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: null, error: constraintError })),
                maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: constraintError })),
              })),
              then: vi.fn((resolve: any) => resolve({ data: null, error: constraintError })),
            };
          }

          const newItem = {
            id: Math.random().toString(36).substr(2, 9),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...data
          };
          tableData.push(newItem);
          mockDatabase.set(table, tableData);
          return {
            select: vi.fn((selectArg?: string) => {
              const relations = parseRelations(selectArg);
              const hydrated = hydrateRelations(table, newItem, relations);
              return {
                single: vi.fn(() => Promise.resolve({ data: hydrated, error: null })),
                maybeSingle: vi.fn(() => Promise.resolve({ data: hydrated, error: null })),
              };
            }),
            then: vi.fn((resolve: any) => resolve({ data: newItem, error: null })),
          };
        }),
        update: vi.fn((data: any) => {
          const createUpdateEq = (currentFiltered: any[]) => {
            const eqFn: any = vi.fn((field: string, value: any) => {
              const filtered = currentFiltered.filter((d: any) => d[field] === value);
              return {
                eq: createUpdateEq(filtered),
                select: vi.fn(() => Promise.resolve({ data: filtered, error: null })),
                single: vi.fn(() => {
                  const item = filtered[0] || null;
                  return Promise.resolve({ data: item, error: null });
                }),
                then: vi.fn((resolve: any) => resolve({ data: filtered, error: null })),
              };
            });
            return eqFn;
          };
          return {
            eq: createUpdateEq(tableData),
          };
        }),
        delete: vi.fn(() => {
          const createDeleteEq = (currentFiltered: any[]) => {
            const eqFn: any = vi.fn((field: string, value: any) => {
              const filtered = currentFiltered.filter((d: any) => d[field] === value);
              return {
                eq: createDeleteEq(filtered),
                select: vi.fn(() => Promise.resolve({ data: [], error: null })),
                single: vi.fn(() => Promise.resolve({ data: null, error: null })),
                then: vi.fn((resolve: any) => resolve({ data: [], error: null })),
              };
            });
            return eqFn;
          };
          return {
            eq: createDeleteEq(tableData),
          };
        }),
      };
    }),
  },
}));

// Helper function to generate valid UUID v4
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
