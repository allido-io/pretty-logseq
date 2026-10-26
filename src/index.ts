import '@logseq/libs';

import { registry } from './core/registry';
import { injectStyles, refreshStyles } from './core/styles';
import { detectAccentWhenReady, setupThemeObserver } from './core/theme';
import { applyVersionAttribute, detectVersion, getVersion } from './core/version';
import { contentFeature } from './features/content';
import { linksFeature } from './features/links';
import { popoversFeature } from './features/popovers';
import { propertiesFeature } from './features/properties';
import { sidebarFeature } from './features/sidebar';
import { sidebarTagsFeature } from './features/sidebar-tags';
import { tablesFeature } from './features/tables';
import { tagsFeature } from './features/tags';
import { templatesFeature } from './features/templates';
import { todosFeature } from './features/todos';
import { applyNavArrowsSetting, topbarFeature } from './features/topbar';
import { typographyFeature } from './features/typography';
import {
  buildSettingsSchema,
  getSettings,
  initSettings,
  onSettingsChanged,
  type PluginSettings,
} from './settings';

interface BaseBinding {
  /** Setting keys that trigger this binding when any of them changes. */
  keys: (keyof PluginSettings)[];
  /** Imperative side effect to run on change (e.g. DOM repositioning). */
  onChange?: () => void;
}

type FeatureBinding =
  | (BaseBinding & {
      action: 'toggle';
      /** Feature to init/destroy. */
      featureId: string;
      /** Gate: the feature is active only while this setting is true. */
      enableKey: keyof PluginSettings;
    })
  | (BaseBinding & {
      action: 'reinit';
      /** Feature to destroy then re-init. */
      featureId: string;
      /** Optional gate: skip the re-init while this setting is false. */
      enableKey?: keyof PluginSettings;
    })
  | (BaseBinding & { action: 'restyle' });

/**
 * Declarative map of setting keys → how a change should be applied. Replaces the
 * old hand-written if-block dispatcher.
 * - `toggle`: init the feature when `enableKey` is on, destroy it when off.
 * - `reinit`: destroy then re-init (re-init only if `enableKey`, or always if none)
 *   — used when a sub-setting changed and the feature must rebuild.
 * - `restyle`: style-only settings; just re-aggregate CSS.
 * Every binding re-injects styles after running.
 */
const FEATURE_BINDINGS: FeatureBinding[] = [
  {
    keys: ['enablePopovers'],
    action: 'toggle',
    featureId: 'popovers',
    enableKey: 'enablePopovers',
  },
  {
    keys: ['enablePrettyLinks'],
    action: 'toggle',
    featureId: 'links',
    enableKey: 'enablePrettyLinks',
  },
  {
    keys: ['enablePrettyTodos'],
    action: 'toggle',
    featureId: 'todos',
    enableKey: 'enablePrettyTodos',
  },
  {
    keys: ['enablePrettyTypography'],
    action: 'toggle',
    featureId: 'typography',
    enableKey: 'enablePrettyTypography',
  },
  {
    keys: ['enablePrettyProperties', 'showPropertyIcons'],
    action: 'reinit',
    featureId: 'properties',
    enableKey: 'enablePrettyProperties',
  },
  {
    keys: ['enableFavoriteStar'],
    action: 'reinit',
    featureId: 'content',
  },
  { keys: ['navArrowsLeft'], action: 'restyle', onChange: applyNavArrowsSetting },
  {
    // Enum setting ('off'|'hide'|'subtle') — 'off' is truthy, so the boolean
    // `enableKey` gate doesn't fit. `reinit` (no enableKey) always destroys then
    // re-inits; the feature self-gates on the setting value in its `init`.
    keys: ['sidebarPageTags'],
    action: 'reinit',
    featureId: 'sidebar-tags',
  },
  {
    keys: [
      'enablePrettyTables',
      'enablePrettyTags',
      'enablePrettyTemplates',
      'enableBulletThreading',
      'dimTodoChildBlocks',
      'hideTodoHiddenPropertiesPill',
      'compactSidebarNav',
      'hideCreateButton',
      'graphSelectorBottom',
      'hideHomeButton',
      'hideSyncIndicator',
      'styleTopbarIcons',
      'topbarGradient',
      'hideWindowControls',
    ],
    action: 'restyle',
  },
];

async function applyBinding(binding: FeatureBinding, settings: PluginSettings): Promise<void> {
  if (binding.action === 'toggle') {
    if (settings[binding.enableKey]) {
      await registry.initializeFeature(binding.featureId);
    } else {
      registry.destroyFeature(binding.featureId);
    }
  } else if (binding.action === 'reinit') {
    registry.destroyFeature(binding.featureId);
    if (!binding.enableKey || settings[binding.enableKey]) {
      await registry.initializeFeature(binding.featureId);
    }
  }

  binding.onChange?.();
  refreshStyles();
}

async function handleSettingsChange(
  newSettings: PluginSettings,
  oldSettings: PluginSettings,
): Promise<void> {
  // Version override changed: everything can differ, so treat it as a full
  // reload — re-detect, update the scope attribute, then destroy + re-init all.
  if (newSettings.logseqVersion !== oldSettings.logseqVersion) {
    await registry.destroyAll();
    applyVersionAttribute(await detectVersion());
    registerSchema();
    await registry.initializeAll();
    refreshStyles();
    return;
  }

  // Data-driven dispatch: run each binding whose keys changed.
  for (const binding of FEATURE_BINDINGS) {
    if (binding.keys.some(key => newSettings[key] !== oldSettings[key])) {
      await applyBinding(binding, newSettings);
    }
  }
}

/**
 * Re-register the settings schema with the detected version, so the read-only
 * "Active: …" status row reflects it. Called after detection and on version
 * change. (Logseq only re-reads the schema when the panel is reopened, so this
 * isn't used for live per-toggle updates.)
 */
function registerSchema(): void {
  const source = getSettings().logseqVersion === 'auto' ? 'auto' : 'manual';
  logseq.useSettingsSchema(buildSettingsSchema({ active: getVersion(), source }));
}

function registerFeatures(): void {
  registry.register(contentFeature);
  registry.register(popoversFeature);
  registry.register(propertiesFeature);
  registry.register(linksFeature);
  registry.register(todosFeature);
  registry.register(topbarFeature);
  registry.register(sidebarFeature);
  registry.register(sidebarTagsFeature);
  registry.register(tablesFeature);
  registry.register(tagsFeature);
  registry.register(templatesFeature);
  registry.register(typographyFeature);
}

/** Tail of the serialized settings-change chain; `beforeunload` waits for it. */
let pendingSettingsChange: Promise<void> = Promise.resolve();
/** Set once unload begins so queued-but-unstarted settings changes are skipped. */
let unloading = false;

async function main(): Promise<void> {
  console.log('[Pretty Logseq] Plugin loading...');

  initSettings();
  registerFeatures();

  const version = await detectVersion();
  applyVersionAttribute(version);
  registerSchema();
  console.log(`[Pretty Logseq] Detected Logseq ${version}`);

  injectStyles();
  setupThemeObserver(refreshStyles);
  // The theme's CSS vars may not be applied yet at cold startup; re-detect the
  // accent once they settle so we don't get stuck on the default fallback.
  detectAccentWhenReady(refreshStyles);

  await registry.initializeAll();

  // Changes are applied one at a time, in arrival order. A feature's `init` can
  // be async (content awaits a favorites fetch; a version change re-detects
  // and re-inits everything), and the registry only marks a feature
  // initialized once its init resolves — so a change landing mid-flight could
  // find `destroyFeature` a no-op and leave the feature running after it was
  // turned off. Chaining each change onto the previous one closes that window.
  // Changes still queued when unload begins are skipped (see `beforeunload`).
  onSettingsChanged((newSettings, oldSettings) => {
    pendingSettingsChange = pendingSettingsChange
      .then(() => (unloading ? undefined : handleSettingsChange(newSettings, oldSettings)))
      .catch(err => console.error('[Pretty Logseq] Failed to apply settings change:', err));
  });

  console.log('[Pretty Logseq] Plugin loaded');
}

logseq.beforeunload(async () => {
  console.log('[Pretty Logseq] Plugin unloading...');
  // Let an in-flight settings change finish (its init could otherwise land
  // after cleanup and leave observers on the host document), and drop any
  // changes queued behind it. The chain never rejects, so this cannot throw.
  unloading = true;
  await pendingSettingsChange;
  await registry.destroyAll();
});

logseq.ready(main).catch(console.error);
