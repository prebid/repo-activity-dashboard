'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExpandIcon, SectionsIcon } from '@/components/ui/icons';
import { useClientReady } from '@/lib/navigation/use-client-ready';
import { replaceHash } from '@/lib/navigation/use-url-state';
import styles from './section-nav.module.css';

/**
 * A panel the view bar links to: the element with `id` is the section, and its `h2` with
 * tabIndex -1 takes focus after a jump (DataTable and ChartPanel take an `anchor` for this).
 */
export interface PageSection {
  id: string;
  label: string;
}

/** Where a jump puts a section's top: the root scroll padding below the sticky chrome. */
function landingLine() {
  return parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
}

/**
 * Brings a section's top to the landing line, moves focus to its heading and replaces the
 * fragment, keeping the entry's state, so Back leaves the page rather than stepping through
 * sections. False when the page has no such section.
 */
function jumpTo(id: string): boolean {
  const section = document.getElementById(id);
  if (!section) return false;
  // Measured, so the landing does not rely on an engine applying the scroll padding to scripted
  // scrolls; a page too short to bring the section that far stops at its end.
  window.scrollTo(
    window.scrollX,
    window.scrollY + section.getBoundingClientRect().top - landingLine(),
  );
  const heading = section.querySelector<HTMLElement>('h2[tabindex="-1"]') ?? section;
  heading.focus({ preventScroll: true });
  replaceHash(id);
  return true;
}

/**
 * Whether the view bar's row has room for every item at its natural width with the chips and
 * their caption beside them. The chips are measured whether shown or not: hidden, they keep their
 * full width (section-nav.module.css).
 */
function chipsFit(nav: HTMLElement, inline: HTMLElement, chips: HTMLElement) {
  const row = nav.parentElement;
  // A row that is not laid out keeps the server's chips.
  if (!row || !row.clientWidth) return true;
  const others = [...row.children].filter(
    (item): item is HTMLElement =>
      item !== nav && item instanceof HTMLElement && item.getClientRects().length > 0,
  );
  const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
  const caption = inline.firstElementChild as HTMLElement;
  // A scrolling tab row's scrollWidth is its content's width; the difference adds its border.
  const natural = (item: HTMLElement) => item.scrollWidth + item.offsetWidth - item.clientWidth;
  const need =
    others.reduce((sum, item) => sum + natural(item) + gap, 0) +
    caption.offsetWidth +
    (parseFloat(getComputedStyle(inline).columnGap) || 0) +
    chips.scrollWidth;
  // Rounded widths: the chips show only with a pixel to spare.
  return need + 1 <= row.clientWidth;
}

/**
 * The page's section chips, the current one following the scroll position. Where they do not fit
 * beside the tabs, and at 600px and below, a "Sections" menu replaces them. The server renders the
 * chips, so a wide screen never shifts; the menu takes their place once a measure shows they do
 * not fit. Without JavaScript the chips are plain fragment links.
 */
export function SectionNav({
  sections,
  label = 'On this page',
}: {
  sections: readonly PageSection[];
  label?: string;
}) {
  const ready = useClientReady();
  const [current, setCurrent] = useState(sections[0]?.id);
  // A jumped-to section stays current until the page scrolls away from where the jump left it,
  // even when the page ends before that section can reach the landing line.
  const pinned = useRef<{ id: string; y: number } | null>(null);
  const chosen = useRef<string | null>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const inline = useRef<HTMLDivElement>(null);
  const chips = useRef<HTMLUListElement>(null);
  const [compact, setCompact] = useState(false);
  const ids = sections.map((section) => section.id).join(' ');

  // Measured before paint, and again whenever the row, the chips or a tab row changes size, such
  // as when the window resizes or the fonts load.
  useLayoutEffect(() => {
    const row = container?.parentElement;
    if (!container || !row || !inline.current || !chips.current) return;
    const measure = () => setCompact(!chipsFit(container, inline.current!, chips.current!));
    measure();
    // Later measures wait a frame, keeping state writes outside ResizeObserver delivery.
    let frame = 0;
    const schedule = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          measure();
        });
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    observer?.observe(row);
    observer?.observe(inline.current);
    for (const item of row.children) if (item !== container) observer?.observe(item);
    window.addEventListener('resize', schedule);
    void document.fonts?.ready.then(schedule);
    return () => {
      cancelAnimationFrame(frame);
      // Marks a frame as pending, so a font promise settling after unmount measures nothing.
      frame = -1;
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [container, ids]);

  useEffect(() => {
    const order = ids.split(' ');
    let frame = 0;
    const update = () => {
      frame = 0;
      const hold = pinned.current;
      if (hold && Math.abs(window.scrollY - hold.y) < 2) return;
      pinned.current = null;
      // The last section whose top has reached the landing line; the first before any has.
      const line = landingLine() + 1;
      let next = order[0];
      for (const id of order) {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= line) next = id;
      }
      setCurrent(next);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [ids]);

  const jump = useCallback((id: string) => {
    if (!jumpTo(id)) return false;
    pinned.current = { id, y: window.scrollY };
    setCurrent(id);
    return true;
  }, []);
  const follow = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    // A modified click opens the fragment the browser's way, such as in a new tab.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    if (jump(id)) event.preventDefault();
  };

  return (
    <nav
      ref={setContainer}
      className={styles.sections}
      aria-label={label}
      data-compact={compact ? '' : undefined}
    >
      <div ref={inline} className={styles.inline}>
        <span className={styles.caption} aria-hidden="true">
          {label}
        </span>
        <ul ref={chips} className={styles.chips}>
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={'#' + section.id}
                className={styles.chip}
                aria-current={current === section.id ? 'location' : undefined}
                onClick={(event) => follow(event, section.id)}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.menu}>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" disabled={!ready}>
              <SectionsIcon size={14} />
              <span className={styles.menuLabel}>Sections</span>
              <ExpandIcon size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            container={container}
            onCloseAutoFocus={(event) => {
              // Focus goes to the chosen section's heading, not back to the trigger.
              const id = chosen.current;
              chosen.current = null;
              if (id && jump(id)) event.preventDefault();
            }}
          >
            {sections.map((section) => (
              <DropdownMenuItem
                key={section.id}
                aria-current={current === section.id ? 'location' : undefined}
                onSelect={() => {
                  chosen.current = section.id;
                }}
              >
                {section.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
