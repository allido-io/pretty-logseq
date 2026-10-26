import { getSettings } from '../../settings';
import type { FeatureStrategy } from '../../types';
import dimChildrenStyles from './dim-children.scss?inline';
import { setupTodoObserver } from './observer';
import styles from './styles.scss?inline';

let cleanup: (() => void) | null = null;

/**
 * Logseq v1 (file/markdown) todos: styles marker-based task blocks
 * (`.todo`/`.doing`/`.done`/…, `a.priority`) and runs the observer that injects
 * a "CANCELLED" label and flags past-due SCHEDULED/DEADLINE dates.
 */
export const todosV1: FeatureStrategy = {
  getStyles() {
    const settings = getSettings();
    if (!settings.enablePrettyTodos) return '';

    const parts = [styles];
    if (settings.dimTodoChildBlocks) parts.push(dimChildrenStyles);
    return parts.join('\n');
  },

  init() {
    if (!getSettings().enablePrettyTodos) return;
    cleanup = setupTodoObserver();
  },

  destroy() {
    cleanup?.();
    cleanup = null;
  },
};
