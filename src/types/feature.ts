export interface Feature {
  id: string;
  name: string;
  description: string;
  getStyles(): string;
  init(): void | Promise<void>;
  destroy(): void;
}

/**
 * The version-specific slice of a `Feature` — everything but its identity.
 * A feature whose behavior diverges between Logseq editions keeps one
 * `FeatureStrategy` per edition (`v1.ts` / `v2.ts`) and its `index.ts` picks one
 * by `getVersion()` (see `features/properties` and `features/todos`).
 */
export type FeatureStrategy = Pick<Feature, 'getStyles' | 'init' | 'destroy'>;
