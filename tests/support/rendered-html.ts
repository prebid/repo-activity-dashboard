import { JSDOM } from 'jsdom';
/** RSC script payloads are not rendered report content. Never use them as rendering canaries. */
export function renderedMain(html: string) {
  const document = new JSDOM(html).window.document;
  for (const node of document.querySelectorAll('script, style, template')) node.remove();
  return document.querySelector('main');
}
