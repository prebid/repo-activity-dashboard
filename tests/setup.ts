import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { config } from 'dotenv';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

config();

const TEST_STORE_DIR = join(process.cwd(), 'tests', 'test-store');

beforeAll(() => {
  console.log('🚀 Starting test suite...');
  
  if (!process.env.GITHUB_TOKEN) {
    console.warn('⚠️ GITHUB_TOKEN not found - some tests may be skipped');
  }
});

beforeEach(() => {
  if (!existsSync(TEST_STORE_DIR)) {
    mkdirSync(TEST_STORE_DIR, { recursive: true });
  }
  
  process.env.TEST_MODE = 'true';
  process.env.STORE_DIR = TEST_STORE_DIR;
});

afterEach(() => {
  if (existsSync(TEST_STORE_DIR)) {
    rmSync(TEST_STORE_DIR, { recursive: true, force: true });
  }
});

afterAll(() => {
  console.log('✅ Test suite completed');
  
  if (existsSync(TEST_STORE_DIR)) {
    rmSync(TEST_STORE_DIR, { recursive: true, force: true });
  }
  
  delete process.env.TEST_MODE;
  delete process.env.STORE_DIR;
});

export { TEST_STORE_DIR };