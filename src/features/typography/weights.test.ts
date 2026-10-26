import { describe, expect, it } from 'vitest';
import headers from './headers.scss?raw';
import typography from './styles.scss?raw';

// headers.scss is injected even with Pretty Typography off, so every custom
// property it reads must be defined in the same sheet.
describe('always-on header styles', () => {
  it('define every --pl-font-weight-* variable they use', () => {
    const used = new Set([...headers.matchAll(/var\((--pl-font-weight-[\w-]+)\)/g)].map(m => m[1]));
    expect(used.size).toBeGreaterThan(0);
    for (const name of used) {
      expect(headers).toMatch(new RegExp(`${name}:\\s*\\d+`));
    }
  });

  it('is the only place the weight scale is defined', () => {
    expect(typography).not.toMatch(/--pl-font-weight-[\w-]+\s*:/);
  });
});
