// =============================================================================
// detailPopup - popup de detalhe de uma entidade (reusa o dialog stack DDL-0007)
// =============================================================================
// Abre a MESMA ficha de detalhe do SelectorPanel (DetailView: imagem, meta,
// descrição resolvida, lore) dentro de um diálogo empilhável. Serve para tornar
// os CHIPS já escolhidos (invocations, metamagics, weapon masteries, perícias…)
// clicáveis: o jogador toca no chip e lê a descrição do que selecionou, sem
// reabrir o seletor. Links de regra dentro da descrição empilham outro popup.
//
// Exporta só a função imperativa (sem componente) - o host é o DialogHost já
// montado no App, dentro do DataProvider.
// -----------------------------------------------------------------------------

import useDialogStore from '../../store/dialogStore';
import DetailView from './DetailView';

/**
 * Abre o detalhe de `raw` usando a config de `entity` (a mesma passada ao
 * SelectorPanel). O nome vai no título do diálogo (por isso `hideHeader` no
 * DetailView, que senão repetiria nome/fonte no corpo). Fire-and-forget.
 */
export function showDetailPopup({ entity, raw, db }) {
  if (!raw) return;
  useDialogStore.getState().open({
    variant: 'alert',
    title: raw.name,
    message: (
      <div style={{ whiteSpace: 'normal', textAlign: 'left' }}>
        <DetailView entity={entity} raw={raw} db={db} capImage hideHeader />
      </div>
    ),
    dismissable: true,
    showClose: true,
    actions: [],
    maxWidth: 560,
  });
}
