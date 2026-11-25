// =============================================================================
// RulePopup: o popup de regra do glossário
// =============================================================================
// O QUE FAZ
//   Reusa a PILHA de diálogos (DDL-0007): cada regra aberta é um diálogo, e um link
//   dentro dele abre outro por cima; X, Esc e clique fora fecham o de cima. O corpo
//   passa pelo EntryContent, então as referências viram links. Só exporta a função
//   imperativa: o host é o DialogHost.
//
// FUNÇÕES
//   ruleBody(entry): o corpo (helper, não componente, por causa do react-refresh).
//   showRulePopup(entry): abre o popup.
//
// DECISÕES E ARMADILHAS
//   - Na moldura única dos previews (variant 'preview', DDL-0295): a categoria e a fonte
//     no kicker, o corpo só com o texto.
//   - ENTITY_TYPE_LABELS cobre os tipos sem entity de seletor (background,
//     classFeature, subclassFeature), que abrem aqui. Os de regra vêm do
//     ruleCategoryLabel.
// -----------------------------------------------------------------------------

import useDialogStore from '../../store/dialogStore';
import { ruleCategoryLabel } from '../../engine/glossary';
import EntryContent from './EntryContent';
import styles from './RulePopup.module.css';

const ENTITY_TYPE_LABELS = {
  background: 'Background',
  classFeature: 'Class Feature',
  subclassFeature: 'Subclass Feature',
};

function ruleBody(entry) {
  return (
    <div className={styles.body}>
      <EntryContent entries={entry.entries} />
    </div>
  );
}

/** Abre o popup de uma entrada do glossário. */
export function showRulePopup(entry) {
  if (!entry) return;
  useDialogStore.getState().open({
    variant: 'preview',
    kicker: ENTITY_TYPE_LABELS[entry.type] ?? ruleCategoryLabel(entry) ?? 'Rule',
    source: entry.source,
    title: entry.name,
    message: ruleBody(entry),
    dismissable: true,
    showClose: true,
    actions: [],
    maxWidth: 560,
  });
}
