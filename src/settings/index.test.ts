import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSettingsSchema,
  defaultSettings,
  getSettings,
  initSettings,
  onSettingsChanged,
} from './index';

describe('Settings Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSettings', () => {
    it('returns default settings when logseq.settings is undefined', () => {
      logseq.settings = undefined;

      const settings = getSettings();

      expect(settings).toEqual(defaultSettings);
    });

    it('returns default settings when logseq.settings is empty', () => {
      logseq.settings = { disabled: false };

      const settings = getSettings();

      expect(settings).toEqual(defaultSettings);
    });

    it('merges user settings with defaults', () => {
      logseq.settings = {
        disabled: false,
        enablePopovers: false,
        enablePrettyTypography: false,
      };

      const settings = getSettings();

      expect(settings).toEqual({
        ...defaultSettings,
        enablePopovers: false,
        enablePrettyTypography: false,
      });
    });

    it('user settings override defaults', () => {
      logseq.settings = {
        disabled: false,
        compactSidebarNav: false,
        hideCreateButton: false,
      };

      const settings = getSettings();

      expect(settings.compactSidebarNav).toBe(false);
      expect(settings.hideCreateButton).toBe(false);
      // Other defaults should remain
      expect(settings.enablePopovers).toBe(true);
      expect(settings.enablePrettyTypography).toBe(true);
    });

    it('includes all expected properties', () => {
      const settings = getSettings();

      expect(settings).toHaveProperty('enablePopovers');
      expect(settings).toHaveProperty('enablePrettyTypography');
      expect(settings).toHaveProperty('enablePrettyTables');
      expect(settings).toHaveProperty('enablePrettyTemplates');
      expect(settings).toHaveProperty('enablePrettyLinks');
      expect(settings).toHaveProperty('enablePrettyTodos');
      expect(settings).toHaveProperty('compactSidebarNav');
      expect(settings).toHaveProperty('hideCreateButton');
      expect(settings).toHaveProperty('graphSelectorBottom');
      expect(settings).toHaveProperty('hideHomeButton');
      expect(settings).toHaveProperty('hideSyncIndicator');
      expect(settings).toHaveProperty('navArrowsLeft');
    });

    it('handles partial settings objects', () => {
      logseq.settings = {
        disabled: false,
        enablePopovers: false,
      };

      const settings = getSettings();

      // Should have the override
      expect(settings.enablePopovers).toBe(false);
      // Should have all other defaults
      expect(Object.keys(settings)).toHaveLength(Object.keys(defaultSettings).length);
    });
  });

  describe('initSettings', () => {
    it('calls logseq.useSettingsSchema with schema', () => {
      initSettings();

      expect(logseq.useSettingsSchema).toHaveBeenCalledTimes(1);
      expect(logseq.useSettingsSchema).toHaveBeenCalledWith(expect.any(Array));
    });

    it('passes schema with correct structure', () => {
      initSettings();

      const schema = logseq.useSettingsSchema.mock.calls[0][0];
      expect(Array.isArray(schema)).toBe(true);
      expect(schema.length).toBeGreaterThan(0);

      // Check first setting (after heading)
      const firstSetting = schema.find(item => item.key === 'enablePopovers');
      expect(firstSetting).toBeDefined();
      expect(firstSetting?.type).toBe('boolean');
      expect(firstSetting?.default).toBe(true);
    });
  });

  describe('buildSettingsSchema', () => {
    it('places the Compatibility section first with the version picker', () => {
      const schema = buildSettingsSchema();
      expect(schema[0].key).toBe('compatibilityHeading');
      expect(schema.find(item => item.key === 'logseqVersion')?.type).toBe('enum');
    });

    it('groups toggles under "Pretty" parent-feature headings', () => {
      const schema = buildSettingsSchema();
      const headings = schema.filter(item => item.type === 'heading').map(item => item.title);

      expect(headings).toEqual(
        expect.arrayContaining([
          'Pretty Content',
          'Pretty Properties',
          'Pretty Left Sidebar',
          'Pretty Top Bar',
        ]),
      );
    });

    it('uses consistent Pretty naming for feature toggles', () => {
      const schema = buildSettingsSchema();
      const popovers = schema.find(item => item.key === 'enablePopovers');

      expect(popovers?.title).toBe('Pretty Popovers');
      expect(popovers?.type).toBe('boolean');
    });

    it('includes every toggle when no version is provided', () => {
      const schema = buildSettingsSchema();
      const keys = ['showPropertyIcons', 'compactSidebarNav', 'styleTopbarIcons', 'navArrowsLeft'];

      for (const key of keys) {
        expect(schema.some(item => item.key === key)).toBe(true);
      }
    });

    it('hides v1-only toggles when the active version is v2', () => {
      const schema = buildSettingsSchema({ active: 'v2', source: 'auto' });
      const keys = schema.map(item => item.key);

      expect(keys).not.toContain('hideCreateButton');
      expect(keys).not.toContain('hideSyncIndicator');
      // Version-agnostic toggles remain.
      expect(keys).toContain('compactSidebarNav');
      expect(keys).toContain('hideHomeButton');
      // v2-only toggles appear.
      expect(keys).toContain('enablePrettyTags');
    });

    it('keeps v1-only toggles when the active version is v1', () => {
      const schema = buildSettingsSchema({ active: 'v1', source: 'auto' });
      const keys = schema.map(item => item.key);

      expect(keys).toContain('hideCreateButton');
      expect(keys).toContain('hideSyncIndicator');
      // v2-only toggles are hidden.
      expect(keys).not.toContain('enablePrettyTags');
    });

    it('emits sidebarPageTags as a v2-only enum with its choices', () => {
      // Hidden on v1 (the file app has no sidebar tag suffix)…
      expect(
        buildSettingsSchema({ active: 'v1', source: 'auto' }).some(
          i => i.key === 'sidebarPageTags',
        ),
      ).toBe(false);
      // …and rendered as an enum select on v2.
      const item = buildSettingsSchema({ active: 'v2', source: 'auto' }).find(
        i => i.key === 'sidebarPageTags',
      );
      expect(item?.type).toBe('enum');
      expect(item?.enumChoices).toEqual(['off', 'hide', 'subtle']);
      expect(item?.default).toBe('subtle');
    });

    it('includes a status row only when version info is provided', () => {
      expect(buildSettingsSchema().some(item => item.key === 'detectedVersionStatus')).toBe(false);

      const withVersion = buildSettingsSchema({ active: 'v2', source: 'auto' });
      const status = withVersion.find(item => item.key === 'detectedVersionStatus');
      expect(status?.title).toContain('Logseq DB (v2)');
      expect(status?.description).toContain('Auto-detected');
    });

    it('describes a manual override in the status row', () => {
      const status = buildSettingsSchema({ active: 'v1', source: 'manual' }).find(
        item => item.key === 'detectedVersionStatus',
      );
      expect(status?.title).toContain('Logseq file (v1)');
      expect(status?.description).toContain('Manually set');
    });

    it('lists every PluginSettings key exactly once (and nothing else) when unversioned', () => {
      const controlKeys = buildSettingsSchema()
        .filter(item => item.type !== 'heading')
        .map(item => item.key);

      expect([...controlKeys].sort()).toEqual(Object.keys(defaultSettings).sort());
    });

    it('sources toggle defaults from defaultSettings (no schema/default drift)', () => {
      const schema = buildSettingsSchema();
      for (const item of schema) {
        if (item.type === 'boolean') {
          expect(item.default).toBe(defaultSettings[item.key as keyof typeof defaultSettings]);
        }
      }
    });
  });

  describe('onSettingsChanged', () => {
    it('registers callback with logseq.onSettingsChanged', () => {
      const callback = vi.fn();

      onSettingsChanged(callback);

      expect(logseq.onSettingsChanged).toHaveBeenCalledTimes(1);
      expect(logseq.onSettingsChanged).toHaveBeenCalledWith(expect.any(Function));
    });

    it('callback receives merged settings with defaults', () => {
      const callback = vi.fn();
      let registeredCallback: ((newSettings: unknown, oldSettings: unknown) => void) | null = null;

      // Capture the callback
      logseq.onSettingsChanged.mockImplementation(cb => {
        registeredCallback = cb;
      });

      onSettingsChanged(callback);

      // Simulate settings change
      const newSettings = { enablePopovers: false };
      const oldSettings = { enablePopovers: true };

      registeredCallback?.(newSettings, oldSettings);

      expect(callback).toHaveBeenCalledTimes(1);

      // Check that defaults were merged
      const [receivedNew, receivedOld] = callback.mock.calls[0];
      expect(receivedNew).toEqual({
        ...defaultSettings,
        enablePopovers: false,
      });
      expect(receivedOld).toEqual({ ...defaultSettings, enablePopovers: true });
    });

    it('merges both new and old settings with defaults', () => {
      const callback = vi.fn();
      let registeredCallback: ((newSettings: unknown, oldSettings: unknown) => void) | null = null;

      logseq.onSettingsChanged.mockImplementation(cb => {
        registeredCallback = cb;
      });

      onSettingsChanged(callback);

      const newSettings = {
        enablePopovers: false,
        compactSidebarNav: false,
      };
      const oldSettings = {
        enablePopovers: true,
        compactSidebarNav: true,
      };

      registeredCallback?.(newSettings, oldSettings);

      const [receivedNew, receivedOld] = callback.mock.calls[0];

      // New settings should have overrides plus defaults
      expect(receivedNew.enablePopovers).toBe(false);
      expect(receivedNew.compactSidebarNav).toBe(false);
      expect(receivedNew.enablePrettyTypography).toBe(defaultSettings.enablePrettyTypography);

      // Old settings should have overrides plus defaults
      expect(receivedOld.enablePopovers).toBe(true);
      expect(receivedOld.compactSidebarNav).toBe(true);
      expect(receivedOld.enablePrettyTypography).toBe(defaultSettings.enablePrettyTypography);
    });

    it('filters out disabled property from settings', () => {
      const callback = vi.fn();
      let registeredCallback: ((newSettings: unknown, oldSettings: unknown) => void) | null = null;

      logseq.onSettingsChanged.mockImplementation(cb => {
        registeredCallback = cb;
      });

      onSettingsChanged(callback);

      // Simulate settings that include Logseq internal 'disabled' property
      const newSettings = { disabled: true, enablePopovers: false };
      const oldSettings = { disabled: false, enablePopovers: true };

      registeredCallback?.(newSettings, oldSettings);

      const [receivedNew, receivedOld] = callback.mock.calls[0];

      // 'disabled' should not be in the received settings
      expect(receivedNew).not.toHaveProperty('disabled');
      expect(receivedOld).not.toHaveProperty('disabled');
      expect(receivedNew.enablePopovers).toBe(false);
      expect(receivedOld.enablePopovers).toBe(true);
    });

    it('handles null/undefined settings gracefully', () => {
      const callback = vi.fn();
      let registeredCallback: ((newSettings: unknown, oldSettings: unknown) => void) | null = null;

      logseq.onSettingsChanged.mockImplementation(cb => {
        registeredCallback = cb;
      });

      onSettingsChanged(callback);

      registeredCallback?.(null, undefined);

      const [receivedNew, receivedOld] = callback.mock.calls[0];
      expect(receivedNew).toEqual(defaultSettings);
      expect(receivedOld).toEqual(defaultSettings);
    });

    it('handles empty settings objects', () => {
      const callback = vi.fn();
      let registeredCallback: ((newSettings: unknown, oldSettings: unknown) => void) | null = null;

      logseq.onSettingsChanged.mockImplementation(cb => {
        registeredCallback = cb;
      });

      onSettingsChanged(callback);

      registeredCallback?.({}, {});

      const [receivedNew, receivedOld] = callback.mock.calls[0];

      // Should be all defaults
      expect(receivedNew).toEqual(defaultSettings);
      expect(receivedOld).toEqual(defaultSettings);
    });
  });
});
