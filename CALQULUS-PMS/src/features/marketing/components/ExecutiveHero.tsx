import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { ArchitecturalSurface } from "@/features/marketing/components/ArchitecturalSurface";
import { ProductPreview } from "@/features/marketing/components/ProductPreview";
import { HERO_CONTENT, PUBLIC_ROUTES } from "@/features/marketing/publicConfig";
import { PROPERTY_THUMBS } from "@/features/marketing/propertyImages";

/** Faint Nairobi property photograph behind the dashboard — supports, never competes. */
const propertyEnvironment = (
  <div className="pointer-events-none absolute inset-0" aria-hidden>
    <div className="absolute inset-x-2 -top-6 bottom-10 overflow-hidden rounded-[24px] opacity-30 sm:inset-x-6">
      <div className="absolute inset-0 opacity-60">
        <ArchitecturalSurface slot="residential" imageSrc={PROPERTY_THUMBS.residential} loading="eager" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#F4F7FB] via-transparent to-[#F4F7FB]/70" />
    </div>
  </div>
);

/**
 * Premium light hero — product-first. The manager dashboard preview dominates;
 * a faint property environment sits behind it so the interface stays the focus.
 */
export function ExecutiveHero() {
  return (
    <section className="public-hero-surface-light relative -mt-[72px] overflow-hidden pt-[72px]">
      <div className="public-hero-grid-light pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-10 text-center sm:px-6 sm:pt-12 lg:px-8 lg:pb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          {HERO_CONTENT.eyebrow}
        </p>
        <h1 className="public-hero-title-light mx-auto mt-3 max-w-3xl">
          {HERO_CONTENT.titleLines.join(" ")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-[17px]">
          {HERO_CONTENT.copy}
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
          <Button asChild size="lg" className="btn-brand h-12 min-h-11 px-6">
            <Link to={PUBLIC_ROUTES.portalAccessSignUp}>
              {HERO_CONTENT.primaryCta}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 min-h-11 border-border bg-card/70 px-6 backdrop-blur-sm hover:bg-card"
          >
            <a href="#how-it-works">{HERO_CONTENT.secondaryCta}</a>
          </Button>
        </div>
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
        {propertyEnvironment}
        <div className="relative transition-transform duration-300 ease-out motion-safe:hover:-translate-y-1">
          <ProductPreview elevated />
        </div>
      </div>
    </section>
  );
}

