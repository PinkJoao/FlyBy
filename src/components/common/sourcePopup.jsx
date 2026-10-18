// =============================================================================
// sourcePopup: o popup com o nome por extenso de uma fonte
// =============================================================================
// O QUE FAZ
//   A abreviação ("PSK") não diz nada a um jogador novo: o card a mostra com o
//   nome completo no title, e o clique abre este popup, na pilha de diálogos
//   (DDL-0065). Só exporta a função imperativa.
//
// FUNÇÕES
//   showSourcePopup(source): abre o popup.
// -----------------------------------------------------------------------------

import useDialogStore from '../../store/dialogStore';
import { sourceName } from '../../engine/sourceNames';
import styles from './RulePopup.module.css';

/**
 * Abre o popup com o nome por extenso de uma fonte.
 * @param {string} source
 */
export function showSourcePopup(source) {
  if (!source) return;
  const full = sourceName(source);
  useDialogStore.getState().open({
    variant: 'alert',
    title: full,
    message: (
      <div className={styles.body}>
        <div className={styles.meta}>
          <span className={styles.badge}>Source</span>
          <span className={styles.source}>{source}</span>
        </div>
      </div>
    ),
    dismissable: true,
    showClose: true,
    actions: [],
    maxWidth: 420,
  });
}
