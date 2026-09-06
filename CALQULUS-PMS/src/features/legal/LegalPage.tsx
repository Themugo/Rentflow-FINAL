import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Shield, FileText } from 'lucide-react';
import { PublicShell } from '@/features/marketing/components/PublicShell';
import { cn } from '@/shared/lib/utils';

const LAST_UPDATED = 'May 2026';
const COMPANY     = 'CALQULUS PMS Ltd';
const EMAIL       = 'legal@calqulus.site';
const COUNTRY     = 'Kenya';

type Tab = 'privacy' | 'terms';

const LegalPage: React.FC = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const paramTab = params.get('tab');
  const defaultTab: Tab = (paramTab === 'terms' || location.hash === '#terms') ? 'terms' : 'privacy';
  const [tab, setTab] = useState<Tab>(defaultTab);

  React.useEffect(() => {
    document.title = tab === 'terms' ? 'Terms of Service | CALQULUS PMS' : 'Privacy Policy | CALQULUS PMS';
  }, [tab]);

  return (
    <PublicShell>
      <div className="border-b border-white/10 bg-navy-primary/80">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2" role="tablist" aria-label="Legal documents">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'privacy'}
              onClick={() => setTab('privacy')}
              className={cn(
                'inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
                tab === 'privacy'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-white/70 hover:bg-white/10 hover:text-white',
              )}
            >
              <Shield className="h-3.5 w-3.5" />
              Privacy Policy
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'terms'}
              onClick={() => setTab('terms')}
              className={cn(
                'inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
                tab === 'terms'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-white/70 hover:bg-white/10 hover:text-white',
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              Terms of Service
            </button>
          </div>
          <p className="text-xs text-white/55">Updated {LAST_UPDATED}</p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="enterprise-card p-6 text-foreground sm:p-8">
          {tab === 'privacy' ? <PrivacyPolicy /> : <TermsOfService />}
        </div>
      </div>
    </PublicShell>
  );
};

// ── Privacy Policy ─────────────────────────────────────────────────────────
const PrivacyPolicy: React.FC = () => (
  <article className="space-y-8 text-sm leading-7">
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground">Last updated: {LAST_UPDATED} · Applies to CALQULUS PMS platform and mobile app</p>
    </div>

    <Section title="1. Who we are">
      <p>{COMPANY} ("CALQULUS PMS", "we", "our") operates the CALQULUS PMS property management platform at calqulus.site. We are registered and operate under the laws of {COUNTRY}.</p>
      <p>Data controller contact: <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a></p>
    </Section>

    <Section title="2. What data we collect">
      <p><strong className="text-foreground">Account data:</strong> name, email address, phone number, and password hash when you register.</p>
      <p><strong className="text-foreground">Tenancy data:</strong> property address, unit number, lease dates, rent amount, deposit amount.</p>
      <p><strong className="text-foreground">Financial data:</strong> invoice amounts, payment dates, M-Pesa transaction codes, bank references. We do not store M-Pesa PINs or full card numbers.</p>
      <p><strong className="text-foreground">Property condition photos:</strong> timestamped images you upload of your rental unit. These are stored securely and only accessible by you and your property manager.</p>
      <p><strong className="text-foreground">Communications:</strong> messages between tenants and managers sent through the platform.</p>
      <p><strong className="text-foreground">Usage data:</strong> login times, pages visited, device type. We do not sell this data.</p>
    </Section>

    <Section title="3. How we use your data">
      <ul className="list-disc pl-5 space-y-1">
        <li>To provide the property management service (invoices, payments, maintenance)</li>
        <li>To process M-Pesa payments via Safaricom Daraja API</li>
        <li>To send rent reminders, receipts, and maintenance updates by email and SMS</li>
        <li>To resolve disputes about property condition at move-out (condition photos)</li>
        <li>To comply with legal obligations in Kenya</li>
        <li>To improve the platform (aggregated, anonymised usage analytics only)</li>
      </ul>
      <p className="mt-2 text-muted-foreground">We do not use your data for advertising. We do not sell your data to third parties.</p>
    </Section>

    <Section title="4. Who we share data with">
      <p><strong className="text-foreground">Safaricom (M-Pesa):</strong> phone number and payment amount when processing STK push payments.</p>
      <p><strong className="text-foreground">Resend (email):</strong> your email address and invoice details when sending notifications.</p>
      <p><strong className="text-foreground">Africa's Talking (SMS):</strong> your phone number and message content when sending SMS alerts.</p>
      <p><strong className="text-foreground">Supabase (database):</strong> all platform data is stored on Supabase infrastructure (AWS us-east-1).</p>
      <p><strong className="text-foreground">Your property manager:</strong> your contact details, payment history, and tenancy information are visible to the manager who manages your property.</p>
      <p><strong className="text-foreground">Landlords:</strong> landlords linked to a property can see property-level financial summaries but <em>cannot see individual tenant names, contact details, or personal information</em>.</p>
    </Section>

    <Section title="5. Your rights under the Kenya Data Protection Act 2019">
      <ul className="list-disc pl-5 space-y-1">
        <li><strong className="text-foreground">Access:</strong> request a copy of all personal data we hold about you</li>
        <li><strong className="text-foreground">Correction:</strong> request correction of inaccurate data</li>
        <li><strong className="text-foreground">Deletion:</strong> request deletion of your account and data (subject to legal retention requirements)</li>
        <li><strong className="text-foreground">Objection:</strong> object to processing of your data for certain purposes</li>
        <li><strong className="text-foreground">Portability:</strong> receive your data in a machine-readable format</li>
      </ul>
      <p className="mt-2">To exercise these rights, email <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a>. We will respond within 21 days.</p>
    </Section>

    <Section title="6. Data retention">
      <p>We retain your data for as long as your account is active plus 7 years (required by Kenya's tax laws for financial records). Payment transaction records and receipts are kept for 7 years. Property condition photos are retained for 1 year after your tenancy ends. You may request early deletion of non-financial data.</p>
    </Section>

    <Section title="7. Security">
      <p>All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Access to production data is restricted to authorised personnel. We conduct regular security reviews. No system is perfectly secure — if you suspect unauthorised access to your account, contact us immediately at {EMAIL}.</p>
    </Section>

    <Section title="8. Changes to this policy">
      <p>We will notify you by email at least 14 days before making material changes to this policy. Continued use of the platform after the effective date constitutes acceptance.</p>
    </Section>
  </article>
);

// ── Terms of Service ────────────────────────────────────────────────────────
const TermsOfService: React.FC = () => (
  <article className="space-y-8 text-sm leading-7">
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Terms of Service</h1>
      <p className="text-muted-foreground">Last updated: {LAST_UPDATED} · Governing law: {COUNTRY}</p>
    </div>

    <Section title="1. Acceptance">
      <p>By creating a CALQULUS PMS account, you agree to these Terms of Service and our Privacy Policy. If you are registering on behalf of a business, you confirm you have authority to bind that business.</p>
    </Section>

    <Section title="2. The service">
      <p>CALQULUS PMS provides a software platform for property managers, landlords, and tenants to manage rental properties, including invoicing, payment tracking, maintenance requests, and communications. CALQULUS PMS is not a party to any lease or tenancy agreement created through the platform.</p>
    </Section>

    <Section title="3. Manager responsibilities">
      <ul className="list-disc pl-5 space-y-1">
        <li>Maintain accurate property and tenant records</li>
        <li>Issue invoices that reflect genuine rent obligations</li>
        <li>Not use the platform to harass, threaten, or unlawfully charge tenants</li>
        <li>Comply with the Landlord and Tenant (Shops, Hotels and Catering Establishments) Act and any applicable rental laws</li>
        <li>Pay platform subscription fees within the stated due dates</li>
      </ul>
    </Section>

    <Section title="4. Tenant protections">
      <p>The following features exist specifically to protect tenants:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong className="text-foreground">Self-initiated payments only:</strong> M-Pesa STK push requests can only be initiated by the tenant — managers cannot push payment requests to your phone without your consent.</li>
        <li><strong className="text-foreground">Condition photos:</strong> timestamped move-in photos create immutable evidence for deposit disputes.</li>
        <li><strong className="text-foreground">Payment diary:</strong> tenants can log cash payments independently of the manager's records.</li>
        <li><strong className="text-foreground">Data isolation:</strong> landlords linked to properties cannot see your personal contact information.</li>
      </ul>
    </Section>

    <Section title="5. Payments">
      <p>CALQULUS PMS processes M-Pesa payments via Safaricom Daraja API. By initiating a payment, you authorise the debit from your M-Pesa account. CALQULUS PMS is not responsible for Safaricom service outages. All payment records are logged and immutable — we cannot alter or delete payment receipts once issued.</p>
      <p className="mt-2">Platform subscription fees for managers are invoiced monthly. Accounts with invoices overdue by 30 days are suspended. Reinstatement is automatic upon payment.</p>
    </Section>

    <Section title="6. Prohibited uses">
      <ul className="list-disc pl-5 space-y-1">
        <li>Creating false invoices or charging tenants for services not rendered</li>
        <li>Using the platform to facilitate unlawful eviction</li>
        <li>Attempting to circumvent the M-Pesa tenant-only payment protection</li>
        <li>Sharing platform credentials with unauthorised parties</li>
        <li>Scraping, reverse-engineering, or reselling the platform</li>
      </ul>
      <p className="mt-2">Violation of these terms will result in immediate account suspension without refund.</p>
    </Section>

    <Section title="7. Liability">
      <p>CALQULUS PMS provides the platform "as is". We are not liable for: disputes between landlords and tenants; losses arising from M-Pesa service outages; data loss due to events beyond our reasonable control. Our total liability to any party in any 12-month period shall not exceed the subscription fees paid to us in that period.</p>
    </Section>

    <Section title="8. Governing law">
      <p>These terms are governed by the laws of Kenya. Disputes shall be resolved in the courts of Nairobi, Kenya.</p>
    </Section>

    <Section title="9. Contact">
      <p>Questions about these terms: <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a></p>
    </Section>
  </article>
);

// ── Helpers ────────────────────────────────────────────────────────────────
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section>
    <h2 className="text-base font-semibold text-foreground mb-3 pb-1 border-b border-border">{title}</h2>
    <div className="space-y-2 text-muted-foreground">{children}</div>
  </section>
);

export default LegalPage;
