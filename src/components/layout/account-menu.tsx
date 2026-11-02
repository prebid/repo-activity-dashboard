'use client';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Avatar } from '@/components/github/avatar';
import { Button } from '@/components/ui/button';
import { ChangePasswordIcon } from '@/components/ui/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AccountRole, AuthenticatedUser } from '@/models/accounts';
import frame from './dashboard.module.css';
import styles from './account-menu.module.css';

/** How each account role reads in the account menu. */
export const accountRoleLabels = {
  viewer: 'Viewer',
  user: 'User',
  admin: 'Administrator',
} as const satisfies Record<AccountRole, string>;

/**
 * The signed-in account: a masthead button with the avatar and name that opens the name, email
 * and role and, where the build lets accounts change their password, a link to the existing
 * change-password page. Signing out stays a separate masthead button.
 */
export function AccountMenu({
  viewer,
  passwordChange,
}: {
  viewer: Pick<AuthenticatedUser, 'name' | 'email' | 'role'>;
  /** Whether this build offers the change-password page. */
  passwordChange: boolean;
}) {
  // Keep the popup within the masthead landmark for assistive navigation.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  // The email and role are text, not items, so the menu's description announces them on opening.
  const emailId = useId();
  const roleId = useId();
  const name = viewer.name || viewer.email;
  return (
    <div ref={setContainer} className={styles.frame}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          {/* Named by its content, "Account: <name>", so the name stays in it where phone widths
              hide the name. The avatar's initials are decorative, and an aria-label would leave
              them as visible text outside the name. */}
          <Button variant="masthead">
            <span className="sr-only">Account:</span>{' '}
            <Avatar kind="person" name={name} accountType="human" size={28} />
            <span className={frame.accountName}>{name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          size="sm"
          container={container}
          aria-describedby={emailId + ' ' + roleId}
        >
          <div className={styles.identity}>
            <Avatar kind="person" name={name} accountType="human" size={32} />
            <div className={styles.names}>
              <p className={styles.name}>{name}</p>
              <p id={emailId} className={styles.detail}>
                {viewer.email}
              </p>
            </div>
          </div>
          <DropdownMenuSeparator />
          <p id={roleId} className={styles.role}>
            Role: {accountRoleLabels[viewer.role]}
          </p>
          {passwordChange && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link prefetch={false} href="/auth/change-password">
                  <ChangePasswordIcon size={16} />
                  Change password
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
