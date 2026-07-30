// =============================================================================
// unassignedSpells - dar ORIGEM (ou descartar) uma magia do balde de CARGA
// =============================================================================
// `character.unassignedSpells` guarda o que um ator importado trazia e nenhuma
// classe da ficha sabe conjurar (ver o schema). Enquanto está lá, a magia é
// CARGA: o re-export a devolve ao Foundry, mas ela não conta em limite nenhum
// porque não tem origem.
//
// Estas duas operações são a única saída do balde, e as duas são PURAS: recebem
// o personagem e devolvem um novo. Ficam aqui, e não no componente, por dois
// motivos - a regra é de modelo (o que é decisão x o que é carga), e assim ela
// tem teste.
//
// **Tudo opera por ÍNDICE, nunca casando por nome+fonte.** O balde pode conter a
// MESMA magia duas vezes (a ficha premade da Riswynn L17 traz duas Magic
// Missile), então um filtro por valor removeria as duas cópias de uma vez e o
// jogador perderia conteúdo ao atribuir só uma.
// -----------------------------------------------------------------------------

/** O balde sem a entrada da posição `index` (as outras cópias iguais ficam). */
function withoutAt(refs, index) {
  return (refs ?? []).filter((_, i) => i !== index);
}

/**
 * Move a magia da posição `index` do balde para as escolhas da classe `uid`.
 * A partir daí ela é uma DECISÃO como qualquer outra: conta contra os limites da
 * classe, deriva DC e estado de preparação.
 *
 * Os dois campos mudam JUNTOS, num só objeto - se fossem dois saves em sequência
 * o segundo sobrescreveria o primeiro (cada save parte do mesmo personagem) e a
 * magia sumiria ou duplicaria.
 *
 * @param {object} character
 * @param {string} uid    uid da ClassEntry que passa a ser a origem
 * @param {number} index  posição no balde
 * @returns {object} novo personagem (o mesmo, se o índice ou a classe não existem)
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
 * Descarta a magia da posição `index`. É a única forma de esvaziar o balde sem
 * dar origem, e ela deixa de voltar ao Foundry no re-export - por isso quem
 * chama confirma antes.
 * @param {object} character
 * @param {number} index
 * @returns {object} novo personagem (o mesmo, se o índice não existe)
 */
export function discardCargoSpell(character, index) {
  if (!(character.unassignedSpells ?? [])[index]) return character;
  return { ...character, unassignedSpells: withoutAt(character.unassignedSpells, index) };
}
