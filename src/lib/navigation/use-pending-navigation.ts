'use client';
import { startTransition, useEffect, useOptimistic, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Whether a click follows a link to another page in this tab, which starts a new navigation. */
function followsLinkInThisTab(event: MouseEvent): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return false;
  const link = event
    .composedPath()
    .find(
      (node): node is HTMLAnchorElement =>
        node instanceof HTMLAnchorElement && node.hasAttribute('href'),
    );
  if (!link || link.hasAttribute('download')) return false;
  if (link.target !== '' && link.target !== '_self') return false;
  const url = new URL(link.href),
    here = window.location;
  const samePage = url.pathname + url.search === here.pathname + here.search;
  return url.origin === here.origin && !(samePage && link.href.includes('#'));
}

/**
 * Router navigation for links whose click handler prevents `next/link`'s own navigation, which
 * leaves `useLinkStatus` idle. `pendingKey` names the control that started the navigation until
 * the destination commits or a click on a link in this tab starts another navigation; a push
 * without a key clears it.
 */
export function usePendingNavigation() {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useOptimistic<string | null>(null);
  // Browsers run microtasks between event listeners, so an optimistic reset here would take its
  // own transition lane rather than the link's and revert when that lane commits.
  const [superseded, setSuperseded] = useState(false);
  useEffect(() => {
    if (pendingKey === null) return;
    // Capture runs before the clicked control's own handler, which may push its key.
    const supersede = (event: MouseEvent) => {
      if (followsLinkInThisTab(event)) setSuperseded(true);
    };
    document.addEventListener('click', supersede, true);
    return () => document.removeEventListener('click', supersede, true);
  }, [pendingKey]);
  return {
    pendingKey: superseded ? null : pendingKey,
    push(href: string, key: string | null = null) {
      setSuperseded(false);
      startTransition(() => {
        setPendingKey(key);
        router.push(href);
      });
    },
  };
}
