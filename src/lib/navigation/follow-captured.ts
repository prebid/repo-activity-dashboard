'use client';
interface LinkClick {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  preventDefault: () => void;
}
/**
 * Follow an in-app link after freezing the current list state into this history entry, so Back
 * returns to it. Modified clicks keep the browser's behavior. Without a destination, the link's
 * own href applies unless `onRejected` explains why the page stays.
 */
export function followCaptured(
  event: LinkClick,
  capture: () => { origin?: string; href: string | null },
  navigate: (href: string) => void,
  onRejected?: () => void,
) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;
  const { origin, href } = capture();
  if (!href) {
    if (onRejected) {
      event.preventDefault();
      onRejected();
    }
    return;
  }
  event.preventDefault();
  if (origin && origin !== window.location.pathname + window.location.search)
    window.history.replaceState(null, '', origin);
  navigate(href);
}
