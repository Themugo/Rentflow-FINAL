# Agency Contract & Financial Workbench

CALQULUS is the platform; the Agency defines its client contracts and operational rules.

## Contract scope
Each `agency_contract_rules` row belongs to one Agency ↔ property/client relationship. It can define the collection destination, management modules, payment behavior, enforcement, settlement and approval rules without forcing every client into the same operating model.

## Financial controls
`agency_charge_catalog` provides the Agency's charge vocabulary. Invoice line items remain the financial source of truth; successful payments continue through the existing atomic payment lifecycle and are proportionally reconciled into charge categories for Agency reporting.

## Evidence
`agency_payment_evidence` records manual bank slips, tenant-submitted proof, landlord/direct collections and outside-source consolidation separately from Agency cash. Accepted Agency-collected evidence can be allocated to the invoice; accepted non-Agency evidence remains external confirmation.

## Close
`agency_financial_periods` stores an automatic period snapshot. Closing is blocked while Agency payment evidence is unresolved, relevant bank transactions remain unmatched, or payments are still pending/processing.

## Configuration tabs
The Agency Settings control center provides Client Contracts, Charges, Operating Defaults and Team Permissions. The Billing control center provides Agency Ledger, Payment Evidence, Close Books and the existing PMS billing screens.
