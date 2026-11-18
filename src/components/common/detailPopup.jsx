// =============================================================================
// detailPopup: o popup de detalhe de uma entidade
// =============================================================================
// O QUE FAZ
//   Abre a MESMA ficha do SelectorPanel (DetailView) num diálogo empilhável
//   (DDL-0007). É o que torna clicáveis os CHIPS já escolhidos (invocações,
//   maestrias, perícias) e os links de entidade (DDL-0021). Só exporta a função
//   imperativa: o host é o DialogHost.
//
// FUNÇÕES
//   showDetailPopup(opts): abre o detalhe; o nome vai no título do diálogo, por
//     isso o DetailView vem com `hideHeader`. Com `actions` ({ label, value, tone }),
//     os botões de uso no rodapé (o play mode: Cast, Attack, Use; DDL-0251); a
//     promessa resolve o `value` escolhido, ou nada.
// -----------------------------------------------------------------------------

import useDialogStore from '../../store/dialogStore';
import DetailView from './DetailView';

/** Abre o detalhe de `raw` com a config de `entity`; resolve a ação escolhida no rodapé, se houver. */
export function showDetailPopup({ entity, raw, db, actions = [] }) {
  if (!raw) return Promise.resolve(null);
  return useDialogStore.getState().open({
    variant: 'alert',
    title: raw.name,
    message: (
      <div style={{ whiteSpace: 'normal', textAlign: 'left' }}>
        <DetailView entity={entity} raw={raw} db={db} capImage hideHeader />
      </div>
    ),
    dismissable: true,
    showClose: true,
    actions,
    maxWidth: 560,
  });
}
