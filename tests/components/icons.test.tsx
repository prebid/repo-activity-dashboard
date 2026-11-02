import type { ComponentType } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
// eslint-disable-next-line no-restricted-imports -- lucide's own render is the reference glyph.
import { icons as lucide, type LucideIcon } from 'lucide-react';
import * as icons from '@/components/ui/icons';

// The glyph each concept draws: the Visual specification's Icons list, the P2 plan's additions,
// the P3 sort glyphs and the concepts the dashboard already showed.
const glyphs = {
  BackIcon: 'arrow-left',
  ExternalLinkIcon: 'arrow-up-right',
  ScrollHintIcon: 'arrow-right',
  ReportIcon: 'table-2',
  TimelineIcon: 'calendar-days',
  RepositoriesIcon: 'folder-git-2',
  BranchIcon: 'git-branch',
  PullRequestsIcon: 'git-pull-request',
  IssuesIcon: 'circle-dot',
  ContributorsIcon: 'users',
  CompaniesIcon: 'building-complex',
  ColumnsIcon: 'columns-3',
  PrAgeIcon: 'hourglass',
  MetricsIcon: 'list-checks',
  FiltersIcon: 'sliders-horizontal',
  AccountTypeIcon: 'shapes',
  PopulationIcon: 'user-round-check',
  CustomRangeIcon: 'calendar-range',
  SwapIcon: 'arrow-left-right',
  AddIcon: 'plus',
  ClearIcon: 'x',
  ExportIcon: 'download',
  ResetIcon: 'rotate-ccw',
  RetryIcon: 'refresh-cw',
  SearchIcon: 'search',
  HelpIcon: 'circle-question-mark',
  AtAGlanceChartIcon: 'chart-column-big',
  TrendChartIcon: 'chart-no-axes-combined',
  ExpandIcon: 'chevron-down',
  CollapseIcon: 'chevron-up',
  PreviousIcon: 'chevron-left',
  NextIcon: 'chevron-right',
  CheckIcon: 'check',
  IndeterminateIcon: 'minus',
  CloseIcon: 'x',
  SortIdleIcon: 'chevrons-up-down',
  SortAscendingIcon: 'arrow-up',
  SortDescendingIcon: 'arrow-down',
  WidthToggleIcon: 'chevrons-left-right',
  ThemeSystemIcon: 'monitor',
  ThemeLightIcon: 'sun',
  ThemeDarkIcon: 'moon',
  ShowPasswordIcon: 'eye',
  HidePasswordIcon: 'eye-off',
  SecureIcon: 'lock-keyhole',
  ContinueIcon: 'arrow-right',
  InfoIcon: 'info',
  WarningIcon: 'triangle-alert',
  ErrorIcon: 'circle-alert',
  EmptyIcon: 'inbox',
  NoMatchIcon: 'search-x',
  MissingIcon: 'circle-dashed',
  LoadingIcon: 'loader-circle',
  PrOpenIcon: 'git-pull-request-arrow',
  PrDraftIcon: 'git-pull-request-draft',
  PrMergedIcon: 'git-merge',
  PrClosedIcon: 'git-pull-request-closed',
  IssueOpenIcon: 'circle-dot',
  IssueClosedIcon: 'circle-check-big',
  HumanAccountIcon: 'user-round',
  AgentAccountIcon: 'cpu',
  BotAccountIcon: 'bot',
  UnknownAccountIcon: 'circle-question-mark',
} as const;
const identity = new Set([
  'HumanAccountIcon',
  'AgentAccountIcon',
  'BotAccountIcon',
  'UnknownAccountIcon',
]);
const direction = new Set(['SortIdleIcon', 'SortAscendingIcon', 'SortDescendingIcon']);
type Rendered = ComponentType<icons.IconProps<number>>;
const exported = Object.entries(icons) as [string, Rendered][];

function svgOf(Icon: Rendered, size: number) {
  const { container } = render(<Icon size={size} />);
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('No svg rendered');
  return svg;
}
/** The shapes lucide itself draws for a glyph, such as 'arrow-left'. */
function lucideShapes(glyph: string) {
  const name = glyph.replace(/(^|-)([a-z\d])/g, (_, _dash: string, char: string) =>
    char.toUpperCase(),
  );
  const Glyph = (lucide as Record<string, LucideIcon | undefined>)[name];
  if (!Glyph) throw new Error('No lucide glyph ' + name);
  return svgOf(Glyph as Rendered, 24).innerHTML;
}

describe('icon map', () => {
  it('exports exactly the specified concepts', () => {
    expect(exported.map(([name]) => name).sort()).toEqual(Object.keys(glyphs).sort());
  });

  it.each(exported)(
    '%s draws its glyph decoratively, 1.5px line (1px at 10, 2px at 12)',
    (name, Icon) => {
      const sizes = identity.has(name) ? [10, 14, 16] : direction.has(name) ? [12] : [14, 16];
      for (const size of sizes) {
        const svg = svgOf(Icon, size);
        // The same shapes as lucide's own glyph.
        expect(svg.childElementCount).toBeGreaterThan(0);
        expect(svg.innerHTML).toBe(lucideShapes(glyphs[name as keyof typeof glyphs]));
        expect(svg).toHaveAttribute('width', String(size));
        expect(svg).toHaveAttribute('height', String(size));
        expect(svg).toHaveAttribute('aria-hidden', 'true');
        expect(svg).toHaveAttribute('focusable', 'false');
        // The 24-unit viewBox scales the stroke by size / 24.
        const line = size === 10 ? 1 : size === 12 ? 2 : 1.5;
        expect((Number(svg.getAttribute('stroke-width')) * size) / 24).toBeCloseTo(line, 10);
      }
    },
  );
});
