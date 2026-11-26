// =============================================================================
// entryName.test: a pontuação do nome de um bloco
// =============================================================================
// O QUE FAZ
//   Prova que o ponto final entra só quando o nome não traz pontuação própria.
//
// FUNÇÕES
//   (nenhuma: só os casos)
//
// DECISÕES E ARMADILHAS
//   - Os backgrounds de 2024 terminam o nome com dois-pontos (DDL-0329).
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { withStop } from './entryName';

describe('withStop', () => {
  it('soma o ponto só quando falta', () => {
    expect(withStop('Feat')).toBe('Feat.');
    expect(withStop('Ability Scores:')).toBe('Ability Scores:');
    expect(withStop('Ready? ')).toBe('Ready?');
    expect(withStop('Done.')).toBe('Done.');
  });
});
