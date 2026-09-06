/**
 * Shared type utilities for improving TypeScript type safety.
 * Provides generic types, type guards, and utility types.
 */

// ── Generic Type Utilities ──────────────────────────────────────────────────

/**
 * Extract the Row type from a Supabase table definition
 */
export type TableRow<T extends { Row: object }> = T["Row"];

/**
 * Extract the Insert type from a Supabase table definition
 */
export type TableInsert<T extends { Insert: object }> = T["Insert"];

/**
 * Extract the Update type from a Supabase table definition
 */
export type TableUpdate<T extends { Update: object }> = T["Update"];

/**
 * Make specific properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make all properties required recursively
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

/**
 * Pick only string keys from a type
 */
export type StringKeys<T> = {
  [K in keyof T]: T[K] extends string ? K : never;
}[keyof T];

/**
 * Pick only numeric keys from a type
 */
export type NumberKeys<T> = {
  [K in keyof T]: T[K] extends number ? K : never;
}[keyof T];

// ── Type Guards ─────────────────────────────────────────────────────────────

/**
 * Type guard for non-nullable values
 */
export function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard for string
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Type guard for number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

/**
 * Type guard for positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

/**
 * Type guard for object (not null, not array)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard for array
 */
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Type guard for UUID string
 */
export function isUUID(value: unknown): value is string {
  if (!isString(value)) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Type guard for valid date string
 */
export function isValidDate(value: unknown): value is string {
  if (!isString(value)) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

// ── Type Predicates ─────────────────────────────────────────────────────────

/**
 * Assert that a value is not null/undefined, narrowing the type
 */
export function assertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present"
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

/**
 * Narrow unknown to a specific type using a predicate
 */
export function narrowType<T>(
  value: unknown,
  predicate: (value: unknown) => value is T
): T | null {
  return predicate(value) ? value : null;
}

// ── Result Types ─────────────────────────────────────────────────────────────

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Create a success result
 */
export function success<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Create a failure result
 */
export function failure<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}

// ── Discriminated Union Utilities ────────────────────────────────────────────

/**
 * Extract the type of the 'data' field from a Result type
 */
export type UnwrapResult<T extends Result<unknown>> = 
  T extends Result<infer U> ? U : never;

/**
 * Check if a Result is successful
 */
export function isSuccess<T>(result: Result<T>): result is { success: true; data: T } {
  return result.success === true;
}

// ── Async Types ───────────────────────────────────────────────────────────────

/**
 * Awaited type - unwrap Promise<T> to T
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Async Result type
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

// ── Record Utilities ─────────────────────────────────────────────────────────

/**
 * Create a typed record from an array of keys
 */
export function createTypedRecord<K extends string | number, V>(
  keys: K[],
  valueFn: (key: K) => V
): Record<K, V> {
  return keys.reduce((acc, key) => {
    acc[key] = valueFn(key);
    return acc;
  }, {} as Record<K, V>);
}

/**
 * Pick specific keys from an object
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omit specific keys from an object
 */
export function omit<T, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

// ── Function Utilities ────────────────────────────────────────────────────────

/**
 * No-operation function type
 */
export type Noop = () => void;

/**
 * Async no-operation function type
 */
export type AsyncNoop = () => Promise<void>;

/**
 * Type-safe event handler
 */
export type EventHandler<T = unknown> = (data: T) => void;

/**
 * Type-safe async event handler
 */
export type AsyncEventHandler<T = unknown> = (data: T) => Promise<void>;

// ── React-Specific Types ─────────────────────────────────────────────────────

/**
 * Props with required children
 */
export type PropsWithChildren<P = unknown> = P & { children: React.ReactNode };

/**
 * ClassName prop type
 */
export type ClassNameProp = { className?: string };

/**
 * Style prop type
 */
export type StyleProp = { style?: React.CSSProperties };

// ── Validation Types ─────────────────────────────────────────────────────────

/**
 * Validation error type
 */
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Create a validation result
 */
export function validationSuccess(): ValidationResult {
  return { valid: true, errors: [] };
}

export function validationFailure(errors: ValidationError[]): ValidationResult {
  return { valid: false, errors };
}
