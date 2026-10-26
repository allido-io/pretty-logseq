/**
 * Favorites API
 * Handles reading/writing favorite pages via Logseq API with caching
 */

import { getPlatform } from '../../../core/platform';

let favoritesCache = new Set<string>();

/**
 * Refresh favorites from Logseq graph config
 */
export async function refreshFavorites(): Promise<void> {
  try {
    const favorites = await getPlatform().api.getFavorites();
    favoritesCache = new Set(favorites.map(name => name.toLowerCase()));
  } catch (error) {
    console.error('[Pretty Logseq] Failed to refresh favorites:', error);
    favoritesCache = new Set();
  }
}

/**
 * Check if a page is favorited (case-insensitive)
 */
export function isFavorited(pageName: string): boolean {
  return favoritesCache.has(pageName.toLowerCase());
}

/**
 * Read the graph's real favorites state for a page, bypassing the cache.
 * Returns null when the read fails so the caller can fall back to the cache.
 */
async function readFavorited(lowerName: string): Promise<boolean | null> {
  try {
    const favorites = await getPlatform().api.getFavorites();
    return favorites.some(name => name.toLowerCase() === lowerName);
  } catch {
    return null;
  }
}

/**
 * Toggle favorite status for a page
 */
export async function toggleFavorite(pageName: string): Promise<void> {
  const lowerName = pageName.toLowerCase();
  let wasFavorited = favoritesCache.has(lowerName);

  // Optimistic update (synchronous, so the star flips immediately)
  if (wasFavorited) {
    favoritesCache.delete(lowerName);
  } else {
    favoritesCache.add(lowerName);
  }

  const setCached = (favorited: boolean) => {
    if (favorited) {
      favoritesCache.add(lowerName);
    } else {
      favoritesCache.delete(lowerName);
    }
  };

  try {
    // The cache can be stale (native favoriting, or a failed refresh emptied it),
    // so decide from the graph's real state, not from the cache.
    const actual = await readFavorited(lowerName);
    if (actual !== null && actual !== wasFavorited) {
      wasFavorited = actual;
      setCached(!wasFavorited);
    }

    // The write mechanism is version-specific (v1 rewrites the graph config; v2
    // invokes the built-in toggle command), so delegate to the platform.
    await getPlatform().api.toggleFavorite(pageName, !wasFavorited);
  } catch (error) {
    console.error('[Pretty Logseq] Failed to toggle favorite:', error);

    // Rollback optimistic update
    setCached(wasFavorited);

    throw error;
  }
}

/**
 * Clear favorites cache (cleanup)
 */
export function clearFavoritesCache(): void {
  favoritesCache.clear();
}
