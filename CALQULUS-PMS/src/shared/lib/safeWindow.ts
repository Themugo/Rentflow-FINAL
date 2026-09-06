/**
 * Safe window.open utility to prevent reverse tabnabbing attacks
 * 
 * When opening URLs in new tabs, using window.open() without 'noopener,noreferrer'
 * allows the opened page to access window.opener and potentially redirect the
 * parent page to a phishing site.
 * 
 * This utility ensures all external links are opened safely.
 */

/**
 * Safely open a URL in a new tab, preventing reverse tabnabbing attacks.
 * @param url - The URL to open
 * @returns The opened window reference (with opener set to null), or null if blocked
 */
export const openSafely = (url: string): Window | null => {
  const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
  if (newWindow) {
    // Belt and suspenders - explicitly null out opener
    newWindow.opener = null;
  }
  return newWindow;
};
