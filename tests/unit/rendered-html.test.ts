import { expect, it } from 'vitest';
import { documentTitles, iconLinks, renderedMain } from '../support/rendered-html';
it('does not accept serialized RSC content or surrounding chrome as a rendered report', () => {
  const document =
    '<header>Alice</header><main><h1>Contributors</h1><script>self.__next_f.push([1,"Alice"])</script><template>Alice</template></main>';
  expect(renderedMain(document)?.textContent).not.toContain('Alice');
  expect(renderedMain(document)?.querySelector('table tbody tr')).toBeNull();
  const report = renderedMain('<main><table><tbody><tr><td>Alice</td></tr></tbody></table></main>');
  expect(report?.textContent).toContain('Alice');
  expect(report?.querySelector('table tbody tr')).not.toBeNull();
});
it('reads document titles from the head and the streamed body, not from SVG', () => {
  expect(
    documentTitles(
      '<html><head><title>Prebid</title></head><body><div hidden><title>Alice · Contributors</title></div><svg><title>Chart</title></svg></body></html>',
    ),
  ).toEqual(['Prebid', 'Alice · Contributors']);
  expect(documentTitles('')).toEqual([]);
});
it('reads icon links wherever metadata places them', () => {
  expect(
    iconLinks(
      '<head><link rel="stylesheet" href="/a.css"><link href="/favicon.ico" rel="icon"></head><body><div hidden><link rel="apple-touch-icon" href="/apple-icon.png?a&amp;b"></div></body>',
    ),
  ).toEqual(['/favicon.ico', '/apple-icon.png?a&b']);
});
