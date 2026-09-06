# CALQULUS Public Homepage + Portal Clean Sweep

Date: 2026-09-05

## Scope

Public homepage, public portal-selection page, public property discovery surface, shared portal login chrome, four portal entry shells, and their public configuration/test contracts. Authenticated dashboards and backend business logic were not changed.

## Refinements completed

- Preserved the existing homepage layout while hardening typography, responsive truncation, image fallbacks, and contrast.
- Hero now respects mobile artwork, pauses on hover/focus, respects reduced-motion preferences, and avoids duplicate floating marketing-card collisions when an explicit hero campaign is active.
- Public navigation is limited to supported live concepts; stale navigation constants were removed from the public config contract.
- Decorative public accents now use CALQULUS blue; semantic green remains available for status meaning.
- Trust/partner slots gracefully render as non-links until a real destination is supplied.
- Default social slots are disabled until real URLs are configured.
- CTA default contact action points to the enterprise mailbox rather than a self-anchor.
- Public discovery/search routing respects the selected category/mode instead of always targeting residential.
- Portal access cards and portal login shells share the same full-bleed photographic architecture with restrained themed overlays, consistent typography, accessible focus treatment, and role-specific slogans/backgrounds sourced from portal identity configuration.
- Added a focused portal visual contract test.

## Intentionally untouched

Financial logic, tenancy lifecycle, payment processing, authentication/authorization rules, database business models, and authenticated dashboards.
