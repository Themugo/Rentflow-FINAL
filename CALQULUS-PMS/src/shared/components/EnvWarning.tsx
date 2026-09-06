import { AlertTriangle, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { CALQULUS_BRAND } from "@/shared/theme/tokens";

export default function EnvWarning() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        'VITE_SUPABASE_URL=https://your-project.supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key'
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-lg w-full bg-card rounded-[var(--radius)] card-shadow border border-border overflow-hidden">
        <div className="bg-warning p-4 flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-warning-foreground flex-shrink-0" />
          <h1 className="text-warning-foreground font-bold text-lg">{CALQULUS_BRAND.product} — Configuration Required</h1>
        </div>
        <div className="p-6 space-y-4">
          <p className="type-body text-muted-foreground">
            Supabase environment variables are missing. The app cannot connect to the database or authenticate users.
          </p>

          <div className="bg-muted rounded-md p-3 space-y-2">
            <p className="type-label">Required</p>
            <code className="block text-sm font-mono bg-surface px-3 py-2 rounded-md border border-border text-foreground">
              VITE_SUPABASE_URL
            </code>
            <code className="block text-sm font-mono bg-surface px-3 py-2 rounded-md border border-border text-foreground">
              VITE_SUPABASE_PUBLISHABLE_KEY
            </code>
          </div>

          <div className="bg-primary/5 rounded-md p-3 border border-primary/20">
            <p className="type-label text-primary mb-1">Quick fix</p>
            <ol className="type-body text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Copy <code className="font-mono text-xs bg-muted px-1 rounded">.env.example</code> to <code className="font-mono text-xs bg-muted px-1 rounded">.env.local</code></li>
              <li>Fill in your Supabase project URL and anon key</li>
              <li>Restart the dev server</li>
            </ol>
          </div>

          <Button onClick={handleCopy} className="w-full">
            {copied ? (
              <><Check className="h-4 w-4" /> Copied!</>
            ) : (
              <><Copy className="h-4 w-4" /> Copy Example Env Template</>
            )}
          </Button>

          <p className="type-meta text-center">
            Dev server URL: <code className="font-mono">http://localhost:3000</code>
          </p>
        </div>
      </div>
    </div>
  );
}
