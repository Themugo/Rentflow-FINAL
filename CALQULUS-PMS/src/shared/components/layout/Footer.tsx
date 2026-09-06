import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Globe,
  ShieldCheck,
  HelpCircle,
  FileText,
  Lock,
  Mail,
} from "lucide-react";
import { BrandMark } from "@/shared/components/branding/BrandMark";
import { HelpCenterModal } from "./HelpCenterModal";
import { useWhiteLabel } from "@/core/whiteLabel/WhiteLabelProvider";
import { term } from "@/core/brand/terms";

function copyrightLine(footer: string, year: number): string {
  const stripped = footer.replace(/^©\s*/, "").trim();
  return `© ${year} ${stripped}`;
}

function LegalHref({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return (
      <a href={href} className={className} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

export interface FooterProps {
  variant?: "default" | "compact" | "agency" | "landlord" | "tenant" | "webhost";
  className?: string;
}

export function Footer({ variant = "default", className = "" }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const [helpOpen, setHelpOpen] = useState(false);
  const { config } = useWhiteLabel();
  const managerLabel = term(config, "manager");
  const landlordLabel = term(config, "landlord");
  const tenantLabel = term(config, "tenant");

  // Compact variant for embedded screens or minimal layouts
  if (variant === "compact") {
    return (
      <footer className={`w-full border-t border-border/70 bg-card/40 px-4 md:px-6 py-3 text-xs text-muted-foreground mt-auto ${className}`}>
        <div className="max-w-[1800px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BrandMark size="xs" />
            <span className="font-semibold text-foreground tracking-tight">{config.identity.product}</span>
            <span className="text-muted-foreground/40">•</span>
            <span className="font-mono text-[11px] text-muted-foreground">v2.4.0</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              TLS in transit
            </span>
            <span className="text-muted-foreground/40">•</span>
            <LegalHref href={config.legal.termsUrl} className="hover:text-foreground transition-colors">
              Terms & Privacy
            </LegalHref>
            <span className="text-muted-foreground/40">•</span>
            <span>{copyrightLine(config.legal.footer, currentYear)}</span>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <>
      <footer
        id="app-universal-footer"
        className={`w-full border-t border-border bg-card/60 backdrop-blur-xs text-xs text-muted-foreground mt-auto transition-colors ${className}`}
      >
        {/* Main Footer Content Grid */}
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
            {/* 1. Brand Area (Spans 2 cols on large screens) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <BrandMark size="md" showWordmark subtitle="PMS" />
              </div>

              <p className="text-xs text-muted-foreground/90 leading-relaxed max-w-sm">
                {config.identity.tagline}
              </p>

              {/* System Live Status & Regional Anchor */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-muted border border-border text-[11px] font-medium text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Web application
                </div>

                <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground px-2 py-0.5">
                  <Globe className="h-3.5 w-3.5 text-primary/80" />
                  East Africa (KES / UTC+3)
                </div>
              </div>
            </div>

            {/* 2. Navigation Portals */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                Portals & Access
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link
                    to="/"
                    className="hover:text-primary transition-colors flex items-center gap-1.5 group"
                  >
                    <span>{managerLabel} Dashboard</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/agency"
                    className="hover:text-primary transition-colors flex items-center gap-1.5 group"
                  >
                    <span>Agency Portal</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/landlord/dashboard"
                    className="hover:text-primary transition-colors flex items-center gap-1.5 group"
                  >
                    <span>{landlordLabel} View</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/portal"
                    className="hover:text-primary transition-colors flex items-center gap-1.5 group"
                  >
                    <span>{tenantLabel} Portal</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/webhost"
                    className="hover:text-primary transition-colors flex items-center gap-1.5 group"
                  >
                    <span>Webhost Control</span>
                  </Link>
                </li>
              </ul>
            </div>

            {/* 3. Support & Operations */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                Support & Operations
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    onClick={() => setHelpOpen(true)}
                    className="hover:text-primary transition-colors flex items-center gap-1.5 text-left"
                  >
                    <HelpCircle className="h-3.5 w-3.5 text-primary" />
                    <span>Documentation & Guides</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setHelpOpen(true)}
                    className="hover:text-primary transition-colors flex items-center gap-1.5 text-left"
                  >
                    <Mail className="h-3.5 w-3.5 text-primary" />
                    <span>Contact Operations Desk</span>
                  </button>
                </li>
                <li>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-success" />
                    <span>No SOC 2 / ISO certification claimed</span>
                  </span>
                </li>
                <li>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Lock className="h-3.5 w-3.5 text-primary/80" />
                    <span>HTTPS (TLS) in transit</span>
                  </span>
                </li>
              </ul>
            </div>

            {/* 4. Legal & Compliance */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                Legal & Governance
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <LegalHref
                    href={config.legal.termsUrl}
                    className="hover:text-primary transition-colors flex items-center gap-1.5"
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <span>Terms of Service</span>
                  </LegalHref>
                </li>
                <li>
                  <LegalHref
                    href={config.legal.privacyUrl}
                    className="hover:text-primary transition-colors flex items-center gap-1.5"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <span>Privacy Policy</span>
                  </LegalHref>
                </li>
                <li>
                  <LegalHref
                    href={config.legal.privacyUrl}
                    className="hover:text-primary transition-colors flex items-center gap-1.5"
                  >
                    <span>Data Protection Policy</span>
                  </LegalHref>
                </li>
                <li>
                  <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
                    <span>Kenya Data Protection Act</span>
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 5. Bottom Bar */}
        <div className="border-t border-border/80 bg-background/50 px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-[1800px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 text-muted-foreground">
              <span>{copyrightLine(config.legal.footer, currentYear)}. All rights reserved.</span>
              <span className="hidden sm:inline text-muted-foreground/40">•</span>
              <span className="font-mono text-muted-foreground/80">v2.4.0-enterprise</span>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 sm:gap-5 text-muted-foreground">
              <LegalHref
                href={config.legal.termsUrl}
                className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
              >
                Terms
              </LegalHref>
              <span className="text-muted-foreground/30">•</span>
              <LegalHref
                href={config.legal.privacyUrl}
                className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
              >
                Privacy
              </LegalHref>
              <span className="text-muted-foreground/30">•</span>
              <button
                onClick={() => setHelpOpen(true)}
                className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
              >
                Support
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Global Help Center Modal Triggered from Footer */}
      <HelpCenterModal open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
