// =============================================================================
// unassignedSpells: dar origem ou descartar uma magia do balde de carga
// =============================================================================
// O QUE FAZ
//   `character.unassignedSpells` guarda o que um ator importado trazia e nenhuma
//   classe conjura (DDL-0084). Lá a magia é CARGA: o re-export a devolve ao
//   Foundry, mas ela não conta em limite nenhum. Estas duas operações são a única
//   saída do balde, PURAS (recebem o personagem, devolvem um novo); a regra é de
//   modelo, e assim tem teste.
//
// FUNÇÕES
//   withoutAt(refs, index): o balde sem a posição `index`.
//   assignCargoSpell(character, uid, index): a magia vira escolha da classe `uid`
//     e passa a contar.
//   discardCargoSpell(character, index): descarta (quem chama confirma).
//
// DECISÕES E ARMADILHAS
//   - Tudo por ÍNDICE, nunca por nome e fonte: o balde pode ter a MESMA magia duas
//     vezes (a Riswynn L17 traz duas Magic Missile), e um filtro por valor tiraria
//     as duas.
//   - Atribuir muda os dois campos JUNTOS, num só objeto: dois saves em sequência
//     partiriam do mesmo personagem e a magia sumiria ou duplicaria.
//   - Índice ou classe inexistente devolve o mesmo personagem.
// -----------------------------------------------------------------------------

/** O balde sem a entrada da posição `index`. */
function withoutAt(refs, index) {
  return (refs ?? []).filter((_, i) => i !== index);
}

/**
 * Move a magia do balde para as escolhas da classe `uid`.
 * @param {object} character
 * @param {string} uid
 * @param {number} index
 * @returns {object}
 */
export function assignCargoSpell(character, uid, index) {
  const ref = (character.unassignedSpells ?? [])[index];
  if (!ref) return character;
  if (!(character.classes ?? []).some((c) => c.uid === uid)) return character;
  return {
    ...character,
    unassignedSpells: withoutAt(character.unassignedSpells, index),
    classes: character.classes.map((c) => (
      c.uid === uid ? { ...c, spells: [...(c.spells ?? []), { id: ref.id, source: ref.source }] } : c
    )),
  };
}

/**
 * Descarta a magia da posição `index`.
 * @param {object} character
 * @param {number} index
 * @returns {object}
 */
export function discardCargoSpell(character, index) {
  if (!(character.unassignedSpells ?? [])[index]) return character;
  return { ...character, unassignedSpells: withoutAt(character.unassignedSpells, index) };
}
