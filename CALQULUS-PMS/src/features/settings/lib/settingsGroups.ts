import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Building2,
  Clock,
  CreditCard,
  Globe,
  HardDrive,
  Landmark,
  Lock,
  Palette,
  Receipt,
  Shield,
  User,
  Users,
  Wallet,
} from "lucide-react";

export type SettingsNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Navigate to an existing page instead of a settings panel. */
  href?: string;
};

export type SettingsGroup = {
  id: string;
  label: string;
  items: SettingsNavItem[];
};

/**
 * Existing Settings panels regrouped. No new screens — Platform billing
 * is the live `/platform-billing` route, not a duplicate form.
 */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: "organization",
    label: "Organization",
    items: [
      { id: "company", label: "Company details", icon: Building2 },
      { id: "currency", label: "Currency", icon: Globe },
      { id: "date-time", label: "Date & Time", icon: Clock },
    ],
  },
  {
    id: "users",
    label: "Users",
    items: [
      { id: "profile", label: "Profile", icon: User },
      { id: "submanagers", label: "Team", icon: Users },
    ],
  },
  {
    id: "roles",
    label: "Roles",
    items: [
      { id: "roles", label: "User roles", icon: Shield },
    ],
  },
  {
    id: "notifications",
    label: "Notifications",
    items: [
      { id: "notifications", label: "Push notifications", icon: Bell },
      { id: "reminders", label: "Payment reminders", icon: Clock },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    items: [
      { id: "payments", label: "Payment settings", icon: Wallet },
      { id: "receipts", label: "Receipts", icon: Receipt },
      { id: "platform-billing", label: "Platform billing", icon: CreditCard, href: "/platform-billing" },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    items: [
      { id: "bank-integration", label: "Bank integration", icon: Landmark },
    ],
  },
  {
    id: "security",
    label: "Security",
    items: [
      { id: "password", label: "Password", icon: Lock },
      { id: "cache", label: "Cache", icon: HardDrive },
    ],
  },
  {
    id: "branding",
    label: "Branding",
    items: [
      { id: "branding", label: "Brand Studio", icon: Palette },
    ],
  },
];

export const SETTINGS_GROUP_LABELS = SETTINGS_GROUPS.map((group) => group.label);

export function findSettingsItem(id: string): SettingsNavItem | undefined {
  for (const group of SETTINGS_GROUPS) {
    const match = group.items.find((item) => item.id === id);
    if (match) return match;
  }
  return undefined;
}

export function isSettingsPanelId(id: string): boolean {
  const item = findSettingsItem(id);
  return Boolean(item && !item.href);
}

export function settingsPanelItems(): SettingsNavItem[] {
  return SETTINGS_GROUPS.flatMap((group) => group.items.filter((item) => !item.href));
}
