# Payment Configuration, Secure Sharing & Device Security — Completion

## 1. Canonical payment routing
- Every unit can have its own payment destination.
- A property can have a grouped/default destination.
- An agency can have an agency-wide fallback destination.
- Manager and landlord destinations remain first-class options.
- Tenancy-specific overrides remain supported.
- Effective routing is resolved live from `payment_collection_accounts`.
- Unit-specific configuration overrides property, agency, landlord and manager fallback routes.
- Tenant portal payment instructions use the live resolver.
- Automated payment prompts use the same live resolver, so prompt content cannot drift from the configured destination.
- M-Pesa STK uses the configured Paybill/Till from the canonical routing record; legacy M-Pesa settings are used only for API credentials.

## 2. Tenant-to-parent/family payment links
- Shared links use opaque random tokens whose hashes are stored server-side.
- A raw link no longer discloses tenant or bill information.
- A separate six-digit access code is required.
- Verification creates a short-lived server-side authorization grant.
- The public page only reveals payment information after that grant is issued.
- Tenant names, email addresses and phone numbers are never exposed by the public payment lookup.
- Link expiry, revocation and attempt limits remain active.
- The access grant is also required to initiate/consume a shared payment and to poll its payment status.

## 3. One-device portal security
- Authenticated portal accounts are limited to one active device by default.
- A second device is blocked unless the active device explicitly generates an authorization code.
- The authorization code is eight digits and expires after 10 minutes.
- A successful authorization can add only one additional device; a third concurrent device is blocked.
- The current device can generate the authorization code from Settings → Portal device security.
- Heartbeats keep the device session active; inactive/expired sessions can naturally release the account.

## 4. Verification
`PAYMENT_CONFIGURATION_PRIVACY_DEVICE_SECURITY_AUDIT=PASS`

The recovered package has no installed `node_modules`, so full TypeScript/Vitest/build execution is unavailable. Static migration and source integrity checks were run instead; no unavailable test suite is represented as passing.
