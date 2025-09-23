export function getAuthUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return process.env.NEXTAUTH_URL || 'http://localhost:3000';
}