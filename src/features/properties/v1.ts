import { getSettings } from '../../settings';
import type { FeatureStrategy } from '../../types';
import { setupPropertyObserver } from './observer';
import styles from './styles.scss?inline';

let cleanup: (() => void) | null = null;

/**
 * Logseq v1 (file/markdown) properties: styles the `.page-properties` block and,
 * when enabled, runs the icon observer.
 */
export const propertiesV1: FeatureStrategy = {
  getStyles() {
    return getSettings().enablePrettyProperties ? styles : '';
  },

  init() {
    const settings = getSettings();
    if (!settings.enablePrettyProperties) return;
    if (settings.showPropertyIcons) cleanup = setupPropertyObserver();
  },

  destroy() {
    cleanup?.();
    cleanup = null;
  },
};
