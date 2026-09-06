import React, { useState } from "react";
import { SlidersHorizontal, X, Check, Save, RotateCcw, Calendar, Bookmark, Tag } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/shared/components/ui/sheet";
import { cn } from "@/shared/lib/utils";

export interface FilterGroup {
  id: string;
  label: string;
  type: "single" | "multiple" | "daterange" | "text";
  options?: { label: string; value: string; count?: number }[];
}

export interface SavedPreset {
  id: string;
  name: string;
  filters: Record<string, any>;
}

export interface FilterFrameworkProps {
  groups: FilterGroup[];
  values: Record<string, any>;
  onChange: (newValues: Record<string, any>) => void;
  onReset: () => void;
  presets?: SavedPreset[];
  onSavePreset?: (name: string, filters: Record<string, any>) => void;
  triggerLabel?: string;
  activeCount?: number;
}

export function FilterFramework({
  groups,
  values,
  onChange,
  onReset,
  presets = [],
  onSavePreset,
  triggerLabel = "Advanced Filters",
  activeCount = 0,
}: FilterFrameworkProps) {
  const [open, setOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  const handleSingleSelect = (groupId: string, optionValue: string) => {
    const current = values[groupId];
    const updated = current === optionValue ? "all" : optionValue;
    onChange({ ...values, [groupId]: updated });
  };

  const handleMultiToggle = (groupId: string, optionValue: string) => {
    const currentList: string[] = values[groupId] || [];
    let updated: string[];
    if (currentList.includes(optionValue)) {
      updated = currentList.filter((v) => v !== optionValue);
    } else {
      updated = [...currentList, optionValue];
    }
    onChange({ ...values, [groupId]: updated });
  };

  const handleTextChange = (groupId: string, textValue: string) => {
    onChange({ ...values, [groupId]: textValue });
  };

  const handleSaveCurrentPreset = () => {
    if (!presetName.trim() || !onSavePreset) return;
    onSavePreset(presetName.trim(), values);
    setPresetName("");
    setShowSaveInput(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="min-h-11 h-11 gap-1.5 text-xs border-border/80">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{triggerLabel}</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-bold bg-primary/20 text-primary border-0">
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col h-full bg-card">
        {/* Drawer Header */}
        <SheetHeader className="p-4 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <SheetTitle className="text-sm font-bold text-foreground">Filter Engine</SheetTitle>
            </div>
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Reset All
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Saved Presets Section */}
          {presets.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Bookmark className="h-3.5 w-3.5 text-primary" />
                Saved Filter Presets
              </p>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((preset) => (
                  <Button
                    key={preset.id}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-border/80 hover:bg-primary/10 hover:text-primary transition-colors"
                    onClick={() => onChange(preset.filters)}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Filter Groups */}
          {groups.map((group) => (
            <div key={group.id} className="space-y-2.5 pb-4 border-b border-border/60 last:border-0">
              <label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>{group.label}</span>
                {values[group.id] && values[group.id] !== "all" && (
                  <span className="text-[10px] text-primary font-medium">Filter Applied</span>
                )}
              </label>

              {/* Single Select Chips */}
              {group.type === "single" && group.options && (
                <div className="flex flex-wrap gap-1.5">
                  {group.options.map((opt) => {
                    const isSelected = (values[group.id] || "all") === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSingleSelect(group.id, opt.value)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        {opt.label}
                        {opt.count !== undefined && (
                          <span className={cn("text-[10px] px-1 rounded-full", isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground")}>
                            {opt.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Multiple Select Checkboxes */}
              {group.type === "multiple" && group.options && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {group.options.map((opt) => {
                    const list: string[] = values[group.id] || [];
                    const checked = list.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-muted/60 transition-colors cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => handleMultiToggle(group.id, opt.value)}
                          />
                          <span className="font-medium text-foreground">{opt.label}</span>
                        </div>
                        {opt.count !== undefined && (
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {opt.count}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Text Search Filter */}
              {group.type === "text" && (
                <Input
                  value={values[group.id] || ""}
                  onChange={(e) => handleTextChange(group.id, e.target.value)}
                  placeholder={`Filter by ${group.label.toLowerCase()}...`}
                  className="h-8 text-xs"
                />
              )}
            </div>
          ))}

          {/* Save Preset Accordion/Toggle */}
          {onSavePreset && (
            <div className="pt-2">
              {!showSaveInput ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-primary gap-1 px-1"
                  onClick={() => setShowSaveInput(true)}
                >
                  <Save className="h-3 w-3" />
                  Save current filter setup as preset
                </Button>
              ) : (
                <div className="space-y-2 p-3 border border-border/80 rounded-lg bg-muted/20">
                  <p className="text-xs font-semibold text-foreground">Save Preset Name</p>
                  <div className="flex gap-2">
                    <Input
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="e.g., Pending Invoices Over 30 Days"
                      className="h-8 text-xs"
                    />
                    <Button size="sm" className="h-8 text-xs gap-1 shrink-0" onClick={handleSaveCurrentPreset}>
                      <Check className="h-3.5 w-3.5" /> Save
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <SheetFooter className="p-4 border-t border-border bg-muted/30 shrink-0 flex items-center justify-between">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button size="sm" className="h-8 text-xs font-semibold" onClick={() => setOpen(false)}>
            Apply Filters ({activeCount})
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
