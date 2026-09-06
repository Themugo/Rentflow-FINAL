# CALQULUS Public Site Configuration

The public marketing experience is now a persisted, platform-controlled presentation layer. It does not replace property, tenancy, billing, authentication, or portal data models.

## Admin control

WebHost administrators with `can_manage_platform_settings` can use **WebHost → Public Site** to publish:

- Hero copy, desktop/mobile artwork, overlay, sizing and slider timing.
- Property-category titles, descriptions, imagery, visibility and public destination.
- Manager, Landlord, Agency and Tenant portal presentation and imagery while retaining their real authentication destinations.
- Featured-property placeholders and promotional/ad cards.
- Homepage section visibility, order and approved density variants.

## Security model

The public site reads through `get_public_site_config()` and therefore exposes only the presentation JSON. The configuration table is not directly readable or writable by public clients. Writes go through `save_public_site_config(...)`, which checks the authenticated platform administrator's `can_manage_platform_settings` authority.

Public-site media lives in the `public-site-media` bucket. Anonymous reads are allowed because published homepage imagery is public; uploads and mutations require the same platform-settings authority.

## Design guardrails

The CMS is deliberately not an arbitrary page builder. Administrators control content and composition while the CALQULUS design system remains responsible for typography, accessibility, responsive behavior, navigation, status semantics and portal security.
