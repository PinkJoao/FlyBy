// =============================================================================
// installHint: o aviso de instalação para quem está no Samsung Internet
// =============================================================================
// O QUE FAZ
//   Detecta o Samsung Internet e monta o link que reabre a página atual no
//   Chrome. A Home mostra um aviso dispensável com esse link.
//
// FUNÇÕES
//   isSamsungInternet(ua): o user agent é do Samsung Internet.
//   isStandalone(): o app já roda instalado (janela própria, sem barra).
//   chromeIntentUrl(loc): um `intent://` do Android que abre `loc` no Chrome,
//     com caminho e query (o `?fonte=` do link da mesa sobrevive).
//
// DECISÕES E ARMADILHAS
//   - Por que existe: o "Instalar" do Samsung Internet gera um WebAPK no servidor
//     DA SAMSUNG, com targetSdk antigo, e o Play Protect o bloqueia ("criado para
//     uma versão mais antiga do Android"). Nada no manifesto muda isso; o WebAPK
//     do Chrome é gerado pelo Google com targetSdk atual. Por isso o caminho é
//     mandar para o Chrome, não mexer no manifesto (DDL-0095).
//   - Só o Samsung Internet: Firefox, Edge, Opera e Brave não geram WebAPK, criam
//     um atalho na tela inicial, que o Play Protect não examina. Estender o aviso
//     a eles alertaria contra um bloqueio que não acontece.
//   - O WebAPK do Samsung Internet também anuncia `SamsungBrowser`: sem o teste de
//     isStandalone, o aviso apareceria dentro do app já instalado.
//   - Sem Chrome no aparelho, o Android trata o `intent://` como pacote ausente e
//     oferece a loja; não há fallback melhor que valha a complexidade.
// -----------------------------------------------------------------------------

/** O user agent é do Samsung Internet (o Chrome de um Samsung não conta). */
export function isSamsungInternet(ua) {
  return /SamsungBrowser\//.test(ua ?? '');
}

/** O app já roda instalado, em janela própria. */
export function isStandalone() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

/** O `intent://` que reabre `loc` (um Location ou URL) no Chrome do Android. */
export function chromeIntentUrl(loc) {
  return `intent://${loc.host}${loc.pathname}${loc.search}#Intent;scheme=https;package=com.android.chrome;end`;
}
