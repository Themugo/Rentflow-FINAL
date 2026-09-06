import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { PortalAccentBar, portalSurfaceProps } from "@/core/design";
import { PageHeader } from "./PageHeader";
import { ContextPanel } from "./ContextPanel";
import { CommandPalette } from "./CommandPalette";
import { KeyboardShortcutsModal } from "./KeyboardShortcutsModal";
import { HelpCenterModal } from "./HelpCenterModal";
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts";
import { TopMobileInstallBanner } from "@/shared/components/ui/top-mobile-install-banner";
import { useViewOnly } from "@/shared/contexts/ViewOnlyContext";
import { useDeskEmbed } from "./DeskEmbed";
import { AlertCircle } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  status?: React.ReactNode;
  headerActions?: React.ReactNode;
  contextTitle?: string;
  contextContent?: React.ReactNode;
}

export function Layout({
  children,
  title,
  subtitle,
  status,
  headerActions,
  contextTitle,
  contextContent,
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [contextPanelOpen, setContextPanelOpen] = useState(false);
  const [helpCenterOpen, setHelpCenterOpen] = useState(false);
  const { isViewOnly } = useViewOnly();
  const { embedded } = useDeskEmbed();

  const { showShortcutsModal, setShowShortcutsModal, keySequence } = useKeyboardShortcuts(
    () => setCommandPaletteOpen(true)
  );

  if (embedded) {
    return (
      <div>
        {headerActions ? (
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">{headerActions}</div>
        ) : null}
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans" {...portalSurfaceProps("manager")}>
      <PortalAccentBar className="fixed top-0 left-0 right-0 z-[60]" />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:left-4 focus:top-4 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-md"
      >
        Skip to main content
      </a>
      {/* Key sequence indicator for fast keyboard navigation */}
      {keySequence.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 bg-primary text-primary-foreground text-xs font-mono font-bold px-3 py-1.5 rounded-md shadow-lg flex items-center gap-2 animate-in fade-in-0 duration-150">
          <span>Waiting for key:</span>
          <kbd className="px-1.5 py-0.5 bg-background text-foreground rounded border border-border">
            g + ...
          </kbd>
        </div>
      )}

      {/* Sidebar Rail / Overlay */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Workspace Frame */}
      <div className="lg:pl-64 transition-all duration-300 min-h-screen flex flex-col flex-1 min-w-0">
        {/* PWA Mobile Install Banner */}
        <TopMobileInstallBanner />

        {/* View-Only Warning Notice for Webhost Preview */}
        {isViewOnly && (
          <div className="bg-warning/10 border-b border-warning/20 px-4 py-2">
            <div className="flex items-center justify-center gap-2 text-warning text-xs font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>View-only mode active — browsing as Webhost administrator. Mutation actions are restricted.</span>
            </div>
          </div>
        )}

        {/* Top Header Navbar */}
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onOpenShortcutsHelp={() => setShowShortcutsModal(true)}
          onOpenHelpCenter={() => setHelpCenterOpen(true)}
          onToggleContextPanel={() => setContextPanelOpen((prev) => !prev)}
        />

        {(title || headerActions) && (
          <PageHeader
            title={title}
            description={subtitle}
            status={status}
            actions={headerActions}
            className="px-4 py-5 md:px-6 lg:px-8"
          />
        )}

        {/* Main Content Viewport (Desktop-first Max-width Container) */}
        <main id="main-content" tabIndex={-1} className="flex-1 w-full min-w-0 max-w-[1800px] mx-auto px-4 md:px-6 lg:px-8 py-6 animate-fade-in outline-none">
          {children}
        </main>

        {/* Universal Enterprise Footer */}
        <Footer variant="compact" />
      </div>

      {/* Reusable Context Panel Side Drawer */}
      <ContextPanel
        open={contextPanelOpen}
        onClose={() => setContextPanelOpen(false)}
        title={contextTitle}
      >
        {contextContent}
      </ContextPanel>

      {/* Global Command Palette Modal */}
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsModal open={showShortcutsModal} onOpenChange={setShowShortcutsModal} />

      {/* Global Help Center Modal */}
      <HelpCenterModal open={helpCenterOpen} onOpenChange={setHelpCenterOpen} />
    </div>
  );
}
