import { Button } from '@/components/ui/button';
export function PageState({
  title,
  children,
  onRetry,
}: {
  title: string;
  children?: React.ReactNode;
  onRetry?: () => void;
}) {
  return (
    <section
      className="rounded-lg border bg-card p-6 text-center"
      role={onRetry ? 'alert' : 'status'}
    >
      <h2 className="font-display text-title font-bold font-stretch-(--prebid-display-stretch)">
        {title}
      </h2>
      {children && <div className="mt-2 text-muted-foreground">{children}</div>}
      {onRetry && (
        <Button type="button" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </section>
  );
}
