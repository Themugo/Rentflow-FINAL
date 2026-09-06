import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { TableCell, TableRow } from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Building2, Eye, Layers, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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

interface PropertyTableRowProps {
  property: Property;
  tenantCount: number;
  formatCurrency: (amount: number) => string;
  onEdit: (property: Property) => void;
  onDelete: (property: Property) => void;
}

const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  flat: "Flat / Apartment Block",
  villa: "Villa",
  bungalow: "Bungalow / Maisonette",
  mixed_use: "Mixed Use",
  apartment: "Flat / Apartment Block",
  townhouse: "Townhouse",
  commercial: "Office / Commercial",
};

function getCategoryLabel(property: Property): string {
  const catKey = property.category_key || property.property_type || "residential_flat";
  const cat = CATEGORY_BY_KEY[catKey];
  if (cat) return cat.name;
  return LEGACY_CATEGORY_LABELS[catKey] || catKey;
}

/** Table-row rendering of a property — replaces the card grid so Properties reads
 * as a scannable table (search/filter/sort operate over the same rows). */
export const PropertyTableRow = memo<PropertyTableRowProps>(({
  property,
  tenantCount,
  formatCurrency,
  onEdit,
  onDelete,
}) => {
  const occupancyRate = useMemo(
    () => (property.units > 0 ? (property.occupied / property.units) * 100 : 0),
    [property.units, property.occupied],
  );
  const vacantUnits = Math.max(0, property.units - property.occupied);
  const categoryLabel = useMemo(() => getCategoryLabel(property), [property]);
  const occupancyColor = occupancyRateColor(occupancyRate);
  const { propertyBase } = useDeskEmbed();
  const detailHref = deskPropertyPath(property.id, { propertyBase });
  const unitsHref = deskPropertyPath(property.id, { propertyBase, query: "tab=units" });

  return (
    <TableRow data-testid="property-row">
      <TableCell>
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {property.image_url ? (
              <img src={property.image_url} alt="" className="h-10 w-10 object-cover" loading="lazy" />
            ) : (
              <Building2 className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <Link
              to={detailHref}
              className="font-medium text-foreground text-sm hover:text-primary transition-colors truncate block"
            >
              {property.name}
            </Link>
            <p className="text-xs text-muted-foreground truncate">{property.address}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-[11px] whitespace-nowrap">
          {categoryLabel}
        </Badge>
      </TableCell>
      <TableCell>
        <span className="text-sm text-foreground">{property.units}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${occupancyColor}`}>{occupancyRate.toFixed(0)}%</span>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {property.occupied}/{property.units}
            {vacantUnits > 0 ? ` · ${vacantUnits} vacant` : ""}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">{tenantCount}</span>
      </TableCell>
      <TableCell>
        <span className="text-sm font-medium text-foreground">{formatCurrency(property.revenue)}</span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="sm" className="min-h-11" asChild>
          <Link to={detailHref} aria-label={`View ${property.name}`}>
            <Eye className="h-4 w-4" />
            View
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 min-h-11 min-w-11" aria-label="Property actions">
              <MoreHorizontal className="h-4 w-4" />
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
                <Layers className="h-4 w-4" /> Manage units
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(property)}>
              <Pencil className="h-4 w-4 mr-2" /> Edit Property
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(property)} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Deactivate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}, (prevProps, nextProps) => (
  prevProps.property.id === nextProps.property.id &&
  prevProps.property.updated_at === nextProps.property.updated_at &&
  prevProps.property.units === nextProps.property.units &&
  prevProps.property.occupied === nextProps.property.occupied &&
  prevProps.property.revenue === nextProps.property.revenue &&
  prevProps.tenantCount === nextProps.tenantCount
));
