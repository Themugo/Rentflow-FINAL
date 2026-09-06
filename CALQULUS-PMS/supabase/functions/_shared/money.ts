/**
 * Integer minor-unit money helpers for Edge Functions.
 * Keep in sync with src/shared/lib/money.ts
 */

export const MONEY_SCALE = 100;

export function toMinorUnits(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * MONEY_SCALE);
}

export function fromMinorUnits(minor: number): number {
  return minor / MONEY_SCALE;
}

export function roundMoney(amount: number): number {
  return fromMinorUnits(toMinorUnits(amount));
}

export function isPositiveMoney(amount: number): boolean {
  return Number.isFinite(amount) && toMinorUnits(amount) > 0;
}

export function moneyEquals(a: number, b: number, toleranceMinor = 1): boolean {
  return Math.abs(toMinorUnits(a) - toMinorUnits(b)) <= toleranceMinor;
}
