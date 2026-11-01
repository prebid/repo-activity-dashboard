import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { coveredStories, knownViolations, type StoryTheme } from './covered-stories';

const storybook = 'http://127.0.0.1:6007';
const themes = [
  ['Light', 'light'],
  ['Dark', 'dark'],
] as const satisfies readonly (readonly [string, StoryTheme])[];

// Each case is its own group, so CI's shards divide the stories instead of taking the whole file.
test.describe.configure({ mode: 'parallel' });

for (const [title, theme] of themes)
  test.describe(title, () => {
    for (const id of coveredStories)
      test(id, async ({ page, request }) => {
        // The built index is read here, not at load: CI lists these titles before Storybook exists.
        const index = await request.get(storybook + '/index.json');
        expect(index.ok()).toBe(true);
        const { entries } = (await index.json()) as { entries: Record<string, { type: string }> };
        expect(entries[id]?.type, id + ' is missing from the built Storybook index').toBe('story');
        await page.goto(`${storybook}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`);
        // A missing or failed story shows the error display instead of the main view.
        await expect(page.locator('body')).toHaveClass(/(^|\s)sb-show-main(\s|$)/);
        await expect(page.locator('html')).toHaveClass(new RegExp(`(^|\\s)${theme}(\\s|$)`));
        // The decorator's frame always exists; the story must put something with a size inside it.
        const frame = page.locator('[data-story-frame]');
        await expect(frame).toHaveCount(1);
        expect(
          await frame.evaluate((element) =>
            [...element.querySelectorAll('*')].some((child) => {
              const box = child.getBoundingClientRect();
              return box.width > 0 && box.height > 0;
            }),
          ),
          id + ' rendered nothing inside the story frame',
        ).toBe(true);
        const { violations } = await new AxeBuilder({ page }).include('#storybook-root').analyze();
        const expected = knownViolations
          .filter((entry) => entry.story === id && entry.theme === theme)
          .map((entry) => entry.rule)
          .sort();
        const found = violations.map((violation) => ({
          rule: violation.id,
          targets: violation.nodes.slice(0, 5).map((node) => node.target.join(' ')),
          summary: violation.nodes[0]?.failureSummary,
        }));
        expect(
          violations.map((violation) => violation.id).sort(),
          JSON.stringify(found, null, 2),
        ).toEqual(expected);
      });
  });
