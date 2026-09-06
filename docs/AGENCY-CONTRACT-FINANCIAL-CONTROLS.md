# Agency Contract & Financial Controls

The Agency is the customer operating the property-management service. CALQULUS provides the system of record, workflow and evidence controls; each Agency defines its own client agreements, responsibilities, payment routing, charge catalogue, staff permissions and month-end rules.

## Contract model

Each Agency/client-property relationship can have its own active contract rule. The rule can mix management modules, financial controls, payment rules, enforcement, settlement and approval rules. A new saved contract versions the prior active rule so operational history remains traceable.

Supported collection destinations:

- Agency
- Landlord
- Direct to nominated party / tenant
- External / outside source
- Split (explicit Agency/outside percentages totaling 100%)

## Financial model

Invoice lines are the human-readable source for charge breakdowns such as rent, water, security, garbage, service charge, electricity, parking, penalties, deposits, maintenance and other Agency-defined categories.

Agency financial reporting separates:

- Agency cash collected
- Outside-source confirmed amounts
- Expenses
- Outstanding balances
- Net position

Successful tenant payments continue through the existing atomic payment lifecycle, which updates invoice balances and allocations. Agency-accepted manual evidence uses the same invoice settlement lifecycle.

## Outside-source evidence

Agency staff can record and verify:

- bank transfer evidence
- cash evidence
- tenant-uploaded evidence
- bank statement evidence
- external consolidation
- landlord confirmation
- direct-to-landlord / direct-to-tenant settlement evidence

Evidence files are private. Accepted external evidence settles the invoice but is excluded from Agency cash totals through `payment_transactions.agency_evidence_id`. Split evidence contributes only the configured Agency portion to Agency cash and the remainder to outside-confirmed reporting.

## Month-end close

The Agency Financial Workbench can close a period only when its control checks are clear. The close snapshot is generated from live invoices, charge lines, Agency cash, accepted external evidence, expenses and pending-payment checks. No manual total entry is required.

Closed periods reject new evidence until explicitly reopened with a reason. This preserves auditability while allowing controlled corrections.

## Permissions

Agency owner/admin status is not the only authority model. Agency owners/admins can delegate granular configuration and operational permissions through `agency_members.permissions`, including:

- view/manage settings
- manage client contracts
- manage billing rules and charge catalogue
- manage team permissions
- view financials
- record payments
- verify payment evidence
- close/reopen books
- manage operations

## Export

The Financial Workbench exports an Excel-compatible CSV ledger including date, event type, reference, counterparty, charge category, destination, source, billed amount, Agency cash, outside-confirmed amount and expense.
