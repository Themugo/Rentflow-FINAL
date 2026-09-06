import { useState, useEffect } from "react";
import { Menu, Command, HelpCircle, Search, PanelRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { BreadcrumbSystem } from "./BreadcrumbSystem";
import { QuickActions } from "./QuickActions";
import { ProfileMenu } from "./ProfileMenu";

interface HeaderProps {
  onMenuClick?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenShortcutsHelp?: () => void;
  onOpenHelpCenter?: () => void;
  onToggleContextPanel?: () => void;
}

export function Header({
  onMenuClick,
  onOpenCommandPalette,
  onOpenShortcutsHelp,
  onOpenHelpCenter,
  onToggleContextPanel,
}: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center justify-between border-b transition-all duration-200 px-4 md:px-6 lg:px-8 gap-4 bg-background/95 backdrop-blur-md",
        scrolled ? "border-border" : "border-border/60"
      )}
    >
      {/* Left: Mobile Toggle & Breadcrumbs / Title */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          className="lg:hidden min-h-11 min-w-11 h-11 w-11 text-muted-foreground hover:text-foreground shrink-0"
          onClick={onMenuClick}
        >
          <Menu className="h-4 w-4" />
        </Button>

        <div className="flex flex-col justify-center min-w-0">
          <BreadcrumbSystem />
        </div>
      </div>

      {/* Right: Actions, Command Palette, QuickActions, Notifications, Theme, Context Panel, Profile */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Global Search & Command Palette Trigger */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          aria-label="Search or jump to a page"
          className="hidden lg:flex items-center gap-3 min-h-11 h-11 min-w-0 w-full max-w-xs xl:max-w-sm px-3 rounded-md bg-muted/50 border border-border/70 hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left truncate">Search or jump to...</span>
          <kbd className="hidden xl:inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>

        {/* Compact search — same command palette, not a hidden capability */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search"
          className="lg:hidden min-h-11 min-w-11 h-11 w-11 text-muted-foreground hover:text-foreground"
          onClick={onOpenCommandPalette}
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* Help Center & Keyboard Shortcuts */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Help center and keyboard shortcuts"
          className="hidden sm:flex min-h-11 min-w-11 h-11 w-11 text-muted-foreground hover:text-foreground"
          onClick={onOpenHelpCenter || onOpenShortcutsHelp}
          title="Help Center & Keyboard Shortcuts (?)"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>

        {/* Quick Actions Dropdown */}
        <QuickActions />

        {/* Notifications Dropdown */}
        <NotificationsDropdown />

        {/* Workspace Context Panel Toggle */}
        {onToggleContextPanel && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle workspace activity and context"
            className="hidden sm:flex min-h-11 min-w-11 h-11 w-11 text-muted-foreground hover:text-foreground"
            onClick={onToggleContextPanel}
            title="Toggle Workspace Activity & Context"
          >
            <PanelRight className="h-4 w-4" />
          </Button>
        )}

        <ProfileMenu />
      </div>
    </header>
  );
}
