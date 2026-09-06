/**
 * WCAG 2.1 AA Accessibility Utilities
 *
 * Implements accessibility features for compliance with:
 * - WCAG 2.1 Level AA standards
 * - Screen reader support
 * - Keyboard navigation
 * - Color contrast requirements
 * - Focus management
 */

import { CALQULUS_COLOR } from "@/shared/theme/tokens";

// Color contrast ratios
export const CONTRAST_RATIOS = {
  // WCAG AA requires 4.5:1 for normal text
  NORMAL_TEXT: 4.5,
  // WCAG AA requires 3:1 for large text (18pt+ or 14pt+ bold)
  LARGE_TEXT: 3,
  // WCAG AAA requires 7:1 for enhanced contrast
  ENHANCED_NORMAL: 7,
  // WCAG AAA requires 4.5:1 for large text
  ENHANCED_LARGE: 4.5,
};

// Minimum touch target size (WCAG 2.1)
export const MIN_TOUCH_TARGET_SIZE = 24; // pixels
export const RECOMMENDED_TOUCH_TARGET_SIZE = 44; // pixels (Apple HIG / WCAG 2.5.5)

// Focus ring styles
export const FOCUS_RING_STYLES = {
  default: {
    outline: `2px solid ${CALQULUS_COLOR.focus}`,
    outlineOffset: "2px",
  },
  highContrast: {
    outline: `3px solid ${CALQULUS_COLOR.navyDeep}`,
    outlineOffset: "2px",
  },
  custom: (color: string) => ({
    outline: `2px solid ${color}`,
    outlineOffset: "2px",
  }),
};

/**
 * Calculate color luminance
 */
export function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Convert hex to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(foreground: string, background: string): number {
  const fgLum = getLuminance(foreground);
  const bgLum = getLuminance(background);
  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG AA standard
 */
export function meetsWCAG_AA(foreground: string, background: string, isLargeText = false): boolean {
  const ratio = getContrastRatio(foreground, background);
  return ratio >= (isLargeText ? CONTRAST_RATIOS.LARGE_TEXT : CONTRAST_RATIOS.NORMAL_TEXT);
}

/**
 * Check if contrast ratio meets WCAG AAA standard
 */
export function meetsWCAG_AAA(foreground: string, background: string, isLargeText = false): boolean {
  const ratio = getContrastRatio(foreground, background);
  return ratio >= (isLargeText ? CONTRAST_RATIOS.ENHANCED_LARGE : CONTRAST_RATIOS.ENHANCED_NORMAL);
}

/**
 * Get accessible color pair
 */
export function getAccessibleColorPair(
  colors: string[],
  background: string,
  isLargeText = false
): string | null {
  for (const color of colors) {
    if (meetsWCAG_AA(color, background, isLargeText)) {
      return color;
    }
  }
  return null;
}

/**
 * Generate accessible focus styles
 */
export function getAccessibleFocusStyles(): React.CSSProperties {
  return {
    outline: `2px solid ${CALQULUS_COLOR.focus}`,
    outlineOffset: "2px",
    borderRadius: "2px",
  };
}

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcer = document.createElement('div');
  announcer.setAttribute('aria-live', priority);
  announcer.setAttribute('aria-atomic', 'true');
  announcer.setAttribute('class', 'sr-only');
  announcer.style.cssText = `
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `;
  
  document.body.appendChild(announcer);
  announcer.textContent = message;
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcer);
  }, 1000);
}

/**
 * Trap focus within a container
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);
  firstElement?.focus();

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Handle keyboard navigation for custom components
 */
export function handleKeyboardNavigation(
  event: React.KeyboardEvent,
  options: {
    onEscape?: () => void;
    onEnter?: () => void;
    onArrowUp?: () => void;
    onArrowDown?: () => void;
    onHome?: () => void;
    onEnd?: () => void;
  }
): void {
  switch (event.key) {
    case 'Escape':
      options.onEscape?.();
      break;
    case 'Enter':
      options.onEnter?.();
      break;
    case 'ArrowUp':
      event.preventDefault();
      options.onArrowUp?.();
      break;
    case 'ArrowDown':
      event.preventDefault();
      options.onArrowDown?.();
      break;
    case 'Home':
      event.preventDefault();
      options.onHome?.();
      break;
    case 'End':
      event.preventDefault();
      options.onEnd?.();
      break;
  }
}

/**
 * Check if reduced motion is preferred
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get animation duration based on user preference
 */
export function getAnimationDuration(defaultDuration: number): number {
  if (prefersReducedMotion()) {
    return 0;
  }
  return defaultDuration;
}

/**
 * Skip link component props
 */
export interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
}

/**
 * Generate unique ID for accessibility
 */
let idCounter = 0;
export function generateAriaId(prefix: string = 'aria'): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * Create ARIA description
 */
export function createAriaDescribedBy(descriptionId: string): { 'aria-describedby': string } {
  return { 'aria-describedby': descriptionId };
}

/**
 * Create ARIA label
 */
export function createAriaLabel(labelId: string): { 'aria-labelledby': string } {
  return { 'aria-labelledby': labelId };
}

/**
 * Merge ARIA attributes
 */
export function mergeAriaAttributes(
  ...attributes: Array<Record<string, string | undefined>>
): Record<string, string> {
  const merged: Record<string, string> = {};
  
  for (const attrs of attributes) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value !== undefined) {
        merged[key] = value;
      }
    }
  }
  
  return merged;
}

/**
 * Screen reader only styles
 */
export const srOnlyStyles: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: '0',
};

/**
 * Link accessibility props
 */
export function getLinkAccessibilityProps(href?: string, onClick?: () => void): Record<string, unknown> {
  const isExternal = href?.startsWith('http') || href?.startsWith('https');
  
  return {
    ...(isExternal && { rel: 'noopener noreferrer', target: '_blank' }),
    ...(isExternal && { 'aria-label': 'Opens in new tab' }),
  };
}

/**
 * Image accessibility props
 */
export function getImageAccessibilityProps(alt?: string | null): Record<string, unknown> {
  if (alt === '') {
    return { role: 'presentation', 'aria-hidden': true };
  }
  if (!alt) {
    console.warn('Image missing alt text');
  }
  return { alt: alt || 'Image' };
}

/**
 * Form field accessibility props
 */
export function getFormFieldAccessibilityProps(
  label: string,
  error?: string,
  hint?: string
): {
  'aria-label': string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
} {
  const describedBy: string[] = [];
  
  if (hint) {
    describedBy.push(`${label.toLowerCase().replace(/\s+/g, '-')}-hint`);
  }
  if (error) {
    describedBy.push(`${label.toLowerCase().replace(/\s+/g, '-')}-error`);
  }

  return {
    'aria-label': label,
    ...(describedBy.length > 0 && { 'aria-describedby': describedBy.join(' ') }),
    ...(error && { 'aria-invalid': true }),
  };
}

/**
 * Live region accessibility props
 */
export function getLiveRegionProps(busy?: boolean): {
  'aria-live': 'polite' | 'off';
  'aria-busy'?: boolean;
} {
  return {
    'aria-live': busy ? 'off' : 'polite',
    ...(busy && { 'aria-busy': true }),
  };
}

/**
 * Dialog/modal accessibility props
 */
export function getDialogAccessibilityProps(
  title: string,
  description?: string
): {
  role: 'dialog';
  'aria-modal': boolean;
  'aria-labelledby': string;
  'aria-describedby'?: string;
} {
  const titleId = `${title.toLowerCase().replace(/\s+/g, '-')}-title`;
  const descriptionId = description ? `${title.toLowerCase().replace(/\s+/g, '-')}-description` : undefined;

  return {
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': titleId,
    ...(descriptionId && { 'aria-describedby': descriptionId }),
  };
}

/**
 * List accessibility props
 */
export function getListAccessibilityProps(
  items: unknown[],
  labelledBy?: string
): {
  role: 'list';
  'aria-label'?: string;
  'aria-setsize'?: number;
} {
  return {
    role: 'list',
    ...(labelledBy && { 'aria-label': labelledBy }),
    ...(items.length > 0 && { 'aria-setsize': items.length }),
  };
}

/**
 * Expandable section accessibility props
 */
export function getExpandableAccessibilityProps(
  expanded: boolean,
  controlsId: string
): {
  'aria-expanded': boolean;
  'aria-controls': string;
} {
  return {
    'aria-expanded': expanded,
    'aria-controls': controlsId,
  };
}
