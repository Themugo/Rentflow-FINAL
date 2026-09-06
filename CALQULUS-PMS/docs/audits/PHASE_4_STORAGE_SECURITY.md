# CALQULUS RMS — PHASE 4: STORAGE & DOCUMENT SECURITY HARDENING AUDIT

**Date:** August 11, 2026  
**System:** CALQULUS RMS Storage Subsystem (`storage.buckets` & `storage.objects`)  
**Status:** COMPLETED & HARDENED

---

## 1. EXECUTIVE SUMMARY

Phase 4 audits and hardens security controls for all Supabase Storage buckets and object access policies in CALQULUS RMS. The audit identified that several private buckets (`tenant-photos`, `contracts`, `signed-contracts`) previously used overly broad RLS policies (`FOR SELECT TO authenticated USING (bucket_id = '...')`), allowing any authenticated user—regardless of role or property ownership—to view private documents and photos.

All storage policies on `storage.objects` have been refactored to enforce strict role-based and ownership-based access boundaries following CALQULUS's core role architecture:
- **Tenant Isolation:** Tenants can only view/upload photos and contracts associated with their own tenant record or user account.
- **Manager Isolation:** Managers and submanagers can only access documents and photos for properties and tenants under their direct management.
- **Landlord Boundary:** Landlords can only access signed lease contracts and maintenance photos for properties they own (`property_landlords`).
- **Webhost Firewall:** Webhosts are strictly blocked from viewing tenant photos and tenant lease contracts, preserving the platform firewall against tenant PII exposure. Webhosts retain access only to manager platform subscription contracts.
- **Public Assets:** Property images, profile photos, and company logos remain publicly viewable for application UI rendering, while upload/update/delete operations are restricted to object owners and property managers.

---

## 2. BUCKET INVENTORY & CLASSIFICATION

| Bucket ID | Visibility | Classification | Content Description | Access Control Strategy |
| :--- | :--- | :--- | :--- | :--- |
| `profile-photos` | `public` | Public Asset | User avatar images | Public read; owner insert/update/delete (`folder = auth.uid()`) |
| `company-logos` | `public` | Public Asset | Organization branding logos | Public read; owner insert/update/delete (`folder = auth.uid()`) |
| `property-images` | `public` | Public Asset | Property & unit marketing photos | Public read; manager/submanager/owner write |
| `tenant-photos` | `private` | Sensitive PII | Tenant headshots & identity photos | Tenant (own photo), Manager/Submanager (their tenants). Webhost blocked. |
| `contracts` | `private` | Confidential | Platform subscription contracts & templates | Manager/Webhost (for manager contracts), Manager/Tenant/Submanager (for lease contracts). |
| `signed-contracts` | `private` | Confidential | Legally binding signed lease agreements | Tenant (own lease), Manager/Submanager (their leases), Landlord (their properties). |
| `maintenance-photos` | `private` | Internal | Maintenance, inspection, & meter photos | Tenant (own tickets/unit), Manager/Submanager (their properties), Landlord (their properties). |

---

## 3. AUDIT FINDINGS & VULNERABILITY ANALYSIS

### Finding 4.1: Over-Permissive READ Access on `tenant-photos`
- **Severity:** HIGH
- **Previous Policy:** `CREATE POLICY "tenant_photos_authenticated_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'tenant-photos');`
- **Vulnerability:** Any authenticated user (including Tenant A, Manager B, or Webhost) could construct or request any object path in `tenant-photos` and view tenant identity photos.
- **Remediation:** Restricted SELECT policy to:
  1. The tenant themselves (`(storage.foldername(name))[1] = tenant_id` or `auth.uid() = owner`).
  2. The manager managing the tenant (`tenant_id` in manager's `tenants` table).
  3. Authorized submanagers.

### Finding 4.2: Over-Permissive READ Access on `signed-contracts` & `contracts`
- **Severity:** HIGH
- **Previous Policy:** `CREATE POLICY "signed_contracts_authenticated_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'signed-contracts');`
- **Vulnerability:** Unrestricted access across tenants and managers to legally binding contracts.
- **Remediation:** Enforced folder and record scoping:
  1. `signed-contracts`: Accessible only by tenant matching lease folder path or tenant_id, managing manager/submanager, or property landlord.
  2. `contracts`: Manager subscription contracts (`manager-contracts/{manager_id}/...`) accessible by that manager or webhost; lease/property contracts accessible by tenant or manager.

### Finding 4.3: Missing Read Scoping on `maintenance-photos`
- **Severity:** MEDIUM
- **Previous State:** Insert policy existed for managers (`Manager_upload_maintenance_photos`), but read access lacked explicit tenant/landlord relationship verification.
- **Remediation:** Standardized SELECT policy so tenants see maintenance photos for their requests, managers/submanagers see photos for their properties, and landlords see photos for their owned properties.

---

## 4. REMEDIATION MIGRATION SUMMARY

Migration file: `supabase/migrations/20260811000002_storage_security_hardening.sql`

Key SQL policies established:
1. `tenant_photos_scoped_select` - Tenant, Manager, Submanager access only.
2. `tenant_photos_scoped_insert` - Tenant (own folder) or Manager/Submanager upload.
3. `signed_contracts_scoped_select` - Tenant, Manager, Submanager, Landlord access.
4. `signed_contracts_scoped_insert` - Manager, Submanager, or Tenant upload.
5. `contracts_scoped_select` - Scoped by manager subscription vs lease contracts.
6. `maintenance_photos_scoped_select` - Tenant, Manager, Submanager, Landlord access.
7. `property_images_scoped_write` - Manager, Submanager, or owner write access.

---

## 5. CERTIFICATION & VERIFICATION

- **Automated Test Suite:** `src/test/isolation/storage-security-certification.test.ts`
- **Verification Criteria:**
  1. Tenant A cannot read Tenant B's photo or signed contract.
  2. Manager A cannot read Manager B's contracts or tenant photos.
  3. Webhost cannot read tenant photos or tenant signed contracts (Webhost Firewall verified).
  4. Landlord can access signed contracts for their assigned properties.
  5. Public assets (`property-images`, `profile-photos`, `company-logos`) remain accessible for UI rendering.

---

**Certified by:** CALQULUS Security & Engineering Team  
**Migration:** `20260811000002_storage_security_hardening.sql`
