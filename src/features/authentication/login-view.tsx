"use client";
import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeReturnPath } from "@/lib/presentation/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { AuthFrame } from "./auth-frame";
import { PasswordInput } from "@/components/ui/password-input";
import styles from "./authentication.module.css";
export function LoginView({
  callbackUrl,
  preview,
  passwordChanged = false,
}: {
  callbackUrl?: string;
  preview: boolean;
  passwordChanged?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(preview ? "alice@example.test" : "");
  const [password, setPassword] = useState(preview ? "preview" : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<symbol | null>(null);
  useEffect(
    () => () => {
      pending.current = null;
    },
    [],
  );
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const operation = Symbol();
    pending.current = operation;
    setError("");
    setBusy(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (pending.current !== operation) return;
      if (result?.error || !result?.ok)
        setError(
          result?.error === "Configuration"
            ? "Sign-in is temporarily unavailable. Try again or contact an administrator."
            : "Unable to sign in. Check your details and try again.",
        );
      else {
        router.replace(safeReturnPath(callbackUrl));
        router.refresh();
      }
    } catch {
      if (pending.current === operation)
        setError("Unable to sign in. Please try again.");
    } finally {
      if (pending.current === operation) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <AuthFrame>
      <h1 className={styles.title}>Sign in</h1>
      <p className={styles.subtitle}>
        Welcome. Let’s see what’s moving forward.
      </p>
      {passwordChanged && (
        <p role="status" className={styles.success}>
          Password changed. Sign in with your new password.
        </p>
      )}
      {preview && (
        <p className={styles.notice}>
          Preview accounts: alice@example.test or bob@example.test. Password:
          preview.
        </p>
      )}
      <form
        method="post"
        onSubmit={(event) => void submit(event)}
        className={styles.form}
        aria-busy={busy}
      >
        <div className={styles.field}>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            name="email"
            placeholder="you@company.com"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
          />
        </div>
        <div className={styles.field}>
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            name="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={busy}
          />
        </div>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <Button type="submit" className={styles.submit} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
          {busy ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight aria-hidden="true" />
          )}
        </Button>
      </form>
      <details className={styles.help}>
        <summary>Signing in for the first time?</summary>
        <p>
          Use the email address and temporary password your administrator sent
          you. You’ll choose your own password after signing in, before entering
          the dashboard.
        </p>
      </details>
      <p className={styles.support}>
        Need access or a new temporary password? Contact your administrator.
      </p>
    </AuthFrame>
  );
}
