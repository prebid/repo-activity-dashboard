import { createContext, useContext } from 'react';
import Link from 'next/link';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useLinkStatus } from '@storybook/nextjs-vite/link.mock';
import { DashboardHeader } from '../src/components/layout/dashboard-header';
import { LinkPending } from '../src/components/navigation/link-pending';
import { RepositoryHeader } from '../src/features/repositories/repository-header';
import { repositoryCatalog } from '../src/config/repositories';
import { repositoryOverviewSamples } from '../src/mocks/repository-overview';
import { repositoryPageNavigationSample } from '../src/mocks/repository-page';
import {
  companyBreakdownHref,
  companyBreakdownLabels,
} from '../src/lib/presentation/contribution-navigation';
import frame from '../src/components/layout/dashboard.module.css';
import contributions from '../src/features/contributions/contributions.module.css';

const samples = repositoryOverviewSamples();
const repo = samples.repositories.find((row) => row.repository.slug === 'prebidjs')!.repository;
// The next/link mock reports the status of the section a link renders in.
const PendingSection = createContext(false);
function useSectionLinkStatus() {
  return { pending: useContext(PendingSection) };
}
function Links() {
  return (
    <>
      <DashboardHeader
        repositories={repositoryCatalog}
        activePath="/repos/prebidjs"
        administration
        accountControls={null}
      />
      <div className={frame.main}>
        <RepositoryHeader
          repository={repo}
          asOf={samples.asOf}
          returnTo="/repos"
          navigation={repositoryPageNavigationSample(repo)}
          activeKind="prs"
          parentLink={{
            href: '/repos/prebidjs?scope=period&metric=prAuthors',
            label: 'PR authors',
          }}
        />
        {/* The company report's breakdown links, as its screen renders them. */}
        <nav aria-label="Company breakdown" className={contributions.breakdowns}>
          {(['members', 'repositories'] as const).map((view) => (
            <Link
              key={view}
              href={companyBreakdownHref('/companies/id/company-acme', '', view)}
              aria-current={view === 'members' ? 'page' : undefined}
            >
              {companyBreakdownLabels[view]}
              <LinkPending />
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
// One state per story, so each landmark name appears once on the page.
function Specimen({ pending }: { pending: boolean }) {
  return (
    <div className={frame.surface}>
      <PendingSection value={pending}>
        <section aria-label={pending ? 'Pending links' : 'Idle links'}>
          <Links />
        </section>
      </PendingSection>
    </div>
  );
}
const meta = {
  title: 'Navigation/Click feedback',
  component: Specimen,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
  beforeEach() {
    useLinkStatus.mockImplementation(useSectionLinkStatus);
    return () => {
      useLinkStatus.mockImplementation(() => ({ pending: false }));
    };
  },
} satisfies Meta<typeof Specimen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Idle: Story = { args: { pending: false } };
export const Pending: Story = { args: { pending: true } };
