// =============================================================================
// speciesChoiceGroups.test: cada escolha da espécie com o traço que a explica
// =============================================================================
// O QUE FAZ
//   Sobre o pacote SRD embutido: o Humano (tamanho sem traço, Skillful, Versatile) e o
//   Elfo Drow (Keen Senses na perícia, a linhagem com o atributo e a lista de magias).
//
// FUNÇÕES
//   groupsOf(id, lineage): os grupos de uma espécie do SRD (com a linhagem, se dada).
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import bundle from '../../data/srdBundle.json';
import { resolveRaceObj } from '../../engine/resolve';
import { lineageSelectorLabel, speciesChoices } from '../../engine/speciesData';
import { lineageTrait, speciesChoiceGroups } from './speciesChoiceGroups';

const groupsOf = (id, lineage = null) => {
  const base = resolveRaceObj(bundle, id, 'XPHB');
  const obj = resolveRaceObj(bundle, id, 'XPHB', lineage);
  const choices = speciesChoices({ db: bundle, baseRace: base, raceObj: obj, lineage, level: 1, bag: {} });
  const label = lineageSelectorLabel(base);
  return { groups: speciesChoiceGroups(obj, choices, label), obj, label };
};

describe('speciesChoiceGroups', () => {
  it('Humano: tamanho sem traço, a perícia no Skillful, o talento no Versatile', () => {
    const { groups } = groupsOf('human');
    expect(groups.map((g) => [g.key, g.choices.map((c) => c.kind)])).toEqual([
      ['size', ['size']],
      ['trait:Skillful', ['skill']],
      ['trait:Versatile', ['feat']],
    ]);
  });

  it('Elfo Drow: a perícia no Keen Senses, a conjuração na linhagem', () => {
    const { groups, obj, label } = groupsOf('elf', 'Drow');
    const skill = groups.find((g) => g.choices.some((c) => c.kind === 'skill'));
    expect(skill.entry.name).toBe('Keen Senses');
    const lineage = groups.find((g) => g.lineage);
    expect(lineage.choices.map((c) => c.kind)).toEqual(expect.arrayContaining(['spellAbility']));
    expect(lineageTrait(obj, label)?.name).toBe(label);
  });
});
