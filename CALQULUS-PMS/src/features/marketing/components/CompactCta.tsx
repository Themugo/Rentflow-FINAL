import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { ArchitecturalSurface } from "@/features/marketing/components/ArchitecturalSurface";
import { FINAL_CTA, PUBLIC_ROUTES } from "@/features/marketing/publicConfig";
import { PROPERTY_THUMBS } from "@/features/marketing/propertyImages";

/** Deep-navy final CTA — compact, faint property photograph behind the copy. */
export function CompactCta() {
  return (
    <section id="contact" className="scroll-mt-20 bg-background py-8 sm:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[16px] bg-navy-deep px-6 py-8 sm:px-10 sm:py-9">
          <div className="pointer-events-none absolute inset-0 opacity-15" aria-hidden>
            <ArchitecturalSurface slot="office" imageSrc={PROPERTY_THUMBS.office} />
            <div className="absolute inset-0 bg-gradient-to-r from-navy-deep via-navy-deep/70 to-navy-deep/30" />
          </div>
          <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="max-w-xl">
              <h2 className="font-heading text-xl font-bold tracking-tight text-white sm:text-2xl">
                {FINAL_CTA.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/75 sm:text-[15px]">
                {FINAL_CTA.copy}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Button asChild size="lg" className="btn-brand min-h-11">
                <Link to={PUBLIC_ROUTES.portalAccessSignUp}>
                  {FINAL_CTA.primary}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="min-h-11 border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link to={PUBLIC_ROUTES.portalAccessSignIn}>{FINAL_CTA.secondary}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
