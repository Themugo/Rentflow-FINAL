# CALQULUS Public Experience + Portal Configuration — Initiative Record

## Scope

Rebuilt the public CALQULUS experience as a premium, light public surface with navy/emerald master identity, premium property imagery, four portal experiences, property discovery, featured/promotional surfaces and a conversion CTA.

## Configuration architecture

- Persisted platform-level configuration: `platform_public_site_config`.
- Public read boundary: `get_public_site_config()`.
- Admin write boundary: `save_public_site_config(...)`, requiring an active platform administrator with `can_manage_platform_settings`.
- Public media bucket: `public-site-media`, anonymous read / platform-settings-admin write.
- No changes to private property, tenancy, billing or authentication tables.
- Existing Brand Studio and portal identity architecture remain intact.

## Editable surface

Hero, desktop/mobile imagery, fit-to-screen/window mode, overlay, autoplay and timing; property categories; portal cards; featured properties; promotional/ad cards; platform value content; CTA content/destinations; section visibility/order/approved layout variants; public header labels; footer tagline and column visibility.

## Routing

The homepage uses existing manager/landlord/agency/tenant authentication routes. Property category cards use explicit public discovery routes under `/discover/:category`; those pages intentionally do not expose private manager portfolio records and are ready for future published listing inventory.

## Verification

- TypeScript/JSX syntax for all changed TypeScript files was transpile-validated with the repository's TypeScript compiler before dependency cleanup.
- Local `@/` imports were checked across `src`; no unresolved local aliases were found.
- Package manifests were verified unchanged from the supplied project archive.
- A full `npm ci` / application test run could not be completed in this environment because dependency installation timed out and the available npm cache did not contain all required packages. This is an environment/dependency-availability limitation, not evidence of a passing full suite.
- The interrupted dependency directory was removed before packaging so the delivered ZIP contains the complete project source, not a partial `node_modules` tree.
