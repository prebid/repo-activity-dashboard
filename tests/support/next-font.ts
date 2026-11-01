// next/font/local is compiled away by Next's SWC transform; its package entry is empty, so Vitest
// resolves it here. Plain functions keep it unaffected by restoreMocks.
export default function localFont({ variable }: { variable?: string }) {
  const name = (variable ?? '--font-local').slice(2);
  return { className: name, variable: name, style: { fontFamily: name } };
}
