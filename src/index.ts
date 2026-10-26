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

type BindingAction = 'toggle' | 'reinit' | 'restyle';

interface FeatureBinding {
  /** Setting keys that trigger this binding when any of them changes. */
  keys: (keyof PluginSettings)[];
  action: BindingAction;
  /** Feature to (re)init/destroy for 'toggle'/'reinit'. */
  featureId?: string;
  /** Gate: the feature is active only while this setting is true. */
  enableKey?: keyof PluginSettings;
  /** Imperative side effect to run on change (e.g. DOM repositioning). */
  onChange?: () => void;
}

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

function applyBinding(binding: FeatureBinding, settings: PluginSettings): void {
  if (binding.action === 'toggle' && binding.featureId && binding.enableKey) {
    if (settings[binding.enableKey]) {
      registry.initializeFeature(binding.featureId);
    } else {
      registry.destroyFeature(binding.featureId);
    }
  } else if (binding.action === 'reinit' && binding.featureId) {
    registry.destroyFeature(binding.featureId);
    if (!binding.enableKey || settings[binding.enableKey]) {
      registry.initializeFeature(binding.featureId);
    }
  }

  binding.onChange?.();
  refreshStyles();
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

  onSettingsChanged(async (newSettings, oldSettings) => {
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
        applyBinding(binding, newSettings);
      }
    }
  });

  console.log('[Pretty Logseq] Plugin loaded');
}

logseq.beforeunload(async () => {
  console.log('[Pretty Logseq] Plugin unloading...');
  await registry.destroyAll();
});

logseq.ready(main).catch(console.error);
