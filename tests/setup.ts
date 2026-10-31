import '@testing-library/jest-dom/vitest';
import { beforeEach, afterEach } from 'vitest';
import { devNull } from 'node:os';
import { cleanup } from '@testing-library/react';
afterEach(() => {
  if (typeof window !== 'undefined') {
    cleanup();
    window.history.replaceState(null, '', '/');
    window.localStorage.clear();
  }
});

// A missing mock must fail locally, never discover the developer's real AWS identity.
beforeEach(() => {
  // Hosting settings must not turn isolated account tests into a live-deployment configuration check.
  for (const key of [
    'AWS_APP_ID',
    'AUTH_URL',
    'NEXTAUTH_URL',
    'AUTH_SECRET',
    'NEXTAUTH_SECRET',
    'AMPLIFY_NEXTAUTH_SECRET',
    'DASHBOARD_AUTH_BACKEND',
    'DASHBOARD_AUTH_SECRET_ARN',
    'DASHBOARD_TEMP_PASSWORD_HOURS',
    'DYNAMODB_REGION',
    'DYNAMODB_USERS_TABLE',
    'DYNAMODB_WHITELIST_TABLE',
    'NEXT_PUBLIC_APP_MODE',
  ])
    delete process.env[key];
  Object.assign(process.env, {
    AWS_ACCESS_KEY_ID: 'local',
    AWS_SECRET_ACCESS_KEY: 'local',
    AWS_EC2_METADATA_DISABLED: 'true',
    AWS_CONFIG_FILE: devNull,
    AWS_SHARED_CREDENTIALS_FILE: devNull,
    AWS_IGNORE_CONFIGURED_ENDPOINT_URLS: 'false',
    AWS_ENDPOINT_URL_DYNAMODB: 'http://127.0.0.1:9',
    AWS_ENDPOINT_URL_SECRETS_MANAGER: 'http://127.0.0.1:9',
  });
  delete process.env.AWS_SESSION_TOKEN;
  delete process.env.S3_ACCESS_KEY_ID;
  delete process.env.S3_SECRET_ACCESS_KEY;
  delete process.env.S3_SESSION_TOKEN;
});
