import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

// Every visual value below is a var() of a src/styles/prebid.css primitive, so each story shows
// the token itself; the printed values are read back from the document in the current theme.
function useComputedToken(name: string) {
  const [value, setValue] = useState('');
  useEffect(() => {
    const read = () =>
      setValue(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
    read();
    // The catalog theme switches the class on <html> after the first render.
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [name]);
  return value;
}

function TokenLabel({ name }: { name: string }) {
  const value = useComputedToken(name);
  return (
    <div className="min-w-0">
      <code className="block text-small break-all" style={{ color: 'var(--prebid-ink)' }}>
        {name}
      </code>
      <span
        className="block text-caption break-all"
        data-token={name}
        style={{ color: 'var(--prebid-muted)', fontFamily: 'var(--prebid-font-mono)' }}
      >
        {value || '…'}
      </span>
    </div>
  );
}

const card: CSSProperties = {
  background: 'var(--prebid-card)',
  border: '1px solid var(--prebid-line)',
  borderRadius: 'var(--prebid-radius-panel)',
  color: 'var(--prebid-ink)',
};

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      className="min-h-screen p-6"
      style={{
        background: 'var(--prebid-background)',
        color: 'var(--prebid-ink)',
        fontFamily: 'var(--prebid-font-body)',
      }}
    >
      <h2
        className="text-title"
        style={{ fontFamily: 'var(--prebid-font-display)', fontWeight: 700 }}
      >
        {title}
      </h2>
      <div className="mt-4 flex flex-col gap-6">{children}</div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 text-heading" style={{ fontWeight: 600 }}>
        {title}
      </h3>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
      >
        {children}
      </div>
    </section>
  );
}

function Tile({ tokens, children }: { tokens: readonly string[]; children: ReactNode }) {
  return (
    <figure className="flex flex-col gap-3 p-3" style={card}>
      {children}
      <figcaption className="flex flex-col gap-2">
        {tokens.map((name) => (
          <TokenLabel key={name} name={name} />
        ))}
      </figcaption>
    </figure>
  );
}

function Swatch({ token }: { token: string }) {
  return (
    <Tile tokens={[token]}>
      <div
        aria-hidden="true"
        style={{
          height: 48,
          background: `var(${token})`,
          border: '1px solid var(--prebid-line)',
          borderRadius: 'var(--prebid-radius-control)',
        }}
      />
    </Tile>
  );
}

const surfaces = [
  '--prebid-background',
  '--prebid-card',
  '--prebid-sunken',
  '--prebid-overlay',
  '--prebid-header-band',
  '--prebid-header-band-hover',
  '--prebid-row-hover',
  '--prebid-hover',
  '--prebid-secondary',
  '--prebid-secondary-hover',
  '--prebid-input',
  '--prebid-masthead',
];

function SurfaceTokens() {
  return (
    <Page title="Surfaces">
      <Group title="Surfaces">
        {surfaces.map((token) => (
          <Swatch key={token} token={token} />
        ))}
      </Group>
    </Page>
  );
}

const sample = 'Repository activity 0123456789';
// Each text colour on the surface it is specified for.
const textPairs = [
  ['--prebid-ink', '--prebid-card'],
  ['--prebid-muted', '--prebid-card'],
  ['--prebid-header-ink', '--prebid-header-band'],
  ['--prebid-link', '--prebid-card'],
] as const;

function TextTokens() {
  return (
    <Page title="Text">
      <Group title="Text colours">
        {textPairs.map(([ink, surface]) => (
          <Tile key={ink} tokens={[ink, surface]}>
            <p
              className="p-3 text-body"
              style={{
                background: `var(${surface})`,
                color: `var(${ink})`,
                borderRadius: 'var(--prebid-radius-control)',
                textDecoration: ink === '--prebid-link' ? 'underline' : undefined,
              }}
            >
              {sample}
            </p>
          </Tile>
        ))}
        <Tile tokens={['--prebid-placeholder', '--prebid-input', '--prebid-input-border']}>
          <input
            aria-label="Placeholder sample"
            readOnly
            placeholder="Search repositories"
            className="p-2 text-body placeholder:text-(--prebid-placeholder)"
            style={{
              background: 'var(--prebid-input)',
              color: 'var(--prebid-ink)',
              border: '1px solid var(--prebid-input-border)',
              borderRadius: 'var(--prebid-radius-control)',
            }}
          />
        </Tile>
      </Group>
    </Page>
  );
}

const lines = [
  '--prebid-line-subtle',
  '--prebid-line',
  '--prebid-line-strong',
  '--prebid-input-border',
] as const;

function LineTokens() {
  return (
    <Page title="Lines">
      <Group title="Lines">
        {lines.map((token) => (
          <Tile key={token} tokens={[token]}>
            <div aria-hidden="true" className="flex flex-col gap-2">
              <div style={{ height: 32, borderBottom: `1px solid var(${token})` }} />
              <div
                style={{
                  height: 32,
                  border: `1px solid var(${token})`,
                  borderRadius: 'var(--prebid-radius-control)',
                }}
              />
            </div>
          </Tile>
        ))}
        <Tile tokens={['--prebid-ring']}>
          <div
            aria-hidden="true"
            style={{
              height: 32,
              margin: 4,
              outline: '2px solid var(--prebid-ring)',
              outlineOffset: 2,
              borderRadius: 'var(--prebid-radius-control)',
            }}
          />
        </Tile>
      </Group>
    </Page>
  );
}

// A filled chip with its own text colour and edge, as notices, selected controls and actions use them.
function Chip({
  background,
  ink,
  edge,
  marker,
  label,
}: {
  background: string;
  ink: string;
  edge?: string;
  marker?: string;
  label: string;
}) {
  return (
    <Tile tokens={[background, ink, ...(edge ? [edge] : []), ...(marker ? [marker] : [])]}>
      <p
        className="flex items-center gap-2 px-3 py-2 text-body"
        style={{
          background: `var(${background})`,
          color: `var(${ink})`,
          border: edge ? `1px solid var(${edge})` : undefined,
          borderRadius: 'var(--prebid-radius-control)',
          fontWeight: 500,
        }}
      >
        {marker ? (
          <span
            aria-hidden="true"
            style={{
              width: 12,
              height: 12,
              background: `var(${marker})`,
              borderRadius: '50%',
            }}
          />
        ) : null}
        {label}
      </p>
    </Tile>
  );
}

function BrandAndStateTokens() {
  return (
    <Page title="Brand and state">
      <Group title="Brand">
        <Swatch token="--prebid-brand-blue" />
        <Swatch token="--prebid-masthead" />
      </Group>
      <Group title="Orange action">
        <Chip
          background="--prebid-accent"
          ink="--prebid-accent-ink"
          edge="--prebid-accent-border"
          label="Apply"
        />
        <Chip
          background="--prebid-accent-hover"
          ink="--prebid-accent-ink"
          edge="--prebid-accent-border"
          label="Apply (hover)"
        />
        <Chip
          background="--prebid-accent-pressed"
          ink="--prebid-accent-ink"
          edge="--prebid-accent-border"
          label="Apply (pressed)"
        />
      </Group>
      <Group title="Selection">
        <Chip
          background="--prebid-selection"
          ink="--prebid-selection-ink"
          edge="--prebid-selection-edge"
          label="Selected"
        />
      </Group>
      <Group title="Notices">
        <Chip
          background="--prebid-warning-bg"
          ink="--prebid-warning-ink"
          edge="--prebid-warning-border"
          marker="--prebid-warning-icon"
          label="Data as of 24 Oct"
        />
        <Chip
          background="--prebid-info-bg"
          ink="--prebid-ink"
          edge="--prebid-info-border"
          label="Information"
        />
        <Chip
          background="--prebid-success-bg"
          ink="--prebid-success-ink"
          edge="--prebid-success-border"
          label="Saved"
        />
        <Chip
          background="--prebid-error-bg"
          ink="--prebid-error-ink"
          edge="--prebid-error-border"
          label="Could not load records"
        />
      </Group>
    </Page>
  );
}

function ElevationTokens() {
  return (
    <Page title="Elevation">
      <Group title="Levels on the canvas">
        {[1, 2, 3].map((level) => (
          <figure
            key={level}
            className="flex flex-col gap-2 p-4"
            style={{ ...card, boxShadow: `var(--prebid-elevation-${level})` }}
          >
            <p className="text-heading" style={{ fontWeight: 600 }}>
              Level {level}
            </p>
            <figcaption>
              <TokenLabel name={`--prebid-elevation-${level}`} />
            </figcaption>
          </figure>
        ))}
      </Group>
    </Page>
  );
}

function RadiusTokens() {
  return (
    <Page title="Radii">
      <Group title="Radii">
        {['--prebid-radius-control', '--prebid-radius-panel'].map((token) => (
          <Tile key={token} tokens={[token]}>
            <div
              aria-hidden="true"
              style={{
                height: 64,
                background: 'var(--prebid-sunken)',
                border: '1px solid var(--prebid-line-strong)',
                borderRadius: `var(${token})`,
              }}
            />
          </Tile>
        ))}
      </Group>
    </Page>
  );
}

// The eight roles of the type scale with the face and weight the specification assigns them.
const roles = [
  { role: 'display', face: 'display', weight: 800, stretch: true },
  { role: 'title', face: 'display', weight: 700, stretch: true },
  { role: 'kpi', face: 'body', weight: 'var(--prebid-kpi-weight)', numeric: true },
  { role: 'heading', face: 'body', weight: 600 },
  { role: 'body', face: 'body', weight: 400 },
  { role: 'small', face: 'body', weight: 400 },
  { role: 'caption', face: 'body', weight: 500 },
  { role: 'overline', face: 'body', weight: 600, overline: true },
] as const satisfies readonly {
  role: string;
  face: 'display' | 'body';
  weight: number | string;
  stretch?: boolean;
  numeric?: boolean;
  overline?: boolean;
}[];

function TypeRole({ entry }: { entry: (typeof roles)[number] }) {
  const tokens = [
    `--prebid-text-${entry.role}`,
    `--prebid-leading-${entry.role}`,
    ...('overline' in entry ? ['--prebid-tracking-overline'] : []),
  ];
  return (
    <Tile tokens={tokens}>
      <p
        style={{
          fontFamily: `var(--prebid-font-${entry.face})`,
          fontSize: `var(--prebid-text-${entry.role})`,
          lineHeight: `var(--prebid-leading-${entry.role})`,
          fontWeight: entry.weight,
          fontStretch: 'stretch' in entry ? 'var(--prebid-display-stretch)' : undefined,
          fontVariantNumeric: 'numeric' in entry ? 'var(--prebid-numeric)' : undefined,
          letterSpacing: 'overline' in entry ? 'var(--prebid-tracking-overline)' : undefined,
          textTransform: 'overline' in entry ? 'uppercase' : undefined,
        }}
      >
        {'numeric' in entry ? '12,345' : entry.role[0].toUpperCase() + entry.role.slice(1)}
      </p>
    </Tile>
  );
}

const digits = [0, 7, 11, 111, 834, 1058, 12345];

function TypeTokens() {
  return (
    <Page title="Type">
      <Group title="Roles">
        {roles.map((entry) => (
          <TypeRole key={entry.role} entry={entry} />
        ))}
      </Group>
      <Group title="Faces">
        <Tile tokens={['--prebid-font-display', '--prebid-display-stretch']}>
          {[700, 800].map((weight) => (
            <p
              key={weight}
              className="text-title"
              style={{
                fontFamily: 'var(--prebid-font-display)',
                fontStretch: 'var(--prebid-display-stretch)',
                fontWeight: weight,
              }}
            >
              Mona Sans {weight}
            </p>
          ))}
        </Tile>
        <Tile tokens={['--prebid-font-body']}>
          {[400, 500, 600].map((weight) => (
            <p
              key={weight}
              className="text-heading"
              style={{ fontFamily: 'var(--prebid-font-body)', fontWeight: weight }}
            >
              Inter {weight}
            </p>
          ))}
        </Tile>
        <Tile tokens={['--prebid-font-mono']}>
          <p className="text-body" style={{ fontFamily: 'var(--prebid-font-mono)' }}>
            repo-prebidjs 0123456789
          </p>
        </Tile>
      </Group>
      <Group title="Numbers">
        <Tile tokens={['--prebid-numeric', '--prebid-number-weight']}>
          <table className="text-body" style={{ fontFamily: 'var(--prebid-font-body)' }}>
            <caption className="text-left text-small" style={{ color: 'var(--prebid-muted)' }}>
              The number style beside default proportional digits
            </caption>
            <thead>
              <tr>
                <th scope="col" className="pr-6 text-right" style={{ fontWeight: 600 }}>
                  Number style
                </th>
                <th scope="col" className="text-right" style={{ fontWeight: 600 }}>
                  Default
                </th>
              </tr>
            </thead>
            <tbody>
              {digits.map((value) => (
                <tr key={value}>
                  <td
                    className="pr-6 text-right"
                    style={{
                      fontVariantNumeric: 'var(--prebid-numeric)',
                      fontWeight: 'var(--prebid-number-weight)',
                    }}
                  >
                    {value.toLocaleString('en-US')}
                  </td>
                  <td className="text-right" style={{ fontWeight: 'var(--prebid-number-weight)' }}>
                    {value.toLocaleString('en-US')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tile>
      </Group>
    </Page>
  );
}

const chartSurfaces = [
  '--prebid-card',
  '--prebid-background',
  '--prebid-sunken',
  '--prebid-selection',
] as const;

function ChartTokens() {
  return (
    <Page title="Chart">
      <Group title="Series colour on each surface a mark sits on">
        {chartSurfaces.map((surface) => (
          <Tile key={surface} tokens={['--prebid-chart-1', surface]}>
            <div
              role="img"
              aria-label={'Chart 1 bars on ' + surface}
              className="flex items-end gap-2 p-3"
              style={{
                height: 96,
                background: `var(${surface})`,
                border: '1px solid var(--prebid-line)',
                borderRadius: 'var(--prebid-radius-control)',
              }}
            >
              {[40, 75, 55, 100, 20].map((height, index) => (
                <span
                  key={index}
                  style={{ flex: 1, height: height + '%', background: 'var(--prebid-chart-1)' }}
                />
              ))}
            </div>
          </Tile>
        ))}
      </Group>
    </Page>
  );
}

const meta = {
  title: 'Foundation/Tokens',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const Surfaces: Story = { render: () => <SurfaceTokens /> };
export const Text: Story = { render: () => <TextTokens /> };
export const Lines: Story = { render: () => <LineTokens /> };
export const BrandAndState: Story = { render: () => <BrandAndStateTokens /> };
export const Elevation: Story = { render: () => <ElevationTokens /> };
export const Radii: Story = { render: () => <RadiusTokens /> };
export const Type: Story = { render: () => <TypeTokens /> };
export const Chart: Story = { render: () => <ChartTokens /> };
