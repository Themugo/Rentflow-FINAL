import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

interface MobilePageHeaderProps {
  title: string;
  onBack: () => void;
  /** Right-hand slot; defaults to an empty spacer that keeps the title centered. */
  trailing?: ReactNode;
}

/**
 * Sticky mobile header (back button + centered title + optional trailing
 * action) shared by the tenant-portal sub-pages. Several pages previously
 * carried an identical copy of this markup.
 */
export function MobilePageHeader({ title, onBack, trailing }: MobilePageHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border safe-area-top">
      <div className="flex items-center justify-between px-4 h-14">
        <Button variant="ghost" size="icon" aria-label="Go back" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-lg">{title}</h1>
        {trailing ?? <div className="w-10" />}
      </div>
    </header>
  );
}
