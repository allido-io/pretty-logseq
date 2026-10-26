/**
 * Tests for Favorites API
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setVersionForTest } from '../../../core/version';
import { clearFavoritesCache, isFavorited, refreshFavorites, toggleFavorite } from './api';

describe('refreshFavorites', () => {
  beforeEach(() => {
    clearFavoritesCache();
  });

  it('loads favorites from Logseq API', async () => {
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue([
      'Page One',
      'Page Two',
      'Another Page',
    ]);

    await refreshFavorites();

    expect(isFavorited('Page One')).toBe(true);
    expect(isFavorited('Page Two')).toBe(true);
    expect(isFavorited('Another Page')).toBe(true);
    expect(isFavorited('Not Favorited')).toBe(false);
  });

  it('handles case-insensitive favorites', async () => {
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['Test Page']);

    await refreshFavorites();

    expect(isFavorited('Test Page')).toBe(true);
    expect(isFavorited('test page')).toBe(true);
    expect(isFavorited('TEST PAGE')).toBe(true);
    expect(isFavorited('TeSt PaGe')).toBe(true);
  });

  it('handles null favorites gracefully', async () => {
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(null);

    await refreshFavorites();

    expect(isFavorited('anything')).toBe(false);
  });

  it('handles empty favorites list', async () => {
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue([]);

    await refreshFavorites();

    expect(isFavorited('anything')).toBe(false);
  });

  it('handles API errors gracefully', async () => {
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockRejectedValue(new Error('API Error'));

    await refreshFavorites();

    expect(isFavorited('anything')).toBe(false);
  });

  it('replaces existing cache on refresh', async () => {
    // First refresh
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['Old Page']);
    await refreshFavorites();
    expect(isFavorited('Old Page')).toBe(true);

    // Second refresh with different data
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['New Page']);
    await refreshFavorites();
    expect(isFavorited('Old Page')).toBe(false);
    expect(isFavorited('New Page')).toBe(true);
  });
});

describe('isFavorited', () => {
  beforeEach(async () => {
    clearFavoritesCache();
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue([
      'Favorite One',
      'Favorite Two',
    ]);
    await refreshFavorites();
  });

  it('returns true for favorited pages', () => {
    expect(isFavorited('Favorite One')).toBe(true);
    expect(isFavorited('Favorite Two')).toBe(true);
  });

  it('returns false for non-favorited pages', () => {
    expect(isFavorited('Not Favorite')).toBe(false);
    expect(isFavorited('Random Page')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isFavorited('favorite one')).toBe(true);
    expect(isFavorited('FAVORITE TWO')).toBe(true);
    expect(isFavorited('FaVoRiTe OnE')).toBe(true);
  });

  it('returns false before refreshFavorites is called', () => {
    clearFavoritesCache();
    expect(isFavorited('anything')).toBe(false);
  });
});

describe('toggleFavorite', () => {
  beforeEach(async () => {
    clearFavoritesCache();
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['Already Favorited']);
    await refreshFavorites();
  });

  it('adds a page to favorites', async () => {
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['Already Favorited']);
    vi.mocked(logseq.App.setCurrentGraphConfigs).mockResolvedValue(undefined);

    expect(isFavorited('New Page')).toBe(false);

    await toggleFavorite('New Page');

    expect(isFavorited('New Page')).toBe(true);
    expect(logseq.App.setCurrentGraphConfigs).toHaveBeenCalledWith({
      favorites: ['Already Favorited', 'New Page'],
    });
  });

  it('removes a page from favorites', async () => {
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['Already Favorited']);
    vi.mocked(logseq.App.setCurrentGraphConfigs).mockResolvedValue(undefined);

    expect(isFavorited('Already Favorited')).toBe(true);

    await toggleFavorite('Already Favorited');

    expect(isFavorited('Already Favorited')).toBe(false);
    expect(logseq.App.setCurrentGraphConfigs).toHaveBeenCalledWith({
      favorites: [],
    });
  });

  it('preserves original case when adding favorites', async () => {
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue([]);
    vi.mocked(logseq.App.setCurrentGraphConfigs).mockResolvedValue(undefined);

    await toggleFavorite('My Cool Page');

    expect(logseq.App.setCurrentGraphConfigs).toHaveBeenCalledWith({
      favorites: ['My Cool Page'],
    });
  });

  it('is case-insensitive when removing favorites', async () => {
    // Initial setup and refresh
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['Test Page']);
    await refreshFavorites();

    // Mock for the toggle call - returns the current state again
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['Test Page']);
    vi.mocked(logseq.App.setCurrentGraphConfigs).mockResolvedValue(undefined);

    // Try to remove with different case
    await toggleFavorite('test page');

    expect(logseq.App.setCurrentGraphConfigs).toHaveBeenCalledWith({
      favorites: [],
    });
  });

  it('optimistically updates cache', async () => {
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['Already Favorited']);
    vi.mocked(logseq.App.setCurrentGraphConfigs).mockResolvedValue(undefined);

    expect(isFavorited('New Page')).toBe(false);

    // Don't await - check optimistic update
    const promise = toggleFavorite('New Page');
    expect(isFavorited('New Page')).toBe(true);

    await promise;
  });

  it('rolls back optimistic update on error when adding', async () => {
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue([]);
    vi.mocked(logseq.App.setCurrentGraphConfigs).mockRejectedValue(new Error('Write failed'));

    expect(isFavorited('New Page')).toBe(false);

    try {
      await toggleFavorite('New Page');
    } catch {
      // Expected error
    }

    expect(isFavorited('New Page')).toBe(false);
  });

  it('rolls back optimistic update on error when removing', async () => {
    // Initial setup and refresh
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['Existing Page']);
    await refreshFavorites();

    expect(isFavorited('Existing Page')).toBe(true);

    // Mock error on setCurrentGraphConfigs
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['Existing Page']);
    vi.mocked(logseq.App.setCurrentGraphConfigs).mockRejectedValue(new Error('Write failed'));

    try {
      await toggleFavorite('Existing Page');
    } catch {
      // Expected error
    }

    expect(isFavorited('Existing Page')).toBe(true);
  });

  it('rethrows errors after rollback', async () => {
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue([]);
    const error = new Error('API Error');
    vi.mocked(logseq.App.setCurrentGraphConfigs).mockRejectedValue(error);

    await expect(toggleFavorite('Test')).rejects.toThrow('API Error');
  });

  it('handles multiple pages with similar names', async () => {
    // Initial setup and refresh
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue([
      'Test',
      'Test Page',
      'Test Page Two',
    ]);
    await refreshFavorites();

    // Mock for toggle call
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue([
      'Test',
      'Test Page',
      'Test Page Two',
    ]);
    vi.mocked(logseq.App.setCurrentGraphConfigs).mockResolvedValue(undefined);

    await toggleFavorite('Test Page');

    expect(logseq.App.setCurrentGraphConfigs).toHaveBeenCalledWith({
      favorites: ['Test', 'Test Page Two'],
    });
  });
});

describe('toggleFavorite (stale cache)', () => {
  beforeEach(() => {
    clearFavoritesCache();
    vi.mocked(logseq.App.setCurrentGraphConfigs).mockReset().mockResolvedValue(undefined);
  });

  it('v1: does not duplicate a page favorited natively since the last refresh', async () => {
    // Cache is empty/stale, but the graph already lists the page.
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['Native Fav']);

    await toggleFavorite('Native Fav');

    // The real state wins: the click unfavorites instead of appending a duplicate.
    expect(logseq.App.setCurrentGraphConfigs).toHaveBeenCalledWith({ favorites: [] });
    expect(isFavorited('Native Fav')).toBe(false);
  });

  it('v1: recovers from an emptied cache after a failed refresh', async () => {
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockRejectedValueOnce(new Error('boom'));
    await refreshFavorites();
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['Kept', 'Target']);

    await toggleFavorite('Target');

    expect(logseq.App.setCurrentGraphConfigs).toHaveBeenCalledWith({ favorites: ['Kept'] });
    expect(isFavorited('Target')).toBe(false);
  });

  it('falls back to the cache when the real-state read fails', async () => {
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['Cached']);
    await refreshFavorites();
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockRejectedValue(new Error('read failed'));
    vi.mocked(logseq.App.setCurrentGraphConfigs).mockClear();

    // The v1 adapter's own read also fails, so the write is rejected and rolled back.
    await expect(toggleFavorite('Cached')).rejects.toThrow('read failed');
    expect(isFavorited('Cached')).toBe(true);
  });
});

describe('toggleFavorite (v2 DB graph)', () => {
  beforeEach(() => {
    clearFavoritesCache();
    setVersionForTest('v2');
    vi.mocked(logseq.App.invokeExternalCommand).mockClear();
    vi.mocked(logseq.App.setCurrentGraphConfigs).mockClear();
  });

  afterEach(() => {
    setVersionForTest(null);
  });

  it('normalizes DB favorite entities to page names when refreshing', async () => {
    // DB `getCurrentGraphFavorites` returns page-block entities, not strings.
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue([
      { name: 'project alpha', originalName: 'Project Alpha', uuid: 'uuid-1' },
      { name: 'daily notes', originalName: 'Daily Notes', uuid: 'uuid-2' },
    ] as unknown as string[]);

    await refreshFavorites();

    // Matched by the same `name` field the observer reads off the current page.
    expect(isFavorited('project alpha')).toBe(true);
    expect(isFavorited('Daily Notes')).toBe(true);
    expect(isFavorited('unknown page')).toBe(false);
  });

  it('toggles via the built-in command instead of writing graph config', async () => {
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue([]);
    vi.mocked(logseq.App.invokeExternalCommand).mockResolvedValue(undefined);

    await toggleFavorite('New Page');

    // DB graphs must NOT write `:favorites` to config (that only logs a deprecation).
    expect(logseq.App.setCurrentGraphConfigs).not.toHaveBeenCalled();
    expect(logseq.App.invokeExternalCommand).toHaveBeenCalledWith('logseq.page/toggle-favorite');
    expect(isFavorited('New Page')).toBe(true);
  });

  it('unfavorites via the same command and rolls back the cache on failure', async () => {
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['Existing Page']);
    await refreshFavorites();
    expect(isFavorited('Existing Page')).toBe(true);

    vi.mocked(logseq.App.invokeExternalCommand).mockRejectedValueOnce(new Error('command failed'));

    await expect(toggleFavorite('Existing Page')).rejects.toThrow('command failed');
    // Optimistic removal is rolled back so the star stays in sync with reality.
    expect(isFavorited('Existing Page')).toBe(true);
  });

  it('never inverts the toggle when the cache is stale', async () => {
    // Favorited natively; cache still says "not favorited".
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['Native Fav'] as string[]);
    vi.mocked(logseq.App.invokeExternalCommand).mockResolvedValue(undefined);

    await toggleFavorite('Native Fav');

    // Real state is favorited, so the click means "unfavorite": one toggle, cache agrees.
    expect(logseq.App.invokeExternalCommand).toHaveBeenCalledTimes(1);
    expect(isFavorited('Native Fav')).toBe(false);
  });
});

describe('clearFavoritesCache', () => {
  it('clears the favorites cache', async () => {
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['Test Page']);
    await refreshFavorites();

    expect(isFavorited('Test Page')).toBe(true);

    clearFavoritesCache();

    expect(isFavorited('Test Page')).toBe(false);
  });

  it('can be called multiple times safely', () => {
    clearFavoritesCache();
    clearFavoritesCache();
    clearFavoritesCache();

    expect(isFavorited('anything')).toBe(false);
  });

  it('clears cache without errors even if empty', () => {
    expect(() => clearFavoritesCache()).not.toThrow();
  });
});
