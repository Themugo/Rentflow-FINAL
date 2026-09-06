import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";

interface ContractEditorProps {
  content: string;
  onChange: (content: string) => void;
}

const MAX_CONTENT_LENGTH = 100000;

export function ContractEditor({ content, onChange }: ContractEditorProps) {
  const charCount = content.length;
  const isNearLimit = charCount > MAX_CONTENT_LENGTH * 0.9;
  const isOverLimit = charCount > MAX_CONTENT_LENGTH;

  const handleChange = (value: string) => {
    if (value.length <= MAX_CONTENT_LENGTH) {
      onChange(value);
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Enter contract content here. You can use markdown formatting.

Use placeholders like:
- {{tenant_name}} - Tenant's full name
- {{tenant_email}} - Tenant's email
- {{property_name}} - Property name
- {{unit_number}} - Unit number
- {{monthly_rent}} - Monthly rent amount
- {{deposit}} - Security deposit
- {{start_date}} - Lease start date
- {{end_date}} - Lease end date
- {{company_name}} - Your company name"
        className={cn(
          "min-h-[400px] font-mono text-sm",
          isOverLimit && "border-destructive focus-visible:ring-destructive"
        )}
      />
      <div className="flex justify-end">
        <span
          className={cn(
            "text-xs text-muted-foreground",
            isNearLimit && "text-warning",
            isOverLimit && "text-destructive font-medium"
          )}
        >
          {charCount.toLocaleString()} / {MAX_CONTENT_LENGTH.toLocaleString()} characters
        </span>
      </div>
    </div>
  );
}
