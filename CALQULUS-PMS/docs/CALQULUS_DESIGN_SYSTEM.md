# CALQULUS Design System — Canonical Source of Truth

**Version:** 2.0 · Phase 1 foundation  
**Status:** Active  
**Scope:** Web/PWA product UI, public marketing surfaces, shared components

This document is the canonical visual foundation for CALQULUS. Existing design specifications that conflict with these tokens are historical and must not be treated as implementation authority.

## 1. Design direction

CALQULUS uses a warm, editorial property-institution aesthetic rather than a generic blue SaaS look:

- **Ivory** is the default page canvas.
- **Deep teal** is the CALQULUS brand and primary interaction colour.
- **Ink** carries headings, data and operational text.
- **Sage** and pale teal provide quiet supporting surfaces.
- **Warm borders** define structure without heavy boxes.
- **Outfit** remains the operational UI font.
- **Georgia / Times New Roman** is the display-serif fallback for editorial headings. No external font dependency is introduced.
- Shadows are sparse and soft.
- Gradients and glassmorphism are not part of the active product system.
- Rounded corners are restrained: 4px small, 6px medium, 8px large. Pills are reserved for status, tags and compact controls.

## 2. Canonical colour tokens

| Token | Value | Use |
|---|---|---|
| Ivory | `#F3EEE3` | Default page canvas |
| Ivory Soft | `#F7F3EA` | Quiet sections, secondary surfaces |
| Ivory Deep | `#EAE4D7` | Subtle contrast surfaces |
| Teal | `#1F625C` | Primary brand, actions, active states |
| Teal Deep | `#174F4A` | Hover, deep chrome |
| Teal Mid | `#2D7069` | Secondary brand/chrome |
| Teal Soft | `#DDEBE7` | Soft brand surfaces |
| Teal Pale | `#EDF4F1` | Faint brand backgrounds |
| Ink | `#24221E` | Primary text |
| Ink Muted | `#625F57` | Secondary text |
| Ink Subtle | `#817C72` | Metadata / tertiary text |
| Sage | `#B9D0C9` | Supporting accent |
| Border | `#D8CFBE` | Standard structural border |
| Border Soft | `#E4DDCF` | Quiet dividers |
| White | `#FFFFFF` | Raised/clean surfaces |
| Success | `#2F8061` | Paid, active, healthy |
| Warning | `#A66A16` | Pending, attention |
| Danger | `#B94A48` | Errors, destructive states |
| Info | `#356F6A` | Informational state |

Semantic colours must not be repurposed as decorative brand accents.

## 3. Semantic mapping

- `--primary` → Teal
- `--primary-hover` → Teal Deep
- `--background` → Ivory
- `--surface` / `--card` → White
- `--foreground` → Ink
- `--muted-foreground` → Ink Muted
- `--border` → Border
- `--success` → Success
- `--warning` → Warning
- `--destructive` → Danger
- `--info` → Info

Compatibility aliases remain temporarily so feature code can migrate incrementally without changing business behaviour.

## 4. Typography

**Operational UI:** Outfit, self-hosted in `public/fonts/`.

**Display:** `Georgia, "Times New Roman", serif` via the `--font-heading` token. This intentionally uses an installed/system serif rather than introducing a new runtime font dependency.

Use display serif selectively for major editorial headings; use Outfit for navigation, forms, tables, metrics and operational content.

## 5. Shape and elevation

- Small controls: 4px
- Medium controls: 6px
- Large cards/containers: 8px
- Pills: status/tag/compact-control use only
- Prefer borders to shadows for structure.
- Use only restrained elevation for genuinely raised surfaces.
- No decorative glow, glassmorphism or gradient backgrounds in active product surfaces.

## 6. Interaction

Primary button: deep teal background + white text.

Secondary button: transparent/ivory surface + warm border + ink text.

Destructive button: semantic danger red + white text.

Focus rings use the primary teal token.

## 7. Portal identity

Portal identity remains subordinate to the CALQULUS brand. Manager, landlord, agency, tenant and platform-admin accents may identify context, but they must not become independent colour systems. Status colours remain semantic.

## 8. Guardrails for Phase 1

This phase establishes tokens only. It does **not** change:

- authentication or authorization
- Supabase/RLS/RPC behaviour
- payment workflows
- routing
- business rules
- page composition
- product feature scope

Phase 2 will apply these tokens consistently to shared reusable UI components.

## 9. Phase 2 — shared component application

Phase 2 applies the canonical foundation to the reusable UI layer in `src/shared/components/ui`.

### Applied patterns
- Buttons use restrained 6px geometry, teal primary actions, warm/ivory secondary surfaces and no generic elevation.
- Cards use 8px geometry and restrained warm-neutral elevation.
- Form controls (inputs, textareas and selects) use 6px geometry, warm borders and shared focus tokens.
- Badges and compact menu items use 4px geometry where appropriate.
- Alerts use 8px geometry and retain semantic success/warning/info/danger colours.
- Tables use the shared muted/ivory surface hierarchy and warm structural borders.
- Tabs, dialogs, sheets, popovers, menus and overlays use the same restrained geometry and warm-neutral elevation.
- Shared install/notification surfaces no longer use decorative gradients or backdrop blur.
- Existing functional variants and accessibility states are preserved.

### Scope guardrail
Phase 2 changes reusable presentation only. It does not alter data fetching, authentication, authorization, routing, payment processing, database behaviour or feature scope.
