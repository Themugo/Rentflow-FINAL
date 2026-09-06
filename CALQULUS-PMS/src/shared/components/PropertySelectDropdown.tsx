import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import type { SimpleProperty } from "@/shared/hooks/useManagerPropertiesSimple";

interface PropertySelectDropdownProps {
  properties: SimpleProperty[];
  selectedProperty: string | null;
  onSelect: (propertyId: string | null) => void;
}

/** Shared property-picker dropdown used in headerActions across per-property manager tools. */
export function PropertySelectDropdown({ properties, selectedProperty, onSelect }: PropertySelectDropdownProps) {
  return (
    <Select value={selectedProperty ?? ""} onValueChange={(v) => onSelect(v || null)}>
      <SelectTrigger className="w-[220px] h-9 text-sm">
        <SelectValue placeholder="Select a property…" />
      </SelectTrigger>
      <SelectContent>
        {properties.map((p) => (
          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
