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
 * In-flight toggle per page (lowercased name). Toggles for the same page run one
 * after another so each reads the state the previous write left behind; without
 * this, a fast double-click reads "not favorited" twice and favorites twice.
 */
const pendingToggles = new Map<string, Promise<void>>();

/**
 * Toggle favorite status for a page
 */
export function toggleFavorite(pageName: string): Promise<void> {
  const lowerName = pageName.toLowerCase();
  const wasCached = favoritesCache.has(lowerName);

  // Optimistic update (synchronous, so the star flips immediately)
  setCached(lowerName, !wasCached);

  const previous = pendingToggles.get(lowerName) ?? Promise.resolve();
  const run = previous
    .catch(() => {}) // the previous click's caller already handles its failure
    .then(() => writeToggle(pageName, lowerName, wasCached));

  const settle = () => {
    if (pendingToggles.get(lowerName) === run) pendingToggles.delete(lowerName);
  };
  pendingToggles.set(lowerName, run);
  run.then(settle, settle);

  return run;
}

function setCached(lowerName: string, favorited: boolean): void {
  if (favorited) {
    favoritesCache.add(lowerName);
  } else {
    favoritesCache.delete(lowerName);
  }
}

async function writeToggle(pageName: string, lowerName: string, wasCached: boolean): Promise<void> {
  let wasFavorited = wasCached;

  try {
    // The cache can be stale (native favoriting, or a failed refresh emptied it),
    // so decide from the graph's real state, not from the cache.
    const actual = await readFavorited(lowerName);
    if (actual !== null && actual !== wasFavorited) {
      wasFavorited = actual;
      setCached(lowerName, !wasFavorited);
    }

    // The write mechanism is version-specific (v1 rewrites the graph config; v2
    // invokes the built-in toggle command), so delegate to the platform.
    await getPlatform().api.toggleFavorite(pageName, !wasFavorited);
  } catch (error) {
    console.error('[Pretty Logseq] Failed to toggle favorite:', error);

    // Rollback optimistic update
    setCached(lowerName, wasFavorited);

    throw error;
  }
}

/**
 * Clear favorites cache (cleanup)
 */
export function clearFavoritesCache(): void {
  favoritesCache.clear();
}
