import type { ComponentType } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as icons from '@/components/ui/icons';

// The glyph each concept draws: the Visual specification's Icons list, the P2 plan's additions
// and the concepts the dashboard already showed.
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
type Rendered = ComponentType<icons.IconProps<number>>;
const exported = Object.entries(icons) as [string, Rendered][];

function svgOf(Icon: Rendered, size: number) {
  const { container } = render(<Icon size={size} />);
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('No svg rendered');
  return svg;
}

describe('icon map', () => {
  it('exports exactly the specified concepts', () => {
    expect(exported.map(([name]) => name).sort()).toEqual(Object.keys(glyphs).sort());
  });

  it.each(exported)('%s draws its glyph decoratively, 1.5px line (1px at 10)', (name, Icon) => {
    const sizes = identity.has(name) ? [10, 14, 16] : [14, 16];
    for (const size of sizes) {
      const svg = svgOf(Icon, size);
      expect(svg).toHaveClass('lucide', 'lucide-' + glyphs[name as keyof typeof glyphs]);
      expect(svg).toHaveAttribute('width', String(size));
      expect(svg).toHaveAttribute('height', String(size));
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('focusable', 'false');
      // The 24-unit viewBox scales the stroke by size / 24.
      const line = size === 10 ? 1 : 1.5;
      expect((Number(svg.getAttribute('stroke-width')) * size) / 24).toBeCloseTo(line, 10);
    }
  });

  it('adds a layout class without dropping the glyph classes', () => {
    const { container } = render(<icons.LoadingIcon size={16} className="animate-spin" />);
    expect(container.querySelector('svg')).toHaveClass(
      'lucide',
      'lucide-loader-circle',
      'animate-spin',
    );
  });
});
