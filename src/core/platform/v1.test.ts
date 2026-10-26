/**
 * Tests for the v1 (file/markdown) platform adapter — the version-specific
 * favorites read/write, which round-trips through the graph config.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', () => ({
  getPage: vi.fn(),
  getPageBlocks: vi.fn(),
}));

import { getPage, getPageBlocks } from '../../lib/api';
import { v1Platform } from './v1';

describe('v1Platform', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports version v1 with the file-app selectors', () => {
    expect(v1Platform.version).toBe('v1');
    expect(v1Platform.selectors.pageTitle).toBe('h1.title');
    expect(v1Platform.selectors.observerRoot).toBe('#main-content-container');
  });

  describe('api data adapter', () => {
    it('routes getPageData through lib/api getPage', async () => {
      vi.mocked(getPage).mockResolvedValue({ name: 'page' } as Awaited<ReturnType<typeof getPage>>);
      const result = await v1Platform.api.getPageData('Page', { useCache: false });
      expect(getPage).toHaveBeenCalledWith('Page', { useCache: false });
      expect(result).toEqual({ name: 'page' });
    });

    it('routes getPageBlocks through lib/api getPageBlocks', async () => {
      vi.mocked(getPageBlocks).mockResolvedValue([]);
      await v1Platform.api.getPageBlocks('Page');
      expect(getPageBlocks).toHaveBeenCalledWith('Page');
    });
  });

  describe('getFavorites', () => {
    it('returns the graph favorites list', async () => {
      vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['Alpha', 'Beta']);
      expect(await v1Platform.api.getFavorites()).toEqual(['Alpha', 'Beta']);
    });

    it('returns an empty array when the config has none', async () => {
      vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(null as unknown as string[]);
      expect(await v1Platform.api.getFavorites()).toEqual([]);
    });
  });

  describe('toggleFavorite', () => {
    it('appends the page when favoriting', async () => {
      vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['Existing']);

      await v1Platform.api.toggleFavorite('New Page', true);

      expect(logseq.App.setCurrentGraphConfigs).toHaveBeenCalledWith({
        favorites: ['Existing', 'New Page'],
      });
    });

    it('removes the page (case-insensitively) when unfavoriting', async () => {
      vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['Keep', 'Drop Me']);

      await v1Platform.api.toggleFavorite('drop me', false);

      expect(logseq.App.setCurrentGraphConfigs).toHaveBeenCalledWith({
        favorites: ['Keep'],
      });
    });

    it('does not append a page that is already favorited (case-insensitive)', async () => {
      vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['Existing', 'Dup Page']);
      vi.mocked(logseq.App.setCurrentGraphConfigs).mockClear();

      await v1Platform.api.toggleFavorite('dup page', true);

      expect(logseq.App.setCurrentGraphConfigs).not.toHaveBeenCalled();
    });

    it('starts from an empty list when the config has no favorites', async () => {
      vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(null as unknown as string[]);

      await v1Platform.api.toggleFavorite('First', true);

      expect(logseq.App.setCurrentGraphConfigs).toHaveBeenCalledWith({
        favorites: ['First'],
      });
    });
  });
});
