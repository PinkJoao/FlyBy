// =============================================================================
// srdRoundtrip.test: o round-trip Foundry sobre o pacote SRD embutido
// =============================================================================
// O QUE FAZ
//   Usa o pacote SRD COMMITADO (src/data/srdBundle.json), então roda em qualquer
//   máquina, sem o snapshot git-ignored. Cobre o TC-0091: a magia que o Mago
//   escolhe para o grimório e que o Evocation Savant também concede saía do
//   export como uma concessão só, e o import descartava a escolha. As sementes
//   são as que reproduziam a perda antes do fix (1 a 6 do Evoker).
//
// DECISÕES E ARMADILHAS
//   - O teste exige que a COLISÃO aconteça em ao menos uma semente: sem ela, o
//     round-trip passaria por acaso e o teste não provaria nada (§6.1).
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classMatrix, defaultSpecies } from './matrix';
import { autoBuild } from './autoBuild';
import { hashSeed } from './rng';
import { decisionSummary, diffSummaries } from './roundtrip';
import { deriveFromDb } from '../../src/engine/resolve';
import { assembleFoundryActor } from '../../src/engine/foundryActor';
import { foundryToCharacter } from '../../src/engine/foundryImport';
import { importSpellsByClass } from '../../src/engine/foundryImport';

const db = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'data', 'srdBundle.json'), 'utf8'));

describe('TC-0091: escolha de classe que a própria origem concede', () => {
  const row = classMatrix(db).find((r) => r.classId === 'wizard' && r.subclassId === 'Evoker');
  const species = defaultSpecies(db);
  const builds = [1, 2, 3, 4, 5, 6].map((seed) => autoBuild(db, { ...row, level: 20, ...species, seed: hashSeed(row.id, seed) }).character);

  it('a colisão acontece (senão o teste não prova nada)', () => {
    const shadowed = builds.flatMap((c) => deriveFromDb(c, db).spellcasting.origins.flatMap((o) => o.shadowedPicks ?? []));
    expect(shadowed.length).toBeGreaterThan(0);
  });

  it('a escolha sombreada sobrevive ao export e ao import', () => {
    for (const c of builds) {
      const back = foundryToCharacter(assembleFoundryActor(c, db), db);
      expect(diffSummaries(decisionSummary(c), decisionSummary(back))).toEqual([]);
    }
  });

  it('o item sai como concessão nativa, com a marca da escolha', () => {
    const c = builds.find((b) => deriveFromDb(b, db).spellcasting.origins.some((o) => o.shadowedPicks?.length));
    const items = assembleFoundryActor(c, db).items.filter((i) => i.flags?.builder5e?.classPick);
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) expect(it.system.prepared).toBe(2);
  });
});

describe('importSpellsByClass com a marca classPick', () => {
  it('devolve a ref à classe, mantendo o "não preparada"', () => {
    const item = {
      type: 'spell',
      name: 'Burning Hands',
      system: { method: 'spell', prepared: 2, level: 1, sourceItem: 'class:wizard', source: { book: 'XPHB' } },
      flags: { builder5e: { classPick: { id: 'Burning Hands', source: 'XPHB', prepared: false } } },
    };
    expect(importSpellsByClass([item]).get('wizard')).toEqual([{ id: 'Burning Hands', source: 'XPHB', prepared: false }]);
  });

  it('sem a marca, prepared 2 continua sendo concessão', () => {
    const item = { type: 'spell', name: 'Bless', system: { method: 'spell', prepared: 2, level: 1, sourceItem: 'class:cleric' }, flags: {} };
    expect(importSpellsByClass([item]).get('cleric')).toBeUndefined();
  });
});
