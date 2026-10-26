import { buildSettingsSchema, defaultSettings, type PluginSettings } from './schema';

export type { PluginSettings, VersionInfo } from './schema';
export { buildSettingsSchema, defaultSettings };

/** Raw shape Logseq hands us: our keys, plus internals like `disabled`. */
type RawSettings = Partial<PluginSettings> & { disabled?: boolean };

/**
 * Turn a raw Logseq settings object into a complete `PluginSettings`: drop
 * Logseq's internal `disabled` flag and fill every missing key from
 * `defaultSettings`. Tolerates `null`/`undefined`.
 */
function normalizeSettings(raw: unknown): PluginSettings {
  const { disabled: _disabled, ...userSettings } = (raw as RawSettings | null | undefined) || {};
  return { ...defaultSettings, ...userSettings };
}

export function getSettings(): PluginSettings {
  return normalizeSettings(logseq.settings);
}

export function initSettings(): void {
  // Registered before version detection, so no status row yet; index.ts
  // re-registers with version info once detection resolves.
  logseq.useSettingsSchema(buildSettingsSchema());
}

export function onSettingsChanged(
  callback: (newSettings: PluginSettings, oldSettings: PluginSettings) => void,
): void {
  logseq.onSettingsChanged((newSettings, oldSettings) => {
    callback(normalizeSettings(newSettings), normalizeSettings(oldSettings));
  });
}
