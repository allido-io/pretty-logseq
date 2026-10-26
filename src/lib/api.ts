import type { BlockData, PageData, PageProperties } from '../types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const pageCache = new Map<string, CacheEntry<PageData>>();
const CACHE_TTL = 30000; // 30 seconds

export async function getPage(
  pageName: string,
  options: { useCache?: boolean } = {},
): Promise<PageData | null> {
  const { useCache = true } = options;
  const cacheKey = pageName.toLowerCase();

  if (useCache) {
    const cached = pageCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  try {
    const page = await logseq.Editor.getPage(pageName);
    if (!page) return null;

    let pageData: PageData = {
      name: page.originalName || page.name,
      originalName: page.originalName,
      properties: (page.properties || {}) as PageProperties,
    };

    // If the page has no properties, it may be an alias stub.
    // Try to resolve to the root page via Datascript.
    if (Object.keys(pageData.properties).length === 0) {
      const resolved = await resolveAlias(pageName);
      if (resolved) {
        pageData = resolved;
      }
    }

    pageCache.set(cacheKey, { data: pageData, timestamp: Date.now() });
    return pageData;
  } catch (err) {
    console.error(`[Pretty Logseq] Failed to fetch page "${pageName}":`, err);
    return null;
  }
}

export function clearPageCache(pageName?: string): void {
  if (pageName) {
    pageCache.delete(pageName.toLowerCase());
  } else {
    pageCache.clear();
  }
}

export async function getThemeMode(): Promise<'light' | 'dark'> {
  try {
    const configs = await logseq.App.getUserConfigs();
    return configs.preferredThemeMode === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/**
 * Get the block tree for a page.
 * Returns simplified BlockData[] with content strings.
 */
export async function getPageBlocks(pageName: string): Promise<BlockData[]> {
  try {
    const blocks = await logseq.Editor.getPageBlocksTree(pageName);
    if (!blocks) return [];
    return blocks.map(mapBlock);
  } catch (err) {
    console.error(`[Pretty Logseq] Failed to fetch blocks for "${pageName}":`, err);
    return [];
  }
}

/**
 * Resolve an alias name to its root page using a Datascript query.
 * Returns the root page data if found, null otherwise.
 */
async function resolveAlias(aliasName: string): Promise<PageData | null> {
  try {
    const results = await logseq.DB.datascriptQuery(
      `
      [:find (pull ?p [*])
       :in $ ?name
       :where
       [?a :block/name ?name]
       [?p :block/alias ?a]]
    `,
      // Inputs are read as EDN by Logseq; JSON string escapes are a valid subset.
      JSON.stringify(aliasName.toLowerCase()),
    );

    if (!results?.length) return null;

    const page = results[0][0];
    if (!page) return null;

    return {
      name: page.originalName || page.name,
      originalName: page.originalName,
      properties: (page.properties || {}) as PageProperties,
    };
  } catch (err) {
    console.error(`[Pretty Logseq] Failed to resolve alias "${aliasName}":`, err);
    return null;
  }
}

function mapBlock(block: Record<string, unknown>): BlockData {
  const children = block.children as Record<string, unknown>[] | undefined;
  return {
    content: (block.content as string) || '',
    children: children?.map(mapBlock),
  };
}

/**
 * Clean block content for display in popovers.
 * Strips property lines, block/page references, and markdown formatting.
 */
export function cleanBlockContent(content: string): string {
  return content
    .replace(/^[a-zA-Z-]+::.*$/gm, '') // Remove property lines
    .replace(/\(\([a-f0-9-]+\)\)/g, '') // Remove block references
    .replace(/\[\[([^\]]+)\]\]/g, '$1') // [[Page]] -> Page
    .replace(/[*_~`]+/g, '') // Remove markdown emphasis
    .replace(/^#+\s*/gm, '') // Remove heading markers
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // [text](url) -> text
    .replace(/\n{2,}/g, '\n') // Collapse multiple newlines
    .trim();
}

/**
 * Clean property value by removing [[ ]] brackets.
 * Logseq returns some properties as arrays (e.g. type: ["Resource"]),
 * so we handle both strings and arrays.
 */
export function cleanPropertyValue(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return String(raw ?? '');
  return raw.replace(/^\[\[|\]\]$/g, '').trim();
}
