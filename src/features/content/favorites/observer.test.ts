/**
 * Tests for Favorites Observer
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { partialMock } from '../../../../test/mocks/logseq';
import { setVersionForTest } from '../../../core/version';
import * as favoritesApi from './api';
import { clearFavoritesCache, refreshFavorites } from './api';
import { cleanupFavoriteObserver, setupFavoriteObserver } from './observer';

type RouteChangedHandler = Parameters<typeof logseq.App.onRouteChanged>[0];
const routeEvent = { path: '/page/test', template: '/page/:name' };

describe('setupFavoriteObserver', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clearFavoritesCache();
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue([]);
    partialMock(logseq.Editor.getCurrentPage).mockResolvedValue({
      name: 'test-page',
      originalName: 'Test Page',
    });
  });

  function createTitleElement(): HTMLHeadingElement {
    const h1 = document.createElement('h1');
    h1.className = 'title';
    h1.textContent = 'Test Page';
    return h1;
  }

  function createContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'main-content-container';
    return container;
  }

  it('performs initial scan and injects star buttons', async () => {
    const container = createContainer();
    const title = createTitleElement();
    container.appendChild(title);
    document.body.appendChild(container);

    setupFavoriteObserver();

    // Wait for initial scan
    await new Promise(resolve => setTimeout(resolve, 0));

    const starButton = title.querySelector('.pl-favorite-star');
    expect(starButton).not.toBeNull();
    expect(starButton?.tagName).toBe('BUTTON');

    cleanupFavoriteObserver();
  });

  it('marks processed titles to avoid duplicate injection', async () => {
    const container = createContainer();
    const title = createTitleElement();
    container.appendChild(title);
    document.body.appendChild(container);

    setupFavoriteObserver();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(title.getAttribute('data-pl-favorite-resolved')).toBe('true');
    const firstButton = title.querySelector('.pl-favorite-star');

    // Trigger another scan (shouldn't add another button)
    await new Promise(resolve => setTimeout(resolve, 0));

    const buttons = title.querySelectorAll('.pl-favorite-star');
    expect(buttons.length).toBe(1);
    expect(buttons[0]).toBe(firstButton);

    cleanupFavoriteObserver();
  });

  it('detects new titles added via mutation', async () => {
    const container = createContainer();
    document.body.appendChild(container);

    setupFavoriteObserver();
    await new Promise(resolve => setTimeout(resolve, 0));

    // Add title after observer is set up
    const title = createTitleElement();
    container.appendChild(title);

    // Wait for mutation observer + RAF
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });

    const starButton = title.querySelector('.pl-favorite-star');
    expect(starButton).not.toBeNull();

    cleanupFavoriteObserver();
  });

  it('sets initial star state based on favorites cache', async () => {
    // Set up favorites before observer
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['test-page']);
    await refreshFavorites();

    const container = createContainer();
    const title = createTitleElement();
    container.appendChild(title);
    document.body.appendChild(container);

    setupFavoriteObserver();
    await new Promise(resolve => setTimeout(resolve, 0));

    const starButton = title.querySelector('.pl-favorite-star') as HTMLButtonElement;
    expect(starButton).not.toBeNull();
    expect(starButton.classList.contains('pl-favorite-star--active')).toBe(true);

    cleanupFavoriteObserver();
  });

  it('toggles star state on click', async () => {
    await refreshFavorites();
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue([]);
    vi.mocked(logseq.App.setCurrentGraphConfigs).mockResolvedValue(undefined);

    const container = createContainer();
    const title = createTitleElement();
    container.appendChild(title);
    document.body.appendChild(container);

    setupFavoriteObserver();
    await new Promise(resolve => setTimeout(resolve, 0));

    const starButton = title.querySelector('.pl-favorite-star') as HTMLButtonElement;
    expect(starButton.classList.contains('pl-favorite-star--active')).toBe(false);

    // Click to favorite - wait for the async operation
    const clickPromise = new Promise<void>(resolve => {
      starButton.addEventListener('click', () => {
        setTimeout(resolve, 10);
      });
    });
    starButton.click();
    await clickPromise;

    expect(starButton.classList.contains('pl-favorite-star--active')).toBe(true);
    // The mock returns name: 'test-page', so that's what gets passed to toggleFavorite
    expect(logseq.App.setCurrentGraphConfigs).toHaveBeenCalledWith({
      favorites: ['test-page'],
    });

    cleanupFavoriteObserver();
  });

  it('prevents event propagation on star click', async () => {
    const container = createContainer();
    const title = createTitleElement();
    container.appendChild(title);
    document.body.appendChild(container);

    const clickHandler = vi.fn();
    title.addEventListener('click', clickHandler);

    setupFavoriteObserver();
    await new Promise(resolve => setTimeout(resolve, 0));

    const starButton = title.querySelector('.pl-favorite-star') as HTMLButtonElement;
    starButton.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(clickHandler).not.toHaveBeenCalled();

    cleanupFavoriteObserver();
  });

  it('logs and swallows an error when toggling a favorite fails', async () => {
    const container = createContainer();
    const title = createTitleElement();
    container.appendChild(title);
    document.body.appendChild(container);

    setupFavoriteObserver();
    await new Promise(resolve => setTimeout(resolve, 0));

    const star = title.querySelector('.pl-favorite-star') as HTMLButtonElement;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // The underlying write reads the graph favorites; make that reject.
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockRejectedValue(new Error('boom'));

    expect(() => star.click()).not.toThrow();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(errorSpy).toHaveBeenCalledWith(
      '[Pretty Logseq] Failed to toggle favorite:',
      expect.any(Error),
    );

    errorSpy.mockRestore();
    cleanupFavoriteObserver();
  });

  it('logs when the favorites refresh on a route change fails', async () => {
    let routeCallback = null as RouteChangedHandler | null;
    vi.mocked(logseq.App.onRouteChanged).mockImplementation(cb => {
      routeCallback = cb;
      return () => {};
    });

    const container = createContainer();
    container.appendChild(createTitleElement());
    document.body.appendChild(container);

    setupFavoriteObserver();
    await new Promise(resolve => setTimeout(resolve, 0));

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // refreshFavorites swallows its own errors, so reject it at the call site to
    // exercise the route handler's catch.
    const refreshSpy = vi
      .spyOn(favoritesApi, 'refreshFavorites')
      .mockRejectedValue(new Error('refresh failed'));
    routeCallback?.(routeEvent);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(errorSpy).toHaveBeenCalledWith(
      '[Pretty Logseq] Failed to sync favorites on route change:',
      expect.any(Error),
    );

    refreshSpy.mockRestore();
    errorSpy.mockRestore();
    cleanupFavoriteObserver();
  });

  it('falls back to originalName when the current page has no name', async () => {
    partialMock(logseq.Editor.getCurrentPage).mockResolvedValue({
      originalName: 'Original Only',
    } as Awaited<ReturnType<typeof logseq.Editor.getCurrentPage>>);

    const container = createContainer();
    const title = createTitleElement();
    container.appendChild(title);
    document.body.appendChild(container);

    setupFavoriteObserver();
    await new Promise(resolve => setTimeout(resolve, 0));

    const star = title.querySelector('.pl-favorite-star') as HTMLButtonElement;
    expect(star).not.toBeNull();
    expect(star.dataset.plFavoritePage).toBe('Original Only');

    cleanupFavoriteObserver();
  });

  it('handles getCurrentPage errors gracefully', async () => {
    partialMock(logseq.Editor.getCurrentPage).mockRejectedValue(new Error('No page'));

    const container = createContainer();
    const title = createTitleElement();
    container.appendChild(title);
    document.body.appendChild(container);

    setupFavoriteObserver();
    await new Promise(resolve => setTimeout(resolve, 0));

    // Should not inject star button
    const starButton = title.querySelector('.pl-favorite-star');
    expect(starButton).toBeNull();

    cleanupFavoriteObserver();
  });

  it('handles null currentPage gracefully', async () => {
    partialMock(logseq.Editor.getCurrentPage).mockResolvedValue(null);

    const container = createContainer();
    const title = createTitleElement();
    container.appendChild(title);
    document.body.appendChild(container);

    setupFavoriteObserver();
    await new Promise(resolve => setTimeout(resolve, 0));

    // Should not inject star button
    const starButton = title.querySelector('.pl-favorite-star');
    expect(starButton).toBeNull();

    cleanupFavoriteObserver();
  });

  it('sets up route change listener', () => {
    setupFavoriteObserver();

    expect(logseq.App.onRouteChanged).toHaveBeenCalled();

    cleanupFavoriteObserver();
  });

  it('refreshes favorites on route change', async () => {
    let routeCallback = null as RouteChangedHandler | null;
    vi.mocked(logseq.App.onRouteChanged).mockImplementation(cb => {
      routeCallback = cb;
      return () => {};
    });

    setupFavoriteObserver();
    expect(routeCallback).not.toBeNull();

    // Trigger route change
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue(['new-favorites']);
    routeCallback?.(routeEvent);

    await new Promise(resolve => setTimeout(resolve, 150)); // Wait for route change delay

    expect(logseq.App.getCurrentGraphFavorites).toHaveBeenCalled();

    cleanupFavoriteObserver();
  });

  it('falls back to document.body if main-content-container not found', () => {
    // Don't add main-content-container
    setupFavoriteObserver();

    // Should not throw error
    expect(() => cleanupFavoriteObserver()).not.toThrow();
  });

  it('batches multiple mutations with requestAnimationFrame', async () => {
    const container = createContainer();
    document.body.appendChild(container);

    let scanCount = 0;
    partialMock(logseq.Editor.getCurrentPage).mockImplementation(async () => {
      scanCount++;
      return {
        name: 'test-page',
        originalName: 'Test Page',
      };
    });

    setupFavoriteObserver();

    // Add multiple titles rapidly
    for (let i = 0; i < 5; i++) {
      const title = createTitleElement();
      container.appendChild(title);
    }

    // Wait for batched processing
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });

    // Should batch into fewer scans than titles added
    // RAF batching means multiple DOM changes trigger only one scan
    expect(scanCount).toBeLessThan(5);

    cleanupFavoriteObserver();
  });
});

describe('setupFavoriteObserver (v2)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clearFavoritesCache();
    setVersionForTest('v2');
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue([]);
    partialMock(logseq.Editor.getCurrentPage).mockResolvedValue({
      name: 'test-page',
      originalName: 'Test Page',
    });
  });

  afterEach(() => {
    setVersionForTest(null);
  });

  // v2 renders the title as an editable block inside a `space-between` row:
  // `#main-content-container > .flex.flex-row.space-between > .ls-page-title`.
  // The editable title text lives in a nested `.block-content-wrapper`.
  function createV2Title(): {
    row: HTMLDivElement;
    title: HTMLDivElement;
    wrapper: HTMLDivElement;
    text: HTMLDivElement;
  } {
    const container = document.createElement('div');
    container.id = 'main-content-container';
    const row = document.createElement('div');
    row.className = 'flex flex-row space-between';
    const title = document.createElement('div');
    title.className = 'title ls-page-title flex flex-1 w-full content items-start';
    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-1 w-full block-content-wrapper';
    const text = document.createElement('div');
    text.className = 'block-content inline';
    text.textContent = 'Test Page';
    wrapper.appendChild(text);
    title.appendChild(wrapper);
    row.appendChild(title);
    container.appendChild(row);
    document.body.appendChild(container);
    return { row, title, wrapper, text };
  }

  it('injects the star at the start of the title, before the title text', async () => {
    const { title, wrapper, text } = createV2Title();

    setupFavoriteObserver();
    await new Promise(resolve => setTimeout(resolve, 0));

    // The star sits inside the title's `.block-content-wrapper`, immediately
    // before the title text — not out at the row's right edge, where the DB app
    // now renders the page-tag pill.
    const star = wrapper.querySelector('.pl-favorite-star');
    expect(star).not.toBeNull();
    expect(star?.parentElement).toBe(wrapper);
    expect(star?.nextElementSibling).toBe(text);
    expect(title.getAttribute('data-pl-favorite-resolved')).toBe('true');

    cleanupFavoriteObserver();
  });

  it('prepends the star to the wrapper when the title text node is not an element', async () => {
    // `.block-content-wrapper` present but no `.block-content` element (e.g. the
    // title renders as a bare text node) → the star prepends to the wrapper.
    const container = document.createElement('div');
    container.id = 'main-content-container';
    const title = document.createElement('div');
    title.className = 'title ls-page-title flex flex-1 w-full';
    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-1 w-full block-content-wrapper';
    wrapper.textContent = 'Bare Title';
    title.appendChild(wrapper);
    container.appendChild(title);
    document.body.appendChild(container);

    setupFavoriteObserver();
    await new Promise(resolve => setTimeout(resolve, 0));

    const star = wrapper.querySelector('.pl-favorite-star');
    expect(star).not.toBeNull();
    expect(star?.parentElement).toBe(wrapper);
    expect(wrapper.firstElementChild).toBe(star);

    cleanupFavoriteObserver();
  });

  it('prepends the star to the title when there is no block-content wrapper', async () => {
    // No `.block-content-wrapper` at all → fall back to prepending the title.
    const container = document.createElement('div');
    container.id = 'main-content-container';
    const title = document.createElement('div');
    title.className = 'title ls-page-title flex flex-1 w-full';
    title.textContent = 'Plain Title';
    container.appendChild(title);
    document.body.appendChild(container);

    setupFavoriteObserver();
    await new Promise(resolve => setTimeout(resolve, 0));

    const star = title.querySelector('.pl-favorite-star');
    expect(star).not.toBeNull();
    expect(title.firstElementChild).toBe(star);

    cleanupFavoriteObserver();
  });

  it('re-injects the star on the next scan if the title block drops it', async () => {
    let routeCallback = null as RouteChangedHandler | null;
    vi.mocked(logseq.App.onRouteChanged).mockImplementation(cb => {
      routeCallback = cb;
      return () => {};
    });

    const { wrapper } = createV2Title();

    setupFavoriteObserver();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(wrapper.querySelector('.pl-favorite-star')).not.toBeNull();

    // Simulate a React re-render wiping the in-block star; the next scan (driven
    // here by a route change) must restore it despite the marker still being set.
    wrapper.querySelector('.pl-favorite-star')?.remove();
    routeCallback?.(routeEvent);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(wrapper.querySelector('.pl-favorite-star')).not.toBeNull();

    cleanupFavoriteObserver();
  });

  it('does not duplicate the star on repeated scans', async () => {
    const { row } = createV2Title();

    setupFavoriteObserver();
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(row.querySelectorAll('.pl-favorite-star').length).toBe(1);

    cleanupFavoriteObserver();
  });

  it('re-syncs a star to active after the favorites cache refreshes on route change', async () => {
    // Capture the route-change callback so we can drive it.
    let routeCallback = null as RouteChangedHandler | null;
    vi.mocked(logseq.App.onRouteChanged).mockImplementation(cb => {
      routeCallback = cb;
      return () => {};
    });

    const { row } = createV2Title();

    // Cache is empty when the star is first injected → it starts inactive.
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue([]);
    setupFavoriteObserver();
    await new Promise(resolve => setTimeout(resolve, 0));

    const star = row.querySelector('.pl-favorite-star') as HTMLButtonElement;
    expect(star.classList.contains('pl-favorite-star--active')).toBe(false);

    // The page is in fact favorited (DB returns entities); a route change refresh
    // must flip the already-injected star to active.
    vi.mocked(logseq.App.getCurrentGraphFavorites).mockResolvedValue([
      { name: 'test-page', originalName: 'Test Page', uuid: 'uuid-1' },
    ] as unknown as string[]);
    routeCallback?.(routeEvent);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(star.classList.contains('pl-favorite-star--active')).toBe(true);

    cleanupFavoriteObserver();
  });

  it('cleanup removes the star and its marker', async () => {
    const { row, title } = createV2Title();

    setupFavoriteObserver();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(row.querySelector('.pl-favorite-star')).not.toBeNull();

    cleanupFavoriteObserver();

    expect(row.querySelector('.pl-favorite-star')).toBeNull();
    expect(title.getAttribute('data-pl-favorite-resolved')).toBeNull();
  });
});

describe('cleanupFavoriteObserver', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    partialMock(logseq.Editor.getCurrentPage).mockResolvedValue({
      name: 'test-page',
      originalName: 'Test Page',
    });
  });

  it('removes all injected star buttons', async () => {
    const container = document.createElement('div');
    container.id = 'main-content-container';
    const title = document.createElement('h1');
    title.className = 'title';
    container.appendChild(title);
    document.body.appendChild(container);

    setupFavoriteObserver();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(title.querySelector('.pl-favorite-star')).not.toBeNull();

    cleanupFavoriteObserver();

    expect(title.querySelector('.pl-favorite-star')).toBeNull();
  });

  it('removes all data-pl-favorite-resolved markers', async () => {
    const container = document.createElement('div');
    container.id = 'main-content-container';
    const title = document.createElement('h1');
    title.className = 'title';
    container.appendChild(title);
    document.body.appendChild(container);

    setupFavoriteObserver();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(title.getAttribute('data-pl-favorite-resolved')).toBe('true');

    cleanupFavoriteObserver();

    expect(title.getAttribute('data-pl-favorite-resolved')).toBeNull();
  });

  it('disconnects mutation observer', async () => {
    const container = document.createElement('div');
    container.id = 'main-content-container';
    document.body.appendChild(container);

    setupFavoriteObserver();
    await new Promise(resolve => setTimeout(resolve, 0));

    cleanupFavoriteObserver();

    // Add title after cleanup - should not inject button
    const title = document.createElement('h1');
    title.className = 'title';
    container.appendChild(title);

    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });

    expect(title.querySelector('.pl-favorite-star')).toBeNull();
  });

  it('cancels pending requestAnimationFrame', async () => {
    const container = document.createElement('div');
    container.id = 'main-content-container';
    document.body.appendChild(container);

    setupFavoriteObserver();

    // Add title but cleanup before RAF processes
    const title = document.createElement('h1');
    title.className = 'title';
    container.appendChild(title);

    cleanupFavoriteObserver();

    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });

    expect(title.querySelector('.pl-favorite-star')).toBeNull();
  });

  it('unsubscribes from route changes', () => {
    const unsubscribe = vi.fn();
    vi.mocked(logseq.App.onRouteChanged).mockReturnValue(unsubscribe);

    setupFavoriteObserver();
    cleanupFavoriteObserver();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('can be called multiple times safely', () => {
    setupFavoriteObserver();
    cleanupFavoriteObserver();
    cleanupFavoriteObserver();
    cleanupFavoriteObserver();

    expect(() => cleanupFavoriteObserver()).not.toThrow();
  });

  it('can be called without prior setup', () => {
    expect(() => cleanupFavoriteObserver()).not.toThrow();
  });
});
