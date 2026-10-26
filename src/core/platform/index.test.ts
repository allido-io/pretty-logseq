import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setVersionForTest } from '../version';
import { getPlatform, pickStyles, setPlatformForTest } from './index';
import type { Platform } from './types';

describe('getPlatform', () => {
  beforeEach(() => {
    setVersionForTest(null);
    setPlatformForTest(null);
  });

  afterEach(() => {
    setVersionForTest(null);
    setPlatformForTest(null);
  });

  it('defaults to the v1 platform before detection', () => {
    expect(getPlatform().version).toBe('v1');
    expect(getPlatform().selectors.observerRoot).toBe('#main-content-container');
  });

  it('selects the v2 platform when the detected version is v2', () => {
    setVersionForTest('v2');
    expect(getPlatform().version).toBe('v2');
  });

  it('overrides the v2 page-title and property-key selectors while inheriting the rest from v1', () => {
    setVersionForTest('v2');
    const v2 = getPlatform();
    setVersionForTest('v1');
    const v1 = getPlatform();

    // v2 rebuilt the page-properties DOM, so its property-key selector differs.
    expect(v2.selectors.propertyKey).toBe('.ls-page-properties .property-k');
    expect(v2.selectors.propertyKey).not.toBe(v1.selectors.propertyKey);

    // v2 renders the page title as an editable block, not an `<h1>`.
    expect(v2.selectors.pageTitle).toBe('.ls-page-title');
    expect(v2.selectors.pageTitle).not.toBe(v1.selectors.pageTitle);

    // Selectors other than the page-title and property key still inherit v1.
    const { propertyKey: _v2Key, pageTitle: _v2Title, ...v2Rest } = v2.selectors;
    const { propertyKey: _v1Key, pageTitle: _v1Title, ...v1Rest } = v1.selectors;
    expect(v2Rest).toEqual(v1Rest);

    // Theme inherits v1's probe inputs but adds v2's `data-color` accent source.
    expect(v2.theme.accentVars).toEqual(v1.theme.accentVars);
    expect(v2.theme.accentFallbackSelector).toBe(v1.theme.accentFallbackSelector);
    expect(v2.theme.accentAttr).toBe('data-color');
    expect(v2.theme.accentColorMap?.violet).toBe('rgb(110, 86, 207)');
    expect(v1.theme.accentAttr).toBeUndefined();
  });

  it('routes v2 page/property reads through the v2 data adapter', () => {
    setVersionForTest('v2');
    const v2 = getPlatform();
    setVersionForTest('v1');
    const v1 = getPlatform();

    // Data access diverges — v2 normalizes the DB model to the shared shape.
    expect(v2.api.getPageData).not.toBe(v1.api.getPageData);
    expect(v2.api.getPageBlocks).not.toBe(v1.api.getPageBlocks);

    // Favorites diverge in both directions: v2 reads DB entities (not name
    // strings) and writes via the toggle command (not the graph config).
    expect(v2.api.getFavorites).not.toBe(v1.api.getFavorites);
    expect(v2.api.toggleFavorite).not.toBe(v1.api.toggleFavorite);
  });

  it('honors a test override regardless of version', () => {
    const fake = { version: 'v2', selectors: { observerRoot: '#fake' } } as unknown as Platform;
    setPlatformForTest(fake);
    expect(getPlatform()).toBe(fake);
  });
});

describe('pickStyles', () => {
  beforeEach(() => {
    setVersionForTest(null);
  });

  afterEach(() => {
    setVersionForTest(null);
  });

  it('returns v1 styles on v1', () => {
    setVersionForTest('v1');
    expect(pickStyles({ v1: 'V1', v2: 'V2' })).toBe('V1');
  });

  it('returns v2 styles on v2 when provided', () => {
    setVersionForTest('v2');
    expect(pickStyles({ v1: 'V1', v2: 'V2' })).toBe('V2');
  });

  it('falls back to v1 on v2 when v2 is empty/omitted', () => {
    setVersionForTest('v2');
    expect(pickStyles({ v1: 'V1', v2: '' })).toBe('V1');
    expect(pickStyles({ v1: 'V1' })).toBe('V1');
  });
});
