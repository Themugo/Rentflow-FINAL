import { Building2, Home, Landmark, type LucideIcon } from "lucide-react";

const TYPES: { name: string; tagline: string; icon: LucideIcon }[] = [
  { name: "Residential", tagline: "Apartments, estates and rental communities.", icon: Home },
  { name: "Commercial", tagline: "Retail and mixed-use properties.", icon: Building2 },
  { name: "Office", tagline: "Office buildings and managed workspaces.", icon: Landmark },
];

/** Compact property-type strip — three equal panels, small icon + one line each. */
export function PropertyTypeSlider() {
  return (
    <section className="scroll-mt-20 border-b border-border bg-background py-8 sm:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="public-section-title">Built for the way property is managed.</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Residential, commercial and office — one workspace.
          </p>
        </div>
        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          {TYPES.map((type) => (
            <li
              key={type.name}
              className="rounded-[12px] border border-border bg-card p-4 shadow-sm transition-shadow duration-200 hover:shadow-md"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <type.icon className="h-4 w-4" aria-hidden />
              </span>
              <h3 className="font-heading mt-3 text-sm font-semibold text-foreground">{type.name}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{type.tagline}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
