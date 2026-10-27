import { appendFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Page } from '@playwright/test';

// Temporary capture for the Linux-only hydration failure. Remove after diagnosis.
export async function captureHydrationMismatch(page: Page, output: string) {
  if (page.context().browser()?.browserType().name() !== 'chromium') return;
  const directory = join(process.cwd(), '.next/static/chunks');
  const file = readdirSync(directory).find((name) => name.startsWith('4bd'));
  if (!file) throw new Error('Missing React diagnostic chunk');
  const source = readFileSync(join(directory, file), 'utf8');
  const marker = 'function rD(e){';
  const position = source.indexOf(marker);
  if (position < 0) throw new Error('Missing hydration diagnostic function');
  mkdirSync(dirname(output), { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Debugger.enable');
  await cdp.send('Debugger.setBreakpointByUrl', {
    urlRegex: '.*/' + file.replaceAll('.', '\\.'),
    lineNumber: 0,
    columnNumber: position + marker.length,
  });
  cdp.on('Debugger.paused', (event) => {
    void (async () => {
      try {
        const frame = event.callFrames.find((candidate) => candidate.functionName === 'rD');
        if (!frame) return;
        const result = await cdp.send('Debugger.evaluateOnCallFrame', {
          callFrameId: frame.callFrameId,
          expression: `JSON.stringify((()=>{
            const fibers=[];
            for(let f=e,j=0;f&&j<12;f=f.return,j++) {
              const t=f.type;
              fibers.push({tag:f.tag,type:typeof t==='string'?t:typeof t==='function'?t.displayName||t.name:String(t),props:Object.fromEntries(Object.entries(f.pendingProps??{}).filter(([k,v])=>['string','number','boolean'].includes(typeof v)))});
            }
            return {url:location.href,fibers,next:rN?.outerHTML??rN?.nodeValue??null,parent:rN?.parentElement?.outerHTML?.slice(0,4000)??null};
          })())`,
          returnByValue: true,
        });
        appendFileSync(output, String(result.result.value) + '\n');
      } finally {
        await cdp.send('Debugger.resume').catch(() => {});
      }
    })();
  });
}
