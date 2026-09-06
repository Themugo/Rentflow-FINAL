/** Navigate the browser to an absolute or same-origin URL (checkout, mailto, etc.). */
export function redirectBrowser(url: string): void {
  window.location.assign(url);
}
