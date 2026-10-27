/**
 * Tests for Popover Manager
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPageRef } from '../../../test/utils/dom';
import * as domModule from '../../lib/dom';
import { setupPopovers } from './manager';
import * as renderersModule from './renderers';

const { getPageData, getPageBlocks } = vi.hoisted(() => ({
  getPageData: vi.fn(),
  getPageBlocks: vi.fn(),
}));

vi.mock('../../core/platform', () => ({
  getPlatform: () => ({
    api: { getPageData, getPageBlocks },
    selectors: { pageRef: '.page-ref, .tag' },
  }),
}));

describe('Popover Manager', () => {
  let cleanup: (() => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();

    // Mock API responses (via the platform)
    getPageData.mockReset().mockResolvedValue({
      name: 'Test Page',
      properties: {},
    });
    getPageBlocks.mockReset().mockResolvedValue([]);

    // Mock DOM positioning
    vi.spyOn(domModule, 'positionElement').mockImplementation(() => {});
    vi.spyOn(domModule, 'removeElementById').mockImplementation((id: string) => {
      document.getElementById(id)?.remove();
    });

    // Mock renderer
    vi.spyOn(renderersModule, 'renderPopover').mockImplementation(() => {
      const div = document.createElement('div');
      div.className = 'pretty-popover__content';
      const title = document.createElement('div');
      title.className = 'pretty-popover__title';
      title.dataset.pageName = 'Test Page';
      title.textContent = 'Test Page';
      div.appendChild(title);
      return div;
    });
  });

  afterEach(() => {
    cleanup?.();
    cleanup = null;
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('setupPopovers', () => {
    it('returns cleanup function', () => {
      cleanup = setupPopovers();

      expect(cleanup).toBeTypeOf('function');
    });

    it('sets up event listeners on document', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      cleanup = setupPopovers();

      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseenter', expect.any(Function), true);
      expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function), true);
    });

    it('removes event listeners on cleanup', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      cleanup = setupPopovers();
      cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseenter', expect.any(Function), true);
      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function), true);
    });
  });

  describe('Hover Behavior', () => {
    beforeEach(() => {
      cleanup = setupPopovers();
    });

    it('shows popover after hover delay', async () => {
      const ref = createPageRef('Test Page');
      document.body.appendChild(ref);

      ref.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

      // Before delay
      expect(document.getElementById('pretty-logseq-popover')).toBeNull();

      // Advance timers and flush promises
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      // After delay
      expect(document.getElementById('pretty-logseq-popover')).toBeTruthy();
    });

    it('cancels popover on quick hover out', async () => {
      const ref = createPageRef('Test Page');
      document.body.appendChild(ref);

      ref.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(100);
      ref.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      expect(document.getElementById('pretty-logseq-popover')).toBeNull();
    });

    it('does not show popover for non-page-ref elements', async () => {
      const div = document.createElement('div');
      document.body.appendChild(div);

      div.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      expect(document.getElementById('pretty-logseq-popover')).toBeNull();
    });

    it('fetches page data and blocks', async () => {
      const ref = createPageRef('Test Page');
      document.body.appendChild(ref);

      ref.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      expect(getPageData).toHaveBeenCalledWith('Test Page');
      expect(getPageBlocks).toHaveBeenCalledWith('Test Page');
    });

    it('uses renderer to build popover content', async () => {
      const ref = createPageRef('Test Page');
      document.body.appendChild(ref);

      ref.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      expect(renderersModule.renderPopover).toHaveBeenCalled();
    });

    it('positions popover relative to anchor', async () => {
      const ref = createPageRef('Test Page');
      document.body.appendChild(ref);

      ref.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      expect(domModule.positionElement).toHaveBeenCalledWith(expect.any(HTMLElement), ref, {
        placement: 'bottom',
        offset: 8,
      });
    });

    it('extracts page name from data-ref attribute', async () => {
      const ref = createPageRef('Page From Attribute');
      document.body.appendChild(ref);

      ref.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      expect(getPageData).toHaveBeenCalledWith('Page From Attribute');
    });

    it('falls back to textContent if no data-ref', async () => {
      const ref = document.createElement('a');
      ref.className = 'page-ref';
      ref.textContent = 'Page From Text';
      document.body.appendChild(ref);

      ref.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      expect(getPageData).toHaveBeenCalledWith('Page From Text');
    });
  });

  describe('Interactive Popover', () => {
    beforeEach(() => {
      cleanup = setupPopovers();
    });

    it('keeps popover open when hovering over it', async () => {
      const ref = createPageRef('Test Page');
      document.body.appendChild(ref);

      // Show popover
      ref.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      const popover = document.getElementById('pretty-logseq-popover');
      expect(popover).toBeTruthy();

      // Leave anchor
      ref.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

      // Enter popover before hide delay
      popover?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(150);

      // Popover should still be there
      expect(document.getElementById('pretty-logseq-popover')).toBeTruthy();
    });

    it('hides popover when leaving both anchor and popover', async () => {
      const ref = createPageRef('Test Page');
      document.body.appendChild(ref);

      // Show popover
      ref.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      const popover = document.getElementById('pretty-logseq-popover');

      // Leave anchor
      ref.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

      // Leave popover
      popover?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      vi.advanceTimersByTime(150);

      expect(document.getElementById('pretty-logseq-popover')).toBeNull();
    });

    it('navigates to page when clicking title', async () => {
      const ref = createPageRef('Test Page');
      document.body.appendChild(ref);

      // Show popover
      ref.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      const title = document.querySelector('.pretty-popover__title');
      expect(title).toBeTruthy();

      // Click title
      title?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(logseq.App.pushState).toHaveBeenCalledWith('page', { name: 'Test Page' });
      expect(document.getElementById('pretty-logseq-popover')).toBeNull();
    });
  });

  describe('Click Dismissal', () => {
    beforeEach(() => {
      cleanup = setupPopovers();
    });

    it('hides popover when clicking on page ref', async () => {
      const ref = createPageRef('Test Page');
      document.body.appendChild(ref);

      // Show popover
      ref.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      expect(document.getElementById('pretty-logseq-popover')).toBeTruthy();

      // Click ref
      ref.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(document.getElementById('pretty-logseq-popover')).toBeNull();
    });

    it('does not hide popover when clicking elsewhere', async () => {
      const ref = createPageRef('Test Page');
      const otherDiv = document.createElement('div');
      document.body.appendChild(ref);
      document.body.appendChild(otherDiv);

      // Show popover
      ref.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      // Click elsewhere
      otherDiv.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(document.getElementById('pretty-logseq-popover')).toBeTruthy();
    });
  });

  describe('Race Conditions', () => {
    beforeEach(() => {
      cleanup = setupPopovers();
    });

    it('aborts if anchor changes during fetch', async () => {
      const ref1 = createPageRef('Page 1');
      const ref2 = createPageRef('Page 2');
      document.body.appendChild(ref1);
      document.body.appendChild(ref2);

      // Hover first ref
      ref1.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);

      // Immediately hover second ref before first completes
      ref2.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);

      await vi.runAllTimersAsync();

      // Should only call for the second page
      expect(getPageData).toHaveBeenCalledWith('Page 2');
    });

    it('does not show popover if page fetch returns null', async () => {
      vi.mocked(getPageData).mockResolvedValue(null);

      const ref = createPageRef('Non Existent');
      document.body.appendChild(ref);

      ref.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      expect(document.getElementById('pretty-logseq-popover')).toBeNull();
    });

    it('cancels pending show timer when hovering same anchor with popover', async () => {
      const ref = createPageRef('Test Page');
      document.body.appendChild(ref);

      // Show popover
      ref.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      const initialCallCount = getPageData.mock.calls.length;

      // Hover same anchor again
      ref.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      // Should not fetch again
      expect(getPageData.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('Popover Ownership', () => {
    beforeEach(() => {
      cleanup = setupPopovers();
    });

    async function showFor(ref: HTMLElement) {
      ref.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await vi.advanceTimersByTimeAsync(0);
    }

    it('removes anchor A popover when B resolves to no page data', async () => {
      const refA = createPageRef('Page A');
      const refB = createPageRef('Missing');
      document.body.append(refA, refB);

      await showFor(refA);
      expect(document.getElementById('pretty-logseq-popover')).toBeTruthy();

      getPageData.mockResolvedValue(null);
      refA.dispatchEvent(new MouseEvent('mouseleave'));
      await showFor(refB);
      await vi.runAllTimersAsync();

      expect(document.getElementById('pretty-logseq-popover')).toBeNull();
    });

    it("drops A's popover as soon as the pointer moves to B, before B's data arrives", async () => {
      const refA = createPageRef('Page A');
      const refB = createPageRef('Page B');
      document.body.append(refA, refB);

      await showFor(refA);
      refA.dispatchEvent(new MouseEvent('mouseleave'));
      refB.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

      expect(document.getElementById('pretty-logseq-popover')).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('removes popover on cleanup', async () => {
      cleanup = setupPopovers();

      const ref = createPageRef('Test Page');
      document.body.appendChild(ref);

      // Show popover
      ref.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      expect(document.getElementById('pretty-logseq-popover')).toBeTruthy();

      // Cleanup
      cleanup();

      expect(document.getElementById('pretty-logseq-popover')).toBeNull();
    });

    it('clears pending timers on cleanup', async () => {
      cleanup = setupPopovers();

      const ref = createPageRef('Test Page');
      document.body.appendChild(ref);

      // Start hover
      ref.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

      // Cleanup before timer fires
      cleanup();

      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      // Should not show popover
      expect(document.getElementById('pretty-logseq-popover')).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      cleanup = setupPopovers();
    });

    it('handles page ref without page name', async () => {
      const ref = document.createElement('a');
      ref.className = 'page-ref';
      // No data-ref and no textContent
      document.body.appendChild(ref);

      ref.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      expect(getPageData).not.toHaveBeenCalled();
      expect(document.getElementById('pretty-logseq-popover')).toBeNull();
    });

    it('removes existing popover before showing new one', async () => {
      const ref1 = createPageRef('Page 1');
      const ref2 = createPageRef('Page 2');
      document.body.appendChild(ref1);
      document.body.appendChild(ref2);

      // Show first popover
      ref1.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      const popover1 = document.getElementById('pretty-logseq-popover');
      expect(popover1).toBeTruthy();

      // Show second popover
      ref2.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      // Should only have one popover
      const popovers = document.querySelectorAll('#pretty-logseq-popover');
      expect(popovers.length).toBe(1);
    });
  });
});
