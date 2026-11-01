// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// Storybook's own CSF parser and id functions, as its indexer uses them (storybook 10.6.3).
import { loadCsf } from 'storybook/internal/csf-tools';
import { storyNameFromExport, toId } from 'storybook/internal/csf';
import { describe, expect, it } from 'vitest';
import { coveredStories, knownViolations } from '../e2e/covered-stories';

const directory = join(import.meta.dirname, '../../.storybook');
const files = readdirSync(directory)
  .filter((file) => file.endsWith('.stories.tsx'))
  .sort();
const derived = files.flatMap((file) =>
  loadCsf(readFileSync(join(directory, file), 'utf8'), {
    fileName: file,
    makeTitle: (title) => {
      if (!title) throw new Error(file + ' has no title');
      return title;
    },
  })
    .parse()
    .indexInputs.map((input) => {
      if (input.type !== 'story' || !input.title) throw new Error(file + ' has a non-story entry');
      const id = toId(input.metaId ?? input.title, storyNameFromExport(input.exportName));
      return { file, id, indexed: input.__id ?? id };
    }),
);
const listed: readonly string[] = coveredStories;
const derivedIds = derived.map((story) => story.id);

describe('story coverage list', () => {
  it('derives ids from every story file', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(derived.length).toBeGreaterThanOrEqual(files.length);
    // A parameters.__id override would make the indexer use an id the list cannot derive.
    expect(derived.filter((story) => story.indexed !== story.id)).toEqual([]);
  });
  it('lists unique, well-formed ids', () => {
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.filter((id, index) => listed.indexOf(id) !== index)).toEqual([]);
    expect(
      listed.filter((id) => !/^[a-z0-9]+(?:-[a-z0-9]+)*--[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)),
    ).toEqual([]);
  });
  it('lists exactly the stories in .storybook', () => {
    expect(listed.filter((id) => !derivedIds.includes(id))).toEqual([]);
    expect(derivedIds.filter((id) => !listed.includes(id))).toEqual([]);
  });
  it('records each known violation once against a listed story, theme and owning phase', () => {
    for (const entry of knownViolations) {
      expect(listed).toContain(entry.story);
      expect(['light', 'dark']).toContain(entry.theme);
      expect(['P2', 'P3', 'P4']).toContain(entry.phase);
      expect(entry.rule).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(entry.reason.trim()).not.toBe('');
    }
    const keys = knownViolations.map((entry) => [entry.story, entry.theme, entry.rule].join(' '));
    expect(keys.filter((key, index) => keys.indexOf(key) !== index)).toEqual([]);
  });
});
