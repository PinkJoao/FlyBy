// =============================================================================
// RulePopup - popup de regra do glossário (aberto pelos RuleLinks do texto)
// =============================================================================
// Reusa a PILHA do sistema de diálogos in-app (DDL-0007): cada regra aberta é um
// diálogo empilhado no dialogStore - um link DENTRO do popup abre outro popup
// por cima; X / Esc / clique fora fecham o de cima. O corpo renderiza via
// EntryContent, então as referências aninhadas viram links recursivamente.
//
// NB: exporta só a função imperativa (sem export de componente) - o host é o
// DialogHost já montado no App, dentro do DataProvider.
// -----------------------------------------------------------------------------

import useDialogStore from '../../store/dialogStore';
import { ruleCategoryLabel } from '../../engine/glossary';
import EntryContent from './EntryContent';
import styles from './RulePopup.module.css';

/** Tipos de ENTIDADE sem entity de seletor própria (ver entityLinks.js) - os
 * links {@background}/{@classFeature}/{@subclassFeature} abrem este popup.
 * Os tipos de REGRA vêm de ruleCategoryLabel (variantrules se desdobram pelo
 * ruleType: Core/Optional/Variant/Variant Optional Rule). */
const ENTITY_TYPE_LABELS = {
  background: 'Background',
  classFeature: 'Class Feature',
  subclassFeature: 'Subclass Feature',
};

// Helper (não componente - satisfaz react-refresh/only-export-components; sem
// hooks aqui, é só construção de JSX).
function ruleBody(entry) {
  const badge = ENTITY_TYPE_LABELS[entry.type] ?? ruleCategoryLabel(entry);
  return (
    <div className={styles.body}>
      <div className={styles.meta}>
        {badge && <span className={styles.badge}>{badge}</span>}
        {entry.source && <span className={styles.source}>{entry.source}</span>}
      </div>
      <EntryContent entries={entry.entries} />
    </div>
  );
}

/**
 * Abre o popup de uma entrada do glossário (`{type,name,source,entries}` - o
 * shape produzido por engine/glossary.js). Fire-and-forget.
 */
export function showRulePopup(entry) {
  if (!entry) return;
  useDialogStore.getState().open({
    variant: 'alert',
    title: entry.name,
    message: ruleBody(entry),
    dismissable: true,
    showClose: true,
    actions: [],
    maxWidth: 560,
  });
}
