export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-screen-2xl p-4 md:p-8">{children}</main>;
}
