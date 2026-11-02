'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { SectionNav, type PageSection } from './section-nav';
import styles from './view-bar.module.css';

/** Scrolls a sideways-scrolling tab row, never the page, until its current tab is in view. */
function reveal(tab: Element) {
  const row = tab.closest('nav');
  if (!row || row.scrollWidth <= row.clientWidth) return;
  const box = row.getBoundingClientRect();
  const target = tab.getBoundingClientRect();
  if (target.left >= box.left && target.right <= box.right) return;
  row.scrollLeft += target.left - box.left - (box.width - target.width) / 2;
}

/**
 * The fixed 44px bar under the page header, sticky below the masthead: the page's view tabs and,
 * with two or more sections, the section chips. Its presence sets --sticky-offset (prebid.css).
 * Render it as a direct child of the page's top-level stack, so it stays stuck to the page end.
 */
export function ViewBar({
  children,
  sections = [],
}: {
  children: ReactNode;
  sections?: readonly PageSection[];
}) {
  const row = useRef<HTMLDivElement>(null);
  // Reveals a current tab once, when it first renders, so a tab row the reader scrolled stays put.
  const revealed = useRef<readonly Element[]>([]);
  useEffect(() => {
    const current = [...row.current!.querySelectorAll('nav [aria-current="page"]')];
    if (current.every((tab) => revealed.current.includes(tab))) return;
    revealed.current = current;
    current.forEach(reveal);
  });
  return (
    <div className={styles.bar} data-view-bar="">
      <div ref={row} className={styles.row}>
        {children}
        {sections.length > 1 && <SectionNav sections={sections} />}
      </div>
    </div>
  );
}
