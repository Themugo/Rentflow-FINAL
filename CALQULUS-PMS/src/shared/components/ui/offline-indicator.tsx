import React from 'react';
import { WifiOff, Database } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface OfflineIndicatorProps {
  isOffline: boolean;
  isFromCache?: boolean;
  className?: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOffline,
  isFromCache,
  className,
}) => {
  if (!isOffline && !isFromCache) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
        isOffline
          ? 'bg-warning/10 text-warning border border-warning/20'
          : 'bg-muted text-muted-foreground',
        className
      )}
    >
      {isOffline ? (
        <>
          <WifiOff className="h-4 w-4" />
          <span>You're offline. Showing cached data. Payments cannot be completed until you reconnect.</span>
        </>
      ) : isFromCache ? (
        <>
          <Database className="h-4 w-4" />
          <span>Showing cached data. Pull to refresh.</span>
        </>
      ) : null}
    </div>
  );
};

// Floating banner version
export const OfflineBanner = React.forwardRef<
  HTMLDivElement,
  { isOffline: boolean }
>(({ isOffline }, ref) => {
  if (!isOffline) return null;

  return (
    <div
      ref={ref}
      className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50 animate-in slide-in-from-bottom-4"
    >
      <div className="bg-warning text-warning-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium">
        <WifiOff className="h-4 w-4" />
        <span>No internet connection. Payments and other actions need a connection.</span>
      </div>
    </div>
  );
});

OfflineBanner.displayName = 'OfflineBanner';
