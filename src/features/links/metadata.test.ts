/**
 * Tests for Link Metadata Fetching
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMetadataCache, createFallbackMetadata, fetchMetadata } from './metadata';

describe('createFallbackMetadata', () => {
  it('derives the domain from the url and strips a leading www.', () => {
    const meta = createFallbackMetadata('https://www.example.com/some/path');
    expect(meta.domain).toBe('example.com');
    expect(meta.url).toBe('https://www.example.com/some/path');
    expect(meta.faviconUrl).toBe('https://example.com/favicon.ico');
  });

  it('leaves title/description/image empty so it renders as a minimal card', () => {
    const meta = createFallbackMetadata('https://example.com');
    expect(meta.title).toBeNull();
    expect(meta.description).toBeNull();
    expect(meta.image).toBeNull();
    expect(meta.error).toBeNull();
  });

  it('falls back to the raw url as the domain when it cannot be parsed', () => {
    const meta = createFallbackMetadata('not a url');
    expect(meta.domain).toBe('not a url');
  });
});

describe('fetchMetadata', () => {
  beforeEach(() => {
    clearMetadataCache();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response()));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetchHTML(html: string, status = 200, statusText = 'OK') {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(html, {
        status,
        statusText,
        headers: { 'Content-Type': 'text/html' },
      }),
    );
  }

  const fullHTML = `
		<html>
			<head>
				<title>Page Title</title>
				<meta property="og:title" content="OG Title" />
				<meta property="og:description" content="OG Description" />
				<meta property="og:image" content="https://example.com/image.png" />
				<meta property="og:site_name" content="Example Site" />
			</head>
			<body></body>
		</html>
	`;

  it('extracts OpenGraph metadata from HTML', async () => {
    mockFetchHTML(fullHTML);

    const result = await fetchMetadata('https://example.com/page');

    expect(result).not.toBeNull();
    expect(result?.title).toBe('OG Title');
    expect(result?.description).toBe('OG Description');
    expect(result?.image).toBe('https://example.com/image.png');
    expect(result?.siteName).toBe('Example Site');
    expect(result?.domain).toBe('example.com');
    expect(result?.faviconUrl).toBe('https://example.com/favicon.ico');
    expect(result?.error).toBeNull();
  });

  it('falls back to <title> tag when no OG title', async () => {
    mockFetchHTML('<html><head><title>Fallback Title</title></head><body></body></html>');

    const result = await fetchMetadata('https://example.com');

    expect(result?.title).toBe('Fallback Title');
  });

  it('falls back to twitter:title meta tag', async () => {
    mockFetchHTML(
      '<html><head><meta name="twitter:title" content="Twitter Title" /></head><body></body></html>',
    );

    const result = await fetchMetadata('https://example.com');

    expect(result?.title).toBe('Twitter Title');
  });

  it('extracts twitter:description as fallback', async () => {
    mockFetchHTML(
      '<html><head><meta name="twitter:description" content="Twitter Desc" /></head><body></body></html>',
    );

    const result = await fetchMetadata('https://example.com');

    expect(result?.description).toBe('Twitter Desc');
  });

  it('extracts twitter:image as fallback', async () => {
    mockFetchHTML(
      '<html><head><meta name="twitter:image" content="https://example.com/tw.png" /></head><body></body></html>',
    );

    const result = await fetchMetadata('https://example.com');

    expect(result?.image).toBe('https://example.com/tw.png');
  });

  it('resolves relative image URLs', async () => {
    mockFetchHTML(
      '<html><head><meta property="og:image" content="/images/hero.png" /></head><body></body></html>',
    );

    const result = await fetchMetadata('https://example.com/page');

    expect(result?.image).toBe('https://example.com/images/hero.png');
  });

  it('returns null fields when metadata is missing', async () => {
    mockFetchHTML('<html><head></head><body></body></html>');

    const result = await fetchMetadata('https://example.com');

    expect(result?.title).toBeNull();
    expect(result?.description).toBeNull();
    expect(result?.image).toBeNull();
    expect(result?.siteName).toBeNull();
  });

  it('strips www. from domain', async () => {
    mockFetchHTML('<html><head></head><body></body></html>');

    const result = await fetchMetadata('https://www.example.com');

    expect(result?.domain).toBe('example.com');
  });

  it('caches results and returns cached data on subsequent calls', async () => {
    mockFetchHTML(fullHTML);

    const first = await fetchMetadata('https://example.com/cached');
    const second = await fetchMetadata('https://example.com/cached');

    expect(first).toEqual(second);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('handles non-OK responses with error metadata', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response('Not Found', { status: 404, statusText: 'Not Found' }),
    );

    const result = await fetchMetadata('https://example.com/missing');

    expect(result).not.toBeNull();
    expect(result?.error).toBe('This page returned 404 (Not Found)');
    expect(result?.title).toBeNull();
    expect(result?.domain).toBe('example.com');
  });

  it('returns null and tracks failed URLs on fetch error', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('Network error'));

    const result = await fetchMetadata('https://example.com/fail');

    expect(result).toBeNull();
  });

  it('skips refetching recently failed URLs', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('Network error'));

    await fetchMetadata('https://example.com/fail2');
    const second = await fetchMetadata('https://example.com/fail2');

    expect(second).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('ignores empty/whitespace-only meta content', async () => {
    mockFetchHTML(
      '<html><head><meta property="og:title" content="   " /></head><body></body></html>',
    );

    const result = await fetchMetadata('https://example.com/blank');

    expect(result?.title).toBeNull();
  });

  it('trims meta content whitespace', async () => {
    mockFetchHTML(
      '<html><head><meta property="og:title" content="  Trimmed Title  " /></head><body></body></html>',
    );

    const result = await fetchMetadata('https://example.com/trim');

    expect(result?.title).toBe('Trimmed Title');
  });
});

describe('fetchMetadata via logseq.Request proxy', () => {
  beforeEach(() => {
    clearMetadataCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (globalThis.logseq as unknown as { Request?: unknown }).Request = undefined;
  });

  it('uses logseq.Request (proxy) instead of fetch when available', async () => {
    const _request = vi
      .fn()
      .mockResolvedValue(
        '<html><head><meta property="og:title" content="Proxied Title" /></head><body></body></html>',
      );
    (globalThis.logseq as unknown as { Request: { _request: typeof _request } }).Request = {
      _request,
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await fetchMetadata('https://example.com/proxy');

    expect(_request).toHaveBeenCalledTimes(1);
    expect(_request).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com/proxy', returnType: 'text' }),
    );
    // The proxy bypasses CORS; the renderer's fetch is never used.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result?.title).toBe('Proxied Title');
  });

  it('returns null when the proxy request fails', async () => {
    const _request = vi.fn().mockRejectedValue(new Error('blocked'));
    (globalThis.logseq as unknown as { Request: { _request: typeof _request } }).Request = {
      _request,
    };

    const result = await fetchMetadata('https://example.com/proxy-fail');

    expect(result).toBeNull();
  });

  it.each([
    ['null', null],
    ['empty-string', ''],
  ])('treats a %s proxy body as a failure, not a cached success', async (_label, body) => {
    const _request = vi.fn().mockResolvedValue(body);
    (globalThis.logseq as unknown as { Request: { _request: typeof _request } }).Request = {
      _request,
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const first = await fetchMetadata('https://example.com/proxy-empty');
    const second = await fetchMetadata('https://example.com/proxy-empty');

    expect(first).toBeNull();
    expect(second).toBeNull();
    // Second call short-circuits on failedUrls instead of re-requesting or serving a cached result.
    expect(_request).toHaveBeenCalledTimes(1);
  });
});

describe('clearMetadataCache', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response('<html><head><title>Test</title></head><body></body></html>', {
          status: 200,
        }),
      ),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearMetadataCache();
  });

  it('clears cache so next fetch hits the network', async () => {
    await fetchMetadata('https://example.com/clear');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    clearMetadataCache();

    await fetchMetadata('https://example.com/clear');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('clears failed URL tracking', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('fail'));

    await fetchMetadata('https://example.com/retry');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    clearMetadataCache();

    // After clearing, it should retry instead of returning null immediately
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('<html><head><title>Success</title></head><body></body></html>', {
        status: 200,
      }),
    );

    const result = await fetchMetadata('https://example.com/retry');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(result?.title).toBe('Success');
  });
});
