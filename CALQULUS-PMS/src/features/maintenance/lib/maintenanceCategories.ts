export const MAINTENANCE_CATEGORIES = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electricity", label: "Electricity" },
  { value: "floors", label: "Floors" },
  { value: "roof", label: "Roof" },
  { value: "windows", label: "Windows" },
  { value: "kitchen", label: "Kitchen Wares" },
  { value: "bathroom", label: "Bathroom / Toilet Wares" },
  { value: "other", label: "Other" },
] as const;

export type MaintenanceCategory = (typeof MAINTENANCE_CATEGORIES)[number]["value"];

export const getCategoryLabel = (value: string): string => {
  const category = MAINTENANCE_CATEGORIES.find((c) => c.value === value);
  return category?.label || "Other";
};
