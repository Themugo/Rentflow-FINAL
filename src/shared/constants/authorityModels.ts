/**
 * CALQULUS PMS authority / operating models — maps commercial arrangements to DB fields.
 * @see docs/CALQULUS_RMS_AUTHORITY_STRUCTURE.md
 */

export type OperatingModel =
  | 'landlord_self_managed'
  | 'manager_operates_landlord_collects'
  | 'agency_collects_full_management'
  | 'agency_collects_pays_landlord'
  | 'agency_manages_fee_from_landlord'
  | 'agency_collects_landlord_managed';

export type PaymentDestination = 'manager' | 'landlord';

export interface OperatingModelMeta {
  id: OperatingModel;
  category: 1 | 2 | 3 | 4;
  title: string;
  shortLabel: string;
  description: string;
  whoOperates: string;
  whoCollects: string;
  whoGetsPaid: string;
  defaultPaymentDestination: PaymentDestination;
}

export const OPERATING_MODELS: OperatingModelMeta[] = [
  {
    id: 'landlord_self_managed',
    category: 1,
    title: 'Landlord-operated (owner is boss)',
    shortLabel: 'Landlord boss',
    description:
      'The property owner runs the portfolio, sets rules, and can build an in-house team. You may optionally delegate an external manager or agency.',
    whoOperates: 'Landlord (and their team)',
    whoCollects: 'Landlord or delegated manager (configurable)',
    whoGetsPaid: 'Landlord pays staff; external manager by separate agreement',
    defaultPaymentDestination: 'landlord',
  },
  {
    id: 'manager_operates_landlord_collects',
    category: 2,
    title: 'Manager operates — landlord collects',
    shortLabel: 'Landlord collects',
    description:
      'Agency/manager runs day-to-day ops (tenants, maintenance, invoices). Rent is collected on the landlord’s M-Pesa/bank; manager is paid by the landlord.',
    whoOperates: 'Manager / agency',
    whoCollects: 'Landlord',
    whoGetsPaid: 'Manager (management fee / invoice from landlord)',
    defaultPaymentDestination: 'landlord',
  },
  {
    id: 'agency_collects_full_management',
    category: 3,
    title: 'Agency collects & full management',
    shortLabel: 'Agency collects',
    description:
      'Manager/agency collects rent and fully manages the property. Supports multiple landlords and many properties under one agency account.',
    whoOperates: 'Manager / agency',
    whoCollects: 'Manager / agency',
    whoGetsPaid: 'Landlord via revenue share & payouts',
    defaultPaymentDestination: 'manager',
  },
  {
    id: 'agency_collects_pays_landlord',
    category: 4,
    title: 'Hybrid — agency collects, pays landlord',
    shortLabel: 'Collect → pay landlord',
    description:
      'Agency collects all rent, keeps commission/management fee, and remits the landlord’s share (revenue_share_pct).',
    whoOperates: 'Manager / agency',
    whoCollects: 'Manager / agency',
    whoGetsPaid: 'Landlord (net share after commission)',
    defaultPaymentDestination: 'manager',
  },
  {
    id: 'agency_manages_fee_from_landlord',
    category: 4,
    title: 'Hybrid — agency manages, landlord collects',
    shortLabel: 'Manage for fee',
    description:
      'Landlord collects rent. Agency enforces payments and operations; landlord pays a management fee (management_fee_pct).',
    whoOperates: 'Manager / agency',
    whoCollects: 'Landlord',
    whoGetsPaid: 'Manager (management fee %)',
    defaultPaymentDestination: 'landlord',
  },
  {
    id: 'agency_collects_landlord_managed',
    category: 4,
    title: 'Agency collects & enforces — owner operates',
    shortLabel: 'Collect + enforce',
    description:
      'Agency collects rent and enforces payment. The property owner retains day-to-day management, caretakers and maintenance authority.',
    whoOperates: 'Landlord (and their team)',
    whoCollects: 'Manager / agency',
    whoGetsPaid: 'Agency collection fee / agreed share',
    defaultPaymentDestination: 'manager',
  },
];

export type AgencyServiceModel =
  | 'full_management'
  | 'managed_direct_landlord_collection'
  | 'collections_enforcement_only';

export interface AgencyServiceModelMeta {
  id: AgencyServiceModel;
  operatingModel: OperatingModel;
  label: string;
  slogan: string;
  description: string;
  operates: string;
  collects: string;
  enforces: string;
  maintenance: string;
  paymentDestination: PaymentDestination;
}

export const AGENCY_SERVICE_MODELS: AgencyServiceModelMeta[] = [
  {
    id: 'full_management',
    operatingModel: 'agency_collects_full_management',
    label: 'Full management + collection',
    slogan: 'You run it. We handle it end to end.',
    description: 'Agency runs property operations, tenant workflows, maintenance, collections and enforcement.',
    operates: 'Agency',
    collects: 'Agency',
    enforces: 'Agency',
    maintenance: 'Agency',
    paymentDestination: 'manager',
  },
  {
    id: 'managed_direct_landlord_collection',
    operatingModel: 'manager_operates_landlord_collects',
    label: 'Management + direct owner collection',
    slogan: 'We manage. Owners receive rent directly.',
    description: 'Agency runs operations and enforcement while rent routes directly to the property owner.',
    operates: 'Agency',
    collects: 'Landlord',
    enforces: 'Agency',
    maintenance: 'Agency',
    paymentDestination: 'landlord',
  },
  {
    id: 'collections_enforcement_only',
    operatingModel: 'agency_collects_landlord_managed',
    label: 'Collections + enforcement only',
    slogan: 'Owners run the property. We protect the rent.',
    description: 'Agency collects rent and enforces payment; the owner retains operations, caretakers and maintenance.',
    operates: 'Landlord',
    collects: 'Agency',
    enforces: 'Agency',
    maintenance: 'Landlord',
    paymentDestination: 'manager',
  },
];

export function getAgencyServiceModelMeta(id: AgencyServiceModel | string | null | undefined): AgencyServiceModelMeta {
  return AGENCY_SERVICE_MODELS.find((m) => m.id === id) ?? AGENCY_SERVICE_MODELS[0];
}

export function agencyServiceModelFromOperatingModel(model: OperatingModel | string | null | undefined): AgencyServiceModel | null {
  switch (model) {
    case 'agency_collects_full_management':
    case 'agency_collects_pays_landlord':
      return 'full_management';
    case 'manager_operates_landlord_collects':
    case 'agency_manages_fee_from_landlord':
      return 'managed_direct_landlord_collection';
    case 'agency_collects_landlord_managed':
      return 'collections_enforcement_only';
    default:
      return null;
  }
}


export const AGENCY_SERVICE_MODEL_SHORT_LABELS: Record<AgencyServiceModel, string> = {
  full_management: 'Full management',
  managed_direct_landlord_collection: 'Manage · owner collects',
  collections_enforcement_only: 'Collections · enforcement',
};


export function getOperatingModelMeta(id: OperatingModel | string | null | undefined): OperatingModelMeta {
  return OPERATING_MODELS.find((m) => m.id === id) ?? OPERATING_MODELS[2];
}

export function paymentDestinationForModel(model: OperatingModel | string | null | undefined): PaymentDestination {
  const m = model as OperatingModel;
  if (m === 'manager_operates_landlord_collects' || m === 'agency_manages_fee_from_landlord') {
    return 'landlord';
  }
  if (m === 'landlord_self_managed') {
    return 'landlord';
  }
  return 'manager';
}

export function shouldSetLandlordAsPropertyOperator(model: OperatingModel): boolean {
  return model === 'landlord_self_managed';
}
