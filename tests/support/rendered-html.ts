import { JSDOM } from 'jsdom';
/** RSC script payloads are not rendered report content. Never use them as rendering canaries. */
export function renderedMain(html: string) {
  const document = new JSDOM(html).window.document;
  for (const node of document.querySelectorAll('script, style, template')) node.remove();
  return document.querySelector('main');
}
/** Every HTML title element, including metadata streamed into the body; SVG titles are not. */
export function documentTitles(html: string) {
  return [...new JSDOM(html).window.document.querySelectorAll('title')]
    .filter((title) => title.namespaceURI === 'http://www.w3.org/1999/xhtml')
    .map((title) => title.textContent);
}
export function iconLinks(html: string) {
  return [
    ...new JSDOM(html).window.document.querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"], link[rel="apple-touch-icon"]',
    ),
  ].map((link) => link.getAttribute('href') ?? '');
}
