/**
 * Tests for Link Popover
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as metadataModule from './metadata';
import { setupLinkPopovers } from './popover';
import type { LinkMetadata } from './types';

vi.mock('./metadata', async importOriginal => ({
  ...(await importOriginal<typeof import('./metadata')>()),
  fetchMetadata: vi.fn(),
}));

const POPOVER_ID = 'pretty-logseq-link-popover';

function createExternalLink(href = 'https://example.com'): HTMLAnchorElement {
  const anchor = document.createElement('a');
  anchor.className = 'external-link';
  anchor.href = href;
  anchor.textContent = 'Example';
  document.body.appendChild(anchor);
  return anchor;
}

function makeMeta(overrides: Partial<LinkMetadata> = {}): LinkMetadata {
  return {
    url: 'https://example.com',
    title: 'Example',
    description: 'A description',
    image: null,
    siteName: 'Example Site',
    domain: 'example.com',
    faviconUrl: 'https://example.com/favicon.ico',
    error: null,
    ...overrides,
  };
}

describe('setupLinkPopovers', () => {
  let cleanup: (() => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup?.();
    cleanup = null;
    vi.useRealTimers();
  });

  it('returns a cleanup function', () => {
    cleanup = setupLinkPopovers();
    expect(typeof cleanup).toBe('function');
  });

  it('shows popover after hover delay on external link', async () => {
    vi.mocked(metadataModule.fetchMetadata).mockResolvedValue(makeMeta());
    cleanup = setupLinkPopovers();

    const link = createExternalLink();

    // Trigger mouseenter
    const event = new MouseEvent('mouseenter', { bubbles: true });
    Object.defineProperty(event, 'target', { value: link });
    document.dispatchEvent(event);

    // Advance past show delay (400ms)
    vi.advanceTimersByTime(400);

    // Wait for fetchMetadata promise
    await vi.runAllTimersAsync();

    const popover = document.getElementById(POPOVER_ID);
    expect(popover).not.toBeNull();
  });

  it('renders title in popover', async () => {
    vi.mocked(metadataModule.fetchMetadata).mockResolvedValue(makeMeta({ title: 'My Page Title' }));
    cleanup = setupLinkPopovers();

    const link = createExternalLink();
    const event = new MouseEvent('mouseenter', { bubbles: true });
    Object.defineProperty(event, 'target', { value: link });
    document.dispatchEvent(event);

    vi.advanceTimersByTime(400);
    await vi.runAllTimersAsync();

    const popover = document.getElementById(POPOVER_ID);
    expect(popover?.textContent).toContain('My Page Title');
  });

  it('renders description in popover', async () => {
    vi.mocked(metadataModule.fetchMetadata).mockResolvedValue(
      makeMeta({ description: 'Page desc' }),
    );
    cleanup = setupLinkPopovers();

    const link = createExternalLink();
    const event = new MouseEvent('mouseenter', { bubbles: true });
    Object.defineProperty(event, 'target', { value: link });
    document.dispatchEvent(event);

    vi.advanceTimersByTime(400);
    await vi.runAllTimersAsync();

    const popover = document.getElementById(POPOVER_ID);
    expect(popover?.querySelector('.pretty-link-popover__description')?.textContent).toBe(
      'Page desc',
    );
  });

  it('renders error message instead of description', async () => {
    vi.mocked(metadataModule.fetchMetadata).mockResolvedValue(
      makeMeta({ error: 'This page returned 404 (Not Found)', description: null }),
    );
    cleanup = setupLinkPopovers();

    const link = createExternalLink();
    const event = new MouseEvent('mouseenter', { bubbles: true });
    Object.defineProperty(event, 'target', { value: link });
    document.dispatchEvent(event);

    vi.advanceTimersByTime(400);
    await vi.runAllTimersAsync();

    const popover = document.getElementById(POPOVER_ID);
    expect(popover?.querySelector('.pretty-link-popover__error')?.textContent).toBe(
      'This page returned 404 (Not Found)',
    );
  });

  it('renders OG image when present', async () => {
    vi.mocked(metadataModule.fetchMetadata).mockResolvedValue(
      makeMeta({ image: 'https://example.com/hero.png' }),
    );
    cleanup = setupLinkPopovers();

    const link = createExternalLink();
    const event = new MouseEvent('mouseenter', { bubbles: true });
    Object.defineProperty(event, 'target', { value: link });
    document.dispatchEvent(event);

    vi.advanceTimersByTime(400);
    await vi.runAllTimersAsync();

    const popover = document.getElementById(POPOVER_ID);
    const img = popover?.querySelector('.pretty-link-popover__image img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img?.src).toContain('hero.png');
  });

  it('renders footer with URL', async () => {
    vi.mocked(metadataModule.fetchMetadata).mockResolvedValue(
      makeMeta({ url: 'https://example.com/page' }),
    );
    cleanup = setupLinkPopovers();

    const link = createExternalLink('https://example.com/page');
    const event = new MouseEvent('mouseenter', { bubbles: true });
    Object.defineProperty(event, 'target', { value: link });
    document.dispatchEvent(event);

    vi.advanceTimersByTime(400);
    await vi.runAllTimersAsync();

    const footer = document.querySelector('.pretty-link-popover__footer');
    expect(footer?.textContent).toBe('https://example.com/page');
  });

  it('falls back to domain when title and siteName are null', async () => {
    vi.mocked(metadataModule.fetchMetadata).mockResolvedValue(
      makeMeta({ title: null, siteName: null, domain: 'example.com' }),
    );
    cleanup = setupLinkPopovers();

    const link = createExternalLink();
    const event = new MouseEvent('mouseenter', { bubbles: true });
    Object.defineProperty(event, 'target', { value: link });
    document.dispatchEvent(event);

    vi.advanceTimersByTime(400);
    await vi.runAllTimersAsync();

    const title = document.querySelector('.pretty-link-popover__title');
    expect(title?.textContent).toBe('example.com');
  });

  it('shows a fallback popover when metadata is null (fetch blocked)', async () => {
    vi.mocked(metadataModule.fetchMetadata).mockResolvedValue(null);
    cleanup = setupLinkPopovers();

    const link = createExternalLink('https://example.com/page');
    const event = new MouseEvent('mouseenter', { bubbles: true });
    Object.defineProperty(event, 'target', { value: link });
    document.dispatchEvent(event);

    vi.advanceTimersByTime(400);
    await vi.runAllTimersAsync();

    // Popover still appears, built from the URL alone (domain + full URL).
    const popover = document.getElementById(POPOVER_ID);
    expect(popover).not.toBeNull();
    expect(popover?.querySelector('.pretty-link-popover__title')?.textContent).toBe('example.com');
    expect(popover?.querySelector('.pretty-link-popover__footer')?.textContent).toBe(
      'https://example.com/page',
    );
  });

  it('hides popover on click', async () => {
    vi.mocked(metadataModule.fetchMetadata).mockResolvedValue(makeMeta());
    cleanup = setupLinkPopovers();

    const link = createExternalLink();

    // Show the popover
    const enterEvent = new MouseEvent('mouseenter', { bubbles: true });
    Object.defineProperty(enterEvent, 'target', { value: link });
    document.dispatchEvent(enterEvent);
    vi.advanceTimersByTime(400);
    await vi.runAllTimersAsync();

    expect(document.getElementById(POPOVER_ID)).not.toBeNull();

    // Click on the link
    const clickEvent = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(clickEvent, 'target', { value: link });
    document.dispatchEvent(clickEvent);

    expect(document.getElementById(POPOVER_ID)).toBeNull();
  });

  it('cleanup removes event listeners and popover', async () => {
    vi.mocked(metadataModule.fetchMetadata).mockResolvedValue(makeMeta());
    cleanup = setupLinkPopovers();

    const link = createExternalLink();

    // Show popover
    const event = new MouseEvent('mouseenter', { bubbles: true });
    Object.defineProperty(event, 'target', { value: link });
    document.dispatchEvent(event);
    vi.advanceTimersByTime(400);
    await vi.runAllTimersAsync();

    expect(document.getElementById(POPOVER_ID)).not.toBeNull();

    // Cleanup
    cleanup();
    cleanup = null;

    expect(document.getElementById(POPOVER_ID)).toBeNull();
  });

  it('re-entering same anchor clears hide timer instead of recreating popover', async () => {
    vi.mocked(metadataModule.fetchMetadata).mockResolvedValue(makeMeta());
    cleanup = setupLinkPopovers();

    const link = createExternalLink();

    // Show popover
    const enterEvent = new MouseEvent('mouseenter', { bubbles: true });
    Object.defineProperty(enterEvent, 'target', { value: link });
    document.dispatchEvent(enterEvent);
    vi.advanceTimersByTime(400);
    await vi.runAllTimersAsync();

    expect(document.getElementById(POPOVER_ID)).not.toBeNull();

    // Re-enter same anchor while popover is visible — should not call fetchMetadata again
    const callsBefore = vi.mocked(metadataModule.fetchMetadata).mock.calls.length;
    const reEnterEvent = new MouseEvent('mouseenter', { bubbles: true });
    Object.defineProperty(reEnterEvent, 'target', { value: link });
    document.dispatchEvent(reEnterEvent);

    vi.advanceTimersByTime(400);
    await vi.runAllTimersAsync();

    expect(vi.mocked(metadataModule.fetchMetadata).mock.calls.length).toBe(callsBefore);
    expect(document.getElementById(POPOVER_ID)).not.toBeNull();
  });

  it('mouseleave from anchor schedules hide when popover exists', async () => {
    vi.mocked(metadataModule.fetchMetadata).mockResolvedValue(makeMeta());
    cleanup = setupLinkPopovers();

    const link = createExternalLink();

    // Show popover
    const enterEvent = new MouseEvent('mouseenter', { bubbles: true });
    Object.defineProperty(enterEvent, 'target', { value: link });
    document.dispatchEvent(enterEvent);
    vi.advanceTimersByTime(400);
    await vi.runAllTimersAsync();

    expect(document.getElementById(POPOVER_ID)).not.toBeNull();

    // Mouseleave from anchor
    link.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));

    // Wait for hide delay (150ms)
    vi.advanceTimersByTime(150);

    expect(document.getElementById(POPOVER_ID)).toBeNull();
  });

  it('mouseleave from anchor clears currentAnchor when no popover exists', async () => {
    vi.mocked(metadataModule.fetchMetadata).mockResolvedValue(null);
    cleanup = setupLinkPopovers();

    const link = createExternalLink();

    // Trigger enter — will not create popover since metadata is null
    const enterEvent = new MouseEvent('mouseenter', { bubbles: true });
    Object.defineProperty(enterEvent, 'target', { value: link });
    document.dispatchEvent(enterEvent);

    // Leave before show delay fires
    link.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));

    // Show timer was cleared; no popover should appear
    vi.advanceTimersByTime(400);
    await vi.runAllTimersAsync();

    expect(document.getElementById(POPOVER_ID)).toBeNull();
  });

  it('favicon error handler swaps in an inline globe svg', async () => {
    vi.mocked(metadataModule.fetchMetadata).mockResolvedValue(makeMeta());
    cleanup = setupLinkPopovers();

    const link = createExternalLink();
    const enterEvent = new MouseEvent('mouseenter', { bubbles: true });
    Object.defineProperty(enterEvent, 'target', { value: link });
    document.dispatchEvent(enterEvent);
    vi.advanceTimersByTime(400);
    await vi.runAllTimersAsync();

    const favicon = document.querySelector('img.pretty-link-popover__favicon') as HTMLImageElement;
    expect(favicon).not.toBeNull();

    // Simulate image error (offline / 404 / CSP img-src block).
    favicon.onerror?.(new Event('error'));

    // The <img> is replaced by an inline <svg>, which renders under any CSP.
    expect(document.querySelector('img.pretty-link-popover__favicon')).toBeNull();
    expect(document.querySelector('svg.pretty-link-popover__favicon')).not.toBeNull();
  });

  it('does not show popover for non-external-link targets', async () => {
    vi.mocked(metadataModule.fetchMetadata).mockResolvedValue(makeMeta());
    cleanup = setupLinkPopovers();

    const span = document.createElement('span');
    document.body.appendChild(span);

    const event = new MouseEvent('mouseenter', { bubbles: true });
    Object.defineProperty(event, 'target', { value: span });
    document.dispatchEvent(event);

    vi.advanceTimersByTime(400);
    await vi.runAllTimersAsync();

    expect(document.getElementById(POPOVER_ID)).toBeNull();
  });
});
