import Link from 'next/link';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Avatar } from '../src/components/github/avatar';
import { PageHeader, type PageHeaderProps } from '../src/components/navigation/page-header';
import { BranchIcon, ExternalLinkIcon } from '../src/components/ui/icons';

const asOf = '2026-10-31T16:00:00.000Z';

function Specimen(props: PageHeaderProps) {
  return (
    <main className="max-w-6xl">
      <PageHeader {...props} />
    </main>
  );
}

const meta = {
  title: 'Navigation/Page header',
  component: Specimen,
} satisfies Meta<typeof Specimen>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A top-level page: title, one meta link and the "Data as of" chip. */
export const Overview: Story = {
  args: {
    title: 'All repositories',
    asOf,
    meta: (
      <a href="https://github.com/prebid" target="_blank" rel="noopener noreferrer">
        Prebid on GitHub
        <ExternalLinkIcon size={14} />
      </a>
    ),
  },
};

/** A supporting view keeps the repository as its title and names itself as the current crumb. */
export const Breadcrumbs: Story = {
  args: {
    title: 'Prebid.js',
    asOf,
    breadcrumbs: [
      { label: 'All repositories', href: '/repos' },
      { label: 'Prebid.js', href: '/repos/prebidjs' },
    ],
    current: 'PR authors',
    meta: (
      <>
        <span>
          <BranchIcon size={14} />
          Primary branch <code className="font-mono">master</code>
        </span>
        <a href="https://github.com/prebid/Prebid.js" target="_blank" rel="noopener noreferrer">
          View repository on GitHub
          <ExternalLinkIcon size={14} />
        </a>
      </>
    ),
  },
};

/** A contributor report: the 48px identity sits beside the title inside the same header. */
export const Identity: Story = {
  args: {
    title: 'Alice Example',
    asOf,
    breadcrumbs: [{ label: 'Back to report', href: '/contributors' }],
    identity: <Avatar kind="person" name="Alice Example" accountType="human" size={48} />,
    meta: (
      <>
        <a href="https://github.com/alice" target="_blank" rel="noopener noreferrer">
          @alice
        </a>
        <span>Human</span>
        <Link href="/companies/id/company-acme">Example Acme</Link>
      </>
    ),
  },
};
