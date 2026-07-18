// =============================================================================
// GlossaryOverlay - o glossário NAVEGÁVEL (busca + lista de tudo no índice)
// =============================================================================
// Aberto pelo item "Glossary" dos menus sanduíche (Home e ficha) via
// glossaryStore. É um SelectorPanel em modo `noPreview`: o MESMO layout dos
// seletores (busca no topo; filtros no painel esquerdo no desktop, com Clear e
// busca de filtros; gaveta arrastável no mobile) - só não há coluna de preview,
// porque aqui nada é "selecionado": tocar num card abre o preview do link
// inline (showDetailPopup para entidades, showRulePopup para regras),
// empilhado no dialog stack (DDL-0007), então os links dentro dele continuam
// clicáveis por cima do glossário.
//
// Montado uma vez no App (dentro do DataProvider); o SelectorPanel já se
// portala para o <body>.
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

  // Entity "glossário" para o SelectorPanel: cada entrada do índice é um item;
  // Category e Source são filtros comuns do painel. Estável por db, então o
  // precompute (7700+ entradas) roda uma vez por sessão.
  const entity = useMemo(
    () => ({
      type: 'glossary',
      title: 'Glossary',
      list: () => entries,
      idOf: (e) => e.id,
      precompute: (e) => ({
        searchText: e.searchText,
        filterValues: {
          // Uma entrada pode casar VÁRIOS filtros de categoria (uma regra
          // "Variant Optional" está em Variant, Optional e Rule) - DDL-0027.
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

  // Esc fecha o glossário - mas NÃO quando há um popup de detalhe/regra por cima
  // (aí o Esc é dele; o DialogHost fecha o de cima). Sem essa guarda, um Esc
  // fecharia os dois de uma vez.
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
