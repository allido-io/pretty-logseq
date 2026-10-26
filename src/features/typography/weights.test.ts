import { describe, expect, it } from 'vitest';
import codeNodes from './code-nodes.v2.scss?raw';
import headers from './headers.scss?raw';
import prose from './prose.scss?raw';
import typography from './styles.scss?raw';

// headers.scss is injected even with Pretty Typography off, so it must define
// every --pl-font-weight-* variable that any typography sheet reads.
describe('font-weight scale', () => {
  it('is defined in the always-on header sheet for every typography sheet that uses it', () => {
    const sources = [headers, typography, prose, codeNodes].join('\n');
    const used = new Set([...sources.matchAll(/var\((--pl-font-weight-[\w-]+)\)/g)].map(m => m[1]));
    expect(used.size).toBeGreaterThan(0);
    for (const name of used) {
      expect(headers).toMatch(new RegExp(`${name}:\\s*\\d+`));
    }
  });

  it('is defined only in the header sheet', () => {
    for (const sheet of [typography, prose, codeNodes]) {
      expect(sheet).not.toMatch(/--pl-font-weight-[\w-]+\s*:/);
    }
  });
});
