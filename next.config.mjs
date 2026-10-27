/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: { '/*': ['./.dashboard-runtime.json'] },
  env: {
    NEXT_PUBLIC_APP_MODE: process.env.DASHBOARD_BUILD_MODE === 'preview' ? 'preview' : 'production',
  },
};
export default nextConfig;
