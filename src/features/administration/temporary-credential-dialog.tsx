'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Callout } from '@/components/feedback/callout';
import type { IssuedCredential } from '@/models/accounts';
export function TemporaryCredentialDialog({
  credential,
  onClose,
  onRestoreFocus,
}: {
  credential: IssuedCredential;
  onClose: () => void;
  onRestoreFocus: () => void;
}) {
  const [confirmDismiss, setConfirmDismiss] = useState(false),
    [copied, setCopied] = useState(false),
    [error, setError] = useState('');
  async function copy() {
    setError('');
    try {
      await navigator.clipboard.writeText(credential.tempPassword);
      setCopied(true);
    } catch {
      setError('Unable to copy. Select and copy the password manually before closing.');
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) setConfirmDismiss(true);
      }}
    >
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          setConfirmDismiss(true);
        }}
        onPointerDownOutside={(event) => {
          event.preventDefault();
          setConfirmDismiss(true);
        }}
      >
        <DialogHeader>
          <DialogTitle>Temporary password</DialogTitle>
          <DialogDescription>
            Share this password privately with {credential.email}. They must replace it at first
            sign-in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="temporary-password">Temporary password</Label>
          <Input id="temporary-password" value={credential.tempPassword} readOnly font="mono" />
          {credential.expiresAt && (
            <p className="text-body">
              Expires{' '}
              <time dateTime={credential.expiresAt}>
                {credential.expiresAt
                  .replace('T', ' ')
                  .replace('.000Z', ' UTC')
                  .replace('Z', ' UTC')}
              </time>
            </p>
          )}
          <Button type="button" variant="secondary" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy password'}
          </Button>
          {error && (
            <Callout tone="error" role="alert">
              {error}
            </Callout>
          )}
          {confirmDismiss && (
            <Callout tone="warning" role="alert">
              You will not be able to retrieve this password after closing. You can use Reissue
              password to replace it.
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  autoFocus
                  onClick={() => setConfirmDismiss(false)}
                >
                  Keep password open
                </Button>
                <Button type="button" variant="destructive" onClick={onClose}>
                  Discard and close
                </Button>
              </div>
            </Callout>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="primary" onClick={onClose}>
            I have saved the password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
