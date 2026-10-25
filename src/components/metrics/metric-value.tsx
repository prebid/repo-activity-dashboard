import { formatCount } from '@/lib/presentation/format';
export function MetricValue({ value }: { value: number | null }) {
  return (
    <span className="tabular-nums" title={value === null ? 'Data unavailable' : undefined}>
      {formatCount(value)}
    </span>
  );
}
