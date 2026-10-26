import { TtlCache } from '../../lib/cache';
import { getFaviconUrl } from './favicons';
import type { LinkMetadata } from './types';

const CACHE_TTL = 300_000; // 5 minutes
const FAILED_TTL = 60_000; // 1 minute retry
const metadataCache = new TtlCache<LinkMetadata>(CACHE_TTL);
/** URLs whose last fetch failed; present (and fresh) means "don't retry yet". */
const failedUrls = new TtlCache<true>(FAILED_TTL);
const FETCH_TIMEOUT = 5_000;

function getMetaContent(doc: Document, selectors: string[]): string | null {
  for (const selector of selectors) {
    const el = doc.querySelector(selector);
    if (el) {
      const content = el.getAttribute('content');
      if (content?.trim()) return content.trim();
    }
  }
  return null;
}

function resolveUrl(relative: string, base: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

interface HtmlResponse {
  ok: boolean;
  status: number;
  statusText: string;
  text: string;
}

/** Minimal shape of Logseq's proxied request client (`logseq.Request`). */
interface ProxyRequestClient {
  _request(opts: {
    url: string;
    method?: string;
    returnType?: string;
    headers?: Record<string, string>;
    timeout?: number;
  }): Promise<unknown>;
}

function getProxyRequestClient(): ProxyRequestClient | null {
  const client = (globalThis.logseq as unknown as { Request?: Partial<ProxyRequestClient> })
    ?.Request;
  return client && typeof client._request === 'function' ? (client as ProxyRequestClient) : null;
}

/**
 * Fetch a page's HTML.
 *
 * Prefers Logseq's proxied request (`logseq.Request`), which runs in the app's
 * main process and is therefore NOT subject to the renderer's CSP/CORS — the v2
 * (DB) app blocks cross-origin `fetch()`, so a direct fetch returns nothing.
 * Falls back to `fetch` when the proxy isn't available (v1 / test env).
 */
async function requestHtml(url: string, signal: AbortSignal): Promise<HtmlResponse> {
  const proxy = getProxyRequestClient();
  if (proxy) {
    const text = (await proxy._request({
      url,
      method: 'GET',
      returnType: 'text',
      headers: { Accept: 'text/html' },
      timeout: FETCH_TIMEOUT,
    })) as string | null;
    return { ok: true, status: 200, statusText: 'OK', text: text ?? '' };
  }

  const response = await fetch(url, { signal, headers: { Accept: 'text/html' } });
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    text: response.ok ? await response.text() : '',
  };
}

/**
 * Build a minimal, URL-derived metadata object so the popover can render even
 * when the metadata fetch is blocked (CSP `connect-src` / CORS in v2).
 */
export function createFallbackMetadata(url: string): LinkMetadata {
  let domain = url;
  try {
    domain = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    // Leave `domain` as the raw url if it can't be parsed.
  }
  return {
    url,
    title: null,
    description: null,
    image: null,
    siteName: null,
    domain,
    faviconUrl: getFaviconUrl(domain),
    error: null,
  };
}

export async function fetchMetadata(url: string): Promise<LinkMetadata | null> {
  // Check cache
  const cached = metadataCache.get(url);
  if (cached !== undefined) return cached;

  // Check failed URLs
  if (failedUrls.get(url)) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    let response: HtmlResponse;
    try {
      response = await requestHtml(url, controller.signal);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const metadata: LinkMetadata = {
        ...createFallbackMetadata(url),
        error: `This page returned ${response.status} (${response.statusText})`,
      };
      metadataCache.set(url, metadata);
      return metadata;
    }

    const html = response.text;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const title =
      getMetaContent(doc, [
        'meta[property="og:title"]',
        'meta[name="twitter:title"]',
        'meta[name="title"]',
      ]) ??
      doc.querySelector('title')?.textContent?.trim() ??
      null;

    const description = getMetaContent(doc, [
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'meta[name="description"]',
    ]);

    let image = getMetaContent(doc, ['meta[property="og:image"]', 'meta[name="twitter:image"]']);
    if (image) {
      image = resolveUrl(image, url);
    }

    const siteName = getMetaContent(doc, ['meta[property="og:site_name"]']);

    const metadata: LinkMetadata = {
      ...createFallbackMetadata(url),
      title,
      description,
      image,
      siteName,
    };

    metadataCache.set(url, metadata);
    failedUrls.delete(url);
    return metadata;
  } catch (err) {
    console.error(`[Pretty Logseq] Failed to fetch metadata for "${url}":`, err);
    failedUrls.set(url, true);
    return null;
  }
}

export function clearMetadataCache(): void {
  metadataCache.clear();
  failedUrls.clear();
}
