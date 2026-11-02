'use client';
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
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
 * The page's section chips, the current one following the scroll position; at 1120px and below a
 * "Sections" menu replaces them. Without JavaScript the chips are plain fragment links.
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
  const ids = sections.map((section) => section.id).join(' ');

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
    <nav ref={setContainer} className={styles.sections} aria-label={label}>
      <span className={styles.caption} aria-hidden="true">
        {label}
      </span>
      <ul className={styles.chips}>
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
