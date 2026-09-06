import calqulusPropertyMark from "@/assets/branding/calqulus-property-mark.svg";
import { cn } from "@/shared/lib/utils";
import { PLATFORM_BRAND } from "@/core/brand/resolve";
import { useWhiteLabel } from "@/core/whiteLabel/WhiteLabelProvider";

const MARK_SIZE = {
  xs: "h-5 w-5",
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
  nav: "h-8 w-8",
  hero: "h-14 w-auto",
} as const;

interface BrandMarkProps {
  size?: keyof typeof MARK_SIZE;
  showWordmark?: boolean;
  subtitle?: string;
  className?: string;
  imgClassName?: string;
  fetchPriority?: "high" | "low" | "auto";
  /** Use on navy/dark public surfaces so the wordmark stays readable. */
  inverse?: boolean;
  /** Marketing, login, and platform admin always show CALQULUS. */
  forcePlatform?: boolean;
  /** Optional public-site override for the mark. */
  logoUrl?: string | null;
  /** Optional public-site override for the wordmark text. */
  wordmarkOverride?: string;
  /** Optional public-site override for the descriptor below the wordmark. */
  subtitleOverride?: string;
}

/** Shared mark for login, header, sidebar, footer, and mobile chrome. */
export function BrandMark({
  size = "md",
  showWordmark = false,
  subtitle = "PMS",
  className,
  imgClassName,
  fetchPriority,
  inverse = false,
  forcePlatform = false,
  logoUrl,
  wordmarkOverride,
  subtitleOverride,
}: BrandMarkProps) {
  const { brand, config } = useWhiteLabel();
  const resolved = forcePlatform ? PLATFORM_BRAND : brand;
  const orgLogo =
    !forcePlatform && resolved.source === "organization"
      ? (inverse && config.identity.logoDark) || resolved.logoUrl
      : null;
  const logoSrc = logoUrl || orgLogo || calqulusPropertyMark;
  const wordmark = wordmarkOverride?.trim() || resolved.name;
  const resolvedSubtitle = subtitleOverride !== undefined ? subtitleOverride : subtitle;
  const square = size !== "hero";
  const priority = fetchPriority ?? (size === "hero" ? "high" : "auto");
  return (
    <div className={cn("flex items-center gap-2.5 min-w-0", className)}>
      <img
        src={logoSrc}
        alt={`${wordmark}${resolvedSubtitle ? ` ${resolvedSubtitle}` : ""}`}
        width={56}
        height={56}
        decoding="async"
        fetchPriority={priority}
        className={cn(
          MARK_SIZE[size],
          "object-contain flex-shrink-0",
          square && "rounded-lg",
          imgClassName,
        )}
      />
      {showWordmark && (
        <div className="min-w-0">
          <p className={cn(
            "font-heading font-bold text-sm tracking-tight leading-none truncate",
            inverse ? "text-white" : "text-foreground",
          )}>
            {wordmark}
          </p>
          {resolvedSubtitle ? (
            <p className={cn(
              "text-[10px] font-medium tracking-wider uppercase mt-1 truncate",
              inverse ? "text-white/60" : "text-muted-foreground",
            )}>
              {resolved.source === "platform" && resolved.workspaceName && resolvedSubtitle === "PMS"
                ? resolved.workspaceName
                : resolvedSubtitle}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
