// =============================================================================
// showSourcePopup - popup com o nome por extenso de uma fonte
// =============================================================================
// Início da exibição das fontes: a abreviação ("PSK") não diz nada a um jogador
// novo. O card mostra a abreviação com o nome completo no `title` (hover), e um
// clique abre este popup. Reusa a PILHA de diálogos in-app (DDL-0007), como o
// RulePopup, então empilha sobre qualquer preview/popup já aberto.
//
// NB: exporta só a função imperativa (o host é o DialogHost montado no App).
// -----------------------------------------------------------------------------

import useDialogStore from '../../store/dialogStore';
import { sourceName } from '../../engine/sourceNames';
import styles from './RulePopup.module.css';

/**
 * Abre um popup com o nome por extenso de uma fonte. Fire-and-forget.
 * @param {string} source  abreviação ("XPHB")
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
