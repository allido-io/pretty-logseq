/**
 * Characterization tests for the bootstrap's settings-change wiring.
 *
 * `src/index.ts` runs `logseq.ready(main)` on import, so each test re-imports
 * it with fresh modules, lets `main()` settle, and then drives the callback it
 * registered with `logseq.onSettingsChanged` directly. The registry and style
 * injector are mocked so the tests observe *which* lifecycle calls a settings
 * change produces, not what the features do.
 */

import { describe, expect, it, vi } from 'vitest';
import type { PluginSettings } from './settings';
import { defaultSettings } from './settings/schema';

// The real import installs a `logseq` global; tests use the mock from test/setup.
vi.mock('@logseq/libs', () => ({}));

vi.mock('./core/registry', () => ({
  registry: {
    register: vi.fn(),
    initializeAll: vi.fn(async () => {}),
    initializeFeature: vi.fn(async () => {}),
    destroyFeature: vi.fn(),
    destroyAll: vi.fn(async () => {}),
    getAggregatedStyles: vi.fn(() => ''),
  },
}));

vi.mock('./core/styles', () => ({
  injectStyles: vi.fn(),
  refreshStyles: vi.fn(),
}));

vi.mock('./core/theme', () => ({
  detectAccentWhenReady: vi.fn(),
  setupThemeObserver: vi.fn(),
}));

vi.mock('./features/topbar', async importOriginal => ({
  ...(await importOriginal<typeof import('./features/topbar')>()),
  applyNavArrowsSetting: vi.fn(),
}));

type RawSettings = Partial<PluginSettings> & { disabled?: boolean };
type ChangeHandler = (next: RawSettings, prev: RawSettings) => void;

/** Let queued settings work (promise chain + awaited inits) run to completion. */
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/**
 * Import a fresh `src/index.ts`, wait for `main()` to register its settings
 * handler, and hand back that handler plus the mocked collaborators it drives.
 */
async function boot(settings: Partial<PluginSettings> = {}) {
  vi.resetModules();
  logseq.settings = { disabled: false, ...settings } as typeof logseq.settings;

  await import('./index');
  const { registry } = await import('./core/registry');
  const { refreshStyles } = await import('./core/styles');
  const { applyNavArrowsSetting } = await import('./features/topbar');
  const { getVersion } = await import('./core/version');

  await vi.waitFor(() => expect(logseq.onSettingsChanged).toHaveBeenCalledTimes(1));
  const handler = vi.mocked(logseq.onSettingsChanged).mock.calls[0][0] as ChangeHandler;
  // Logseq updates `logseq.settings` before firing the callback; mirror that.
  // Changes are applied asynchronously (serialized), so wait for them to land.
  const change = async (next: RawSettings, prev: RawSettings): Promise<void> => {
    logseq.settings = { ...logseq.settings, ...next } as typeof logseq.settings;
    handler(next, prev);
    await flush();
  };

  // Startup itself calls these; clear so each test sees only what its change caused.
  vi.mocked(registry.initializeAll).mockClear();
  vi.mocked(registry.initializeFeature).mockClear();
  vi.mocked(registry.destroyFeature).mockClear();
  vi.mocked(registry.destroyAll).mockClear();
  vi.mocked(refreshStyles).mockClear();
  vi.mocked(applyNavArrowsSetting).mockClear();

  return { change, registry, refreshStyles, applyNavArrowsSetting, getVersion };
}

describe('bootstrap', () => {
  it('registers the schema, injects styles, initializes every feature, and wires unload', async () => {
    vi.resetModules();
    logseq.settings = { disabled: false } as typeof logseq.settings;

    await import('./index');
    const { registry } = await import('./core/registry');
    const { injectStyles } = await import('./core/styles');

    await vi.waitFor(() => expect(logseq.onSettingsChanged).toHaveBeenCalledTimes(1));

    // Once before detection (no status row), once after with the detected version.
    expect(logseq.useSettingsSchema).toHaveBeenCalledTimes(2);
    const schemas = vi.mocked(logseq.useSettingsSchema).mock.calls.map(c => c[0]);
    expect(schemas[0].some(item => item.key === 'detectedVersionStatus')).toBe(false);
    expect(schemas[1].some(item => item.key === 'detectedVersionStatus')).toBe(true);

    expect(registry.register).toHaveBeenCalledTimes(12);
    expect(injectStyles).toHaveBeenCalledTimes(1);
    expect(registry.initializeAll).toHaveBeenCalledTimes(1);
    expect(logseq.beforeunload).toHaveBeenCalledTimes(1);
  });

  it('destroys every feature on unload', async () => {
    vi.resetModules();
    logseq.settings = { disabled: false } as typeof logseq.settings;

    await import('./index');
    const { registry } = await import('./core/registry');
    await vi.waitFor(() => expect(logseq.beforeunload).toHaveBeenCalledTimes(1));

    const onUnload = vi.mocked(logseq.beforeunload).mock.calls[0][0] as () => Promise<void>;
    vi.mocked(registry.destroyAll).mockClear();
    await onUnload();

    expect(registry.destroyAll).toHaveBeenCalledTimes(1);
  });
});

describe('settings-change dispatch', () => {
  it('does nothing when no setting changed', async () => {
    const { change, registry, refreshStyles } = await boot();

    await change({ enablePopovers: true }, { enablePopovers: true });

    expect(registry.initializeFeature).not.toHaveBeenCalled();
    expect(registry.destroyFeature).not.toHaveBeenCalled();
    expect(refreshStyles).not.toHaveBeenCalled();
  });

  describe('toggle bindings', () => {
    it('initializes the feature when its toggle turns on', async () => {
      const { change, registry, refreshStyles } = await boot();

      await change({ enablePopovers: true }, { enablePopovers: false });

      expect(registry.initializeFeature).toHaveBeenCalledWith('popovers');
      expect(registry.destroyFeature).not.toHaveBeenCalled();
      expect(refreshStyles).toHaveBeenCalledTimes(1);
    });

    it('destroys the feature when its toggle turns off', async () => {
      const { change, registry, refreshStyles } = await boot();

      await change({ enablePrettyLinks: false }, { enablePrettyLinks: true });

      expect(registry.destroyFeature).toHaveBeenCalledWith('links');
      expect(registry.initializeFeature).not.toHaveBeenCalled();
      expect(refreshStyles).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['enablePopovers', 'popovers'],
      ['enablePrettyLinks', 'links'],
      ['enablePrettyTodos', 'todos'],
      ['enablePrettyTypography', 'typography'],
    ] as const)('%s toggles the %s feature', async (key, featureId) => {
      const { change, registry } = await boot();

      await change({ [key]: false }, { [key]: true });
      expect(registry.destroyFeature).toHaveBeenCalledWith(featureId);

      await change({ [key]: true }, { [key]: false });
      expect(registry.initializeFeature).toHaveBeenCalledWith(featureId);
    });
  });

  describe('reinit bindings', () => {
    it('destroys then re-initializes properties when a sub-setting changes and it is enabled', async () => {
      const { change, registry, refreshStyles } = await boot();

      await change(
        { enablePrettyProperties: true, showPropertyIcons: false },
        { enablePrettyProperties: true, showPropertyIcons: true },
      );

      expect(registry.destroyFeature).toHaveBeenCalledWith('properties');
      expect(registry.initializeFeature).toHaveBeenCalledWith('properties');
      expect(vi.mocked(registry.destroyFeature).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(registry.initializeFeature).mock.invocationCallOrder[0],
      );
      expect(refreshStyles).toHaveBeenCalledTimes(1);
    });

    it('only destroys properties when the gate setting turns off', async () => {
      const { change, registry } = await boot();

      await change({ enablePrettyProperties: false }, { enablePrettyProperties: true });

      expect(registry.destroyFeature).toHaveBeenCalledWith('properties');
      expect(registry.initializeFeature).not.toHaveBeenCalled();
    });

    it('rebuilds content when the favorite star toggles', async () => {
      const { change, registry } = await boot();

      await change({ enableFavoriteStar: false }, { enableFavoriteStar: true });

      expect(registry.destroyFeature).toHaveBeenCalledWith('content');
      expect(registry.initializeFeature).toHaveBeenCalledWith('content');
    });

    it('always rebuilds sidebar-tags, including when set to off', async () => {
      const { change, registry } = await boot();

      await change({ sidebarPageTags: 'off' }, { sidebarPageTags: 'subtle' });

      expect(registry.destroyFeature).toHaveBeenCalledWith('sidebar-tags');
      expect(registry.initializeFeature).toHaveBeenCalledWith('sidebar-tags');
    });
  });

  describe('restyle bindings', () => {
    it('only refreshes styles for a style-only setting', async () => {
      const { change, registry, refreshStyles } = await boot();

      await change({ topbarGradient: false }, { topbarGradient: true });

      expect(refreshStyles).toHaveBeenCalledTimes(1);
      expect(registry.initializeFeature).not.toHaveBeenCalled();
      expect(registry.destroyFeature).not.toHaveBeenCalled();
    });

    it('does not rebuild content when bullet threading toggles (style-only)', async () => {
      const { change, registry, refreshStyles } = await boot();

      await change({ enableBulletThreading: false }, { enableBulletThreading: true });

      expect(refreshStyles).toHaveBeenCalledTimes(1);
      expect(registry.initializeFeature).not.toHaveBeenCalled();
      expect(registry.destroyFeature).not.toHaveBeenCalled();
    });

    it('refreshes styles once when several style-only settings change together', async () => {
      const { change, refreshStyles } = await boot();

      await change(
        { topbarGradient: false, hideHomeButton: false, compactSidebarNav: false },
        { topbarGradient: true, hideHomeButton: true, compactSidebarNav: true },
      );

      expect(refreshStyles).toHaveBeenCalledTimes(1);
    });

    it('repositions the nav arrows and refreshes styles when navArrowsLeft changes', async () => {
      const { change, registry, refreshStyles, applyNavArrowsSetting } = await boot();

      await change({ navArrowsLeft: false }, { navArrowsLeft: true });

      expect(applyNavArrowsSetting).toHaveBeenCalledTimes(1);
      expect(refreshStyles).toHaveBeenCalledTimes(1);
      expect(registry.initializeFeature).not.toHaveBeenCalled();
      expect(registry.destroyFeature).not.toHaveBeenCalled();
    });
  });

  describe('serialization', () => {
    it('applies a change that arrives mid-init only after the pending init resolves', async () => {
      const { change, registry } = await boot();
      let resolveInit: () => void = () => {};
      vi.mocked(registry.initializeFeature).mockImplementationOnce(
        () => new Promise<void>(resolve => (resolveInit = resolve)),
      );

      // Turn popovers on (init pending), then off while it's still pending.
      const on = change({ enablePopovers: true }, { enablePopovers: false });
      const off = change({ enablePopovers: false }, { enablePopovers: true });
      await flush();

      expect(registry.initializeFeature).toHaveBeenCalledWith('popovers');
      expect(registry.destroyFeature).not.toHaveBeenCalled();

      resolveInit();
      await Promise.all([on, off]);
      await flush();

      expect(registry.destroyFeature).toHaveBeenCalledWith('popovers');
      expect(vi.mocked(registry.initializeFeature).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(registry.destroyFeature).mock.invocationCallOrder[0],
      );
    });

    it('keeps applying later changes after one fails', async () => {
      const { change, registry, refreshStyles } = await boot();
      vi.mocked(registry.initializeFeature).mockRejectedValueOnce(new Error('init exploded'));

      await change({ enablePopovers: true }, { enablePopovers: false });
      await change({ topbarGradient: false }, { topbarGradient: true });

      expect(console.error).toHaveBeenCalledWith(
        '[Pretty Logseq] Failed to apply settings change:',
        expect.any(Error),
      );
      expect(refreshStyles).toHaveBeenCalledTimes(1);
    });
  });

  it('every setting key is bound: changing it refreshes styles', async () => {
    const { change, refreshStyles } = await boot();
    const keys = (Object.keys(defaultSettings) as (keyof PluginSettings)[]).filter(
      k => k !== 'logseqVersion',
    );

    for (const key of keys) {
      vi.mocked(refreshStyles).mockClear();
      const current = defaultSettings[key];
      const flipped = typeof current === 'boolean' ? !current : 'off';

      await change({ [key]: flipped }, { [key]: current });

      expect(refreshStyles, `setting "${key}" has no binding`).toHaveBeenCalled();
    }
  });

  describe('version override', () => {
    it('tears everything down, re-detects, re-registers the schema, and re-initializes', async () => {
      const { change, registry, refreshStyles, getVersion } = await boot();
      vi.mocked(logseq.useSettingsSchema).mockClear();

      await change({ logseqVersion: 'v2' }, { logseqVersion: 'auto' });
      await vi.waitFor(() => expect(registry.initializeAll).toHaveBeenCalledTimes(1));

      expect(registry.destroyAll).toHaveBeenCalledTimes(1);
      expect(vi.mocked(registry.destroyAll).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(registry.initializeAll).mock.invocationCallOrder[0],
      );
      expect(getVersion()).toBe('v2');
      expect(logseq.useSettingsSchema).toHaveBeenCalledTimes(1);
      const schema = vi.mocked(logseq.useSettingsSchema).mock.calls[0][0];
      expect(schema.find(item => item.key === 'detectedVersionStatus')?.description).toContain(
        'Manually set',
      );
      expect(refreshStyles).toHaveBeenCalledTimes(1);
    });

    it('does not run per-feature bindings for keys changed alongside the version', async () => {
      const { change, registry } = await boot();

      await change(
        { logseqVersion: 'v1', enablePopovers: false },
        { logseqVersion: 'auto', enablePopovers: true },
      );
      await vi.waitFor(() => expect(registry.initializeAll).toHaveBeenCalledTimes(1));

      expect(registry.destroyFeature).not.toHaveBeenCalled();
      expect(registry.initializeFeature).not.toHaveBeenCalled();
    });
  });
});
