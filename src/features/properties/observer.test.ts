/**
 * Tests for Properties Observer
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiModule from '../../lib/api';
import { setupPropertyObserver } from './observer';

const { getPageData } = vi.hoisted(() => ({ getPageData: vi.fn() }));

vi.mock('../../core/platform', () => ({
  getPlatform: () => ({
    api: { getPageData },
    selectors: { propertyKey: '.page-properties .page-property-key' },
  }),
  getObserverRoot: () => document.body,
}));

vi.mock('../../lib/api', () => ({
  cleanPropertyValue: vi.fn((v: unknown) => String(v ?? '')),
}));

const ICON_CLASS = 'pl-property-icon';
const RESOLVED_ATTR = 'data-pl-icon-resolved';

function createPropertyBlock(keys: string[]): HTMLElement {
  const block = document.createElement('div');
  block.className = 'page-properties';

  for (const key of keys) {
    const keyEl = document.createElement('span');
    keyEl.className = 'page-property-key';
    keyEl.textContent = key;
    block.appendChild(keyEl);
  }

  document.body.appendChild(block);
  return block;
}

describe('Property Observer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a cleanup function', () => {
    const cleanup = setupPropertyObserver();
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('scans existing property keys on setup', async () => {
    vi.mocked(getPageData).mockResolvedValue({
      properties: { icon: '📦' },
    } as ReturnType<typeof getPageData> extends Promise<infer T> ? T : never);

    createPropertyBlock(['type']);

    const cleanup = setupPropertyObserver();

    // Wait for async getPage to resolve
    await vi.waitFor(() => {
      expect(getPageData).toHaveBeenCalledWith('type');
    });

    cleanup();
  });

  it('prepends icon span when page has icon property', async () => {
    vi.mocked(getPageData).mockResolvedValue({
      properties: { icon: '📦' },
    } as ReturnType<typeof getPageData> extends Promise<infer T> ? T : never);
    vi.mocked(apiModule.cleanPropertyValue).mockReturnValue('📦');

    const block = createPropertyBlock(['type']);

    const cleanup = setupPropertyObserver();

    await vi.waitFor(() => {
      const icon = block.querySelector(`.${ICON_CLASS}`);
      expect(icon).not.toBeNull();
      expect(icon?.textContent).toBe('📦');
    });

    cleanup();
  });

  it('marks processed elements with resolved attribute', async () => {
    vi.mocked(getPageData).mockResolvedValue({
      properties: { icon: '📦' },
    } as ReturnType<typeof getPageData> extends Promise<infer T> ? T : never);

    createPropertyBlock(['type']);

    const cleanup = setupPropertyObserver();

    await vi.waitFor(() => {
      const keyEl = document.querySelector('.page-property-key');
      expect(keyEl?.hasAttribute(RESOLVED_ATTR)).toBe(true);
    });

    cleanup();
  });

  it('skips elements already resolved', async () => {
    vi.mocked(getPageData).mockResolvedValue({
      properties: { icon: '📦' },
    } as ReturnType<typeof getPageData> extends Promise<infer T> ? T : never);

    const block = createPropertyBlock(['type']);
    const keyEl = block.querySelector('.page-property-key');
    keyEl?.setAttribute(RESOLVED_ATTR, '');

    const cleanup = setupPropertyObserver();

    // Give it a tick to process
    await new Promise(r => setTimeout(r, 10));

    expect(getPageData).not.toHaveBeenCalled();

    cleanup();
  });

  it('skips when page has no icon property', async () => {
    vi.mocked(getPageData).mockResolvedValue({
      properties: { description: 'something' },
    } as ReturnType<typeof getPageData> extends Promise<infer T> ? T : never);

    const block = createPropertyBlock(['type']);

    const cleanup = setupPropertyObserver();

    await vi.waitFor(() => {
      expect(getPageData).toHaveBeenCalled();
    });

    // No icon should be prepended
    expect(block.querySelector(`.${ICON_CLASS}`)).toBeNull();

    cleanup();
  });

  it('skips when page is null', async () => {
    vi.mocked(getPageData).mockResolvedValue(null as Awaited<ReturnType<typeof getPageData>>);

    const block = createPropertyBlock(['unknown-key']);

    const cleanup = setupPropertyObserver();

    await vi.waitFor(() => {
      expect(getPageData).toHaveBeenCalled();
    });

    expect(block.querySelector(`.${ICON_CLASS}`)).toBeNull();

    cleanup();
  });

  it('skips when key text is empty', async () => {
    const block = document.createElement('div');
    block.className = 'page-properties';

    const keyEl = document.createElement('span');
    keyEl.className = 'page-property-key';
    keyEl.textContent = '';
    block.appendChild(keyEl);
    document.body.appendChild(block);

    const cleanup = setupPropertyObserver();

    await new Promise(r => setTimeout(r, 10));

    expect(getPageData).not.toHaveBeenCalled();

    cleanup();
  });

  it('skips when cleanPropertyValue returns empty string', async () => {
    vi.mocked(getPageData).mockResolvedValue({
      properties: { icon: '' },
    } as ReturnType<typeof getPageData> extends Promise<infer T> ? T : never);
    vi.mocked(apiModule.cleanPropertyValue).mockReturnValue('');

    const block = createPropertyBlock(['type']);

    const cleanup = setupPropertyObserver();

    await vi.waitFor(() => {
      expect(getPageData).toHaveBeenCalled();
    });

    expect(block.querySelector(`.${ICON_CLASS}`)).toBeNull();

    cleanup();
  });

  describe('Cleanup', () => {
    it('removes all icon spans', async () => {
      vi.mocked(getPageData).mockResolvedValue({
        properties: { icon: '📦' },
      } as ReturnType<typeof getPageData> extends Promise<infer T> ? T : never);
      vi.mocked(apiModule.cleanPropertyValue).mockReturnValue('📦');

      createPropertyBlock(['type', 'status']);

      const cleanup = setupPropertyObserver();

      await vi.waitFor(() => {
        expect(document.querySelectorAll(`.${ICON_CLASS}`).length).toBe(2);
      });

      cleanup();

      expect(document.querySelectorAll(`.${ICON_CLASS}`).length).toBe(0);
    });

    it('removes resolved attributes', async () => {
      vi.mocked(getPageData).mockResolvedValue({
        properties: { icon: '📦' },
      } as ReturnType<typeof getPageData> extends Promise<infer T> ? T : never);

      createPropertyBlock(['type']);

      const cleanup = setupPropertyObserver();

      await vi.waitFor(() => {
        expect(document.querySelector(`[${RESOLVED_ATTR}]`)).not.toBeNull();
      });

      cleanup();

      expect(document.querySelector(`[${RESOLVED_ATTR}]`)).toBeNull();
    });

    it('does not prepend an icon when a pending lookup resolves after cleanup', async () => {
      let resolveLookup: (v: unknown) => void = () => {};
      vi.mocked(getPageData).mockReturnValue(
        new Promise(r => {
          resolveLookup = r;
        }) as ReturnType<typeof getPageData>,
      );
      vi.mocked(apiModule.cleanPropertyValue).mockReturnValue('📦');

      createPropertyBlock(['type']);

      const cleanup = setupPropertyObserver();
      cleanup();

      resolveLookup({ properties: { icon: '📦' } });
      await new Promise(r => setTimeout(r, 0));

      expect(document.querySelector(`.${ICON_CLASS}`)).toBeNull();
    });

    it('does not double-prepend when re-setup happens while a lookup is pending', async () => {
      const resolvers: Array<(v: unknown) => void> = [];
      vi.mocked(getPageData).mockImplementation(
        () =>
          new Promise(r => {
            resolvers.push(r);
          }) as ReturnType<typeof getPageData>,
      );
      vi.mocked(apiModule.cleanPropertyValue).mockReturnValue('📦');

      createPropertyBlock(['type']);

      const cleanupOld = setupPropertyObserver();
      cleanupOld();
      const cleanupNew = setupPropertyObserver();

      for (const r of resolvers) r({ properties: { icon: '📦' } });
      await new Promise(r => setTimeout(r, 0));

      expect(document.querySelectorAll(`.${ICON_CLASS}`).length).toBe(1);
      cleanupNew();
    });

    it('disconnects mutation observer', async () => {
      vi.mocked(getPageData).mockResolvedValue({
        properties: { icon: '🔧' },
      } as ReturnType<typeof getPageData> extends Promise<infer T> ? T : never);
      vi.mocked(apiModule.cleanPropertyValue).mockReturnValue('🔧');

      const cleanup = setupPropertyObserver();
      cleanup();

      // Clear call count after cleanup
      vi.mocked(getPageData).mockClear();

      // Add new property key — observer should be disconnected, so no new calls
      createPropertyBlock(['area']);

      await new Promise(r => setTimeout(r, 50));
      await new Promise(r => requestAnimationFrame(r));

      expect(getPageData).not.toHaveBeenCalled();
    });
  });
});
