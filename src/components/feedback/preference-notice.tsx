'use client';
import { Button } from '@/components/ui/button';
import { usePreferenceNotice } from '@/lib/navigation/use-preference-cookie';
import { Callout } from './callout';

/** Says when saving a preference removed older saved settings or could not be saved at all. */
export function PreferenceNotice() {
  const { notice, dismiss } = usePreferenceNotice();
  if (!notice) return null;
  return (
    <Callout tone="warning" role="alert">
      {notice}{' '}
      <Button variant="ghost" size="sm" onClick={dismiss}>
        Dismiss
      </Button>
    </Callout>
  );
}
