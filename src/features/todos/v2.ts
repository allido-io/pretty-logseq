import { getSettings } from '../../settings';
import type { FeatureStrategy } from '../../types';
import dimChildrenStyles from './dim-children.v2.scss?inline';
import hiddenPropertiesPillStyles from './hidden-properties-pill.v2.scss?inline';
import styles from './styles.v2.scss?inline';

/**
 * Logseq v2 (DB) todos.
 *
 * v2 has no marker text (`.todo`/`.done`/…) or `a.priority` anchors — task state
 * is a property rendered via icon-font glyphs (`.ls-icon-Todo`/`InProgress`/
 * `Done`/`Cancelled`), priority via `.ls-icon-priorityLvl*`, and past-due via a
 * native `.overdue` class. So v2 is styling-only (`styles.v2.scss`) and needs no
 * observer — hence the no-op `init`/`destroy` (nothing to inject or clean up).
 */
export const todosV2: FeatureStrategy = {
  getStyles() {
    const settings = getSettings();
    if (!settings.enablePrettyTodos) return '';

    const parts = [styles];
    if (settings.hideTodoHiddenPropertiesPill) parts.push(hiddenPropertiesPillStyles);
    if (settings.dimTodoChildBlocks) parts.push(dimChildrenStyles);
    return parts.join('\n');
  },

  init() {},
  destroy() {},
};
