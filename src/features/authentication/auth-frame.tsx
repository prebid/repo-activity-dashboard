import Image from "next/image";
import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./authentication.module.css";

export function AuthFrame({
  children,
  settingPassword = false,
}: {
  children: ReactNode;
  settingPassword?: boolean;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Image
          src="/prebid-logo.png"
          alt="Prebid"
          width={171}
          height={30}
          priority
        />
      </header>
      <section
        className={styles.card}
        aria-label={settingPassword ? "Password settings" : "Account sign-in"}
      >
        {children}
      </section>
      <footer className={styles.pageFooter}>
        <LockKeyhole size={12} aria-hidden="true" />
        <span>Private workspace. Access by invitation.</span>
      </footer>
    </div>
  );
}
