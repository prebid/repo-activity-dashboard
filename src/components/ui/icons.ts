import { createElement, type ReactElement } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Building2,
  CalendarDays,
  CalendarRange,
  ChartColumnBig,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeftRight,
  ChevronUp,
  CircleAlert,
  CircleCheckBig,
  CircleDashed,
  CircleDot,
  CircleQuestionMark,
  Columns3,
  Cpu,
  Download,
  Eye,
  EyeOff,
  FolderGit2,
  GitBranch,
  GitMerge,
  GitPullRequest,
  GitPullRequestArrow,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Hourglass,
  Inbox,
  Info,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  Minus,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SearchX,
  Shapes,
  SlidersHorizontal,
  Sun,
  Table2,
  TriangleAlert,
  UserRound,
  UserRoundCheck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';

// The only module that imports lucide-react (eslint.config.mjs). Every icon is decorative: the
// control it sits in or the text beside it carries the name. A 1.5 stroke with absoluteStrokeWidth
// keeps the line 1.5px at every size, which holds only while the svg renders at its width
// attribute, so no stylesheet may resize an icon. A 10px badge glyph draws 1px, because a 1.5px
// line fills the gaps between Cpu's pins at that size.

/** 14 in in-page controls, chips, inline text and status markers; 16 in tabs, menus and header buttons. */
export type IconSize = 14 | 16;
/** Account glyphs also render at 10 inside an identity badge. */
export type IdentityIconSize = 10 | IconSize;

export interface IconProps<Size extends number = IconSize> {
  size: Size;
  /** Layout or animation only. */
  className?: string;
}
export type IconComponent = (props: IconProps) => ReactElement;

function icon<Size extends number>(glyph: LucideIcon) {
  return function Icon({ size, className }: IconProps<Size>): ReactElement {
    return createElement(glyph, {
      size,
      strokeWidth: size === 10 ? 1 : 1.5,
      absoluteStrokeWidth: true,
      'aria-hidden': 'true',
      focusable: 'false',
      className,
    });
  };
}
const concept = (glyph: LucideIcon): IconComponent => icon<IconSize>(glyph);
const identity = icon<IdentityIconSize>;

// Navigation and views.
export const BackIcon = concept(ArrowLeft);
export const ExternalLinkIcon = concept(ArrowUpRight);
export const ScrollHintIcon = concept(ArrowRight);
export const ReportIcon = concept(Table2);
export const TimelineIcon = concept(CalendarDays);
export const RepositoriesIcon = concept(FolderGit2);
export const BranchIcon = concept(GitBranch);
export const PullRequestsIcon = concept(GitPullRequest);
export const IssuesIcon = concept(CircleDot);
export const ContributorsIcon = concept(Users);
export const CompaniesIcon = concept(Building2);

// Report and table controls.
export const ColumnsIcon = concept(Columns3);
export const PrAgeIcon = concept(Hourglass);
export const MetricsIcon = concept(ListChecks);
export const FiltersIcon = concept(SlidersHorizontal);
export const AccountTypeIcon = concept(Shapes);
export const PopulationIcon = concept(UserRoundCheck);
export const CustomRangeIcon = concept(CalendarRange);
export const SwapIcon = concept(ArrowLeftRight);
export const AddIcon = concept(Plus);
export const ClearIcon = concept(X);
export const ExportIcon = concept(Download);
export const ResetIcon = concept(RotateCcw);
export const RetryIcon = concept(RefreshCw);
export const SearchIcon = concept(Search);
export const HelpIcon = concept(CircleQuestionMark);
export const AtAGlanceChartIcon = concept(ChartColumnBig);
export const TrendChartIcon = concept(ChartNoAxesCombined);
export const ExpandIcon = concept(ChevronDown);
export const CollapseIcon = concept(ChevronUp);
export const PreviousIcon = concept(ChevronLeft);
export const NextIcon = concept(ChevronRight);
export const CheckIcon = concept(Check);
export const IndeterminateIcon = concept(Minus);
export const CloseIcon = concept(X);

// Shell and authentication.
export const WidthToggleIcon = concept(ChevronsLeftRight);
export const ThemeSystemIcon = concept(Monitor);
export const ThemeLightIcon = concept(Sun);
export const ThemeDarkIcon = concept(Moon);
export const ShowPasswordIcon = concept(Eye);
export const HidePasswordIcon = concept(EyeOff);
export const SecureIcon = concept(LockKeyhole);
export const ContinueIcon = concept(ArrowRight);

// Notices and page states.
export const InfoIcon = concept(Info);
export const WarningIcon = concept(TriangleAlert);
export const ErrorIcon = concept(CircleAlert);
export const EmptyIcon = concept(Inbox);
export const NoMatchIcon = concept(SearchX);
export const MissingIcon = concept(CircleDashed);
export const LoadingIcon = concept(LoaderCircle);

// Record states.
export const PrOpenIcon = concept(GitPullRequestArrow);
export const PrDraftIcon = concept(GitPullRequestDraft);
export const PrMergedIcon = concept(GitMerge);
export const PrClosedIcon = concept(GitPullRequestClosed);
export const IssueOpenIcon = concept(CircleDot);
export const IssueClosedIcon = concept(CircleCheckBig);

// Account types, for identities and the account-type choices.
export const HumanAccountIcon = identity(UserRound);
export const AgentAccountIcon = identity(Cpu);
export const BotAccountIcon = identity(Bot);
export const UnknownAccountIcon = identity(CircleQuestionMark);
