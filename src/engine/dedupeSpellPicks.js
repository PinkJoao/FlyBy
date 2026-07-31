// =============================================================================
// dedupeSpellPicks - a MESMA magia escolhida duas vezes na mesma classe
// =============================================================================
// Um ator EXTERNO pode listar a mesma magia duas vezes: a ficha premade da
// Sefris (Warlock 11) traz `Hex` e `Hideous Laughter` em duplicidade. O import
// carregava as duas copias para `ClassEntry.spells`, e o efeito era um numero
// errado na ficha - o contador de preparadas somava as duas.
//
// Preparar a mesma magia duas vezes nao faz NADA pelo jogador: e a mesma decisao
// escrita duas vezes, nao duas decisoes. Por isso deduplicamos por padrao
// (TC-0089, decisao do usuario).
//
// ---------------------------------------------------------------------------
// O QUE ISTO NAO PODE TOCAR, e por que o escopo e estreito de proposito
// ---------------------------------------------------------------------------
// Uma magia CONCEDIDA por feature pode trazer um pool de usos proprio, e a mesma
// magia pode ser concedida por MAIS DE UMA fonte. O levantamento completo esta
// em `scripts/survey-granted-spells.js` (188 concessoes com uso proprio); os
// casos-limite conhecidos:
//
//   - **Ranger / Hunter's Mark** - a classe a concede sempre-preparada @1 E o
//     Favored Enemy da conjuracoes gratis por descanso longo;
//   - **Archfey Warlock / Misty Step** - QUATRO fontes: o patrono a concede
//     sempre-preparada @3, o mesmo patrono da um pool `daily:cha`, e as features
//     Steps of the Fey @3 e Bewitching Magic @14 dao conjuracao gratis;
//   - **Contact Patron / Contact Other Plane** - concedida pela classe com uso
//     gratis 1/descanso longo que so a prosa declara (DDL-0086).
//
// Colapsar qualquer uma dessas PERDERIA um pool de usos. Elas estao a salvo por
// construcao: concessao NAO mora em `ClassEntry.spells` (o schema diz isso, e a
// derivacao as recria por `additionalSpells` + registros curados). Esta funcao
// so ve as ESCOLHAS do jogador, e por isso so pode remover uma decisao repetida.
// Quem mudar isso de lugar precisa reler este cabecalho.
// -----------------------------------------------------------------------------

/** Chave de identidade de uma escolha de magia: nome + livro, sem caixa. */
const refKey = (ref) =>
  `${String(ref?.id ?? ref?.name ?? '').toLowerCase()}|${String(ref?.source ?? '').toLowerCase()}`;

/**
 * Remove escolhas repetidas de magia de UMA classe, preservando a ordem.
 *
 * A copia que sobrevive e a PRIMEIRA, mas a bandeira `prepared` e unificada pelo
 * mais capaz: se qualquer copia estava preparada, a sobrevivente fica preparada.
 * Sem isso, uma ficha em que a 1a copia estava guardada no grimorio e a 2a
 * preparada perderia a preparacao.
 *
 * @param {Array<{id?:string, name?:string, source?:string, prepared?:boolean}>} spells
 * @returns {Array} nova lista (a mesma referencia quando nao ha o que remover)
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
    // `prepared === false` e a unica forma "menos capaz"; qualquer outra copia
    // (ausente ou true) significa preparada.
    if (seen.prepared === false && ref.prepared !== false) delete seen.prepared;
  }
  if (dupes === 0) return spells;
  return [...byKey.values()];
}

/**
 * Aplica a dedup a todas as classes de um personagem. Devolve o MESMO objeto
 * quando nada muda, para o import nao criar lixo a toa.
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
