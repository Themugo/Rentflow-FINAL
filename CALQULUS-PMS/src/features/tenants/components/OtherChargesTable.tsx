/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/shared/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';

export interface ChargeItem {
  description: string;
  amount: string;
}

interface OtherChargesTableProps {
  items: ChargeItem[];
  onChange: (items: ChargeItem[]) => void;
  readOnly?: boolean;
}

export const OtherChargesTable: React.FC<OtherChargesTableProps> = ({
  items,
  onChange,
  readOnly = false,
}) => {
  const addItem = () => {
    onChange([...items, { description: '', amount: '' }]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ChargeItem, value: string) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    onChange(updated);
  };

  const totalAmount = items.reduce((sum, item) => {
    const amount = parseFloat(item.amount) || 0;
    return sum + amount;
  }, 0);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[60%]">Description</TableHead>
              <TableHead className="w-[30%]">Amount (KES)</TableHead>
              {!readOnly && <TableHead className="w-[10%]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={readOnly ? 2 : 3} className="text-center text-muted-foreground py-4">
                  No other charges added
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="p-2">
                    {readOnly ? (
                      <span className="text-sm">{item.description}</span>
                    ) : (
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        placeholder="e.g., Garbage, Water, Service Charge"
                        className="h-9 bg-background border-border"
                      />
                    )}
                  </TableCell>
                  <TableCell className="p-2">
                    {readOnly ? (
                      <span className="text-sm">{parseFloat(item.amount || '0').toLocaleString()}</span>
                    ) : (
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.amount}
                        onChange={(e) => updateItem(index, 'amount', e.target.value)}
                        placeholder="0"
                        className="h-9 bg-background border-border"
                      />
                    )}
                  </TableCell>
                  {!readOnly && (
                    <TableCell className="p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove charge"
                        onClick={() => removeItem(index)}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
          {items.length > 0 && (
            <TableFooter>
              <TableRow className="bg-muted/30">
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="font-semibold">
                  KES {totalAmount.toLocaleString()}
                </TableCell>
                {!readOnly && <TableCell></TableCell>}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          className="w-full border-dashed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Charge
        </Button>
      )}
    </div>
  );
};

// Helper functions to convert between ChargeItem[] and stored format
export const parseChargesFromStorage = (
  otherCharges: number | null,
  otherChargesDescription: string | null
): ChargeItem[] => {
  // Try to parse as JSON first (new format)
  if (otherChargesDescription) {
    try {
      const parsed = JSON.parse(otherChargesDescription);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Not JSON, use legacy format
    }
    
    // Legacy format: single description with total amount
    if (otherCharges) {
      return [{ description: otherChargesDescription, amount: otherCharges.toString() }];
    }
  }
  
  return [];
};

export const serializeChargesForStorage = (
  items: ChargeItem[]
): { otherCharges: number; otherChargesDescription: string } => {
  const validItems = items.filter(item => item.description.trim() && parseFloat(item.amount) > 0);
  
  if (validItems.length === 0) {
    return { otherCharges: 0, otherChargesDescription: '' };
  }

  const totalAmount = validItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  
  // Store as JSON for retrieval
  return {
    otherCharges: totalAmount,
    otherChargesDescription: JSON.stringify(validItems),
  };
};

export default OtherChargesTable;
