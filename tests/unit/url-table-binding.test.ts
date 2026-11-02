import { expect, it } from 'vitest';
import {
  boundLocationStamp,
  readBoundTableQuery,
  writeBoundTableQuery,
  type TableFields,
} from '@/lib/presentation/url/table-binding';

const records: TableFields = { route: '/repos/[slug]', search: 'q', sort: 'sort', page: 'page' };
const backlog: TableFields = {
  route: '/repos',
  sort: 'bsort',
  page: 'bpage',
  peers: ['asort', 'apage'],
};
const columns = ['number', 'createdAt', 'author', 'name', 'totalOpenPrs', 'nonDraftPrs'];

it('reads a table’s search, sort and page from registry fields', () => {
  expect(readBoundTableQuery(records, 'q=fix&sort=number&page=3', columns)).toEqual({
    search: 'fix',
    sort: 'number',
    descending: false,
    page: 3,
  });
  // An absent sort is the v1 default; one the table lacks is ignored.
  expect(readBoundTableQuery(records, '', columns)).toEqual({
    search: '',
    sort: 'createdAt',
    descending: true,
    page: 1,
  });
  expect(readBoundTableQuery(records, 'sort=-nope', columns).sort).toBe('');
  expect(readBoundTableQuery(backlog, 'bsort=-nonDraftPrs', columns, undefined, 2)).toEqual({
    search: '',
    sort: 'nonDraftPrs',
    descending: true,
    page: 2,
  });
  // A route without a registry default takes the caller's fallback.
  const listed: TableFields = {
    route: '/repos/[slug]/authors/[account]',
    sort: 'listsort',
    page: 'listpage',
  };
  expect(readBoundTableQuery(listed, 'metric=prAuthors', ['recordCount'])).toMatchObject({
    sort: '',
  });
  expect(
    readBoundTableQuery(listed, 'metric=prAuthors', ['recordCount'], {
      sort: 'recordCount',
      descending: true,
    }),
  ).toMatchObject({ sort: 'recordCount', descending: true });
  // A legacy or invalid address reads as the defaults.
  expect(readBoundTableQuery(records, 'prs.q=fix', columns).search).toBe('');
});

it('writes changes and keeps every other field, including return context', () => {
  expect(writeBoundTableQuery(records, 'view=issues&back=-x', { search: 'a b', page: 2 })).toBe(
    'view=issues&q=a%20b&page=2&back=-x',
  );
  expect(
    writeBoundTableQuery(records, 'q=a&sort=number&page=2', {
      sort: 'author',
      descending: true,
      page: 1,
    }),
  ).toBe('q=a&sort=-author');
  expect(writeBoundTableQuery(records, 'sort=-author', { descending: false })).toBe('sort=author');
  expect(writeBoundTableQuery(records, 'q=a', { search: '' })).toBe('');
  // The default sort is omitted; a table without search ignores one.
  expect(writeBoundTableQuery(records, '', { sort: 'createdAt', descending: true })).toBe('');
  expect(writeBoundTableQuery(backlog, '', { search: 'x', sort: 'name', descending: false })).toBe(
    'bsort=name',
  );
  expect(writeBoundTableQuery(records, '', { sort: '' })).toBe('');
});

it('stamps the address without peer tables’ fields', () => {
  expect(boundLocationStamp(backlog, '/repos', 'age=&bsort=name&asort=name&apage=2')).toBe(
    '/repos?age=&bsort=name',
  );
  expect(boundLocationStamp(records, '/repos/prebidjs', 'q=a')).toBe('/repos/prebidjs?q=a');
});
