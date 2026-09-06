# CALQULUS Public Homepage — Premium Compact Composition

The public homepage uses the CALQULUS master identity: light surfaces with navy/emerald chrome, dense desktop composition, premium property imagery, and four portal accents.

## Composition

- Compact hero with a left editorial panel, large property artwork, three compact floating promotional cards, slider controls, and configurable trust pills.
- Property discovery cards for Residentials, Estates, Offices, and Institutions.
- Four portal cards for Property Manager, Landlord, Tenant, and Agency.
- Compact Why CALQULUS value row.
- Featured property cards.
- Responsive right rail with Quick Search, Platform Highlights, and Latest Insights.
- Trust & testimonial card.
- Final conversion CTA and full navy/emerald footer.

## Configuration boundary

Public presentation configuration is persisted through the existing `platform_public_site_config` JSON contract and the permission-gated `save_public_site_config` RPC. No second CMS or private property data store is introduced.

Admin/Public Site Studio can change:

- Header navigation labels and destinations
- Footer columns, newsletter and social labels/links
- Hero slides, artwork, mobile artwork, signature text, CTA links, fit mode, overlay, autoplay and interval
- Hero floating cards and trust pills
- Property categories, order, artwork and destinations
- Portal cards, order, artwork and destinations
- Why CALQULUS cards
- Featured property cards and artwork
- Platform highlights
- Latest insights
- Trust logos and testimonial content
- Quick Search content and category shortcuts
- Main section visibility, order and approved variants
- Right-rail visibility, width and order
- Final CTA content

## Design guardrails

The admin controls content and composition inputs while the application retains control over accessibility, responsive behavior, route security, and private data boundaries.
