import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ContributionDetailsView } from '../src/features/contributions/contribution-details-view';
import { DashboardFrame } from '../src/components/layout/dashboard-frame';
import { useLocalTableController } from '../src/components/tables/local-data-table';
import { contributionSample } from '../src/mocks/contributions';
import {
  defaultContributionSelection,
  selectContributionPresentation,
} from '../src/lib/presentation/contributions';
import type { ReportMetric } from '../src/models/contribution-metrics';
import type { ContributionSampleScenario } from '../src/models/contribution-page';
function Preview({
  metric = 'reviewerContributions',
  sample = 'reference',
}: {
  metric?: ReportMetric;
  sample?: ContributionSampleScenario;
}) {
  const source = contributionSample({ scenario: sample });
  const selected = selectContributionPresentation(
    source,
    defaultContributionSelection(source),
    { kind: 'company', companyId: sample === 'large' ? 'company-prebid' : 'company-acme' },
    metric,
  );
  const controller = useLocalTableController({
    search: '',
    sort: 'creditedAt',
    descending: true,
    page: 1,
  });
  return (
    <DashboardFrame navigation={<span>Prebid · Contributions</span>}>
      <ContributionDetailsView
        page={{
          area: 'companies',
          sample,
          breakdown: 'members',
          returnTo: '/companies',
          ...selected,
        }}
        details={selected.details!}
        controller={controller}
        links={{ sample, currentHref: '/companies', context: selected.report.context }}
      />
    </DashboardFrame>
  );
}
const meta = {
  title: 'Contributions/Supporting records',
  component: Preview,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Credits: Story = {};
export const Comments: Story = { args: { metric: 'prComments' } };
export const Volume: Story = { args: { metric: 'reviewed.filesChanged' } };
export const Large: Story = { args: { sample: 'large', metric: 'issuesAuthored' } };
export const Missing: Story = { args: { sample: 'missing' } };
