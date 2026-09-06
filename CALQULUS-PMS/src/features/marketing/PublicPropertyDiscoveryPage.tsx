import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Building2, Home, Landmark } from "lucide-react";
import { PublicShell } from "@/features/marketing/components/PublicShell";
import { Button } from "@/shared/components/ui/button";
import { DEFAULT_PUBLIC_SITE_CONFIG } from "@/features/marketing/publicSiteConfig";
import { usePublicSiteConfig } from "@/features/marketing/hooks/usePublicSiteConfig";
import { PROPERTY_IMAGES } from "@/features/marketing/propertyImages";

const LABELS: Record<string, { title: string; copy: string; image: string; icon: typeof Home }> = {
  residential: { title: "Residential properties", copy: "Explore homes, apartments and rental communities. Published adverts appear here as they are approved.", image: PROPERTY_IMAGES.residential, icon: Home },
  estates: { title: "Estates", copy: "Explore managed estates and multi-unit communities. Published adverts can be routed here from the homepage.", image: PROPERTY_IMAGES.commercial, icon: Building2 },
  offices: { title: "Office properties", copy: "Explore offices and professional workspaces. Published inventory can be connected without changing the homepage.", image: PROPERTY_IMAGES.office, icon: Building2 },
  institutions: { title: "Institutional properties", copy: "Explore purpose-built property portfolios and facilities. Published inventory appears here when approved.", image: PROPERTY_IMAGES.commercial, icon: Landmark },
};

function searchableText(item: { title: string; location: string; detail: string; price: string }) {
  return [item.title, item.location, item.detail, item.price].join(" ").toLowerCase();
}

export function filterPublicListings<T extends { title: string; location: string; detail: string; price: string }>(items: T[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => searchableText(item).includes(normalized));
}

export default function PublicPropertyDiscoveryPage() {
  const { category = "residential" } = useParams();
  const [params] = useSearchParams();
  const mode = params.get("mode") || "all";
  const q = params.get("q")?.trim() || "";
  const current = LABELS[category] || LABELS.residential;
  const Icon = current.icon;
  const { data: publicConfig } = usePublicSiteConfig();
  const config = publicConfig ?? DEFAULT_PUBLIC_SITE_CONFIG;
  const categoryDefinition = config.propertyTypes.find((item) => item.id === category && item.enabled);
  const categoryName = categoryDefinition?.title || current.title;
  const featured = config.featured
    .filter((item) => item.enabled && item.href.includes(`/discover/${category}`))
    .filter((item) => {
      if (mode === "all") return true;
      const haystack = `${item.eyebrow} ${item.detail} ${item.price}`.toLowerCase();
      return mode === "rent" ? /(rent|let|\/mo|monthly)/i.test(haystack) : /(sale|selling|buy|purchase)/i.test(haystack);
    });
  const filtered = filterPublicListings(featured, q);
  const heading = categoryDefinition?.title || current.title;
  const summary = categoryDefinition?.description || current.copy;
  const heroImage = categoryDefinition?.image || current.image;
  const resultLabel = mode === "buy" ? "Properties for sale" : mode === "rent" ? "Properties to let" : "Available listings";
  const noResultsCopy = q
    ? `No published ${categoryName.toLowerCase()} listings match “${q}”. Try a broader location, property name or detail.`
    : `There are no published ${categoryName.toLowerCase()} adverts yet. Once a real advert is activated in Public Site Studio, it will appear here.`;

  return (
    <PublicShell>
      <section className="relative overflow-hidden bg-[#123FB7] text-white">
        <div className="absolute inset-0"><img src={heroImage} alt="" className="h-full w-full object-cover opacity-45"/><div className="absolute inset-0 bg-gradient-to-r from-[#07185E] via-[#123FB7]/82 to-[#123FB7]/22"/></div>
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <Button asChild variant="ghost" className="mb-7 -ml-3 text-white/85 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70">
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4"/>Back to CALQULUS</Link>
          </Button>
          <div className="max-w-2xl">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10"><Icon className="h-5 w-5"/></span>
            <p className="mt-5 text-sm font-bold tracking-[.2em] text-white/90">PROPERTY DISCOVERY</p>
            <h1 className="mt-2 font-heading text-4xl font-semibold tracking-[-.04em] sm:text-6xl">{heading}</h1>
            <p className="mt-5 text-base leading-7 text-white/86 sm:text-lg">{summary}</p>
          </div>
        </div>
      </section>
      <section className="bg-background py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-sm font-bold tracking-[.2em] text-primary">SALE & LETTING</p><h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight">{resultLabel}</h2></div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground sm:text-right">{q ? `Showing published ${categoryName.toLowerCase()} results related to “${q}”.` : "Only published public-site adverts appear here; private portfolio records are never exposed."}</p>
          </div>
          {filtered.length ? (
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {filtered.map((item)=><Link key={item.id} to={item.href} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
                <img src={item.image || current.image} alt="" className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.02]"/>
                <div className="p-5"><p className="text-sm font-semibold text-primary">{item.location}</p><h3 className="mt-1 font-heading text-lg font-semibold text-navy-deep">{item.title}</h3><p className="mt-2 text-sm leading-5 text-muted-foreground">{item.detail}</p><p className="mt-4 text-sm font-semibold text-foreground">{item.price}</p></div>
              </Link>)}
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-8 text-center sm:p-12">
              <Icon className="mx-auto h-7 w-7 text-primary" aria-hidden/>
              <h3 className="mt-3 font-heading text-xl font-semibold text-navy-deep">{q ? "No matching listings" : "Listings coming soon"}</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{noResultsCopy}</p>
              <Button asChild className="btn-brand mt-5"><Link to={q ? `/discover/${category}` : "/"}>{q ? "Clear search" : "Return home"}<ArrowRight className="ml-2 h-4 w-4"/></Link></Button>
            </div>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
