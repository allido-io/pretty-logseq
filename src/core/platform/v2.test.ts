/**
 * Tests for the v2 (DB) platform adapter.
 *
 * Focuses on the parts v2 overrides on top of v1: the DB data-adapter wiring
 * (`api.getPageData`/`getPageBlocks`), favorites normalization
 * (DB returns page *entities*, not name strings), the toggle-favorite command
 * route, and the accent theme config.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getPageV2, getPageBlocksV2 } = vi.hoisted(() => ({
  getPageV2: vi.fn(),
  getPageBlocksV2: vi.fn(),
}));

vi.mock('../../lib/api.v2', () => ({ getPageV2, getPageBlocksV2 }));

// v1 (which v2 spreads) also imports from lib/api — provide every export it uses.
vi.mock('../../lib/api', () => ({
  getPage: vi.fn(),
  getPageBlocks: vi.fn(),
}));

import { v2Platform } from './v2';

describe('v2Platform', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logseq.App.getCurrentGraphFavorites.mockResolvedValue([]);
    logseq.App.invokeExternalCommand.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports version v2', () => {
    expect(v2Platform.version).toBe('v2');
  });

  describe('selectors', () => {
    it('overrides pageTitle and propertyKey but inherits observerRoot from v1', () => {
      expect(v2Platform.selectors.pageTitle).toBe('.ls-page-title');
      expect(v2Platform.selectors.propertyKey).toBe('.ls-page-properties .property-k');
      expect(v2Platform.selectors.observerRoot).toBe('#main-content-container');
    });
  });

  describe('theme', () => {
    it('reads the accent from the data-color attribute', () => {
      expect(v2Platform.theme.accentAttr).toBe('data-color');
    });

    it('maps Radix accent names to their solid RGB', () => {
      expect(v2Platform.theme.accentColorMap?.violet).toBe('rgb(110, 86, 207)');
      expect(v2Platform.theme.accentColorMap?.blue).toBe('rgb(0, 144, 255)');
    });
  });

  describe('api data adapter', () => {
    it('routes getPageData through the v2 adapter', async () => {
      getPageV2.mockResolvedValue({ name: 'page' });
      const result = await v2Platform.api.getPageData('Page', { includeChildren: true });
      expect(getPageV2).toHaveBeenCalledWith('Page', { includeChildren: true });
      expect(result).toEqual({ name: 'page' });
    });

    it('routes getPageBlocks through the v2 adapter', async () => {
      getPageBlocksV2.mockResolvedValue([{ content: 'b' }]);
      const result = await v2Platform.api.getPageBlocks('Page');
      expect(getPageBlocksV2).toHaveBeenCalledWith('Page');
      expect(result).toEqual([{ content: 'b' }]);
    });
  });

  describe('getFavorites', () => {
    it('normalizes DB page entities to their names', async () => {
      logseq.App.getCurrentGraphFavorites.mockResolvedValue([
        { name: 'alpha' },
        { originalName: 'Beta' },
        { title: 'Gamma' },
      ] as unknown as string[]);

      expect(await v2Platform.api.getFavorites()).toEqual(['alpha', 'Beta', 'Gamma']);
    });

    it('prefers name over originalName/title', async () => {
      logseq.App.getCurrentGraphFavorites.mockResolvedValue([
        { name: 'primary', originalName: 'secondary', title: 'tertiary' },
      ] as unknown as string[]);

      expect(await v2Platform.api.getFavorites()).toEqual(['primary']);
    });

    it('passes through plain string entries', async () => {
      logseq.App.getCurrentGraphFavorites.mockResolvedValue(['plain'] as string[]);
      expect(await v2Platform.api.getFavorites()).toEqual(['plain']);
    });

    it('drops entries with no resolvable name', async () => {
      logseq.App.getCurrentGraphFavorites.mockResolvedValue([
        { name: 'keep' },
        {},
        { uuid: 'no-name-field' },
        42,
        null,
        '',
      ] as unknown as string[]);

      expect(await v2Platform.api.getFavorites()).toEqual(['keep']);
    });

    it('returns an empty array when the API returns a non-array', async () => {
      logseq.App.getCurrentGraphFavorites.mockResolvedValue(undefined as unknown as string[]);
      expect(await v2Platform.api.getFavorites()).toEqual([]);
    });
  });

  describe('toggleFavorite', () => {
    it('invokes the built-in toggle-favorite command', async () => {
      await v2Platform.api.toggleFavorite('any-page', true);
      expect(logseq.App.invokeExternalCommand).toHaveBeenCalledWith('logseq.page/toggle-favorite');
    });
  });
});
