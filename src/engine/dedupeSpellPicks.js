// =============================================================================
// dedupeSpellPicks: a mesma magia escolhida duas vezes na mesma classe
// =============================================================================
// O QUE FAZ
//   Um ator EXTERNO pode listar a mesma magia duas vezes (o premade da Sefris,
//   Warlock 11, traz Hex e Hideous Laughter repetidas), e o contador de preparadas
//   somava as duas. Preparar a mesma magia duas vezes não faz NADA pelo jogador: é
//   a mesma decisão escrita duas vezes. Por isso a dedup é o padrão (TC-0089,
//   decisão do usuário; DDL-0087).
//
// FUNÇÕES
//   refKey(ref): nome e livro, sem caixa.
//   dedupeSpellPicks(spells): as escolhas de UMA classe sem repetição.
//   dedupeCharacterSpellPicks(character): o mesmo em todas as classes.
//
// DECISÕES E ARMADILHAS
//   - O escopo é estreito DE PROPÓSITO. Uma magia CONCEDIDA pode ter pool de usos
//     próprio, e vir de mais de uma fonte (levantamento em
//     scripts/survey-granted-spells.js: 188 concessões com uso próprio): o Hunter's
//     Mark do Ranger (sempre preparada e os usos do Favored Enemy), o Misty Step do
//     Archfey (QUATRO fontes), o Contact Other Plane (DDL-0086). Colapsar uma delas
//     perderia um pool. Elas estão a salvo por construção: concessão NÃO mora em
//     `ClassEntry.spells`, então esta função só vê ESCOLHAS. Quem mudar isso de
//     lugar relê este cabeçalho.
//   - Sobrevive a PRIMEIRA cópia, com o `prepared` do mais capaz: se alguma cópia
//     estava preparada, a sobrevivente fica preparada.
//   - Devolve a MESMA referência quando nada muda (o import não cria lixo).
// -----------------------------------------------------------------------------

/** A chave de identidade de uma escolha: nome e livro, sem caixa. */
const refKey = (ref) =>
  `${String(ref?.id ?? ref?.name ?? '').toLowerCase()}|${String(ref?.source ?? '').toLowerCase()}`;

/**
 * Remove escolhas repetidas de uma classe, preservando a ordem.
 * @param {Array<{id?:string, name?:string, source?:string, prepared?:boolean}>} spells
 * @returns {Array}
 */
export function dedupeSpellPicks(spells) {
  if (!Array.isArray(spells) || spells.length < 2) return spells ?? [];
  const byKey = new Map();
  let dupes = 0;
  for (const ref of spells) {
    const k = refKey(ref);
    const seen = byKey.get(k);
    if (!seen) {
      byKey.set(k, { ...ref });
      continue;
    }
    dupes++;
    if (seen.prepared === false && ref.prepared !== false) delete seen.prepared;
  }
  if (dupes === 0) return spells;
  return [...byKey.values()];
}

/**
 * Aplica a dedup a todas as classes (o mesmo objeto se nada muda).
 * @param {object} character
 * @returns {object}
 */
export function dedupeCharacterSpellPicks(character) {
  const classes = character?.classes ?? [];
  let changed = false;
  const next = classes.map((c) => {
    const spells = dedupeSpellPicks(c.spells);
    if (spells === c.spells) return c;
    changed = true;
    return { ...c, spells };
  });
  return changed ? { ...character, classes: next } : character;
}
