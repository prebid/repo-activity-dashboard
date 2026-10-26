export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-svh bg-[#f6f8fa] px-4 py-8 text-[#1c3445] sm:px-6">{children}</main>
  );
}
