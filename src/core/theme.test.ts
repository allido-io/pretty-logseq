/**
 * Tests for Theme Color Management
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectAccentWhenReady, generateThemeCSS, setupThemeObserver } from './theme';
import { setVersionForTest } from './version';

describe('Theme Color Management', () => {
  beforeEach(() => {
    // Clear document body
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any elements
    document.body.innerHTML = '';
  });

  describe('getCSSVariableColor', () => {
    it('extracts color from CSS variable', () => {
      // Setup: mock getComputedStyle to return a color
      const mockComputedStyle = {
        color: 'rgb(139, 92, 246)',
      };
      vi.spyOn(window, 'getComputedStyle').mockReturnValue(
        mockComputedStyle as CSSStyleDeclaration,
      );

      const css = generateThemeCSS();

      expect(css).toContain('--pl-accent: rgb(139, 92, 246)');
    });

    it('cleans up temporary element', () => {
      const initialChildren = document.body.children.length;

      generateThemeCSS();

      // Should not leave any elements behind
      expect(document.body.children.length).toBe(initialChildren);
    });
  });

  describe('getAccentColor', () => {
    it('returns first valid accent color from CSS variables', () => {
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        color: 'rgb(59, 130, 246)',
      } as CSSStyleDeclaration);

      const css = generateThemeCSS();

      expect(css).toContain('rgb(59, 130, 246)');
    });

    it('skips black color (rgb(0, 0, 0))', () => {
      let callCount = 0;
      vi.spyOn(window, 'getComputedStyle').mockImplementation(() => {
        callCount++;
        // First few calls return black, last call returns valid color
        if (callCount <= 4) {
          return { color: 'rgb(0, 0, 0)' } as CSSStyleDeclaration;
        }
        return { color: 'rgb(139, 92, 246)' } as CSSStyleDeclaration;
      });

      const css = generateThemeCSS();

      // Should use the purple color, not black
      expect(css).toContain('rgb(139, 92, 246)');
    });

    it('skips gray colors (same RGB values)', () => {
      let callCount = 0;
      vi.spyOn(window, 'getComputedStyle').mockImplementation(() => {
        callCount++;
        if (callCount <= 4) {
          // Gray color: all values same
          return { color: 'rgb(128, 128, 128)' } as CSSStyleDeclaration;
        }
        return { color: 'rgb(139, 92, 246)' } as CSSStyleDeclaration;
      });

      const css = generateThemeCSS();

      expect(css).toContain('rgb(139, 92, 246)');
    });

    it('falls back to link element color when CSS variables fail', () => {
      // Create a link element
      const link = document.createElement('a');
      link.className = 'page-ref';
      document.body.appendChild(link);

      vi.spyOn(window, 'getComputedStyle').mockImplementation(element => {
        // CSS variable calls return black
        if (element.tagName === 'SPAN') {
          return { color: 'rgb(0, 0, 0)' } as CSSStyleDeclaration;
        }
        // Link element returns accent color
        return { color: 'rgb(59, 130, 246)' } as CSSStyleDeclaration;
      });

      const css = generateThemeCSS();

      expect(css).toContain('rgb(59, 130, 246)');
    });

    it('uses default purple when no valid accent found', () => {
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        color: 'rgb(0, 0, 0)',
      } as CSSStyleDeclaration);

      const css = generateThemeCSS();

      // Default purple
      expect(css).toContain('rgb(139, 92, 246)');
    });
  });

  describe('v2 data-color accent', () => {
    afterEach(() => {
      setVersionForTest(null);
      document.documentElement.removeAttribute('data-color');
    });

    it('uses the mapped color from html[data-color] before probing (v2)', () => {
      setVersionForTest('v2');
      document.documentElement.setAttribute('data-color', 'green');
      // Probe would otherwise return purple; the attribute must win.
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        color: 'rgb(139, 92, 246)',
      } as CSSStyleDeclaration);

      const css = generateThemeCSS();

      expect(css).toContain('--pl-accent: rgb(48, 164, 108)');
    });

    it('falls through to probing for an unmapped data-color value (v2)', () => {
      setVersionForTest('v2');
      document.documentElement.setAttribute('data-color', 'chartreuse-not-a-radix-name');
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        color: 'rgb(34, 197, 94)',
      } as CSSStyleDeclaration);

      const css = generateThemeCSS();

      expect(css).toContain('--pl-accent: rgb(34, 197, 94)');
    });

    it('ignores data-color on v1 (no accentAttr)', () => {
      setVersionForTest('v1');
      document.documentElement.setAttribute('data-color', 'green');
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        color: 'rgb(34, 197, 94)',
      } as CSSStyleDeclaration);

      const css = generateThemeCSS();

      // v1 has no accentAttr, so the attribute is not consulted.
      expect(css).toContain('--pl-accent: rgb(34, 197, 94)');
    });
  });

  describe('parseRGB', () => {
    it('parses valid RGB color string', () => {
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        color: 'rgb(255, 128, 64)',
      } as CSSStyleDeclaration);

      const css = generateThemeCSS();

      // Should use parsed values in RGBA
      expect(css).toContain('rgba(255, 128, 64, 0.1)');
    });

    it('handles RGB with spaces after commas', () => {
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        color: 'rgb(100, 200, 50)',
      } as CSSStyleDeclaration);

      const css = generateThemeCSS();

      expect(css).toContain('rgba(100, 200, 50, 0.1)');
    });
  });

  describe('rgba', () => {
    it('generates RGBA color with alpha', () => {
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        color: 'rgb(139, 92, 246)',
      } as CSSStyleDeclaration);

      const css = generateThemeCSS();

      // Check various alpha values
      expect(css).toContain('rgba(139, 92, 246, 0.1)'); // subtle
      expect(css).toContain('rgba(139, 92, 246, 0.15)'); // light
      expect(css).toContain('rgba(139, 92, 246, 0.25)'); // medium
      expect(css).toContain('rgba(139, 92, 246, 0.35)'); // strong
      expect(css).toContain('rgba(139, 92, 246, 0.4)'); // border
      expect(css).toContain('rgba(139, 92, 246, 0.6)'); // border-strong
    });
  });

  describe('generateThemeCSS', () => {
    it('returns CSS with theme variables', () => {
      const css = generateThemeCSS();

      expect(css).toContain(':root {');
      expect(css).toContain('--pl-accent:');
      expect(css).toContain('--pl-accent-text:');
      expect(css).toContain('--pl-accent-subtle:');
      expect(css).toContain('--pl-accent-light:');
      expect(css).toContain('--pl-accent-medium:');
      expect(css).toContain('--pl-accent-strong:');
      expect(css).toContain('--pl-accent-border:');
      expect(css).toContain('--pl-accent-border-strong:');
    });

    it('includes header comment', () => {
      const css = generateThemeCSS();

      expect(css).toContain('Pretty Logseq Theme Colors');
      expect(css).toContain('auto-detected');
    });

    it('uses detected accent color', () => {
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        color: 'rgb(34, 197, 94)',
      } as CSSStyleDeclaration);

      const css = generateThemeCSS();

      expect(css).toContain('--pl-accent: rgb(34, 197, 94)');
      expect(css).toContain('rgba(34, 197, 94, 0.1)');
    });

    it('generates valid CSS', () => {
      const css = generateThemeCSS();

      // Should be valid CSS
      expect(css).toMatch(/:root\s*\{[\s\S]*\}/);
    });
  });

  describe('setupThemeObserver', () => {
    it('creates MutationObserver', () => {
      const callback = vi.fn();
      const observeSpy = vi.spyOn(MutationObserver.prototype, 'observe');

      setupThemeObserver(callback);

      expect(observeSpy).toHaveBeenCalled();
    });

    it('observes documentElement and body', () => {
      const callback = vi.fn();
      const observeSpy = vi.spyOn(MutationObserver.prototype, 'observe');

      setupThemeObserver(callback);

      expect(observeSpy).toHaveBeenCalledWith(document.documentElement, { attributes: true });
      expect(observeSpy).toHaveBeenCalledWith(document.body, { attributes: true });
    });

    it('calls callback when class attribute changes', async () => {
      const callback = vi.fn();

      setupThemeObserver(callback);

      // Trigger class change
      document.documentElement.className = 'dark-theme';

      // Wait for observer to fire and debounce
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(callback).toHaveBeenCalled();
    });

    it('debounces callback calls', async () => {
      const callback = vi.fn();

      setupThemeObserver(callback);

      // Trigger multiple rapid class changes
      document.documentElement.className = 'theme-1';
      document.documentElement.className = 'theme-2';
      document.documentElement.className = 'theme-3';

      // Wait for observer and debounce (100ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should have called callback (debounce consolidates multiple changes)
      expect(callback).toHaveBeenCalled();
    });

    it('coalesces a burst of attribute mutations and theme hooks into one refresh', async () => {
      const callback = vi.fn();
      vi.useFakeTimers();

      setupThemeObserver(callback);
      const onThemeChanged = logseq.App.onThemeChanged as unknown as ReturnType<typeof vi.fn>;
      const onThemeModeChanged = logseq.App.onThemeModeChanged as unknown as ReturnType<
        typeof vi.fn
      >;
      const themeHook = onThemeChanged.mock.calls[0][0] as () => void;
      const modeHook = onThemeModeChanged.mock.calls[0][0] as () => void;

      // A real theme switch flips html + body classes and fires both Logseq
      // hooks within a few ms of each other.
      document.documentElement.className = 'dark';
      await vi.advanceTimersByTimeAsync(20);
      document.body.className = 'dark-theme';
      await vi.advanceTimersByTimeAsync(20);
      themeHook();
      modeHook();
      await vi.advanceTimersByTimeAsync(20);

      // Still inside the quiet window: nothing yet.
      expect(callback).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(200);
      expect(callback).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('does not call callback for non-class attribute changes', async () => {
      const callback = vi.fn();
      vi.useFakeTimers();

      setupThemeObserver(callback);

      // Change non-class attribute
      document.documentElement.setAttribute('data-test', 'value');

      vi.advanceTimersByTime(150);

      expect(callback).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('calls callback when the v2 accent attribute (data-color) changes', async () => {
      setVersionForTest('v2');
      const callback = vi.fn();

      setupThemeObserver(callback);
      document.documentElement.setAttribute('data-color', 'blue');

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(callback).toHaveBeenCalled();

      document.documentElement.removeAttribute('data-color');
      setVersionForTest(null);
    });

    it('picks up the accent attribute after a runtime version override to v2', async () => {
      // index.ts handles a logseqVersion override change without re-running
      // setupThemeObserver, so the watched attribute set must follow the active
      // platform rather than the one resolved at setup.
      setVersionForTest('v1');
      const callback = vi.fn();

      setupThemeObserver(callback);
      setVersionForTest('v2');
      document.documentElement.setAttribute('data-color', 'teal');

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(callback).toHaveBeenCalled();

      document.documentElement.removeAttribute('data-color');
      setVersionForTest(null);
    });
  });

  describe('setupThemeObserver disposer', () => {
    it('stops the observer and cancels a pending refresh', async () => {
      const callback = vi.fn();
      const dispose = setupThemeObserver(callback);

      document.documentElement.className = 'dark-theme';
      // Let the observer fire so a trailing refresh is pending, then dispose.
      await Promise.resolve();
      dispose();
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(callback).not.toHaveBeenCalled();

      document.documentElement.className = 'light-theme';
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(callback).not.toHaveBeenCalled();
    });

    it('unsubscribes the Logseq theme hooks when they return off-handles', () => {
      const offChanged = vi.fn();
      const offMode = vi.fn();
      const app = logseq.App as unknown as Record<string, unknown>;
      const prev = { c: app.onThemeChanged, m: app.onThemeModeChanged };
      app.onThemeChanged = vi.fn(() => offChanged);
      app.onThemeModeChanged = vi.fn(() => offMode);

      try {
        setupThemeObserver(vi.fn())();
      } finally {
        app.onThemeChanged = prev.c;
        app.onThemeModeChanged = prev.m;
      }

      expect(offChanged).toHaveBeenCalledTimes(1);
      expect(offMode).toHaveBeenCalledTimes(1);
    });
  });

  describe('detectAccentWhenReady', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('re-detects and refreshes once the theme accent becomes readable', () => {
      // Simulate the cold-start race: the accent var is unusable until the theme
      // stylesheet lands, then resolves to the real (rust) accent.
      let themeReady = false;
      vi.spyOn(window, 'getComputedStyle').mockImplementation(
        () => ({ color: themeReady ? 'rgb(184, 90, 48)' : 'rgb(0, 0, 0)' }) as CSSStyleDeclaration,
      );
      const onReady = vi.fn();

      detectAccentWhenReady(onReady);

      // Theme not applied yet → probe is unusable → no refresh.
      vi.advanceTimersByTime(200);
      expect(onReady).not.toHaveBeenCalled();

      // Theme applies its accent → next poll refreshes.
      themeReady = true;
      vi.advanceTimersByTime(200);
      expect(onReady).toHaveBeenCalled();
    });

    it('stops polling once the accent value settles', () => {
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        color: 'rgb(184, 90, 48)',
      } as CSSStyleDeclaration);
      const onReady = vi.fn();

      detectAccentWhenReady(onReady);
      vi.advanceTimersByTime(200 * 30);

      // First usable read + two stable confirmations, then it stops.
      expect(onReady).toHaveBeenCalledTimes(3);
    });

    it('stops polling once disposed', () => {
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        color: 'rgb(184, 90, 48)',
      } as CSSStyleDeclaration);
      const onReady = vi.fn();

      const dispose = detectAccentWhenReady(onReady);
      vi.advanceTimersByTime(200);
      expect(onReady).toHaveBeenCalledTimes(1);

      dispose();
      vi.advanceTimersByTime(200 * 30);
      expect(onReady).toHaveBeenCalledTimes(1);
    });

    it('gives up (keeps the fallback) when no accent ever resolves', () => {
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        color: 'rgb(0, 0, 0)',
      } as CSSStyleDeclaration);
      const onReady = vi.fn();

      detectAccentWhenReady(onReady);
      vi.advanceTimersByTime(200 * 30);

      expect(onReady).not.toHaveBeenCalled();
    });
  });
});
