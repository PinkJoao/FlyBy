// =============================================================================
// entryName: o nome de um bloco do 5etools com a pontuação certa
// =============================================================================
// O QUE FAZ
//   O título em negrito de um bloco nomeado ("Feat. Magic Initiate") termina com um
//   ponto; o nome que já traz a própria pontuação fica como está.
//
// FUNÇÕES
//   withStop(name): o nome com o ponto final, sem dobrar a pontuação.
//
// DECISÕES E ARMADILHAS
//   - Os backgrounds de 2024 nomeiam os itens com dois-pontos ("Ability Scores:"), e o
//     ponto somado dava "Ability Scores:." no app, no PDF e no texto do Foundry
//     (DDL-0329). Quem desenha um bloco nomeado passa por aqui.
// -----------------------------------------------------------------------------

/** O nome com o ponto final, sem dobrar a pontuação que ele já tem. */
export function withStop(name) {
  const s = String(name ?? '').trimEnd();
  return /[.:!?]$/.test(s) ? s : `${s}.`;
}
