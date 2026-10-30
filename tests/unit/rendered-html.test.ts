import { expect, it } from 'vitest';
import { renderedMain } from '../support/rendered-html';
it('does not accept serialized RSC content or surrounding chrome as a rendered report', () => {
  const document =
    '<header>Alice</header><main><h1>Contributors</h1><script>self.__next_f.push([1,"Alice"])</script><template>Alice</template></main>';
  expect(renderedMain(document)?.textContent).not.toContain('Alice');
  expect(renderedMain(document)?.querySelector('table tbody tr')).toBeNull();
  const report = renderedMain('<main><table><tbody><tr><td>Alice</td></tr></tbody></table></main>');
  expect(report?.textContent).toContain('Alice');
  expect(report?.querySelector('table tbody tr')).not.toBeNull();
});
