import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Search } from "lucide-react";
import { BrandMark } from "@/shared/components/branding/BrandMark";
import { Button } from "@/shared/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/shared/components/ui/sheet";
import { usePublicSiteConfig } from "@/features/marketing/hooks/usePublicSiteConfig";
import { DEFAULT_PUBLIC_SITE_CONFIG } from "@/features/marketing/publicSiteConfig";
import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";

const navClass = "inline-flex min-h-10 items-center rounded-lg px-3 py-2 font-heading text-[15px] font-semibold tracking-[-0.005em] text-white/95 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

function HeaderLink({ href, label, onClick, active }: { href: string; label: string; onClick?: () => void; active?: boolean }) {
  if (href.startsWith("#")) return <a href={href} onClick={onClick} className={`${navClass} ${active ? "bg-white/12 text-white shadow-[inset_0_-2px_0_rgba(255,255,255,0.9)]" : ""}`}>{label}</a>;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) return <a href={href} target="_blank" rel="noreferrer" onClick={onClick} className={`${navClass} ${active ? "bg-white/12 text-white shadow-[inset_0_-2px_0_rgba(255,255,255,0.9)]" : ""}`}>{label}</a>;
  return <Link to={href} onClick={onClick} className={`${navClass} ${active ? "bg-white/12 text-white shadow-[inset_0_-2px_0_rgba(255,255,255,0.9)]" : ""}`}>{label}</Link>;
}

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { data } = usePublicSiteConfig();
  const config = data ?? DEFAULT_PUBLIC_SITE_CONFIG;
  const utilityWords = config.shell.header.utilityWords.filter(Boolean).slice(0, 3);
  const visibleSections = new Set(config.sections.filter((section) => section.visible).map((section) => section.id));
  const navItems = config.shell.header.nav.filter((item) => item.enabled).filter((item) => {
    if (!item.href.startsWith("#")) return true;
    const anchor = item.href.slice(1);
    if (anchor === "quick-search") return config.rail.visible;
    return visibleSections.has(anchor as (typeof config.sections)[number]["id"]);
  });
  return (
    <header className="sticky top-0 z-40 border-b border-[#0B2B7A] bg-[#123FB7] text-white shadow-[0_10px_28px_rgba(12,47,128,0.18)]">
      <div className="mx-auto flex h-[66px] max-w-[1480px] items-center justify-between gap-3 px-3 sm:px-4 lg:px-6">
        <Link to={PUBLIC_ROUTES.home} className="flex min-w-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success" aria-label="CALQULUS home">
          <BrandMark size="nav" showWordmark subtitleOverride={config.brand.descriptor} wordmarkOverride={config.brand.name} logoUrl={config.brand.logoUrl} fetchPriority="high" forcePlatform inverse />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
          {navItems.map((item) => <HeaderLink key={item.id} href={item.href} label={item.label} active={item.href === pathname || item.href === `#${window.location.hash.slice(1)}`} />)}
        </nav>
        <div className="flex items-center gap-1.5">
          <a href={config.rail.visible ? "#quick-search" : "#property-types"} className="hidden h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-[#0B2B7A] text-white transition hover:bg-white/10 sm:flex" aria-label={config.shell.header.searchLabel}><Search className="h-4 w-4"/></a>
          <Button asChild size="sm" className="min-h-9 rounded-lg bg-white px-4 font-heading text-sm font-semibold text-[#123FB7] shadow-sm hover:bg-white/90"><Link to={PUBLIC_ROUTES.portalAccessSignIn}>{config.shell.header.signInLabel}</Link></Button>
          <div className="hidden h-9 w-[58px] flex-col justify-center font-heading text-[10px] font-bold leading-3.5 tracking-[0.22em] text-white/90 xl:flex">{utilityWords.map((word) => <span key={word}>{word}</span>)}</div>
          <Sheet open={open} onOpenChange={setOpen}>
            <Button type="button" variant="outline" size="icon" className="border-white/20 bg-[#0B2B7A] text-white hover:bg-white/10 hover:text-white lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu className="h-4 w-4"/></Button>
            <SheetContent side="right" className="w-[min(100%,20rem)] border-white/15 bg-[#123FB7] text-white">
              <SheetHeader><SheetTitle className="text-left font-heading text-white">{config.brand.name}</SheetTitle><SheetDescription className="text-left text-white/80">Property operations platform</SheetDescription></SheetHeader>
              <nav aria-label="Mobile" className="mt-6 flex flex-col gap-1">{navItems.map((item) => <HeaderLink key={item.id} href={item.href} label={item.label} onClick={() => setOpen(false)} active={item.href === pathname || item.href === `#${window.location.hash.slice(1)}`} />)}<div className="mt-4 border-t border-white/15 pt-4"><HeaderLink href={config.rail.visible ? "#quick-search" : "#property-types"} label={config.shell.header.searchLabel} onClick={() => setOpen(false)}/><Button asChild className="mt-2 min-h-10 w-full bg-white font-heading text-[#123FB7] shadow-sm hover:bg-white/90"><Link to={PUBLIC_ROUTES.portalAccessSignIn} onClick={() => setOpen(false)}>{config.shell.header.signInLabel}</Link></Button></div></nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <span className="sr-only">Current path: {pathname}</span>
    </header>
  );
}
