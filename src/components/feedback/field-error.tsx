import { cn } from '@/lib/utils';

/** Inline feedback for a rejected edit; the owning control retains its draft. */
export function FieldError({
  message,
  id,
  className,
}: {
  message: string;
  id?: string;
  className?: string;
}) {
  return message ? (
    <p id={id} role="alert" className={cn('text-[13px] text-[var(--prebid-error-ink)]', className)}>
      {message}
    </p>
  ) : null;
}
