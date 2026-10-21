// =============================================================================
// GlossaryOverlay: o glossário navegável
// =============================================================================
// O QUE FAZ
//   Aberto pelo "Glossary" dos menus sanduíche (glossaryStore). É um SelectorPanel
//   em modo `noPreview`: o mesmo layout dos seletores, sem coluna de preview,
//   porque nada é "selecionado". Tocar num card abre o preview do link
//   (showDetailPopup ou showRulePopup), empilhado no dialog stack, então os links
//   de dentro continuam clicáveis. Montado uma vez no App.
//
// FUNÇÕES
//   GlossaryOverlay(): o overlay.
//
// DECISÕES E ARMADILHAS
//   - A ordem própria do índice (regras primeiro, DDL-0027) é a `naturalSort`:
//     segue sendo a padrão, e o nome vira uma opção do botão de ordenar.
//   - A entity é estável por db: o precompute das 7700+ entradas roda uma vez por
//     sessão. Uma entrada pode casar várias categorias (DDL-0027).
// -----------------------------------------------------------------------------

import { useEffect, useMemo } from 'react';
import { useData } from '../../data/dataContext';
import useGlossaryStore from '../../store/glossaryStore';
import useDialogStore from '../../store/dialogStore';
import SelectorPanel from '../../selector/SelectorPanel';
import { glossaryIndexFor } from './glossaryIndex';
import { showDetailPopup } from './detailPopup';
import { showRulePopup } from './RulePopup';

export default function GlossaryOverlay() {
  const open = useGlossaryStore((s) => s.open);
  const hide = useGlossaryStore((s) => s.hide);
  const { db } = useData();

  const { entries, categories } = useMemo(() => glossaryIndexFor(db), [db]);

  const entity = useMemo(
    () => ({
      type: 'glossary',
      title: 'Glossary',
      naturalSort: { value: 'natural', label: 'Rules first', defaultDir: 'asc', dirLabels: ['Rules first', 'Reversed'] },
      list: () => entries,
      idOf: (e) => e.id,
      precompute: (e) => ({
        searchText: e.searchText,
        filterValues: {
          category: e.filterCategories,
          source: e.source ? [e.source] : [],
        },
      }),
      filters: [
        { id: 'category', header: 'Category', options: categories },
        { id: 'source', header: 'Source', derive: true },
      ],
      card: (e) => ({
        title: e.name,
        subtitle: e.subtitle || e.source,
        badges: [e.categoryLabel],
      }),
    }),
    [entries, categories],
  );

  // ATENÇÃO: o Esc só fecha o glossário sem popup por cima; senão fecharia os dois.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (useDialogStore.getState().dialogs.length > 0) return;
      hide();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, hide]);

  if (!open) return null;

  const openEntry = (e) => {
    if (e.kind === 'entity') showDetailPopup({ entity: e.entity, raw: e.raw, db });
    else showRulePopup(e.ruleEntry);
  };

  return (
    <SelectorPanel
      entity={entity}
      db={db}
      currentId={null}
      noPreview
      heading="Glossary"
      hint="Search every rule, spell, item, feat, species, class, subclass and feature."
      onSelect={openEntry}
      onClose={hide}
    />
  );
}
