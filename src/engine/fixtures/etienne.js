// =============================================================================
// Fixture: Étienne Corbeau - Fighter 6 (PHB 2024)
// =============================================================================
// Reconstrói, em forma de DECISÕES do builder, a ficha real exportada do
// Foundry (D&D/Mestre/Jogadores/etienne.json). Serve de gabarito para validar
// o engine contra números-verdade reais.
//
// Verdade do Foundry:
//   scores finais: str15(save) dex20 con14(save) int13 wis10 cha8
//   HP: 59  ·  Fighter 6, dado d10
//   hitPoints (rolagens): {1:max,2:4,3:10,4:4,5:10,6:9}
//   bônus de proficiência (nível 6): +3
//
// Decomposição base+boost (escolha da fixture, soma bate com os finais):
//   origem custom 2024 dá +2 DEX, +1 CON; ASIs do Fighter (níveis 4 e 6) foram
//   tomados como talentos, sem mexer em atributos.
// -----------------------------------------------------------------------------

import { createCharacter, createClassEntry } from '../../schema/character';

export function etienneFixture() {
  const base = createCharacter({ name: 'Étienne Corbeau', subclassLevel: 3 });

  base.scores = { str: 15, dex: 18, con: 13, int: 13, wis: 10, cha: 8 };
  base.scoreMethod = { type: 'manual' };

  // Espécie: Elfo (XPHB). No 2024 o elfo ESCOLHE 1 perícia entre
  // insight/perception/survival - Étienne escolheu Perception (prc).
  // choice-bag genérico: a escolha de perícia da espécie (Perception).
  base.species = {
    id: 'elf',
    source: 'XPHB',
    choices: { 'skill-0': { kind: 'skill', picks: ['prc'] } },
  };

  base.origin = {
    abilityBoosts: [
      { ability: 'dex', amount: 2 },
      { ability: 'con', amount: 1 },
    ],
    originFeat: { id: 'savage-attacker', source: 'XPHB', subtype: 'origin', choices: {} },
    skillProficiencies: ['ath', 'itm'], // Soldier-equivalente
    toolProficiencies: ['game:dice'],
    languages: ['common', 'elvish'],
  };

  const fighter = createClassEntry(true);
  fighter.classId = 'fighter';
  fighter.source = 'XPHB';
  fighter.level = 6;
  fighter.hitPoints = { 1: 'max', 2: 4, 3: 10, 4: 4, 5: 10, 6: 9 };
  // choice-bag: perícias de Fighter (nível 1).
  fighter.choices = { skill: { kind: 'skill', picks: ['acr', 'his'] } };
  base.classes = [fighter];

  return base;
}

/** Contexto que o expander (Fase 3b) preencherá a partir do compêndio. */
export const etienneContext = {
  hitDieMax: { fighter: 10 },
  proficientSaves: ['str', 'con'], // saves do Fighter
};
