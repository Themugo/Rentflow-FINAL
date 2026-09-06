import { useState, useEffect, useRef, useCallback, useMemo, memo, type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

// Virtualization configuration
const ITEM_HEIGHT = 72; // Default row height in pixels
const OVERSCAN = 5; // Number of items to render outside visible area
const ESTIMATED_CONTAINER_HEIGHT = 600;

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  estimatedItemHeight?: number;
  className?: string;
  getItemKey: (item: T, index: number) => string | number;
  onEndReached?: () => void;
  endReachedThreshold?: number; // Percentage from bottom (0-1)
  emptyMessage?: string;
  loading?: boolean;
  loadingMessage?: string;
  // Optional header/footer
  header?: ReactNode;
  footer?: ReactNode;
}

function VirtualizedList<T>({
  items,
  renderItem,
  estimatedItemHeight = ITEM_HEIGHT,
  className,
  getItemKey,
  onEndReached,
  endReachedThreshold = 0.9,
  emptyMessage = "No items to display",
  loading = false,
  loadingMessage = "Loading more...",
  header,
  footer,
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(ESTIMATED_CONTAINER_HEIGHT);
  const [endReachedTriggered, setEndReachedTriggered] = useState(false);

  // Measure container height
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop: newScrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setScrollTop(newScrollTop);

    // Check if we've reached the end
    if (onEndReached && !endReachedTriggered) {
      const scrollPercentage = (newScrollTop + clientHeight) / scrollHeight;
      if (scrollPercentage >= endReachedThreshold) {
        setEndReachedTriggered(true);
        onEndReached();
      }
    }
  }, [onEndReached, endReachedTriggered, endReachedThreshold]);

  // Reset end reached trigger when items change
  useEffect(() => {
    setEndReachedTriggered(false);
  }, [items.length]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / estimatedItemHeight) - OVERSCAN);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / estimatedItemHeight) + OVERSCAN
    );
    return { startIndex, endIndex };
  }, [scrollTop, containerHeight, estimatedItemHeight, items.length]);

  // Get items to render
  const visibleItems = useMemo(() => {
    const result: { item: T; index: number }[] = [];
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
      if (items[i] !== undefined) {
        result.push({ item: items[i], index: i });
      }
    }
    return result;
  }, [items, visibleRange]);

  // Calculate total height for scrollbar
  const totalHeight = items.length * estimatedItemHeight;

  // Calculate offset for visible items
  const offsetY = visibleRange.startIndex * estimatedItemHeight;

  return (
    <div
      ref={containerRef}
      className={cn("overflow-auto", className)}
      onScroll={handleScroll}
    >
      {/* Header */}
      {header && <div className="sticky top-0 z-10 bg-background">{header}</div>}

      {/* Virtual list container */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {items.length === 0 && !loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div
            style={{
              transform: `translateY(${offsetY}px)`,
            }}
          >
            {visibleItems.map(({ item, index }) => (
              <div
                key={getItemKey(item, index)}
                data-index={index}
                style={{ height: estimatedItemHeight }}
              >
                {renderItem(item, index)}
              </div>
            ))}
          </div>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            {loadingMessage}
          </div>
        )}
      </div>

      {/* Footer */}
      {footer && <div className="sticky bottom-0 z-10 bg-background">{footer}</div>}
    </div>
  );
}

// Memoized version for stable renders
export const MemoizedVirtualizedList = memo(VirtualizedList) as typeof VirtualizedList;

// Window-based virtualization for very large lists (1000+ items)
interface WindowVirtualizerProps<T> {
  items: T[];
  renderItem: (item: T, index: number, style: React.CSSProperties) => ReactNode;
  itemHeight: number;
  windowHeight: number;
  className?: string;
  overscan?: number;
}

export function WindowVirtualizer<T>({
  items,
  renderItem,
  itemHeight,
  windowHeight,
  className,
  overscan = 3,
}: WindowVirtualizerProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + windowHeight) / itemHeight) + overscan
  );

  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  const visibleItems = useMemo(() => {
    const result: { item: T; index: number }[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (items[i] !== undefined) {
        result.push({ item: items[i], index: i });
      }
    }
    return result;
  }, [items, startIndex, endIndex]);

  return (
    <div
      ref={containerRef}
      className={cn("overflow-auto", className)}
      style={{ height: windowHeight }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: itemHeight,
              transform: `translateY(${index * itemHeight}px)`,
            }}
          >
            {renderItem(item, index, {
              height: itemHeight,
              overflow: 'hidden',
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// Infinite scroll wrapper with intersection observer
interface InfiniteScrollProps {
  children: ReactNode;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  className?: string;
  loader?: ReactNode;
  endMessage?: ReactNode;
}

export function InfiniteScroll({
  children,
  onLoadMore,
  hasMore,
  isLoading,
  className,
  loader,
  endMessage,
}: InfiniteScrollProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (!hasMore || isLoading) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          onLoadMore();
        }
      },
      { rootMargin: '100px' }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoading, onLoadMore]);

  return (
    <div className={className}>
      {children}
      <div ref={loadMoreRef} className="flex justify-center py-4">
        {isLoading && (loader || <span className="text-muted-foreground">Loading...</span>)}
        {!hasMore && endMessage}
      </div>
    </div>
  );
}

export default VirtualizedList;
