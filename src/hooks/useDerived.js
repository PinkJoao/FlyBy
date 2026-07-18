// =============================================================================
// useDerived - derivação ao vivo do personagem na UI
// =============================================================================
// Lê o compêndio do contexto de dados e roda o engine (puro) sobre o personagem.
// Memoizado por (character, db) para não re-derivar à toa. É o ponto onde o
// engine entra no bundle de produção (Fase 5a).
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
