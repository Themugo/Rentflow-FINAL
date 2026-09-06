# CALQULUS PMS — Agency Service Model Matrix

CALQULUS treats an agency as a **multi-model operator**. One agency may run different client/property arrangements at the same time, without cloning properties, tenants, leases or financial history.

## The three commercial operating models

| Model | Agency operates | Agency collects | Agency enforces | Maintenance | Rent destination |
|---|---|---|---|---|---|
| **Full management + collection** | Yes | Yes | Yes | Agency | Agency collection account |
| **Management + direct owner collection** | Yes | No | Yes | Agency | Landlord account |
| **Collections + enforcement only** | No | Yes | Yes | Landlord | Agency collection account |

### Full management + collection

The agency is the operating partner. It can maintain buildings, manage units and tenants, administer leases, invoice, collect, arrange payment plans, enforce arrears and coordinate maintenance.

### Management + direct owner collection

The agency runs the operational side and enforces payment, but the rent is paid directly to the landlord's configured account. The agency can still configure payment arrangements because that is an enforcement/receivables workflow, not a statement that the agency receives the money.

### Collections + enforcement only

The landlord retains operational authority, caretakers and maintenance responsibility. The agency's job is to collect rent and enforce payment. Property/unit/lease/tenant/maintenance writes are blocked at the database boundary for this mandate.

## Why the model is attached to the owner/property relationship

A single agency can manage:

- Building A under full management;
- Building B under direct owner collection;
- Building C under collections-only;
- and continue to add properties under any of the three models.

This avoids the common mistake of making one agency-wide setting dictate every client contract.

## Data continuity

Changing the agency service model changes **authority**, not identity. Existing properties, units, tenants, leases, invoices, payments, documents and maintenance history remain the same records.

Every mandate change is recorded in `agency_service_mandate_history` with the previous and new configuration.

## Shared ownership

Multiple landlords remain supported through `property_landlords`. For one property, conflicting agency service models are rejected because the current PMS payment routing is property-scoped; allowing contradictory collection destinations would create an unsafe financial ambiguity.

Owners can still have different revenue shares while sharing one property-level agency service mandate.

## Dashboard implications

Agency dashboards should distinguish:

- **Portfolio under full management** — operational work is actionable;
- **Managed / direct owner collection** — operations + enforcement, but not agency collection;
- **Collections + enforcement only** — receivables/enforcement, while operational actions are read-only.

The Agency dashboard therefore reports the **service mix** rather than treating every building as the same kind of client.
