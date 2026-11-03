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
    // Production builds report from the activity snapshot they carry and preview builds use
    // samples, unless the build names samples (the production test fixture does).
    DASHBOARD_REPORT_DATA:
      process.env.DASHBOARD_BUILD_MODE === 'production' &&
      process.env.DASHBOARD_REPORT_DATA !== 'sample'
        ? 'snapshot'
        : 'sample',
  },
};
export default nextConfig;
