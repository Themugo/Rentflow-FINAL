# CALQULUS RMS / PMS — ENTERPRISE DESIGN SYSTEM SPECIFICATION

**Version:** 1.0 Enterprise  
**Brand Archetype:** Professional, Modern, Premium, Minimal, Data-First Enterprise Platform  
**Target Applications:** CALQULUS Property Management System (RMS/PMS) — Web & Mobile PWA

---

## 1. DESIGN TOKENS & COLOR SYSTEM

The visual system is built on strict high-contrast enterprise neutrals and functional semantic accents. It explicitly bans black branding, gold/yellow accenting, random gradients, and glassmorphism.

### 1.1 Palette & Hex Tokens

| Token Name | Hex Code | HSL Representation | Enterprise Usage |
| :--- | :--- | :--- | :--- |
| **Primary (Deep Indigo)** | `#304FFE` | `231 100% 59%` | Primary actions, focused navigation, key interactive triggers |
| **Secondary (Slate Blue)** | `#546E7A` | `201 18% 41%` | Structural elements, secondary buttons, subheaders |
| **Success (Emerald)** | `#00A878` | `163 100% 33%` | Paid invoices, occupied units, active leases, positive metrics |
| **Info / Accent (Sky Blue)**| `#039BE5` | `199 97% 45%` | Informational badges, active tabs, progress indicators |
| **Warning (Soft Orange)** | `#F57C00` | `30 100% 48%` | Pending payments, maintenance alerts, upcoming contract expirations |
| **Destructive (Red)** | `#EF4444` | `0 84% 60%` | Overdue balances, lease terminations, system errors |
| **Background Light** | `#F6F8FB` | `216 43% 97%` | Main viewport canvas, page backgrounds |
| **Surface White** | `#FFFFFF` | `0 0% 100%` | Raised cards, modal dialogs, table rows, dropdown menus |
| **Border Neutral** | `#E5E7EB` | `220 13% 91%` | Clean structural dividers, card outlines |
| **Text Primary** | `#1F2937` | `215 25% 17%` | Headings, high-emphasis typography, data labels |
| **Text Muted** | `#6B7280` | `215 9% 46%` | Secondary descriptions, timestamps, metadata labels |

### 1.2 Dark Mode System Tokens

| Token | HSL Value | Purpose |
| :--- | :--- | :--- |
| `--background` | `215 28% 12%` | Deep Slate canvas background (`#111827`) |
| `--card` | `215 25% 16%` | Raised surface background |
| `--popover` | `215 25% 18%` | Dropdowns and contextual popovers |
| `--border` | `215 20% 24%` | High-legibility border divider |
| `--foreground` | `210 40% 98%` | High-contrast text on dark surfaces |

---

## 2. TYPOGRAPHY & SPACING SYSTEM

### 2.1 Font Stack & Hierarchy
* **Primary System Font:** Outfit, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif.
* Runtime source of truth: `src/index.css` (`@theme` / `--font-sans`). This markdown must not specify Inter.
* **Monospace Font (Data & Numerical):** JetBrains Mono, "Fira Code", monospace.

### 2.2 Mathematical Typographic Scale

| Level | Size | Weight | Line Height | Application |
| :--- | :--- | :--- | :--- | :--- |
| **Display H1** | `24px` (`1.5rem`) | `700` (Bold) | `1.25` | Page titles, key dashboard headlines |
| **Header H2** | `20px` (`1.25rem`) | `600` (SemiBold) | `1.3` | Section headings, modal titles |
| **Subhead H3** | `16px` (`1rem`) | `600` (SemiBold) | `1.4` | Card titles, group labels |
| **Body Large** | `15px` (`0.9375rem`) | `400` / `500` | `1.5` | Lead narrative text |
| **Body Standard**| `14px` (`0.875rem`) | `400` (Regular) | `1.5` | Form inputs, table cell data, body paragraphs |
| **Caption / Label**| `12px` (`0.75rem`) | `500` (Medium) | `1.4` | Table headers, stat card labels, badges |

### 2.3 Spacing & Radius Rules
* **Container Padding:** Standard outer container padding is `16px` (`p-4`) on mobile, `24px` (`p-6`) on desktop.
* **Component Radius:**
  * Small inputs, buttons, badges: `6px` (`rounded-md`, `var(--radius): 0.5rem`).
  * Cards & Containers: `8px` (`rounded-lg`).
  * Modals & Drawers: `12px` (`rounded-xl`).
  * **Rule:** Extreme pill shapes (`rounded-full`) are strictly reserved for circular avatars and status indicator dots.

---

## 3. REUSABLE ENTERPRISE UI COMPONENT SPECIFICATIONS

All reusable UI components are exported from `src/shared/components/ui/` and share strict design token bindings:

### 3.1 Buttons (`button.tsx`)
* **Primary Variant:** `bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/90` (Deep Indigo `#304FFE`).
* **Secondary Variant:** `bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80` (Slate Blue tint).
* **Destructive Variant:** `bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90`.
* **Outline Variant:** `border border-input bg-background hover:bg-muted text-foreground`.
* **Sizes:** `sm` (h-8), `default` (h-9), `lg` (h-10), `icon` (h-9 w-9).

### 3.2 Badges (`badge.tsx`)
* Standardized semantic pill status labels with `border-transparent px-2 py-0.5 text-xs font-semibold rounded-md`:
  * `success`: Emerald `#00A878` tint for Paid/Occupied states.
  * `warning`: Soft Orange `#F57C00` tint for Pending/Maintenance states.
  * `info`: Sky Blue `#039BE5` tint for Neutral metadata.
  * `indigo`: Deep Indigo `#304FFE` tint for System/Role tags.
  * `destructive`: Red `#EF4444` tint for Overdue/Vacant states.

### 3.3 Tables (`table.tsx`)
* Enterprise data table styling with sticky header capabilities:
  * Headers: `bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider h-9 border-b border-border`.
  * Rows: `border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted`.
  * Density: Compact row padding (`py-2.5 px-4`) prioritizing data density over whitespace.

### 3.4 Feedback & Communication States
* **Alerts (`alert.tsx`):** `default`, `destructive`, `success`, `warning`, `info` variants with consistent icon placement.
* **Empty State (`empty-state.tsx`):** Dashed border enclosure (`border-dashed border-border`), icon container, title, description, and primary CTA trigger.
* **Loading State (`loading-state.tsx`):** Centered animated spinner (`Loader2`) with customizable status message.
* **Error State (`error-state.tsx`):** Destructive alert container with explicit "Try Again" recovery callback button.
* **Search Input (`search.tsx`):** Integrated search bar with leading search icon and instant clear (`X`) button.

---

## 4. VERIFICATION & COMPLIANCE

1. **Compilation Check:** Verified clean build via `compile_applet`.
2. **Linting Check:** Verified zero syntax or rule violations via `lint_applet`.
3. **Backend Logic:** Preserved 100% of Supabase RLS policies, RPCs (`get_manager_dashboard_stats`), and Edge Functions.
4. **Role Isolation:** Preserved 6-tier RBAC firewall rules (Webhost, Manager, Agency, Submanager, Landlord, Tenant).
