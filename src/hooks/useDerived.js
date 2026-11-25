// =============================================================================
// useDerived: a derivação ao vivo do personagem na UI
// =============================================================================
// O QUE FAZ
//   Lê o compêndio do contexto de dados e roda o engine (puro) sobre o
//   personagem, memoizado por (character, db) para não re-derivar à toa. É por
//   aqui que o engine entra no bundle de produção.
//
// FUNÇÕES
//   useDerived(character): deriveFromDb(character, db), a entrada única do engine.
// -----------------------------------------------------------------------------

import { useMemo } from 'react';
import { useData } from '../data/dataContext';
import { deriveFromDb } from '../engine/resolve';

/**
 * @param {import('../schema/character').Character} character
 * @returns {ReturnType<import('../engine/index').deriveCharacter>}
 */
export default function useDerived(character) {
  const { db } = useData();
  return useMemo(() => deriveFromDb(character, db), [character, db]);
}
