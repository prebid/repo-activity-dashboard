/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    '/*': [
      './.dashboard-runtime.json',
      ...(process.env.DASHBOARD_AUTH_BACKEND === 'legacy' ? ['./.dashboard-legacy-auth.json'] : []),
    ],
  },
  env: {
    NEXT_PUBLIC_APP_MODE: process.env.DASHBOARD_BUILD_MODE === 'preview' ? 'preview' : 'production',
  },
};
export default nextConfig;
