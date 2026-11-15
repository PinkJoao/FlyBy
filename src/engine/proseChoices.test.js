// =============================================================================
// proseChoices.test: as escolhas que a prosa pede e o builder passou a guardar
// =============================================================================
// O QUE FAZ
//   Prova as cinco escolhas do TC-0128 com dados mínimos no formato do 5etools: os
//   planos do Replicate Magic Item (quantos, e quais itens cada linha aceita), o Animal Enhancement
//   (a opção do nível 5 sem a do 1), o cantrip do Giant Power (com o atributo do grupo),
//   o idioma do Giant Power e do Draconic Disciple, e a perícia ou ferramenta do Khoravar.
//
// FUNÇÕES
//   table(level, rows): uma tabela "Magic Item Plans (Artificer Level N+)".
//   artificerDb(): o db mínimo do Artificer do EFA.
//
// DECISÕES E ARMADILHAS
//   - Dados à mão, como o formato real: o sweep e o survey-builder-choices provam o
//     dado inteiro; aqui fica a regra.
// -----------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { planChoices, planAllows, subclassFeatureChoices } from './classFeatureChoices';
import { speciesOptionChoices, speciesCatalog } from './speciesData';
import { curatedAdditionalSpells } from './grantedSpellUses';
import { parseChoices } from './choices';

const table = (level, rows) => ({ type: 'table', caption: `Magic Item Plans (Artificer Level ${level}+)`, colLabels: ['Magic Item Plan', 'Attunement'], rows });
const artificerDb = () => ({
  items: { itemGroup: [{ name: 'Armor of Resistance', source: 'XDMG', items: ['Armor of Acid Resistance|XDMG'] }] },
  'class-artificer': {
    classFeature: [{
      name: 'Replicate Magic Item', source: 'EFA', classSource: 'EFA', level: 2,
      entries: [{ type: 'entries', entries: [
        table(2, [['{@item Bag of Holding|XDMG}', 'No'], ["{@filter Common magic item that isn't a Potion, a Scroll, or cursed|items|source=|type=!potion;!scroll|rarity=common|category=|miscellaneous=!cursed}*", 'Varies']]),
        table(6, [['{@item +1 Armor|XDMG|Armor +1}', 'No'], ['{@item Armor of Resistance|XDMG}', 'Yes']]),
      ] }],
    }],
  },
});
const ARTIFICER = { name: 'Artificer', source: 'EFA', classTableGroups: [{ colLabels: ['Plans Known'], rows: [['-'], [4], [4], [4], [4], [5]] }] };
const ITEMS = {
  bag: { name: 'Bag of Holding', source: 'XDMG', rarity: 'uncommon', wondrous: true },
  cloak: { name: 'Cloak of Billowing', source: 'XDMG', rarity: 'common', wondrous: true },
  potion: { name: 'Potion of Climbing', source: 'XDMG', rarity: 'common', type: 'P|XPHB' },
  scroll: { name: 'Spell Scroll (Cantrip)', source: 'XDMG', rarity: 'common', type: 'SC|XPHB' },
  cursed: { name: 'Cursed Trinket', source: 'XDMG', rarity: 'common', wondrous: true, curse: true },
  chain: { name: '+1 Chain Mail', source: 'XDMG', rarity: 'uncommon', _variantName: '+1 Armor' },
  acid: { name: 'Acid Chain Mail', source: 'XDMG', rarity: 'rare', _variantName: 'Armor of Acid Resistance' },
};

describe('os planos do Replicate Magic Item', () => {
  it('nada antes do nível 2; no 2, quatro planos de itens concretos', () => {
    expect(planChoices(artificerDb(), 'artificer', ARTIFICER, 1)).toEqual([]);
    const [ch] = planChoices(artificerDb(), 'artificer', ARTIFICER, 2);
    expect(ch).toMatchObject({ id: 'plan@replicate magic item@2', kind: 'plan', count: 4, pool: { type: 'plan' } });
    expect(planAllows(ch.pool, ITEMS.bag)).toBe(true);
    expect(planAllows(ch.pool, ITEMS.chain)).toBe(false);
  });

  it('a linha-filtro aceita qualquer item comum que não seja poção, pergaminho ou amaldiçoado', () => {
    const [ch] = planChoices(artificerDb(), 'artificer', ARTIFICER, 2);
    expect(planAllows(ch.pool, ITEMS.cloak)).toBe(true);
    expect(planAllows(ch.pool, ITEMS.potion)).toBe(false);
    expect(planAllows(ch.pool, ITEMS.scroll)).toBe(false);
    expect(planAllows(ch.pool, ITEMS.cursed)).toBe(false);
  });

  it('no 6, cinco planos: a variante gerada do genérico e o membro do grupo de itens', () => {
    const [ch] = planChoices(artificerDb(), 'artificer', ARTIFICER, 6);
    expect(ch.count).toBe(5);
    expect(planAllows(ch.pool, ITEMS.chain)).toBe(true);
    expect(planAllows(ch.pool, ITEMS.acid)).toBe(true);
  });

  it('outro Artificer (o do TCE) não ganha planos', () => {
    expect(planChoices(artificerDb(), 'artificer', { ...ARTIFICER, source: 'TCE' }, 6)).toEqual([]);
  });
});

describe('o Animal Enhancement do Simic Hybrid', () => {
  const simic = {
    name: 'Simic Hybrid', source: 'GGR',
    entries: [{ type: 'entries', name: 'Animal Enhancement', entries: [
      'At 1st level, choose one of the following options:',
      { type: 'list', items: [{ type: 'item', name: 'Manta Glide', entry: 'a' }, { type: 'item', name: 'Nimble Climber', entry: 'b' }] },
      'At 5th level, choose one of the options you did not take, or:',
      { type: 'list', items: [{ type: 'item', name: 'Carapace', entry: 'c' }] },
    ] }],
  };

  it('uma opção no 1 e outra no 5, sem repetir a do 1', () => {
    expect(speciesOptionChoices(simic, 1).map((c) => c.id)).toEqual(['featopt@Animal Enhancement@1']);
    const bag = { 'featopt@Animal Enhancement@1': { kind: 'featureoption', picks: ['Nimble Climber'] } };
    const [, five] = speciesOptionChoices(simic, 5, bag);
    expect(five.pool.options.map((o) => o.value)).toEqual(['Manta Glide', 'Carapace']);
    expect(five.pool.excludeFrom).toEqual(['featopt@Animal Enhancement@1']);
  });

  it('espécie sem registro não ganha nada', () => {
    expect(speciesOptionChoices({ name: 'Elf', source: 'XPHB', entries: [] }, 5)).toEqual([]);
  });
});

describe('Giant Power, Draconic Disciple e Khoravar', () => {
  it('o cantrip do Giant Power: a escolha do dado (dois grupos) ganha SAB nos dois, sem repetir', () => {
    const additionalSpells = [{ innate: { 3: ['druidcraft#c'] } }, { innate: { 3: ['thaumaturgy#c'] } }];
    const groups = curatedAdditionalSpells({ name: 'Path of the Giant', source: 'BGG', additionalSpells });
    expect(groups.map((g) => g.ability)).toEqual(['wis', 'wis']);
    expect(groups.map((g) => g.innate)).toEqual(additionalSpells.map((g) => g.innate));
  });

  it('o idioma do Giant Power e do Draconic Disciple é escolha livre', () => {
    const feature = (name, shortName, source) => ({ name, source, className: 'X', classSource: 'PHB', subclassShortName: shortName, subclassSource: source, level: 3, entries: [] });
    const db = { 'class-barbarian': { subclassFeature: [feature('Giant Power', 'Giant', 'BGG')] }, 'class-monk': { subclassFeature: [feature('Draconic Disciple', 'Ascendant Dragon', 'FTD')] } };
    const giant = subclassFeatureChoices(db, 'barbarian', { shortName: 'Giant', source: 'BGG', subclassFeatures: ['Giant Power|Barbarian||Giant|BGG|3'] }, 3);
    const monk = subclassFeatureChoices(db, 'monk', { shortName: 'Ascendant Dragon', source: 'FTD', subclassFeatures: ['Draconic Disciple|Monk||Ascendant Dragon|FTD|3'] }, 3);
    expect(giant.find((c) => c.kind === 'language')?.label).toMatch(/Giant/);
    expect(monk.find((c) => c.kind === 'language')?.label).toMatch(/Draconic/);
  });

  it('o Khoravar ganha a escolha de uma perícia ou ferramenta', () => {
    const [khoravar] = speciesCatalog({ races: { race: [{ name: 'Khoravar', source: 'EFA', entries: [] }] } });
    const mixed = parseChoices(khoravar, { level: 1 }).find((c) => c.kind === 'mixed');
    expect(mixed).toMatchObject({ count: 1, pool: { type: 'any', of: ['skill', 'tool'] } });
  });
});
