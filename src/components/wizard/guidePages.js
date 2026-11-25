// =============================================================================
// guidePages: as páginas de uma etapa do guia e o botão principal do rodapé
// =============================================================================
// O QUE FAZ
//   Uma etapa do guia pode ter várias PÁGINAS (DDL-0289): em geral a primeira é o
//   texto que explica a etapa e a segunda a escolha. O Wizard guarda a página atual e
//   o rodapé anda por elas (Next vai à próxima página antes da próxima etapa; Back
//   volta uma página). A etapa também pode trocar o rótulo e a ação do botão
//   principal do rodapé ("Choose Fighter"), para não haver um botão de escolher e
//   outro de avançar.
//
// FUNÇÕES
//   GuideContext: o contexto que o Wizard fornece.
//   useGuidePage(count): registra quantas páginas a etapa tem e devolve a atual (fora
//     do guia, a última: só a escolha, sem a introdução).
//   useGuidePrimary(label, onClick): troca o botão principal do rodapé enquanto
//     `label` não for nulo.
//   useGuideNav(): `next({ force })` (próxima página ou etapa; `force` ignora a trava de
//     escolha que falta, para quem acabou de escolher) e `page(n)` (vai a uma página).
//
// DECISÕES E ARMADILHAS
//   - A etapa calcula a própria página com o próprio `count` (não espera o registro
//     no Wizard): ao voltar de uma etapa à anterior o Wizard pede a ÚLTIMA página com
//     um número grande, e a etapa o corta sem mostrar a introdução por um instante.
//   - O rótulo do botão principal vai para o estado do Wizard só quando muda; a ação
//     fica numa ref atualizada a cada commit, senão o objeto novo a cada render
//     faria um laço de renderização.
// -----------------------------------------------------------------------------

import { createContext, useContext, useEffect, useRef } from 'react';

export const GuideContext = createContext(null);

/** Registra quantas páginas a etapa tem e devolve a atual. */
export function useGuidePage(count) {
  const ctx = useContext(GuideContext);
  const setPages = ctx?.setPages;
  useEffect(() => {
    setPages?.(count);
  }, [setPages, count]);
  if (!ctx) return count - 1;
  return Math.max(0, Math.min(ctx.page, count - 1));
}

/** Troca o botão principal do rodapé do guia enquanto `label` não for nulo. */
export function useGuidePrimary(label, onClick) {
  const ctx = useContext(GuideContext);
  const setPrimary = ctx?.setPrimary;
  const action = useRef(onClick);
  useEffect(() => {
    action.current = onClick;
  });
  useEffect(() => {
    if (!setPrimary) return undefined;
    setPrimary(label ? { label, run: () => action.current?.() } : null);
    return () => setPrimary(null);
  }, [setPrimary, label]);
}

/** A navegação do guia para a etapa (null fora do guia). */
export function useGuideNav() {
  return useContext(GuideContext)?.nav ?? null;
}
