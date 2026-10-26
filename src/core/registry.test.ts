/**
 * Tests for Feature Registry
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Feature } from '../types';
import { FeatureRegistry } from './registry';

describe('FeatureRegistry', () => {
  let testRegistry: FeatureRegistry;
  let mockFeature: Feature;

  beforeEach(() => {
    testRegistry = new FeatureRegistry();
    mockFeature = {
      id: 'test-feature',
      name: 'Test Feature',
      description: 'A test feature',
      getStyles: vi.fn(() => '.test { color: red; }'),
      init: vi.fn(),
      destroy: vi.fn(),
    };
  });

  describe('register', () => {
    it('registers a new feature', () => {
      testRegistry.register(mockFeature);

      expect(testRegistry.get('test-feature')).toBe(mockFeature);
    });

    it('warns when registering duplicate feature', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      testRegistry.register(mockFeature);
      testRegistry.register(mockFeature);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Pretty Logseq] Feature "test-feature" already registered',
      );

      consoleSpy.mockRestore();
    });

    it('does not overwrite existing feature on duplicate registration', () => {
      const firstFeature = { ...mockFeature };
      const secondFeature = {
        ...mockFeature,
        name: 'Different Name',
      };

      testRegistry.register(firstFeature);
      testRegistry.register(secondFeature);

      expect(testRegistry.get('test-feature')).toBe(firstFeature);
    });

    it('registers multiple features', () => {
      const feature2 = { ...mockFeature, id: 'feature-2' };
      const feature3 = { ...mockFeature, id: 'feature-3' };

      testRegistry.register(mockFeature);
      testRegistry.register(feature2);
      testRegistry.register(feature3);

      expect(testRegistry.getAll()).toHaveLength(3);
    });
  });

  describe('get', () => {
    it('returns registered feature by ID', () => {
      testRegistry.register(mockFeature);

      expect(testRegistry.get('test-feature')).toBe(mockFeature);
    });

    it('returns undefined for non-existent feature', () => {
      expect(testRegistry.get('non-existent')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('returns empty array when no features registered', () => {
      expect(testRegistry.getAll()).toEqual([]);
    });

    it('returns all registered features', () => {
      const feature2 = { ...mockFeature, id: 'feature-2' };
      const feature3 = { ...mockFeature, id: 'feature-3' };

      testRegistry.register(mockFeature);
      testRegistry.register(feature2);
      testRegistry.register(feature3);

      const all = testRegistry.getAll();

      expect(all).toHaveLength(3);
      expect(all).toContain(mockFeature);
      expect(all).toContain(feature2);
      expect(all).toContain(feature3);
    });
  });

  describe('initializeAll', () => {
    it('initializes all registered features', async () => {
      const feature2 = {
        ...mockFeature,
        id: 'feature-2',
        init: vi.fn(),
      };

      testRegistry.register(mockFeature);
      testRegistry.register(feature2);

      await testRegistry.initializeAll();

      expect(mockFeature.init).toHaveBeenCalled();
      expect(feature2.init).toHaveBeenCalled();
    });

    it('marks features as initialized', async () => {
      testRegistry.register(mockFeature);

      expect(testRegistry.isInitialized('test-feature')).toBe(false);

      await testRegistry.initializeAll();

      expect(testRegistry.isInitialized('test-feature')).toBe(true);
    });

    it('does not re-initialize already initialized features', async () => {
      testRegistry.register(mockFeature);

      await testRegistry.initializeAll();
      await testRegistry.initializeAll();

      expect(mockFeature.init).toHaveBeenCalledTimes(1);
    });

    it('continues initialization on feature error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failingFeature: Feature = {
        id: 'failing-feature',
        name: 'Failing Feature',
        description: 'A feature that fails',
        getStyles: () => '',
        init: vi.fn(() => Promise.reject(new Error('Init failed'))),
        destroy: vi.fn(),
      };

      testRegistry.register(failingFeature);
      testRegistry.register(mockFeature);

      await testRegistry.initializeAll();

      expect(failingFeature.init).toHaveBeenCalled();
      expect(mockFeature.init).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Pretty Logseq] Failed to initialize feature "failing-feature":',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('handles synchronous init methods', async () => {
      const syncFeature: Feature = {
        ...mockFeature,
        init: vi.fn(), // Synchronous (returns undefined)
      };

      testRegistry.register(syncFeature);

      await testRegistry.initializeAll();

      expect(syncFeature.init).toHaveBeenCalled();
      expect(testRegistry.isInitialized('test-feature')).toBe(true);
    });

    it('logs each feature initialization', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      testRegistry.register(mockFeature);

      await testRegistry.initializeAll();

      expect(consoleSpy).toHaveBeenCalledWith('[Pretty Logseq] Feature "test-feature" initialized');

      consoleSpy.mockRestore();
    });
  });

  describe('initializeFeature', () => {
    it('initializes a single feature by ID', async () => {
      testRegistry.register(mockFeature);

      await testRegistry.initializeFeature('test-feature');

      expect(mockFeature.init).toHaveBeenCalled();
      expect(testRegistry.isInitialized('test-feature')).toBe(true);
    });

    it('warns when feature not found', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await testRegistry.initializeFeature('non-existent');

      expect(consoleSpy).toHaveBeenCalledWith('[Pretty Logseq] Feature "non-existent" not found');

      consoleSpy.mockRestore();
    });

    it('does not re-initialize if already initialized', async () => {
      testRegistry.register(mockFeature);

      await testRegistry.initializeFeature('test-feature');
      await testRegistry.initializeFeature('test-feature');

      expect(mockFeature.init).toHaveBeenCalledTimes(1);
    });

    it('logs successful initialization', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      testRegistry.register(mockFeature);
      await testRegistry.initializeFeature('test-feature');

      expect(consoleSpy).toHaveBeenCalledWith('[Pretty Logseq] Feature "test-feature" initialized');

      consoleSpy.mockRestore();
    });

    it('handles initialization errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failingFeature: Feature = {
        ...mockFeature,
        init: vi.fn(() => Promise.reject(new Error('Init error'))),
      };

      testRegistry.register(failingFeature);

      await testRegistry.initializeFeature('test-feature');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Pretty Logseq] Failed to initialize feature "test-feature":',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('destroyFeature', () => {
    it('destroys an initialized feature', async () => {
      testRegistry.register(mockFeature);
      await testRegistry.initializeFeature('test-feature');

      await testRegistry.destroyFeature('test-feature');

      expect(mockFeature.destroy).toHaveBeenCalled();
      expect(testRegistry.isInitialized('test-feature')).toBe(false);
    });

    it('does not destroy uninitialized feature', async () => {
      testRegistry.register(mockFeature);

      await testRegistry.destroyFeature('test-feature');

      expect(mockFeature.destroy).not.toHaveBeenCalled();
    });

    it('does nothing when feature not found', async () => {
      await expect(testRegistry.destroyFeature('non-existent')).resolves.toBeUndefined();
    });

    it('logs successful destruction', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      testRegistry.register(mockFeature);
      await testRegistry.initializeFeature('test-feature');

      await testRegistry.destroyFeature('test-feature');

      expect(consoleSpy).toHaveBeenCalledWith('[Pretty Logseq] Feature "test-feature" destroyed');

      consoleSpy.mockRestore();
    });

    it('handles destruction errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failingFeature: Feature = {
        ...mockFeature,
        destroy: vi.fn(() => {
          throw new Error('Destroy error');
        }),
      };

      testRegistry.register(failingFeature);
      await testRegistry.initializeFeature('test-feature');

      await testRegistry.destroyFeature('test-feature');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Pretty Logseq] Failed to destroy feature "test-feature":',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('pending init', () => {
    function deferredFeature() {
      let resolveInit!: () => void;
      const feature: Feature = {
        ...mockFeature,
        init: vi.fn(
          () =>
            new Promise<void>(resolve => {
              resolveInit = resolve;
            }),
        ),
      };
      return { feature, finishInit: () => resolveInit() };
    }

    it('destroyFeature waits for a pending init and then tears the feature down', async () => {
      const { feature, finishInit } = deferredFeature();
      testRegistry.register(feature);

      const init = testRegistry.initializeFeature('test-feature');
      const destroy = testRegistry.destroyFeature('test-feature');
      expect(feature.destroy).not.toHaveBeenCalled();

      finishInit();
      await Promise.all([init, destroy]);

      expect(feature.destroy).toHaveBeenCalledTimes(1);
      expect(testRegistry.isInitialized('test-feature')).toBe(false);
    });

    it('runs init once and records initOrder once for a double initialize', async () => {
      const { feature, finishInit } = deferredFeature();
      testRegistry.register(feature);

      const first = testRegistry.initializeFeature('test-feature');
      const second = testRegistry.initializeFeature('test-feature');
      finishInit();
      await Promise.all([first, second]);

      expect(feature.init).toHaveBeenCalledTimes(1);
      await testRegistry.destroyAll();
      expect(feature.destroy).toHaveBeenCalledTimes(1);
    });

    it('destroyAll waits for pending inits', async () => {
      const { feature, finishInit } = deferredFeature();
      testRegistry.register(feature);

      const init = testRegistry.initializeFeature('test-feature');
      const destroyAll = testRegistry.destroyAll();
      finishInit();
      await Promise.all([init, destroyAll]);

      expect(feature.destroy).toHaveBeenCalledTimes(1);
      expect(testRegistry.isInitialized('test-feature')).toBe(false);
    });

    it('allows a retry after a failed pending init', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const init = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
      testRegistry.register({ ...mockFeature, init });

      await testRegistry.initializeFeature('test-feature');
      await testRegistry.initializeFeature('test-feature');

      expect(init).toHaveBeenCalledTimes(2);
      expect(testRegistry.isInitialized('test-feature')).toBe(true);
      consoleSpy.mockRestore();
    });
  });

  describe('isInitialized', () => {
    it('returns false for uninitialized feature', () => {
      testRegistry.register(mockFeature);

      expect(testRegistry.isInitialized('test-feature')).toBe(false);
    });

    it('returns true for initialized feature', async () => {
      testRegistry.register(mockFeature);
      await testRegistry.initializeFeature('test-feature');

      expect(testRegistry.isInitialized('test-feature')).toBe(true);
    });

    it('returns false for non-existent feature', () => {
      expect(testRegistry.isInitialized('non-existent')).toBe(false);
    });

    it('returns false after feature is destroyed', async () => {
      testRegistry.register(mockFeature);
      await testRegistry.initializeFeature('test-feature');

      await testRegistry.destroyFeature('test-feature');

      expect(testRegistry.isInitialized('test-feature')).toBe(false);
    });
  });

  describe('destroyAll', () => {
    it('destroys all initialized features in reverse order', async () => {
      const feature2: Feature = {
        ...mockFeature,
        id: 'feature-2',
        destroy: vi.fn(),
      };
      const feature3: Feature = {
        ...mockFeature,
        id: 'feature-3',
        destroy: vi.fn(),
      };

      testRegistry.register(mockFeature);
      testRegistry.register(feature2);
      testRegistry.register(feature3);

      await testRegistry.initializeAll();

      const destroyOrder: string[] = [];
      mockFeature.destroy = vi.fn(() => destroyOrder.push('test-feature'));
      feature2.destroy = vi.fn(() => destroyOrder.push('feature-2'));
      feature3.destroy = vi.fn(() => destroyOrder.push('feature-3'));

      await testRegistry.destroyAll();

      expect(destroyOrder).toEqual(['feature-3', 'feature-2', 'test-feature']);
    });

    it('marks all features as not initialized', async () => {
      const feature2 = { ...mockFeature, id: 'feature-2' };

      testRegistry.register(mockFeature);
      testRegistry.register(feature2);

      await testRegistry.initializeAll();
      await testRegistry.destroyAll();

      expect(testRegistry.isInitialized('test-feature')).toBe(false);
      expect(testRegistry.isInitialized('feature-2')).toBe(false);
    });

    it('handles destruction errors and continues', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failingFeature: Feature = {
        ...mockFeature,
        id: 'failing',
        destroy: vi.fn(() => {
          throw new Error('Destroy failed');
        }),
      };
      const feature2 = { ...mockFeature, id: 'feature-2' };

      testRegistry.register(mockFeature);
      testRegistry.register(failingFeature);
      testRegistry.register(feature2);

      await testRegistry.initializeAll();
      await testRegistry.destroyAll();

      expect(mockFeature.destroy).toHaveBeenCalled();
      expect(failingFeature.destroy).toHaveBeenCalled();
      expect(feature2.destroy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Pretty Logseq] Failed to destroy feature "failing":',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('does nothing when no features are initialized', async () => {
      testRegistry.register(mockFeature);

      await testRegistry.destroyAll();

      expect(mockFeature.destroy).not.toHaveBeenCalled();
    });
  });

  describe('getAggregatedStyles', () => {
    it('returns empty string when no features registered', () => {
      expect(testRegistry.getAggregatedStyles()).toBe('');
    });

    it('aggregates styles from single feature', () => {
      testRegistry.register(mockFeature);

      const styles = testRegistry.getAggregatedStyles();

      expect(styles).toContain('/* Feature: test-feature */');
      expect(styles).toContain('.test { color: red; }');
    });

    it('aggregates styles from multiple features', () => {
      const feature2: Feature = {
        ...mockFeature,
        id: 'feature-2',
        getStyles: vi.fn(() => '.feature2 { color: blue; }'),
      };

      testRegistry.register(mockFeature);
      testRegistry.register(feature2);

      const styles = testRegistry.getAggregatedStyles();

      expect(styles).toContain('/* Feature: test-feature */');
      expect(styles).toContain('.test { color: red; }');
      expect(styles).toContain('/* Feature: feature-2 */');
      expect(styles).toContain('.feature2 { color: blue; }');
    });

    it('skips features with empty styles', () => {
      const emptyFeature: Feature = {
        ...mockFeature,
        id: 'empty',
        getStyles: () => '',
      };

      testRegistry.register(mockFeature);
      testRegistry.register(emptyFeature);

      const styles = testRegistry.getAggregatedStyles();

      expect(styles).toContain('test-feature');
      expect(styles).not.toContain('empty');
    });

    it('separates feature styles with double newlines', () => {
      const feature2: Feature = {
        ...mockFeature,
        id: 'feature-2',
        getStyles: () => '.feature2 {}',
      };

      testRegistry.register(mockFeature);
      testRegistry.register(feature2);

      const styles = testRegistry.getAggregatedStyles();

      expect(styles).toContain('\n\n');
    });

    it('includes styles regardless of initialization status', () => {
      testRegistry.register(mockFeature);

      const styles = testRegistry.getAggregatedStyles();

      expect(styles).toContain('.test { color: red; }');
    });
  });
});
