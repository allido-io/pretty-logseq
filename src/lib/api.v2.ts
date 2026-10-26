import type { BlockData, PageData, PageProperties } from '../types';
import { getPageBlocks } from './api';
import { TtlCache } from './cache';

/**
 * Logseq v2 (DB graph) data layer.
 *
 * `Editor.getPage` works on a DB graph but returns a very different property
 * shape than the v1 file graph (verified against a real instance):
 *
 * - Property keys are namespaced AND suffixed: `:user.property/<name>-<8char>`,
 *   e.g. `:user.property/owner-xEJFd0zo`, `:user.property/created-y-pW8jBd`. The
 *   suffix is always exactly 8 chars and may itself contain `-`/`_`.
 * - Property values are entity ids (bare numbers, e.g. `owner: 1927`, or arrays
 *   like `status: [492]`), NOT literals.
 * - Resolving an id via `:block/title` yields raw markdown, e.g.
 *   `1927 → "[[David Meents]]"`, `1924 → "[GitHub](https://…)"`,
 *   `1925 → "[[TypeScript]], [[Tauri]], [[Rust]]"`.
 *
 * This module normalizes that back into the shared `PageProperties` contract —
 * lowercased plain keys (`owner`, `status`, `url`, …) mapping to `string |
 * string[]` — so the version-agnostic popover renderer works unchanged. The
 * renderer's existing `cleanPropertyValue`/`extractUrl` handle the `[[ ]]` and
 * markdown-link forms, so raw titles pass straight through.
 *
 * v1 (`./api`) is intentionally left untouched — this is purely additive.
 */

// Separate cache instance from the v1 layer so the two never collide across a version switch.
const CACHE_TTL = 30000; // 30 seconds — matches the v1 layer
const pageCache = new TtlCache<PageData>(CACHE_TTL);

/**
 * Non-property entity attributes that must never become detail rows/tags. These
 * are the plain (non-namespaced) keys `Editor.getPage` returns alongside the
 * `:user.property/*` entries.
 */
const INTERNAL_KEYS = new Set([
  'id',
  'uuid',
  'name',
  'title',
  'fulltitle',
  'content',
  'tags',
  'refs',
  'path-refs',
  'createdat',
  'updatedat',
  'created-at',
  'updated-at',
  'journal-day',
  'format',
]);

export function clearPageCacheV2(pageName?: string): void {
  if (pageName) {
    pageCache.delete(pageName.toLowerCase());
  } else {
    pageCache.clear();
  }
}

export async function getPageV2(
  pageName: string,
  options: { useCache?: boolean } = {},
): Promise<PageData | null> {
  const { useCache = true } = options;
  const cacheKey = pageName.toLowerCase();

  if (useCache) {
    const cached = pageCache.get(cacheKey);
    if (cached !== undefined) return cached;
  }

  try {
    const entity = (await logseq.Editor.getPage(pageName)) as Record<string, unknown> | null;
    if (!entity) return null;

    const name = resolveName(entity, pageName);
    const properties = await normalizeProperties(entity);

    const pageData: PageData = { name, originalName: name, properties };
    pageCache.set(cacheKey, pageData);
    return pageData;
  } catch (err) {
    console.error(`[Pretty Logseq] Failed to fetch v2 page "${pageName}":`, err);
    return null;
  }
}

/** Blocks still expose markdown `content` strings on v2, so the v1 mapper suffices. */
export function getPageBlocksV2(pageName: string): Promise<BlockData[]> {
  return getPageBlocks(pageName);
}

/** Resolve the display name across the v2 (`title`) and v1 (`originalName`) shapes. */
function resolveName(entity: Record<string, unknown>, fallback: string): string {
  return (
    (entity['block/title'] as string) ||
    (entity.title as string) ||
    (entity.originalName as string) ||
    (entity.name as string) ||
    fallback
  );
}

/**
 * Normalize a DB page entity into the flat `PageProperties` map the renderer
 * expects. Two-phase so all entity-id references resolve in a single query:
 *   1. collect every referenced id across all properties;
 *   2. batch-resolve to `:block/title`, then build each value.
 */
export async function normalizeProperties(
  entity: Record<string, unknown>,
): Promise<PageProperties> {
  const rawEntries = collectPropertyEntries(entity);

  const ids = new Set<number>();
  for (const [, value] of rawEntries) collectRefIds(value, ids);
  const titles = ids.size > 0 ? await resolveRefTitles([...ids]) : new Map<number, string>();

  const props: PageProperties = {};
  for (const [rawKey, rawValue] of rawEntries) {
    const key = normalizeKey(rawKey);
    if (!key || INTERNAL_KEYS.has(key)) continue;
    const value = buildValue(rawValue, titles);
    if (value !== undefined && value !== '') props[key] = value;
  }
  return props;
}

/**
 * Pull the user-property entries off the entity. v2 puts them at the top level as
 * `:user.property/*` (also `:logseq.property/*`); a nested `properties` map is
 * accepted too for forward-compatibility.
 */
function collectPropertyEntries(entity: Record<string, unknown>): Array<[string, unknown]> {
  const entries: Array<[string, unknown]> = [];

  const nested = entity.properties;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    entries.push(...Object.entries(nested as Record<string, unknown>));
  }

  for (const [key, value] of Object.entries(entity)) {
    if (key === 'properties') continue;
    if (isPropertyKey(key)) entries.push([key, value]);
  }
  return entries;
}

/** A DB user property is a namespaced attribute, e.g. `:user.property/status-xxxx`. */
function isPropertyKey(key: string): boolean {
  const k = key.startsWith(':') ? key.slice(1) : key;
  return /\.property[^/]*\//.test(k);
}

/**
 * Strip the namespace and the 8-char id suffix, then lowercase.
 * `:user.property/owner-xEJFd0zo` → `owner`; `:user.property/created-y-pW8jBd` →
 * `created`. The suffix is always exactly 8 chars (and may contain `-`/`_`), so
 * the tail is matched by length rather than by splitting on the last hyphen.
 */
function normalizeKey(rawKey: string): string {
  let k = rawKey.startsWith(':') ? rawKey.slice(1) : rawKey;
  const slash = k.lastIndexOf('/');
  if (slash !== -1) k = k.slice(slash + 1);
  k = k.replace(/-[A-Za-z0-9_-]{8}$/, '');
  return k.toLowerCase();
}

/** Gather every entity id referenced by a raw property value. */
function collectRefIds(raw: unknown, out: Set<number>): void {
  const add = (v: unknown) => {
    if (typeof v === 'number') out.add(v);
    else if (v && typeof v === 'object') {
      const id = (v as Record<string, unknown>)['db/id'] ?? (v as Record<string, unknown>).id;
      if (typeof id === 'number') out.add(id);
    }
  };
  if (Array.isArray(raw)) raw.forEach(add);
  else add(raw);
}

/**
 * Build a normalized property value from a raw one, resolving entity ids to their
 * titles. Array values stay arrays (single-element arrays collapse to a scalar);
 * a single node whose title is itself a `[[a]], [[b]]` ref list is expanded to an
 * array so the renderer shows individual pills.
 */
function buildValue(raw: unknown, titles: Map<number, string>): string | string[] | undefined {
  const resolveOne = (v: unknown): string | undefined => {
    if (v == null) return undefined;
    if (typeof v === 'number') return titles.get(v);
    if (typeof v === 'string') return v;
    if (typeof v === 'boolean') return String(v);
    if (typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      const t = obj['block/title'] ?? obj.title ?? obj['block/name'] ?? obj.name;
      if (typeof t === 'string') return t;
      const id = obj['db/id'] ?? obj.id;
      if (typeof id === 'number') return titles.get(id);
    }
    return undefined;
  };

  if (Array.isArray(raw)) {
    const items = raw.map(resolveOne).filter((s): s is string => Boolean(s));
    if (items.length === 0) return undefined;
    return items.length === 1 ? items[0] : items;
  }

  const single = resolveOne(raw);
  if (single === undefined) return undefined;
  return splitMultiRefs(single) ?? single;
}

/** Split `"[[a]], [[b]], [[c]]"` into `['a','b','c']`; returns null for 0–1 refs. */
function splitMultiRefs(value: string): string[] | null {
  const matches = [...value.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]);
  return matches.length >= 2 ? matches : null;
}

/** Batch-resolve entity ids to their `:block/title` in a single datascript query. */
async function resolveRefTitles(ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (ids.length === 0) return out;
  try {
    const results = (await logseq.DB.datascriptQuery(
      `
      [:find ?id ?title
       :in $ [?id ...]
       :where [?id :block/title ?title]]
    `,
      `[${ids.join(' ')}]`,
    )) as Array<[number, string]> | null;

    if (!results) return out;
    for (const [id, title] of results) {
      if (typeof id === 'number' && typeof title === 'string') out.set(id, title);
    }
  } catch (err) {
    console.error('[Pretty Logseq] Failed to resolve v2 property references:', err);
  }
  return out;
}
