import { getSettings } from '../../settings';
import type { FeatureStrategy } from '../../types';
import styles from './styles.v2.scss?inline';
import { propertiesV1 } from './v1';

/**
 * Logseq v2 (DB) properties.
 *
 * v2 rebuilt the page-properties DOM, so it needs its own stylesheet
 * (`styles.v2.scss`, targeting `.ls-page-properties` / `.property-k` /
 * `.property-value-inner`). The icon observer is version-agnostic — it reads its
 * key selector from `getPlatform().selectors.propertyKey`, which v2 defines
 * correctly (`src/core/platform/v2.ts`) — so `init`/`destroy` are identical to v1
 * and reuse its wiring (and its shared module-level cleanup).
 */
export const propertiesV2: FeatureStrategy = {
  getStyles() {
    return getSettings().enablePrettyProperties ? styles : '';
  },

  init: propertiesV1.init,
  destroy: propertiesV1.destroy,
};
