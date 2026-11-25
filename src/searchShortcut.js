// =============================================================================
// searchShortcut: "/" põe o cursor na busca da tela (desktop)
// =============================================================================
// O QUE FAZ
//   Liga, uma vez no main.jsx, o atalho de teclado "/" (DDL-0309, U7 do
//   docs/UI-STUDY.md): fora de um campo de texto, ele foca a caixa de busca visível
//   da camada de cima (o seletor aberto, a lista de personagens, o inventário, o
//   grimório) e seleciona o que já estava escrito.
//
// FUNÇÕES
//   isTyping(target): o foco está num campo de texto (aí o "/" é só um caractere)?
//   visibleSearch(): a última caixa de busca visível e fora de uma camada guardada.
//   installSearchShortcut(): liga o atalho (uma vez só).
//
// DECISÕES E ARMADILHAS
//   - A ÚLTIMA busca visível do documento é a da camada de cima: o seletor e as
//     janelas entram por portal no fim do <body>.
//   - Nada acontece com Ctrl, Alt ou Meta (atalhos do navegador) nem sem busca à
//     vista; dentro de `inert` (o topo compacto escondido, a barra de abas do rodapé)
//     a busca não conta.
// -----------------------------------------------------------------------------

let installed = false;

/** O foco está num campo de texto? */
function isTyping(target) {
  return !!target?.closest?.('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
}

/** A última caixa de busca visível, fora de uma camada guardada. */
function visibleSearch() {
  const all = [...document.querySelectorAll('input[type="search"]')].filter(
    (el) => !el.closest('[inert]') && el.getClientRects().length > 0,
  );
  return all[all.length - 1] ?? null;
}

/** Liga o atalho "/" (uma vez só). */
export function installSearchShortcut() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.altKey || e.metaKey || isTyping(e.target)) return;
    const box = visibleSearch();
    if (!box) return;
    e.preventDefault();
    box.focus();
    box.select();
  });
}
