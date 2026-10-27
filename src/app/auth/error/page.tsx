import Link from "next/link";
import { AuthFrame } from "@/features/authentication/auth-frame";
import styles from "@/features/authentication/authentication.module.css";
export default function Page() {
  return (
    <AuthFrame>
      <h1 className={styles.title}>Unable to sign in</h1>
      <p className={styles.subtitle}>
        Please try again or contact your administrator.
      </p>
      <Link className={styles.backLink} href="/auth/login">
        Return to sign in
      </Link>
    </AuthFrame>
  );
}
