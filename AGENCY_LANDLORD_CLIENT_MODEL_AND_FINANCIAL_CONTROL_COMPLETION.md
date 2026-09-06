# Agency → Landlord Client Operating Model & Financial Control

## Foundation
Built from the supplied CALQULUS master repository. Existing Agency contract rules, payment policies, invoice line items, payment transactions, evidence queue, ledger and financial close remain the system of record.

## Commercial model
CALQULUS is the platform. The Agency decides the commercial arrangement with each landlord/client. An Agency may therefore configure different combinations of:
- property operations
- unit/lease/tenant operations
- maintenance, inspections, utilities, compliance and vendors
- tenant communications
- collection destination
- owner/landlord collection control
- Agency collection authority
- owner financial control
- owner distribution control
- owner approval requirements
- manual-payment tolerance
- expense approval threshold
- reporting and dispute configuration

No universal Agency business rule is imposed beyond security and accounting integrity.

## Money controls
1. Successful payments continue through the existing atomic payment lifecycle.
2. Rent allocation remains automatic through the existing invoice/payment allocation source of truth.
3. Invoice line items remain the canonical charge breakdown.
4. Accepted external/direct payments can settle tenant invoices without being counted as Agency cash.
5. Manual evidence is reviewed before acceptance.
6. The same evidence cannot be accepted twice because review is row-locked and terminal states are idempotent.
7. Invoice financial terms become immutable after paid/cancelled; corrections must use governed adjustment/reversal flows.
8. Deferred invoice-line integrity prevents line totals from diverging from invoice totals.
9. Month-end close stores the generated financial snapshot and SHA-256 hash.
10. Closed periods remain protected; reopening requires an authorized user and reason.

## Evidence sources supported
- agent manual
- tenant upload
- bank statement
- external consolidation
- landlord confirmation

## Payment destinations supported
- Agency
- landlord
- direct nominated party
- external/outside source
- split

## Breakdown/reporting
The existing Agency financial workbench already exposes an Excel/CSV-friendly event ledger with invoice lines, Agency cash, outside-source confirmations and expenses. This initiative keeps that path and strengthens its accounting controls instead of creating a second spreadsheet ledger.

## Tenant experience
Existing tenant-facing payment policy visibility and communication mechanisms remain the delivery path. Configuration changes should continue to be communicated through the existing communication hub using selected or global reach; the backend remains authoritative for the effective rule.

## What was deliberately not created
- no agency_invoices table
- no agency_payments table
- no second ledger
- no second tenant system
- no second landlord system
- no parallel payment engine
- no replacement for property_landlords

## Recommended future dynamics
These should be evaluated against the same foundation before implementation:
- contract document/e-signature linkage to every active client rule version
- owner acknowledgement for material rule changes
- bank reconciliation variance workflow
- approval separation for high-value expenses
- automated owner statement package at close
- dispute case lifecycle linking payment evidence, invoice lines, messages and documents
- effective-dated tenant notice history for every material tenant-facing rule change
