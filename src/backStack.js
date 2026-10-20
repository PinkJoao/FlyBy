// =============================================================================
// backStack: o voltar do celular fecha a camada de cima, não a página
// =============================================================================
// O QUE FAZ
//   Toda camada que abre por cima (diálogo, menu, seletor, gaveta, preview,
//   imagem, passo do guia) empilha uma entrada no histórico do navegador, na
//   MESMA URL, marcada com um número (`flybyLayer`). O voltar do aparelho (gesto,
//   botão ou o voltar do navegador) tira essa entrada; o popstate então fecha as
//   camadas vivas acima da entrada em que o histórico parou. As hooks de React
//   (hooks/useBack.js) usam o singleton `backStack`.
//
// FUNÇÕES
//   createBackStack(win): a pilha ligada a uma janela (o app usa a real; os
//     testes, uma falsa). Devolve push(onBack), release(id), popRoute(then),
//     liveCount() e dispose().
//   backStack: a pilha do app, na `window` (null fora do navegador).
//
// DECISÕES E ARMADILHAS
//   - Fechar pela INTERFACE (o X, clicar fora) não mexe no histórico: só tira a
//     camada das vivas, e a entrada dela fica para trás, "gasta". Um voltar que
//     para numa entrada gasta pula sozinho para a de baixo. A alternativa,
//     chamar history.back() ao fechar, é assíncrona e corre contra o que vem
//     logo depois: um submenu que fecha e abre outro diálogo veria o voltar
//     atrasado fechar o diálogo novo, e um menu que fecha e navega perderia a
//     navegação.
//   - Pular entradas gastas nunca muda de página: toda entrada de camada repete
//     a URL da entrada sobre a qual foi empilhada.
//   - Os números crescem a partir de Date.now() em microssegundos (x 1000):
//     depois de recarregar, as entradas gastas de antes ficam com números
//     MENORES que qualquer camada nova. Contando do zero, uma camada nova ficaria
//     abaixo de uma gasta antiga e o voltar não a fecharia.
//   - Avançar (o "forward" do navegador) para uma entrada gasta não pula: só o
//     voltar pula, e o sentido vem de comparar com a entrada atual.
//   - O estado empilhado copia o do React Router (`key`, `idx`, `usr`), que
//     então vê a mesma rota e não remonta nada.
//   - popRoute: sair de uma página pelo botão do app (o fechar do guia, o
//     voltar da ficha) DESEMPILHA em vez de empilhar a página de destino; empilhando, o voltar do
//     celular reabriria a página que acabou de fechar. Ele volta até o `idx` do
//     router ficar menor que o de partida (as camadas da página repetem o idx
//     dela), pula as entradas gastas da página de baixo e só então chama `then`.
//     ATENÇÃO ao `idx`: é detalhe interno do createBrowserHistory do React Router
//     (v6 e v7); sem ele, quem chama (useLeaveTo) navega por substituição.
// -----------------------------------------------------------------------------

const KEY = 'flybyLayer';

/**
 * A pilha de camadas sobre o histórico de uma janela.
 * @param {Window} win
 */
export function createBackStack(win) {
  let seq = Date.now() * 1000;
  let current = win.history.state?.[KEY] ?? 0;
  const live = new Map();
  let leaving = null;
  let settled = null;

  const onPop = () => {
    const state = win.history.state;
    const target = state?.[KEY] ?? 0;
    const forward = !leaving && target > current;
    current = target;
    if (forward) return;
    const closing = [...live.keys()].filter((id) => id > target).sort((a, b) => b - a);
    for (const id of closing) {
      const onBack = live.get(id);
      live.delete(id);
      onBack?.();
    }
    if (leaving && (state?.idx ?? 0) >= leaving.from) {
      win.history.back();
      return;
    }
    if (leaving) {
      settled = leaving.then;
      leaving = null;
    }
    if (target && !live.has(target)) {
      win.history.back();
      return;
    }
    if (settled) {
      const then = settled;
      settled = null;
      then();
    }
  };

  win.addEventListener('popstate', onPop);

  return {
    /** Empilha uma camada; `onBack` roda quando o voltar a fecha. Devolve o id. */
    push(onBack) {
      seq = Math.max(seq + 1, Date.now() * 1000);
      const id = seq;
      live.set(id, onBack);
      win.history.pushState({ ...(win.history.state ?? {}), [KEY]: id }, '');
      current = id;
      return id;
    },
    /** A camada fechou pela interface (ou desmontou): sai das vivas, sem tocar no histórico. */
    release(id) {
      live.delete(id);
    },
    /** Volta até a rota ANTERIOR (passa as camadas desta); `then` roda ao parar. */
    popRoute(then) {
      leaving = { from: win.history.state?.idx ?? 0, then };
      win.history.back();
    },
    liveCount: () => live.size,
    dispose: () => win.removeEventListener('popstate', onPop),
  };
}

export const backStack = typeof window !== 'undefined' && window.history ? createBackStack(window) : null;
