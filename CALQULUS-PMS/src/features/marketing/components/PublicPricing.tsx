import { Link } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { FALLBACK_COMMERCIAL_TIERS, formatKes, type CommercialTier } from "@/shared/lib/commercialCatalog";
import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";

interface PublicPricingProps {
  tiers: CommercialTier[];
}

export function PublicPricing({ tiers }: PublicPricingProps) {
  const safeTiers = (Array.isArray(tiers) ? tiers : []).filter(Boolean).map((tier) => ({
    ...tier,
    displayName: typeof tier.displayName === "string" && tier.displayName.trim() ? tier.displayName : "Starter",
    audience: typeof tier.audience === "string" ? tier.audience : "Property professionals",
    description: typeof tier.description === "string" ? tier.description : "Connected property operations.",
    pricePerProperty: Number.isFinite(Number(tier.pricePerProperty)) ? Number(tier.pricePerProperty) : 0,
    maxProperties: Number.isFinite(Number(tier.maxProperties)) ? Number(tier.maxProperties) : 0,
    maxUnits: Number.isFinite(Number(tier.maxUnits)) ? Number(tier.maxUnits) : 0,
    highlights: Array.isArray(tier.highlights) ? tier.highlights.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [],
  }));
  const displayTiers = safeTiers.length ? safeTiers : FALLBACK_COMMERCIAL_TIERS;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {displayTiers.map((tier) => (
        <article
          key={tier.tierKey}
          className={cn(
            "flex min-w-0 flex-col rounded-xl border border-border bg-card p-6 shadow-[0_10px_28px_rgba(16,42,67,0.06)]",
            tier.featured && "border-primary/40",
          )}
        >
          {tier.featured && (
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Most used
            </p>
          )}
          <h3 className="font-heading text-xl font-semibold tracking-[-0.02em] text-navy-deep">{tier.displayName}</h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{tier.audience}</p>
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground/90">{tier.description}</p>
          <div className="mt-4">
            {tier.customPricing ? (
              <p className="text-3xl font-bold text-foreground">Custom</p>
            ) : (
              <p className="text-3xl font-bold text-foreground">
                {formatKes(tier.pricePerProperty)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  / property / month
                </span>
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {tier.maxProperties >= 999
                ? "Capacity by agreement"
                : `Up to ${tier.maxProperties} properties · ${tier.maxUnits} units`}
            </p>
          </div>
          <ul className="mt-5 flex-1 space-y-2.5 text-sm leading-5.5 text-muted-foreground">
            {tier.highlights.map((item) => (
              <li key={item} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
          <Button
            asChild
            className={cn("mt-5 min-h-11 w-full", !tier.customPricing && "btn-brand")}
            variant={tier.customPricing ? "outline" : "default"}
          >
            <Link to={tier.customPricing ? `${PUBLIC_ROUTES.home}#cta` : PUBLIC_ROUTES.portalAccessSignUp}>
              {tier.customPricing ? "Talk to us" : `Start with ${tier.displayName}`}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </article>
      ))}
    </div>
  );
}
