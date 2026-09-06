import type { LucideIcon } from 'lucide-react';
import { Home, Droplets, Shield, Trash2, Wifi, Car, Wrench, Receipt } from 'lucide-react';

export type ChargeType =
  | 'rent'
  | 'water'
  | 'garbage'
  | 'security'
  | 'service_charge'
  | 'caretaker'
  | 'wifi'
  | 'parking'
  | 'custom';

export const CHARGE_TYPE_META: Record<
  string,
  { label: string; icon: LucideIcon; color: string; bg: string }
> = {
  rent: { label: 'Rent', icon: Home, color: 'text-success', bg: 'bg-success/10 border-success/20' },
  water: { label: 'Water', icon: Droplets, color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
  security: { label: 'Security', icon: Shield, color: 'text-navy-mid', bg: 'bg-navy-mid/10 border-navy-mid/20' },
  garbage: { label: 'Garbage', icon: Trash2, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
  service_charge: { label: 'Service charge', icon: Receipt, color: 'text-navy-mid', bg: 'bg-navy-mid/10 border-navy-mid/20' },
  caretaker: { label: 'Caretaker', icon: Wrench, color: 'text-warning', bg: 'bg-warning/10 border-warning/20' },
  wifi: { label: 'Wi‑Fi', icon: Wifi, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  parking: { label: 'Parking', icon: Car, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  custom: { label: 'Other', icon: Receipt, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
};

export function chargeMeta(type: string | null | undefined) {
  return CHARGE_TYPE_META[type ?? 'custom'] ?? CHARGE_TYPE_META.custom;
}
