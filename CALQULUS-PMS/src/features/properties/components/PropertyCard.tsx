import { memo, useMemo, useCallback, useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { MapPin, ChevronDown, ChevronRight, Eye, Layers, Pencil, Trash2 } from "lucide-react";
import { CATEGORY_BY_KEY } from "@/shared/constants/propertyTypes";
import { occupancyRateColor } from "@/shared/lib/statusBadge";
import { deskPropertyPath, useDeskEmbed } from "@/shared/components/layout/DeskEmbed";

export interface Property {
  id: string;
  name: string;
  address: string;
  house_number: string | null;
  units: number;
  occupied: number;
  revenue: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  category_key?: string;
  property_type?: string;
  number_of_floors?: number;
  rent_per_house?: number;
  house_label_prefix?: string;
  payment_details?: string;
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  unit: string | null;
  property_id: string | null;
  status: string;
}

interface PropertyCardProps {
  property: Property;
  index: number;
  tenants: Tenant[];
  isSelected: boolean;
  formatCurrency: (amount: number) => string;
  onEdit: (property: Property) => void;
  onDelete: (property: Property) => void;
}

// Legacy category labels
const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  flat: "Flat / Apartment Block",
  villa: "Villa",
  bungalow: "Bungalow / Maisonette",
  mixed_use: "Mixed Use",
  apartment: "Flat / Apartment Block",
  townhouse: "Townhouse",
  commercial: "Office / Commercial",
};

// Memoized category label computation
const getCategoryLabel = (property: Property): string => {
  const catKey = property.category_key || property.property_type || "residential_flat";
  const cat = CATEGORY_BY_KEY[catKey];
  if (cat) return cat.name;
  return LEGACY_CATEGORY_LABELS[catKey] || catKey;
};

// Occupancy color uses design-system semantic tokens
const getOccupancyColor = (rate: number): string => occupancyRateColor(rate);

// Optimized PropertyCard with memoization
export const PropertyCard = memo<PropertyCardProps>(({
  property,
  index,
  tenants,
  isSelected,
  formatCurrency,
  onEdit,
  onDelete,
}) => {
  // Memoize expensive calculations
  const occupancyRate = useMemo(() => 
    property.units > 0 ? (property.occupied / property.units) * 100 : 0,
    [property.units, property.occupied]
  );
  
  const propertyTenants = useMemo(() => 
    tenants.filter((t) => t.property_id === property.id),
    [tenants, property.id]
  );
  
  const floors = (property as { number_of_floors?: number }).number_of_floors || 1;
  const rentPerHouse = (property as { rent_per_house?: number }).rent_per_house || 0;
  const categoryLabel = useMemo(() => getCategoryLabel(property), [property]);
  const occupancyColor = useMemo(() => getOccupancyColor(occupancyRate), [occupancyRate]);
  
  // Memoize handlers
  const { propertyBase } = useDeskEmbed();
  const detailHref = deskPropertyPath(property.id, { propertyBase });
  const unitsHref = deskPropertyPath(property.id, { propertyBase, query: "tab=units" });

  const handleEdit = useCallback(() => onEdit(property), [onEdit, property]);
  const handleDelete = useCallback(() => onDelete(property), [onDelete, property]);
  
  // Precompute class names
  const vacantUnits = Math.max(0, property.units - property.occupied);
  const cardClassName = `overflow-hidden transition-all duration-200 animate-fade-in hover:shadow-md ${isSelected ? "ring-2 ring-primary" : ""}`;
  const animationDelay = `${Math.min(index * 30, 300)}ms`; // Cap delay for performance

  return (
    <Card
      className={cardClassName}
      style={{ animationDelay }}
    >
      <CardContent className="p-0">
        <div className="flex items-stretch">
          <div className="w-24 h-24 flex-shrink-0 overflow-hidden">
            <LazyPropertyImage 
              src={property.image_url} 
              alt={property.name}
            />
          </div>
          <div className="flex-1 p-3 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link 
                  to={detailHref}
                  className="font-heading font-semibold text-foreground text-sm hover:text-primary transition-colors truncate block"
                >
                  {property.name}
                </Link>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  {property.address}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="min-h-11 min-w-11 h-11 w-11 flex-shrink-0" aria-label="Property actions">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem asChild>
                    <Link to={detailHref} className="flex items-center gap-2">
                      <Eye className="h-4 w-4" /> View Details
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={unitsHref} className="flex items-center gap-2">
                      <Layers className="h-4 w-4" /> Manage Houses
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleEdit}>
                    <Pencil className="h-4 w-4 mr-2" /> Edit Property
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" /> Deactivate
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground min-w-0">
              <span className="font-medium text-foreground truncate">{property.units} units</span>
              <ChevronRight className="h-3 w-3 shrink-0 text-border" />
              <span className="truncate">{property.occupied} occupied</span>
              <ChevronRight className="h-3 w-3 shrink-0 text-border" />
              <span className="truncate">{propertyTenants.length} tenant{propertyTenants.length !== 1 ? "s" : ""}</span>
            </div>
            <div
              className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(occupancyRate)}
              aria-label={`${Math.round(occupancyRate)} percent occupied`}
            >
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, Math.max(0, occupancyRate))}%` }}
              />
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {categoryLabel}
              </Badge>
              <span className={`text-xs font-medium ${occupancyColor}`}>
                {occupancyRate.toFixed(0)}% occupied
              </span>
              {vacantUnits > 0 && (
                <span className="text-xs text-muted-foreground">{vacantUnits} vacant</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-t border-border text-xs">
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">{floors} floor{floors !== 1 ? "s" : ""}</span>
            {rentPerHouse > 0 && (
              <span className="text-muted-foreground">Rent: {formatCurrency(rentPerHouse)}</span>
            )}
          </div>
          <span className="font-medium text-foreground">{formatCurrency(property.revenue)}</span>
        </div>
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo - only re-render when these specific props change
  return (
    prevProps.property.id === nextProps.property.id &&
    prevProps.property.updated_at === nextProps.property.updated_at &&
    prevProps.property.units === nextProps.property.units &&
    prevProps.property.occupied === nextProps.property.occupied &&
    prevProps.property.revenue === nextProps.property.revenue &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.tenants.length === nextProps.tenants.length
  );
});

// Separate lazy image component to isolate re-renders
const LazyPropertyImage = memo(({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px', threshold: 0 }
    );
    
    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    
    return () => observer.disconnect();
  }, []);
  
  return (
    <img
      ref={imgRef}
      src={isInView ? (src || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=200&h=200&fit=crop") : undefined}
      alt={alt}
      className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
      onLoad={() => setIsLoaded(true)}
      loading="lazy"
      decoding="async"
    />
  );
});
