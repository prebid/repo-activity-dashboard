'use client';

import { useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import styles from './authentication.module.css';

export function PasswordInput({
  visibilityLabel = 'password',
  ...props
}: Omit<ComponentProps<typeof Input>, 'type'> & { visibilityLabel?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.passwordField}>
      <Input {...props} type={visible ? 'text' : 'password'} className={styles.passwordInput} />
      <button
        type="button"
        className={styles.visibilityButton}
        aria-label={`${visible ? 'Hide' : 'Show'} ${visibilityLabel}`}
        aria-pressed={visible}
        aria-controls={props.id}
        disabled={props.disabled}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}
