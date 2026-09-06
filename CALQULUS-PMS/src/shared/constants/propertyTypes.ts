/**
 * propertyTypes.ts
 *
 * Single source of truth for all property category types in CALQULUS PMS.
 * Used in: Add Property form, Property filters, Webhost billing,
 *           PropertyDetail, Reports, Tier enforcement.
 */

export interface PropertyCategory {
  key:               string;
  name:              string;
  description:       string;
  icon:              string;       // lucide icon name
  color:             string;       // tailwind colour (bg-{color}-100 etc.)
  group:             'residential' | 'commercial' | 'industrial' | 'mixed' | 'land';
  requiresTier:      'lite' | 'pro' | 'enterprise';
  billingMultiplier: number;       // 1.0 = base rate
  unitTypes:         string[];     // available unit types for this category
}

export const PROPERTY_CATEGORIES: PropertyCategory[] = [
  // ── Residential ──────────────────────────────────────────────────
  {
    key: 'residential_flat',
    name: 'Flat / Apartment Block',
    description: 'Multi-unit residential building with self-contained flats',
    icon: 'Building2', color: 'blue', group: 'residential',
    requiresTier: 'lite', billingMultiplier: 1.0,
    unitTypes: ['bedsitter', 'studio', 'one_bedroom', 'two_bedroom', 'three_bedroom', 'penthouse'],
  },
  {
    key: 'residential_bedsitter',
    name: 'Bedsitter Block',
    description: 'Building with single-room bedsitter units',
    icon: 'Home', color: 'sky', group: 'residential',
    requiresTier: 'lite', billingMultiplier: 0.9,
    unitTypes: ['bedsitter', 'single_room'],
  },
  {
    key: 'residential_studio',
    name: 'Studio Apartments',
    description: 'Purpose-built studio apartment complex',
    icon: 'Square', color: 'cyan', group: 'residential',
    requiresTier: 'lite', billingMultiplier: 1.0,
    unitTypes: ['studio', 'one_bedroom'],
  },
  {
    key: 'residential_bungalow',
    name: 'Bungalow / Maisonette',
    description: 'Standalone bungalows or maisonettes on one compound',
    icon: 'House', color: 'green', group: 'residential',
    requiresTier: 'lite', billingMultiplier: 1.1,
    unitTypes: ['two_bedroom', 'three_bedroom', 'four_bedroom', 'bungalow'],
  },
  {
    key: 'residential_townhouse',
    name: 'Townhouse / Row House',
    description: 'Terraced or semi-detached townhouses',
    icon: 'LayoutGrid', color: 'teal', group: 'residential',
    requiresTier: 'lite', billingMultiplier: 1.1,
    unitTypes: ['two_bedroom', 'three_bedroom', 'four_bedroom', 'townhouse'],
  },
  {
    key: 'residential_villa',
    name: 'Villa',
    description: 'High-end detached residential property',
    icon: 'Star', color: 'violet', group: 'residential',
    requiresTier: 'pro', billingMultiplier: 1.3,
    unitTypes: ['three_bedroom', 'four_bedroom', 'five_bedroom', 'villa'],
  },
  {
    key: 'residential_estate',
    name: 'Gated Estate',
    description: 'Managed residential estate with shared amenities, security, CCTV',
    icon: 'Shield', color: 'purple', group: 'residential',
    requiresTier: 'pro', billingMultiplier: 1.4,
    unitTypes: ['two_bedroom', 'three_bedroom', 'four_bedroom', 'villa', 'townhouse'],
  },
  {
    key: 'residential_servant',
    name: 'Servant Quarters / SQ',
    description: 'Attached servant quarters or caretaker units',
    icon: 'Users', color: 'slate', group: 'residential',
    requiresTier: 'lite', billingMultiplier: 0.7,
    unitTypes: ['single_room', 'bedsitter'],
  },

  // ── Commercial ───────────────────────────────────────────────────
  {
    key: 'commercial_office',
    name: 'Office Block',
    description: 'Multi-floor commercial office building',
    icon: 'Briefcase', color: 'amber', group: 'commercial',
    requiresTier: 'pro', billingMultiplier: 2.0,
    unitTypes: ['open_plan', 'private_office', 'boardroom', 'floor'],
  },
  {
    key: 'commercial_retail',
    name: 'Retail / Shop Space',
    description: 'Ground-floor retail shops or shopping complex',
    icon: 'ShoppingBag', color: 'orange', group: 'commercial',
    requiresTier: 'pro', billingMultiplier: 1.8,
    unitTypes: ['shop', 'kiosk', 'stall', 'supermarket'],
  },
  {
    key: 'commercial_warehouse',
    name: 'Warehouse / Godown',
    description: 'Industrial storage or godown / warehouse',
    icon: 'Package', color: 'stone', group: 'commercial',
    requiresTier: 'pro', billingMultiplier: 1.6,
    unitTypes: ['bay', 'godown', 'storage_unit'],
  },
  {
    key: 'commercial_market',
    name: 'Market Stalls',
    description: 'Open-air or covered market with multiple stalls',
    icon: 'Store', color: 'yellow', group: 'commercial',
    requiresTier: 'pro', billingMultiplier: 1.5,
    unitTypes: ['stall', 'kiosk', 'container'],
  },
  {
    key: 'commercial_showroom',
    name: 'Showroom / Dealership',
    description: 'Car showroom, equipment dealership or display space',
    icon: 'Layers', color: 'red', group: 'commercial',
    requiresTier: 'pro', billingMultiplier: 1.8,
    unitTypes: ['showroom', 'floor', 'bay'],
  },
  {
    key: 'commercial_hotel',
    name: 'Hotel / Serviced Apartments',
    description: 'Hotel, guesthouse or fully serviced apartments',
    icon: 'Building', color: 'rose', group: 'commercial',
    requiresTier: 'enterprise', billingMultiplier: 2.5,
    unitTypes: ['room', 'suite', 'apartment', 'penthouse'],
  },
  {
    key: 'commercial_hospital',
    name: 'Hospital / Medical Facility',
    description: 'Medical facility, clinic or hospital',
    icon: 'Heart', color: 'pink', group: 'commercial',
    requiresTier: 'enterprise', billingMultiplier: 2.2,
    unitTypes: ['ward', 'clinic', 'theatre', 'pharmacy'],
  },
  {
    key: 'commercial_school',
    name: 'School / Education Centre',
    description: 'School, college, training centre or educational facility',
    icon: 'BookOpen', color: 'indigo', group: 'commercial',
    requiresTier: 'pro', billingMultiplier: 1.9,
    unitTypes: ['classroom', 'lab', 'hall', 'office'],
  },
  {
    key: 'commercial_restaurant',
    name: 'Restaurant / Food Court',
    description: 'Restaurant, food court or hospitality venue',
    icon: 'Utensils', color: 'amber', group: 'commercial',
    requiresTier: 'pro', billingMultiplier: 1.7,
    unitTypes: ['unit', 'kiosk', 'restaurant'],
  },

  // ── Mixed Use ────────────────────────────────────────────────────
  {
    key: 'mixed_residential_commercial',
    name: 'Mixed Use (Residential + Commercial)',
    description: 'Ground floor commercial, upper floors residential',
    icon: 'Layers', color: 'violet', group: 'mixed',
    requiresTier: 'pro', billingMultiplier: 1.5,
    unitTypes: ['shop', 'bedsitter', 'one_bedroom', 'two_bedroom', 'office'],
  },
  {
    key: 'mixed_office_retail',
    name: 'Office + Retail Complex',
    description: 'Commercial building with retail and office floors',
    icon: 'LayoutDashboard', color: 'blue', group: 'mixed',
    requiresTier: 'pro', billingMultiplier: 1.6,
    unitTypes: ['shop', 'office', 'floor', 'open_plan'],
  },

  // ── Industrial ───────────────────────────────────────────────────
  {
    key: 'industrial_factory',
    name: 'Factory / Manufacturing',
    description: 'Manufacturing plant or industrial production facility',
    icon: 'Cog', color: 'zinc', group: 'industrial',
    requiresTier: 'enterprise', billingMultiplier: 1.8,
    unitTypes: ['production_bay', 'floor', 'unit'],
  },
  {
    key: 'industrial_logistics',
    name: 'Logistics / Depot',
    description: 'Transport depot, logistics hub or distribution centre',
    icon: 'Truck', color: 'gray', group: 'industrial',
    requiresTier: 'enterprise', billingMultiplier: 1.7,
    unitTypes: ['bay', 'dock', 'yard'],
  },
  {
    key: 'industrial_cold_store',
    name: 'Cold Storage',
    description: 'Refrigerated cold storage facility',
    icon: 'Snowflake', color: 'blue', group: 'industrial',
    requiresTier: 'enterprise', billingMultiplier: 2.0,
    unitTypes: ['chamber', 'bay'],
  },

  // ── Land / Plots ─────────────────────────────────────────────────
  {
    key: 'land_plot',
    name: 'Plot / Land',
    description: 'Undeveloped land or building plot',
    icon: 'Map', color: 'green', group: 'land',
    requiresTier: 'lite', billingMultiplier: 0.8,
    unitTypes: ['plot'],
  },
  {
    key: 'land_farm',
    name: 'Farm / Agricultural Land',
    description: 'Farm, agricultural land or greenhouse',
    icon: 'Leaf', color: 'emerald', group: 'land',
    requiresTier: 'lite', billingMultiplier: 0.8,
    unitTypes: ['plot', 'greenhouse', 'paddock'],
  },
  {
    key: 'land_parking',
    name: 'Parking / Car Park',
    description: 'Dedicated parking facility or car park',
    icon: 'Car', color: 'slate', group: 'land',
    requiresTier: 'lite', billingMultiplier: 1.0,
    unitTypes: ['bay', 'slot'],
  },
];

// ── Helpers ────────────────────────────────────────────────────────

export const CATEGORY_BY_KEY = Object.fromEntries(
  PROPERTY_CATEGORIES.map(c => [c.key, c])
);

export const CATEGORIES_BY_GROUP = PROPERTY_CATEGORIES.reduce<Record<string, PropertyCategory[]>>(
  (acc, cat) => { (acc[cat.group] = acc[cat.group] || []).push(cat); return acc; },
  {}
);

export const GROUP_LABELS: Record<string, string> = {
  residential: 'Residential',
  commercial:  'Commercial',
  industrial:  'Industrial',
  mixed:       'Mixed Use',
  land:        'Land & Plots',
};

export const GROUP_COLORS: Record<string, string> = {
  residential: 'text-navy-mid bg-navy-mid/10 border-navy-mid/20',
  commercial:  'text-warning bg-warning/10 border-warning/20',
  industrial:  'text-muted-foreground bg-muted border-border',
  mixed:       'text-navy-mid bg-navy-mid/10 border-navy-mid/20',
  land:        'text-success bg-success/10 border-success/20',
};

/** Return category group ('residential'|'commercial'|...) from a category key */
export function getCategoryGroup(key: string | null | undefined): string {
  if (!key) return 'residential';
  if (key.startsWith('residential_')) return 'residential';
  if (key.startsWith('commercial_'))  return 'commercial';
  if (key.startsWith('industrial_'))  return 'industrial';
  if (key.startsWith('mixed_'))       return 'mixed';
  if (key.startsWith('land_'))        return 'land';
  return 'residential';
}

export const TIER_NAMES: Record<string, string> = {
  lite:       'Lite',
  pro:        'Pro',
  enterprise: 'Enterprise',
  // legacy
  starter:    'Starter',
  growth:     'Growth',
  professional:'Professional',
};

export const TIER_BADGE_COLORS: Record<string, string> = {
  lite:       'bg-slate-100 text-slate-700 border-slate-300',
  pro:        'bg-blue-100 text-blue-800 border-blue-300',
  enterprise: 'bg-amber-100 text-amber-800 border-amber-300',
  starter:    'bg-slate-100 text-slate-700 border-slate-200',
  growth:     'bg-blue-100 text-blue-700 border-blue-200',
  professional:'bg-amber-400/15 text-warning border-navy-mid/20',
};

/** Unit types per category — displayed in Add Unit form */
export const UNIT_TYPE_LABELS: Record<string, string> = {
  bedsitter:      'Bedsitter',
  single_room:    'Single room',
  studio:         'Studio',
  one_bedroom:    '1 bedroom',
  two_bedroom:    '2 bedrooms',
  three_bedroom:  '3 bedrooms',
  four_bedroom:   '4 bedrooms',
  five_bedroom:   '5 bedrooms',
  penthouse:      'Penthouse',
  villa:          'Villa',
  townhouse:      'Townhouse',
  bungalow:       'Bungalow',
  // Commercial
  shop:           'Shop',
  kiosk:          'Kiosk',
  stall:          'Stall / Market stall',
  container:      'Container / Prefab',
  office:         'Office',
  open_plan:      'Open plan',
  private_office: 'Private office',
  boardroom:      'Boardroom',
  floor:          'Whole floor',
  showroom:       'Showroom',
  supermarket:    'Supermarket / Large retail',
  bay:            'Bay / Unit',
  godown:         'Godown',
  storage_unit:   'Storage unit',
  room:           'Room (hotel)',
  suite:          'Suite',
  apartment:      'Serviced apartment',
  ward:           'Ward',
  clinic:         'Clinic room',
  theatre:        'Theatre / OR',
  pharmacy:       'Pharmacy',
  classroom:      'Classroom',
  lab:            'Laboratory',
  hall:           'Hall / Auditorium',
  unit:           'Unit',
  restaurant:     'Restaurant unit',
  // Industrial
  production_bay: 'Production bay',
  dock:           'Loading dock',
  yard:           'Yard',
  chamber:        'Cold chamber',
  // Land
  plot:           'Plot',
  greenhouse:     'Greenhouse',
  paddock:        'Paddock',
  slot:           'Parking slot',
};
