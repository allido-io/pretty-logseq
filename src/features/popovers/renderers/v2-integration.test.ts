/**
 * End-to-end check that the v2 data adapter feeds the version-agnostic renderer
 * a rich popover — the whole point of the v2 work. A real DB `Editor.getPage`
 * entity flows through `getPageV2` normalization into `renderPopover`, and we
 * assert the structured sections render (not the sparse snippet fallback that
 * v2 showed before the adapter existed).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { partialMock } from '../../../../test/mocks/logseq';
import { clearPageCacheV2, getPageV2 } from '../../../lib/api.v2';
import { renderPopover } from './unified';

const REF_TITLES: Record<number, string> = {
  492: 'Active',
  676: 'Code Base',
  1921: 'A powerful game overlay for Path of Exile 2 built with Tauri and React',
  1922: '[[POE2 Overlord]]',
  1924: '[GitHub](https://github.com/dmeents/poe2-overlord)',
  1925: '[[TypeScript]], [[Tauri]], [[Rust]]',
  1926: '[[Personal]]',
  1927: '[[David Meents]]',
};

describe('v2 popover pipeline (getPageV2 → renderPopover)', () => {
  beforeEach(() => {
    clearPageCacheV2();
    vi.mocked(logseq.DB.datascriptQuery).mockImplementation(async (_q: string, input: string) => {
      const ids = (input.match(/\d+/g) ?? []).map(Number);
      return ids.filter(id => id in REF_TITLES).map(id => [id, REF_TITLES[id]]);
    });
    partialMock(logseq.Editor.getPage).mockResolvedValue({
      id: 1105,
      name: 'poe2-overlord',
      title: 'poe2-overlord',
      tags: [4],
      ':user.property/status-cnmlDIuA': [492],
      ':user.property/type-XLXzDmK8': [676],
      ':user.property/area-c1xBUFxO': [1926],
      ':user.property/owner-xEJFd0zo': 1927,
      ':user.property/url-O9mmxiVt': 1924,
      ':user.property/description-L4iXvb1J': 1921,
      ':user.property/initiative-g7dB4L-E': 1922,
      ':user.property/stack-T_fP0Srf': 1925,
    });
  });

  it('renders a rich, structured popover with cleaned property values', async () => {
    const pageData = await getPageV2('poe2-overlord');
    if (!pageData) throw new Error('expected page data');
    const el = renderPopover(pageData);
    const text = el.textContent ?? '';

    // Title + owner subtitle (brackets stripped by the renderer).
    expect(el.querySelector('.pretty-popover__title')?.textContent).toBe('poe2-overlord');
    expect(el.querySelector('.pretty-popover__subtitle')?.textContent).toBe('David Meents');

    // Description surfaced from the resolved node title.
    expect(text).toContain('A powerful game overlay');

    // type/status/area render as tags; initiative as an extra tag.
    const tags = [...el.querySelectorAll('.pretty-popover__tag')].map(t => t.textContent);
    expect(tags).toEqual(expect.arrayContaining(['Code Base', 'Active', 'Personal']));

    // The multi-ref stack node became individual pills.
    expect(tags).toEqual(expect.arrayContaining(['TypeScript', 'Tauri', 'Rust']));

    // url renders as an external link with a formatted label.
    const link = el.querySelector('.pretty-popover__external-link') as HTMLAnchorElement | null;
    expect(link?.getAttribute('href')).toBe('https://github.com/dmeents/poe2-overlord');

    // Crucially: NOT the bare snippet fallback.
    expect(el.querySelector('.pretty-popover__snippet')).toBeNull();
  });
});
