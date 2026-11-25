// =============================================================================
// etienne: a ficha real do Étienne Corbeau (Fighter 6, PHB 2024) como fixture
// =============================================================================
// O QUE FAZ
//   Reconstrói em DECISÕES do builder uma ficha real exportada do Foundry, como
//   gabarito de números-verdade para o engine.
//     Scores finais: str 15 (save), dex 20, con 14 (save), int 13, wis 10, cha 8.
//     HP 59, Fighter 6 com d10; rolagens {1:max, 2:4, 3:10, 4:4, 5:10, 6:9}.
//     Bônus de proficiência +3.
//   A decomposição base mais boost é escolha da fixture: a origem 2024 dá +2 DEX
//   e +1 CON, e os ASIs do Fighter (4 e 6) viraram talentos. Espécie Elfo XPHB,
//   que escolhe uma perícia (Perception).
//
// FUNÇÕES
//   etienneFixture(): o personagem. etienneContext traz os saves do Fighter.
// -----------------------------------------------------------------------------

import { createCharacter, createClassEntry } from '../../schema/character';

export function etienneFixture() {
  const base = createCharacter({ name: 'Étienne Corbeau', subclassLevel: 3 });

  base.scores = { str: 15, dex: 18, con: 13, int: 13, wis: 10, cha: 8 };
  base.scoreMethod = { type: 'manual' };

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
    skillProficiencies: ['ath', 'itm'],
    toolProficiencies: ['game:dice'],
    languages: ['common', 'elvish'],
  };

  const fighter = createClassEntry(true);
  fighter.classId = 'fighter';
  fighter.source = 'XPHB';
  fighter.level = 6;
  fighter.hitPoints = { 1: 'max', 2: 4, 3: 10, 4: 4, 5: 10, 6: 9 };
  fighter.choices = { skill: { kind: 'skill', picks: ['acr', 'his'] } };
  base.classes = [fighter];

  return base;
}

export const etienneContext = {
  hitDieMax: { fighter: 10 },
  proficientSaves: ['str', 'con'],
};
