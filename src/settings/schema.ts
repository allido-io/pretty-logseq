import type { SettingSchemaDesc } from '@logseq/libs/dist/LSPlugin';

export interface PluginSettings {
  enablePopovers: boolean;
  enablePrettyTypography: boolean;
  enablePrettyTables: boolean;
  enablePrettyTemplates: boolean;
  enablePrettyProperties: boolean;
  showPropertyIcons: boolean;
  enablePrettyLinks: boolean;
  enablePrettyTodos: boolean;
  dimTodoChildBlocks: boolean;
  hideTodoHiddenPropertiesPill: boolean;
  enablePrettyTags: boolean;
  enableFavoriteStar: boolean;
  enableBulletThreading: boolean;
  compactSidebarNav: boolean;
  hideCreateButton: boolean;
  graphSelectorBottom: boolean;
  hideHomeButton: boolean;
  hideSyncIndicator: boolean;
  navArrowsLeft: boolean;
  styleTopbarIcons: boolean;
  topbarGradient: boolean;
  hideWindowControls: boolean;
  sidebarPageTags: 'off' | 'hide' | 'subtle';
  logseqVersion: 'auto' | 'v1' | 'v2';
}

export const defaultSettings: PluginSettings = {
  enablePopovers: true,
  enablePrettyTypography: true,
  enablePrettyTables: true,
  enablePrettyTemplates: true,
  enablePrettyProperties: true,
  showPropertyIcons: true,
  enablePrettyLinks: true,
  enablePrettyTodos: true,
  dimTodoChildBlocks: true,
  hideTodoHiddenPropertiesPill: true,
  enablePrettyTags: true,
  enableFavoriteStar: true,
  enableBulletThreading: true,
  compactSidebarNav: true,
  hideCreateButton: true,
  graphSelectorBottom: true,
  hideHomeButton: true,
  hideSyncIndicator: true,
  navArrowsLeft: true,
  styleTopbarIcons: true,
  topbarGradient: true,
  hideWindowControls: false,
  sidebarPageTags: 'subtle',
  logseqVersion: 'auto',
};

/** Keys of `PluginSettings` that hold a boolean (everything except the enums). */
type BooleanSettingKey = {
  [K in keyof PluginSettings]: PluginSettings[K] extends boolean ? K : never;
}[keyof PluginSettings];

interface SettingToggle {
  key: BooleanSettingKey | 'sidebarPageTags';
  title: string;
  /** Optional — omit when the title is self-explanatory (Logseq also shows the key). */
  description?: string;
  /**
   * Versions this toggle applies to. Omit when it applies to both. When the
   * active version is known, `buildSettingsSchema` hides toggles that don't list
   * it (e.g. v1-only toggles whose target element doesn't exist in v2).
   */
  versions?: ('v1' | 'v2')[];
  /** Control type; defaults to `'boolean'`. */
  type?: 'boolean' | 'enum';
  /** Choices for an `enum` toggle (required when `type: 'enum'`). */
  enumChoices?: string[];
}

interface SettingGroup {
  /** Heading key + label shown as the group divider. */
  id: string;
  title: string;
  toggles: SettingToggle[];
}

/**
 * Settings are organized into a few group dividers, each a flat list of toggles.
 * Descriptions are kept only where the title (and Logseq's always-shown key chip)
 * don't already make the toggle self-explanatory.
 */
const SETTING_GROUPS: SettingGroup[] = [
  {
    id: 'content',
    title: 'Pretty Content',
    toggles: [
      {
        key: 'enablePopovers',
        title: 'Pretty Popovers',
        description: 'Hover previews for page references, with their page properties.',
      },
      {
        key: 'enablePrettyTypography',
        title: 'Pretty Typography',
        description: 'Inter font, refined heading weights, and prose styling.',
      },
      {
        key: 'enablePrettyLinks',
        title: 'Pretty Links',
        description: 'Favicons and hover preview cards for external links.',
      },
      {
        key: 'enablePrettyTodos',
        title: 'Pretty Todos',
        description: 'Status, priority, and past-due styling for task blocks.',
      },
      {
        key: 'dimTodoChildBlocks',
        title: 'Dim Task Child Blocks',
        description: "Add a subtle background to a task's child blocks (needs Pretty Todos).",
      },
      {
        key: 'hideTodoHiddenPropertiesPill',
        title: "Hide 'Show Hidden Properties' Pill",
        description:
          "Hide the pill that toggles a task card's hidden properties (needs Pretty Todos).",
        // Targets v2's bottom-properties pill row; the v1 property UI has no equivalent.
        versions: ['v2'],
      },
      {
        key: 'enablePrettyTags',
        title: 'Pretty Tags',
        description: "Accent pill styling for the tag/class chips on a block's tag row.",
        // v2 renders tags as a `.block-tags` pill strip; v1 has no equivalent DOM.
        versions: ['v2'],
      },
      {
        key: 'enablePrettyTables',
        title: 'Pretty Tables',
        description: 'Accent borders, refined headers, and hover states for query tables.',
      },
      {
        key: 'enablePrettyTemplates',
        title: 'Pretty Templates',
        description: 'Dimmed, contained cards for template blocks.',
      },
      {
        key: 'enableBulletThreading',
        title: 'Bullet Threading',
        description: 'Hierarchy lines from parent blocks to their children on hover.',
      },
      {
        key: 'enableFavoriteStar',
        title: 'Favorite Star',
        description: 'A star button by page titles to toggle favorites.',
      },
    ],
  },
  {
    id: 'properties',
    title: 'Pretty Properties',
    toggles: [
      {
        key: 'enablePrettyProperties',
        title: 'Property Styling',
        description: 'Accent borders and pipe-separated values for page properties.',
      },
      {
        key: 'showPropertyIcons',
        title: 'Show Property Icons',
        description: "Show each property key's page icon (needs Pretty Properties).",
      },
    ],
  },
  {
    id: 'sidebar',
    title: 'Pretty Left Sidebar',
    toggles: [
      {
        key: 'compactSidebarNav',
        title: 'Compact Navigation',
        description: 'Show navigation items as inline icons instead of a vertical list.',
      },
      {
        key: 'hideCreateButton',
        title: 'Hide Create Button',
        description: "Hide the 'New page' create button in the sidebar.",
        // No `.create` element exists in the v2 sidebar.
        versions: ['v1'],
      },
      {
        key: 'graphSelectorBottom',
        title: 'Graph Selector at Bottom',
        description: 'Move the graph/vault selector to the bottom of the sidebar.',
      },
      {
        key: 'sidebarPageTags',
        title: 'Page Tags in Sidebar',
        description:
          "Tagged pages show their tag inline (e.g. 'Next.JS #Technology'). 'hide' drops the tag; 'subtle' right-aligns and tints it; 'off' leaves it alone.",
        type: 'enum',
        enumChoices: ['off', 'hide', 'subtle'],
        // v2 renders the tag suffix in sidebar page names; v1 doesn't.
        versions: ['v2'],
      },
    ],
  },
  {
    id: 'topbar',
    title: 'Pretty Top Bar',
    toggles: [
      {
        key: 'styleTopbarIcons',
        title: 'Style Icons',
        description: 'Theme-consistent colors and hover effects for icon buttons.',
      },
      {
        key: 'topbarGradient',
        title: 'Gradient',
        description: 'Subtle gradient from the background toward the accent color.',
      },
      {
        key: 'navArrowsLeft',
        title: 'Navigation Arrows on Left',
        description: 'Move the back/forward arrows to the left, next to the sidebar toggle.',
      },
      {
        key: 'hideHomeButton',
        title: 'Hide Home Button',
        description: 'Hide the Home button from the top navigation bar.',
      },
      {
        key: 'hideSyncIndicator',
        title: 'Hide Sync Indicator',
        description: 'Hide the sync/cloud status indicator from the top bar.',
        // Targets v1's `.cp__file-sync-indicator`, which the DB app doesn't render.
        versions: ['v1'],
      },
      {
        key: 'hideWindowControls',
        title: 'Hide Window Controls',
        description: 'Hide the minimize, maximize, and close buttons.',
      },
    ],
  },
];

const VERSION_LABELS: Record<'v1' | 'v2', string> = {
  v1: 'Logseq file (v1)',
  v2: 'Logseq DB (v2)',
};

export interface VersionInfo {
  active: 'v1' | 'v2';
  source: 'auto' | 'manual';
}

function heading(key: string, title: string, description = ''): SettingSchemaDesc {
  return { key, title, description, type: 'heading', default: null };
}

/**
 * Builds the full settings schema. The schema is static except for the version
 * status row, so `version` is the only input; pass it (after detection) to show a
 * read-only "Active: …" row above the version picker. It is passed in rather than
 * read from core/version to keep this module free of a settings↔version cycle.
 */
export function buildSettingsSchema(version?: VersionInfo): SettingSchemaDesc[] {
  const schema: SettingSchemaDesc[] = [heading('compatibilityHeading', 'Compatibility')];

  if (version) {
    schema.push(
      heading(
        'detectedVersionStatus',
        `● Active: ${VERSION_LABELS[version.active]}`,
        version.source === 'auto'
          ? `Auto-detected this graph as the ${version.active} app. Use the dropdown below to override.`
          : `Manually set to the ${version.active} app. Set the dropdown below to 'auto' to re-detect.`,
      ),
    );
  }

  schema.push({
    key: 'logseqVersion',
    title: 'Logseq Version',
    description: 'Override the auto-detected version only if detection is wrong.',
    type: 'enum',
    enumChoices: ['auto', 'v1', 'v2'],
    enumPicker: 'select',
    default: 'auto',
  });

  for (const group of SETTING_GROUPS) {
    // Hide toggles that don't apply to the active version (only once detection
    // has resolved; before that, show everything).
    const toggles = version
      ? group.toggles.filter(t => !t.versions || t.versions.includes(version.active))
      : group.toggles;
    if (toggles.length === 0) continue;

    schema.push(heading(`${group.id}Heading`, group.title));
    for (const t of toggles) {
      if (t.type === 'enum') {
        schema.push({
          key: t.key,
          title: t.title,
          description: t.description ?? '',
          type: 'enum',
          enumChoices: t.enumChoices ?? [],
          enumPicker: 'select',
          default: defaultSettings[t.key],
        });
      } else {
        schema.push({
          key: t.key,
          title: t.title,
          description: t.description ?? '',
          type: 'boolean',
          default: defaultSettings[t.key],
        });
      }
    }
  }

  return schema;
}
