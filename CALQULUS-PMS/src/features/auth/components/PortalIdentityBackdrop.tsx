import { usePortalIdentity } from "@/core/product/PortalIdentityProvider";
import type { PortalId } from "@/core/product/portals";

export function PortalIdentityBackdrop({ portal, fallbackImage }: { portal: PortalId; fallbackImage: string }) {
  const { identity } = usePortalIdentity();
  const image = identity.portalId === portal ? identity.backgroundImageUrl : fallbackImage;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <img src={image || fallbackImage} alt="" loading="lazy" decoding="async" className="h-full w-full scale-105 object-cover opacity-25 blur-[2px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-navy-deep/90 via-navy-deep/80 to-navy-deep/93" />
    </div>
  );
}
