/**
 * A page's properties as the renderer consumes them, keyed by lowercased plain
 * property name. Values are intentionally `unknown`: the v1 file app returns
 * whatever Logseq parsed (strings, `[[ref]]` arrays, numbers, booleans), and the
 * v2 adapter (`lib/api.v2.ts`) normalizes DB entities to `string | string[]`.
 * Read a value through `cleanPropertyValue` / `cleanAllValues`, never raw.
 *
 * Well-known keys the popover and properties features look for: `type`,
 * `status`, `area`, `description`, `icon`, `url`, `photo`, `alias`.
 */
export type PageProperties = Record<string, unknown>;

export interface BlockData {
  content: string;
  children?: BlockData[];
}

export interface PageData {
  name: string;
  originalName?: string;
  properties: PageProperties;
  blocks?: BlockData[];
}

export type ThemeMode = 'light' | 'dark';
