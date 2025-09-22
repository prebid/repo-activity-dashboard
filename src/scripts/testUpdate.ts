#!/usr/bin/env node
import { config } from 'dotenv';
import { DataFetcher } from '../services/dataFetcher';

config();

async function testUpdate() {
  if (!process.env.GITHUB_TOKEN) {
    console.error('GITHUB_TOKEN not found in .env');
    process.exit(1);
  }

  const dataFetcher = new DataFetcher(process.env.GITHUB_TOKEN, 'store');

  const repo = {
    owner: 'prebid',
    repo: 'prebid-universal-creative',
    name: 'prebid-universal-creative',
    category: 'main',
    url: 'https://github.com/prebid/prebid-universal-creative'
  };

  // Use Aug 27 to ensure we capture ALL data since before our last update
  // Deduplication will handle any overlaps with existing data
  const sinceDate = new Date('2025-08-27T00:00:00Z');

  console.log(`Testing incremental update since ${sinceDate.toISOString()}`);

  await dataFetcher.incrementalSync(repo, sinceDate);
}

testUpdate().catch(console.error);