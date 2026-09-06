# CALQULUS PMS — Phase 54–55 Hardening

## Phase 54 — Unit Photo Mutation Convergence

Unit photo metadata mutations now use SECURITY DEFINER atomic RPCs:

- `save_unit_photo_atomic`
- `delete_unit_photo_atomic`
- `set_unit_cover_photo_atomic`

The database derives the property from the unit, requires the authenticated user to be the property manager, and keeps cover-photo promotion/selection inside a transaction. Authenticated direct INSERT/UPDATE/DELETE privileges on `unit_photos` are revoked.

`UnitPhotoGallery.tsx` now calls the RPCs rather than mutating `unit_photos` directly. Public read access previously removed by the RLS lockdown remains removed; this phase does not re-open it.

## Phase 55 — Landlord Portal Mutation Convergence

The following landlord portal writes now use atomic RPCs:

- `save_landlord_bank_details_atomic`
- `save_landlord_notification_preferences`
- `send_landlord_message_atomic`
- `mark_landlord_messages_read_atomic`

Bank and notification preference identity is derived from `auth.uid()`. Message sending validates that the authenticated sender is either the manager of the property or a landlord linked to that property, and validates the recipient and thread relationship. Authenticated direct DML on the three landlord portal tables is revoked.

## Verification

- `npm run audit:prod`: PASS.
- Production UI direct-mutation scan for Phase 54–55 protected tables: 0 violations.
- SQL structural check: 7 functions / 7 execute grants / balanced dollar quoting.
- Focused Vitest test file was attempted but the supplied environment does not contain `vitest` (`vitest: not found`).
- TypeScript was attempted but is blocked by missing project dependencies/types (React, React Query, router, Capacitor, etc.).
- Vite build was attempted but is blocked because `vite` is unavailable.
- No live Supabase connection was available, so migrations were structurally validated but not applied to a live database.

## Deployment note

Apply migrations through the project's normal Supabase migration pipeline after review. The extracted package is not itself a Git checkout; commit/push from the developer's local CALQULUS-PMS checkout.
