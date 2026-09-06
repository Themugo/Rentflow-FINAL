import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  const shortcutGroups = [
    {
      title: "Navigation Shortcuts (Press sequence)",
      shortcuts: [
        { keys: ["G", "D"], description: "Go to Dashboard" },
        { keys: ["G", "L"], description: "Go to Leases" },
        { keys: ["G", "T"], description: "Go to Tenants" },
        { keys: ["G", "B"], description: "Go to Billing & Invoices" },
        { keys: ["G", "W"], description: "Go to Water Meter Billing" },
        { keys: ["G", "M"], description: "Go to Maintenance Work Orders" },
        { keys: ["G", "R"], description: "Go to Financial & Occupancy Reports" },
        { keys: ["G", "S"], description: "Go to System Settings" },
      ],
    },
    {
      title: "Global Commands",
      shortcuts: [
        { keys: ["⌘", "K"], description: "Open Command Palette & Global Search" },
        { keys: ["?"], description: "Toggle Keyboard Shortcuts Menu" },
        { keys: ["Esc"], description: "Close Modal / Clear Search" },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Keyboard Shortcuts</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Use these fast key combinations to navigate CALQULUS PMS instantly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {shortcutGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </p>
              <div className="space-y-1.5">
                {group.shortcuts.map((sc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0"
                  >
                    <span className="text-muted-foreground">{sc.description}</span>
                    <div className="flex items-center gap-1">
                      {sc.keys.map((key, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-0.5 text-[11px] font-mono font-semibold text-foreground bg-muted border border-border rounded shadow-xs"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
