import { requireViewer } from '@/lib/auth/viewer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MetricValue } from '@/components/metrics/metric-value';
export default async function FoundationPage() {
  await requireViewer();
  return (
    <>
      <h1 className="text-3xl font-semibold">Component foundation</h1>
      <section
        data-testid="style-specimen"
        className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-4"
      >
        <p data-testid="text-specimen" className="text-sm">
          Spacing and typography specimen
        </p>
        <Button>Example action</Button>
        <Button variant="destructive">Destructive action</Button>
        <Label htmlFor="example-input">Example input</Label>
        <Input id="example-input" className="w-48" />
        <span>
          Known zero: <MetricValue value={0} />
        </span>
        <span>
          Missing: <MetricValue value={null} />
        </span>
      </section>
    </>
  );
}
