/**
 * Tests for Style Management
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { partialMock } from '../../test/mocks/logseq';
import { injectStyles, refreshStyles } from './styles';

// Mock dependencies
vi.mock('./theme', () => ({
  generateThemeCSS: vi.fn(() => '/* theme styles */'),
}));

vi.mock('./registry', () => ({
  registry: {
    getAggregatedStyles: vi.fn(() => '/* feature styles */'),
  },
}));

describe('Style Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('injectStyles', () => {
    it('calls logseq.provideStyle with aggregated styles', () => {
      injectStyles();

      expect(logseq.provideStyle).toHaveBeenCalledWith({
        key: 'pretty-logseq-styles',
        style: expect.any(String),
      });
    });

    it('includes base component styles', () => {
      injectStyles();

      const call = partialMock(logseq.provideStyle).mock.calls[0][0];
      const styles = call.style as string;

      // Should always include theme and feature styles
      expect(styles).toContain('/* theme styles */');
      expect(styles).toContain('/* feature styles */');
    });

    it('includes theme CSS', async () => {
      const { generateThemeCSS } = await import('./theme');

      injectStyles();

      expect(generateThemeCSS).toHaveBeenCalled();

      const call = partialMock(logseq.provideStyle).mock.calls[0][0];
      const styles = call.style as string;
      expect(styles).toContain('/* theme styles */');
    });

    it('includes feature styles from registry', async () => {
      const { registry } = await import('./registry');

      injectStyles();

      expect(registry.getAggregatedStyles).toHaveBeenCalled();

      const call = partialMock(logseq.provideStyle).mock.calls[0][0];
      const styles = call.style as string;
      expect(styles).toContain('/* feature styles */');
    });

    it('calls generateThemeCSS', async () => {
      const { generateThemeCSS } = await import('./theme');

      injectStyles();

      expect(generateThemeCSS).toHaveBeenCalled();
    });

    it('calls registry.getAggregatedStyles', async () => {
      const { registry } = await import('./registry');

      injectStyles();

      expect(registry.getAggregatedStyles).toHaveBeenCalled();
    });

    it('uses consistent style key', () => {
      injectStyles();

      const call = partialMock(logseq.provideStyle).mock.calls[0][0];
      expect(call.key).toBe('pretty-logseq-styles');
    });

    it('includes all style sections in output', () => {
      injectStyles();

      const call = partialMock(logseq.provideStyle).mock.calls[0][0];
      const styles = call.style as string;

      // Aggregated output includes theme CSS and feature styles
      expect(styles).toContain('/* theme styles */');
      expect(styles).toContain('/* feature styles */');
    });
  });

  describe('refreshStyles', () => {
    it('re-injects styles by calling injectStyles', () => {
      // First call
      injectStyles();
      expect(logseq.provideStyle).toHaveBeenCalledTimes(1);

      // Refresh
      refreshStyles();
      expect(logseq.provideStyle).toHaveBeenCalledTimes(2);
    });

    it('uses same style key on refresh', () => {
      injectStyles();
      const firstCall = partialMock(logseq.provideStyle).mock.calls[0][0];

      refreshStyles();
      const secondCall = partialMock(logseq.provideStyle).mock.calls[1][0];

      expect(firstCall.key).toBe(secondCall.key);
      expect(firstCall.key).toBe('pretty-logseq-styles');
    });
  });
});
