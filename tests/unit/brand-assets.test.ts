// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { brandLogoSizes, brandLogoSource, brandLogoViewBox } from '@/components/layout/brand-logo';

const knockout = readFileSync('public/images/prebid-logo-knockout.svg', 'utf8');
const light = readFileSync('public/images/prebid-logo.svg', 'utf8');
const icon = readFileSync('src/app/icon.svg', 'utf8');
const bar = /<path fill="#ff6f00" d="([^"]+)"\/>/g;

/** Reasons a served SVG is not a plain, inert vector document; empty when it is. */
function svgProblems(text: string): string[] {
  const problems: string[] = [];
  if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/.test(text)) problems.push('root is not <svg>');
  if (/<script/i.test(text)) problems.push('script element');
  if (/\son[a-z]+\s*=/i.test(text)) problems.push('event-handler attribute');
  if (/<foreignObject/i.test(text)) problems.push('foreignObject element');
  if (/href\s*=\s*(?!["']?#)/i.test(text)) problems.push('external href');
  if (/url\(\s*(?!["']?#)/i.test(text)) problems.push('external url()');
  if (/<!(?:DOCTYPE|ENTITY)/i.test(text)) problems.push('DTD');
  return problems;
}
function viewBox(text: string): number[] {
  const value = /<svg[^>]*\sviewBox="([^"]+)"/.exec(text)?.[1];
  if (!value) throw Error('No viewBox');
  return value.split(/[\s,]+/).map(Number);
}
function png(bytes: Buffer) {
  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  expect(bytes.toString('latin1', 12, 16)).toBe('IHDR');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
}
/** RGBA bytes of an 8-bit, non-interlaced RGBA PNG. */
function rgba(bytes: Buffer) {
  const { width, height, colorType } = png(bytes);
  expect([bytes[24], colorType, bytes[28]]).toEqual([8, 6, 0]);
  const chunks: Buffer[] = [];
  for (let at = 8; at < bytes.length; at += 12 + bytes.readUInt32BE(at)) {
    if (bytes.toString('latin1', at + 4, at + 8) === 'IDAT')
      chunks.push(bytes.subarray(at + 8, at + 8 + bytes.readUInt32BE(at)));
  }
  const filtered = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const data = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = filtered[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? data[y * stride + x - 4] : 0;
      const up = y ? data[(y - 1) * stride + x] : 0;
      const upLeft = x >= 4 && y ? data[(y - 1) * stride + x - 4] : 0;
      const estimate = left + up - upLeft;
      const [a, b, c] = [left, up, upLeft].map((value) => Math.abs(estimate - value));
      const paeth = a <= b && a <= c ? left : b <= c ? up : upLeft;
      const predictor = [0, left, up, (left + up) >> 1, paeth][filter];
      data[y * stride + x] = (filtered[y * (stride + 1) + 1 + x] + predictor) & 255;
    }
  }
  return { width, height, data };
}
function icoFrames(ico: Buffer) {
  expect([...ico.subarray(0, 4)]).toEqual([0, 0, 1, 0]);
  return Array.from({ length: ico.readUInt16LE(4) }, (_, index) => {
    const entry = 6 + index * 16;
    const start = ico.readUInt32LE(entry + 12);
    return {
      width: ico[entry],
      height: ico[entry + 1],
      data: ico.subarray(start, start + ico.readUInt32LE(entry + 8)),
    };
  });
}

describe('brand logo files', () => {
  it('keeps the official knockout lockup byte for byte', () => {
    expect(createHash('sha256').update(knockout).digest('hex')).toBe(
      '3b5e5b6b01a0c62a2f0375f82ba140445864e9beccaa244f166917bcda303909',
    );
  });
  it('derives the light lockup by filling only the wordmark Prebid blue', () => {
    expect(light).toBe(knockout.replaceAll('fill="#fff"', 'fill="#3887c2"'));
    expect(light).not.toContain('fill="#fff"');
    expect(light.match(bar)).toHaveLength(5);
  });
  it.each([
    ['knockout', knockout],
    ['light', light],
  ])('serves the %s lockup as an inert SVG with the component viewBox', (_, text) => {
    expect(svgProblems(text)).toEqual([]);
    expect(viewBox(text)).toEqual([0, 0, brandLogoViewBox.width, brandLogoViewBox.height]);
  });
  it('points the component at the light lockup', () => {
    expect(readFileSync('public' + brandLogoSource, 'utf8')).toBe(light);
  });
  it.each(Object.entries(brandLogoSizes))(
    'sizes the %s logo to the viewBox ratio',
    (_, { width, height }) => {
      expect(height).toBe(Math.round((width * brandLogoViewBox.height) / brandLogoViewBox.width));
    },
  );
  it.each([
    ['404: Not Found', 'root is not <svg>'],
    ['<svg><script>alert(1)</script></svg>', 'script element'],
    ['<svg onload="alert(1)"></svg>', 'event-handler attribute'],
    ['<svg><foreignObject></foreignObject></svg>', 'foreignObject element'],
    ['<svg><image href="https://example.test/a.png"/></svg>', 'external href'],
    ['<svg><use xlink:href="other.svg#a"/></svg>', 'external href'],
    ['<svg><rect style="fill:url(https://example.test/a)"/></svg>', 'external url()'],
    ['<!DOCTYPE svg [<!ENTITY a "b">]><svg/>', 'DTD'],
    ['<svg><use href="#bar"/><rect style="fill:url(#g)"/></svg>', null],
  ])('judges %s', (text, problem) => {
    if (problem) expect(svgProblems(text)).toContain(problem);
    else expect(svgProblems(text)).toEqual([]);
  });
});

describe('icons', () => {
  it('draws only the five official bars in a square viewBox', () => {
    expect(svgProblems(icon)).toEqual([]);
    const [, , width, height] = viewBox(icon);
    expect(width).toBe(height);
    const official = [...knockout.matchAll(bar)].map((match) => match[1]);
    expect([...icon.matchAll(bar)].map((match) => match[1])).toEqual(official);
    expect(icon.match(/<path/g)).toHaveLength(5);
  });
  it('packs 16, 32 and 48 pixel PNG frames into favicon.ico', () => {
    const frames = icoFrames(readFileSync('src/app/favicon.ico'));
    for (const frame of frames) {
      const { width, height } = png(frame.data);
      expect([width, height]).toEqual([frame.width, frame.height]);
    }
    expect(frames.map((frame) => frame.width)).toEqual([16, 32, 48]);
  });
  it('draws the 16 pixel frame as five solid bars on whole pixel rows', () => {
    // At 16px the official bars are 0.75px thick, so a rasterized frame blurs them together.
    const frame = icoFrames(readFileSync('src/app/favicon.ico')).find(({ width }) => width === 16)!;
    const { width, data } = rgba(frame.data);
    const rows = new Set<number>();
    for (let pixel = 0; pixel < data.length / 4; pixel++) {
      const color = [...data.subarray(pixel * 4, pixel * 4 + 4)];
      if (color[3] === 0) continue;
      expect(color).toEqual([0xff, 0x6f, 0x00, 0xff]);
      rows.add(Math.floor(pixel / width));
    }
    expect([...rows]).toHaveLength(5);
  });
  it('renders the apple icon opaque at 180 by 180', () => {
    // Colour type 2 is truecolour without an alpha channel.
    expect(png(readFileSync('src/app/apple-icon.png'))).toEqual({
      width: 180,
      height: 180,
      colorType: 2,
    });
  });
});
