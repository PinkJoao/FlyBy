import { describe, it, expect } from 'vitest';
import { buildClassItem, buildChoiceTraits, buildFeatureItem, buildFeatItem, buildClassChosenFeats, buildClassTraitValues, buildOriginFeatItem, buildClassFeatureItems, buildClassFutureGrants, buildSubclassFeatureItems, buildSubclassFutureGrants, buildSubclassItem, buildSpeciesItem, buildSpeciesFeatItems, buildBackgroundItem, hitPointsValue, randomFoundryId, fvttProgression, buildItemChoiceAdvancements, buildClassWeaponItems, speciesTraitEntries, buildInventoryItems } from './foundryItems';

// db mínimo de talentos p/ os testes de feat.
const gwm = { name: 'Great Weapon Master', source: 'XPHB', category: 'G', ability: [{ str: 1 }], entries: ['You have mastered heavy weapons.'] };
const alert = { name: 'Alert', source: 'XPHB', category: 'O', entries: ['You are always ready.'] };
const asiFeat = { name: 'Ability Score Improvement', source: 'XPHB', category: 'G', repeatable: true, ability: [{ choose: { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], count: 2 } }] };
const featsDb = { feats: { feat: [gwm, alert, asiFeat] } };

// advancement agora é um OBJETO indexado por _id (formato Foundry) - helper p/ listar.
const advList = (item) => Object.values(item.system.advancement ?? {});

const fighterObj = {
  name: 'Fighter',
  source: 'XPHB',
  hd: { number: 1, faces: 10 },
  proficiency: ['str', 'con'],
  startingProficiencies: {
    armor: ['light', 'medium', 'heavy', 'shield'],
    weapons: ['simple', 'martial'],
    skills: [{ choose: { from: ['acrobatics', 'athletics'], count: 2 } }],
  },
  classFeatures: [
    'Fighting Style|Fighter||1',
    'Weapon Mastery|Fighter||1',
    { classFeature: 'Martial Archetype|Fighter||3', gainSubclassFeature: true },
    'Ability Score Improvement|Fighter||4',
  ],
};

const wizardObj = {
  name: 'Wizard',
  source: 'XPHB',
  hd: { number: 1, faces: 6 },
  proficiency: ['int', 'wis'],
  spellcastingAbility: 'int',
  casterProgression: 'full',
  startingProficiencies: { armor: [], weapons: ['simple'], skills: [{ choose: { from: ['arcana'], count: 2 } }] },
  classFeatures: ['Wizard Subclass|Wizard||3'],
};

describe('randomFoundryId', () => {
  it('gera id de 16 chars alfanuméricos', () => {
    const id = randomFoundryId();
    expect(id).toMatch(/^[A-Za-z0-9]{16}$/);
    expect(randomFoundryId()).not.toBe(id); // praticamente sempre distinto
  });
});

describe('hitPointsValue', () => {
  it('usa rolagens do personagem; default nv1 max, resto avg', () => {
    expect(hitPointsValue({ level: 3, hitPoints: { 1: 'max', 2: 6, 3: 4 } })).toEqual({ 1: 'max', 2: 6, 3: 4 });
    expect(hitPointsValue({ level: 3, hitPoints: {} })).toEqual({ 1: 'max', 2: 'avg', 3: 'avg' });
    expect(hitPointsValue({ level: 1 })).toEqual({ 1: 'max' });
  });
});

describe('buildClassItem', () => {
  const item = buildClassItem({ level: 6, hitPoints: { 1: 'max', 2: 4, 3: 10, 4: 4, 5: 10, 6: 9 } }, fighterObj);

  it('monta um item type class com identifier, levels e hd', () => {
    expect(item.type).toBe('class');
    expect(item.name).toBe('Fighter');
    expect(item.system.identifier).toBe('fighter');
    expect(item.system.levels).toBe(6);
    expect(item.system.hd.denomination).toBe('d10');
    expect(item._id).toMatch(/^[A-Za-z0-9]{16}$/);
  });

  it('inclui o advancement gerado (objeto keyed), cada um com _id', () => {
    const adv = advList(item);
    const types = adv.map((a) => a.type);
    expect(types).toContain('HitPoints');
    expect(types).toContain('Trait');
    expect(types).toContain('AbilityScoreImprovement');
    expect(types).toContain('Subclass');
    expect(adv.every((a) => /^[A-Za-z0-9]{16}$/.test(a._id))).toBe(true);
    // chave do objeto = _id do advancement
    expect(Object.keys(item.system.advancement)).toEqual(adv.map((a) => a._id));
  });

  it('preenche o value do HitPoints com as rolagens do personagem', () => {
    const hp = advList(item).find((a) => a.type === 'HitPoints');
    expect(hp.value).toEqual({ 1: 'max', 2: 4, 3: 10, 4: 4, 5: 10, 6: 9 });
  });

  it('classe conjuradora carrega spellcasting; não-conjuradora fica none', () => {
    const wiz = buildClassItem({ level: 5, hitPoints: {} }, wizardObj);
    expect(wiz.system.spellcasting).toEqual({ progression: 'full', ability: 'int', preparation: { formula: '' } });
    expect(item.system.spellcasting).toEqual({ progression: 'none', ability: '', preparation: { formula: '' } });
  });

  it('objeto de classe nulo → null', () => {
    expect(buildClassItem({ level: 1 }, null)).toBeNull();
  });
});

describe('buildFeatureItem', () => {
  it('monta item type feat / subtype class com identifier e descrição', () => {
    const item = buildFeatureItem({ name: 'Second Wind', level: 1, source: 'XPHB', entries: ['You have a limited well of stamina.'] });
    expect(item.type).toBe('feat');
    expect(item.system.type).toEqual({ value: 'class', subtype: '' });
    expect(item.system.identifier).toBe('second-wind');
    expect(item.system.description.value).toContain('limited well of stamina');
    expect(item.flags.builder5e.level).toBe(1);
    expect(item.effects).toEqual([]); // sem mecânica curada
  });

  it('anexa Active Effect curado (Fast Movement → +10 walk)', () => {
    const item = buildFeatureItem({ name: 'Fast Movement', level: 5, source: 'XPHB', entries: ['+10 speed'] });
    expect(item.effects).toHaveLength(1);
    expect(item.effects[0].changes[0]).toMatchObject({ key: 'system.attributes.movement.walk', mode: 2, value: '10' });
    expect(item.effects[0].transfer).toBe(true);
  });

  it('Channel Divinity (Clérigo) → Turn Undead referencia um Active Effect transfer:false no próprio item', () => {
    const item = buildFeatureItem({ name: 'Channel Divinity', level: 2, source: 'XPHB', entries: ['...'], classId: 'cleric' });
    expect(item.effects).toHaveLength(1);
    const [effect] = item.effects;
    expect(effect).toMatchObject({ name: 'Turn Undead', transfer: false, statuses: ['frightened', 'incapacitated'], duration: { seconds: 60 } });
    const turnUndead = Object.values(item.system.activities).find((a) => a.name === 'Turn Undead');
    expect(turnUndead.effects).toEqual([{ _id: effect._id }]);
  });

  it('Channel Divinity (Paladino) → sem Active Effect (só o clérigo usa Turn Undead)', () => {
    const item = buildFeatureItem({ name: 'Channel Divinity', level: 3, source: 'XPHB', entries: ['...'], classId: 'paladin' });
    expect(item.effects).toEqual([]);
  });
});

describe('parity com o export nativo do Foundry (premades)', () => {
  const fsFeat = { name: 'Great Weapon Fighting', source: 'XPHB', category: 'FS', entries: ['Reroll 1s and 2s.'] };
  const db = {
    feats: { feat: [gwm, alert, asiFeat, fsFeat] },
    'items-base': { baseitem: [
      { name: 'Greatsword', source: 'XPHB', weaponCategory: 'martial' },
      { name: 'Javelin', source: 'XPHB', weaponCategory: 'simple' },
    ] },
  };

  it('Trait de GRANT fixo sai aplicado (value.chosen = grants)', () => {
    const item = buildClassItem({ level: 6, hitPoints: {} }, fighterObj);
    const saves = advList(item).find((a) => a.type === 'Trait' && a.title === 'Saving Throw Proficiencies');
    expect(saves.value).toEqual({ chosen: ['saves:str', 'saves:con'] });
  });

  it('buildClassTraitValues: perícias (código→skills:) e mastery (weapon:cat:slug)', () => {
    const cls = {
      level: 6,
      choices: {
        skill: { kind: 'skill', picks: ['prc', 'sur'] },
        weaponMastery: { kind: 'weapon', picks: ['Greatsword|XPHB', 'Javelin|XPHB'] },
      },
    };
    expect(buildClassTraitValues(cls, db)).toEqual({
      'Skill Proficiencies': ['skills:prc', 'skills:sur'],
      'Weapon Mastery': ['weapon:mar:greatsword', 'weapon:sim:javelin'],
    });
  });

  it('Trait de ESCOLHA recebe value.chosen dos traitValues', () => {
    const item = buildClassItem({ level: 6, hitPoints: {} }, fighterObj, [], {}, {
      traitValues: { 'Skill Proficiencies': ['skills:prc', 'skills:sur'] },
    });
    const skills = advList(item).find((a) => a.type === 'Trait' && a.title === 'Skill Proficiencies');
    expect(skills.value).toEqual({ chosen: ['skills:prc', 'skills:sur'] });
  });

  // Coluna de Weapon Mastery que CRESCE: 3 até o nv3, 4 no nv4 (como a real).
  const fighterGrowing = { ...fighterObj, classTableGroups: [{ colLabels: ['Weapon Mastery'], rows: [[3], [3], [3], [4]] }] };

  it('Weapon Mastery: os escolhidos são FATIADOS entre os Traits de cada breakpoint', () => {
    // Trait de count 3 no nv1 e de +1 no nv4: os 4 picks se dividem 3 + 1, na ordem.
    const item = buildClassItem({ level: 4, hitPoints: {} }, fighterGrowing, [], {}, {
      traitValues: { 'Weapon Mastery': ['weapon:mar:greatsword', 'weapon:sim:javelin', 'weapon:mar:longsword', 'weapon:mar:maul'] },
    });
    const masteries = advList(item).filter((a) => a.type === 'Trait' && a.title === 'Weapon Mastery');
    expect(masteries.map((a) => [a.level, a.value.chosen])).toEqual([
      [1, ['weapon:mar:greatsword', 'weapon:sim:javelin', 'weapon:mar:longsword']],
      [4, ['weapon:mar:maul']],
    ]);
  });

  it('Weapon Mastery: breakpoint acima do nível atual fica sem chosen (pendente no Foundry)', () => {
    const item = buildClassItem({ level: 1, hitPoints: {} }, fighterGrowing, [], {}, {
      traitValues: { 'Weapon Mastery': ['weapon:mar:greatsword', 'weapon:sim:javelin', 'weapon:mar:longsword'] },
    });
    const masteries = advList(item).filter((a) => a.type === 'Trait' && a.title === 'Weapon Mastery');
    expect(masteries.find((a) => a.level === 1).value.chosen).toHaveLength(3);
    expect(masteries.find((a) => a.level === 4).value).toEqual({});
  });

  it('Fighting Style escolhido vira ItemChoice (não ASI) com value.added por nível', () => {
    const cls = { level: 2, choices: { 'feat@1': { kind: 'feat', picks: ['Great Weapon Fighting|XPHB'] } } };
    const { items, asiByLevel, fightingStyles } = buildClassChosenFeats(cls, db);
    expect(items.map((i) => i.name)).toEqual(['Great Weapon Fighting']);
    expect(asiByLevel).toEqual({}); // FS não linka em ASI
    expect(fightingStyles).toEqual([{ itemId: items[0]._id, level: 1 }]);

    const classItem = buildClassItem(cls, fighterObj, [], {}, { fightingStyles });
    const ic = advList(classItem).find((a) => a.type === 'ItemChoice');
    expect(ic.title).toBe('Fighting Style');
    expect(ic.configuration.restriction).toEqual({ type: 'feat', subtype: 'fightingStyle', list: [] });
    expect(ic.value.added).toEqual({ 1: { [items[0]._id]: `.${items[0]._id}` } });
  });

  it('primaryAbility do 5etools ([{str},{dex}] = OU; [{str,cha}] = todas)', () => {
    const fighter = buildClassItem({ level: 1 }, { ...fighterObj, primaryAbility: [{ str: true }, { dex: true }] });
    expect(fighter.system.primaryAbility).toEqual({ value: ['str', 'dex'], all: false });
    const paladin = buildClassItem({ level: 1 }, { ...fighterObj, name: 'Paladin', primaryAbility: [{ str: true, cha: true }] });
    expect(paladin.system.primaryAbility).toEqual({ value: ['str', 'cha'], all: true });
  });

  it('ícones oficiais: classe sempre; subclasse SRD própria, não-SRD herda o da classe', () => {
    expect(buildClassItem({ level: 1 }, fighterObj).img).toBe('systems/dnd5e/icons/classes/fighter.webp');
    expect(buildSubclassItem({ shortName: 'Champion', name: 'Champion', source: 'XPHB' }, 'fighter').img)
      .toBe('systems/dnd5e/icons/classes/champion.webp');
    expect(buildSubclassItem({ shortName: 'Battle Master', name: 'Battle Master', source: 'XPHB' }, 'fighter').img)
      .toBe('systems/dnd5e/icons/classes/fighter.webp');
  });
});

describe('buildFeatItem', () => {
  it('monta feat com subtipo da categoria e descrição', () => {
    const item = buildFeatItem(gwm, { level: 4 });
    expect(item.type).toBe('feat');
    expect(item.system.type).toEqual({ value: 'feat', subtype: 'general' });
    expect(item.system.identifier).toBe('great-weapon-master');
    expect(item.system.description.value).toContain('mastered heavy weapons');
    expect(item.flags.builder5e.level).toBe(4);
  });

  it('embute advancement ASI fixo p/ boost fixo (GWM +1 Str)', () => {
    const asi = advList(buildFeatItem(gwm)).find((a) => a.type === 'AbilityScoreImprovement');
    expect(asi.configuration.fixed).toMatchObject({ str: 1, dex: 0 });
    expect(asi.configuration.points).toBe(1);
    expect(asi.configuration.cap).toBe(1);
    expect(asi.value).toEqual({ type: 'asi' });
  });

  it('feat sem boost fixo não ganha advancement', () => {
    expect(buildFeatItem(alert).system.advancement).toEqual({});
  });

  it('subtipo pode ser forçado (origin)', () => {
    expect(buildFeatItem(alert, { subtype: 'origin' }).system.type.subtype).toBe('origin');
  });

  it('null → null', () => {
    expect(buildFeatItem(null)).toBeNull();
  });
});

describe('buildClassChosenFeats', () => {
  it('talento normal vira item + liga o value do ASI (type feat) no nível', () => {
    const cls = { level: 4, choices: { 'feat@4': { kind: 'feat', picks: ['Great Weapon Master|XPHB'] } } };
    const { items, asiByLevel } = buildClassChosenFeats(cls, featsDb);
    expect(items.map((i) => i.name)).toEqual(['Great Weapon Master']);
    expect(asiByLevel[4]).toEqual({ type: 'feat', feat: { [items[0]._id]: `.${items[0]._id}` } });
  });

  it('ASI cru (Ability Score Improvement) NÃO vira item; value type asi com assignments', () => {
    const cls = {
      level: 4,
      choices: {
        'feat@4': {
          kind: 'feat',
          picks: ['Ability Score Improvement|XPHB'],
          sub: { 'Ability Score Improvement|XPHB': { 'ability-0': { kind: 'ability', alt: 0, picks: [{ ability: 'str', amount: 2 }] } } },
        },
      },
    };
    const { items, asiByLevel } = buildClassChosenFeats(cls, featsDb);
    expect(items).toEqual([]);
    expect(asiByLevel[4]).toEqual({ type: 'asi', assignments: { str: 2 } });
  });

  it('buildClassItem preenche o value do advancement ASI do nível', () => {
    const cls = { level: 4, hitPoints: {}, choices: { 'feat@4': { kind: 'feat', picks: ['Great Weapon Master|XPHB'] } } };
    const { items, asiByLevel } = buildClassChosenFeats(cls, featsDb);
    const classItem = buildClassItem(cls, fighterObj, [], asiByLevel);
    const asi4 = advList(classItem).find((a) => a.type === 'AbilityScoreImprovement' && a.level === 4);
    expect(asi4.value).toEqual({ type: 'feat', feat: { [items[0]._id]: `.${items[0]._id}` } });
  });
});

describe('buildOriginFeatItem + background ItemGrant', () => {
  it('monta o talento de origem (subtipo origin) e liga por ItemGrant no background', () => {
    const character = { origin: { originFeat: { id: 'Alert', source: 'XPHB', choices: {} }, abilityBoosts: [], skillProficiencies: [], choices: {} } };
    const featItem = buildOriginFeatItem(character, featsDb);
    expect(featItem.system.type.subtype).toBe('origin');
    expect(featItem.name).toBe('Alert');
    const bg = buildBackgroundItem(character, featItem);
    const grant = advList(bg).find((a) => a.type === 'ItemGrant');
    expect(grant.configuration.items[0].uuid).toBe(`.${featItem._id}`);
    expect(grant.value.added[featItem._id]).toBe(`.${featItem._id}`);
  });

  it('sem talento de origem → null', () => {
    expect(buildOriginFeatItem({ origin: {} }, featsDb)).toBeNull();
  });
});

describe('buildClassFeatureItems + ItemGrant', () => {
  const db = {
    'class-fighter': {
      classFeature: [
        { name: 'Second Wind', level: 1, source: 'XPHB', entries: ['regain hp'] },
        { name: 'Fast Movement', level: 5, source: 'XPHB', entries: ['+10 speed'] },
      ],
    },
  };
  const classObj = {
    name: 'Fighter', source: 'XPHB', hd: { faces: 10 }, proficiency: ['str', 'con'],
    startingProficiencies: { armor: [], weapons: ['simple'], skills: [{ choose: { from: ['athletics'], count: 2 } }] },
    classFeatures: [
      'Second Wind|Fighter||1',
      { classFeature: 'Martial Archetype|Fighter||3', gainSubclassFeature: true },
      'Ability Score Improvement|Fighter||4',
      'Fast Movement|Fighter||5',
    ],
  };

  it('gera itens só das features reais (exclui ASI e feature de subclasse)', () => {
    const items = buildClassFeatureItems({ level: 5 }, classObj, db);
    expect(items.map((i) => i.name)).toEqual(['Second Wind', 'Fast Movement']);
  });

  it('respeita o nível do personagem', () => {
    expect(buildClassFeatureItems({ level: 1 }, classObj, db).map((i) => i.name)).toEqual(['Second Wind']);
  });

  it('anexa uses de recurso curado (Second Wind → @scale) + dedupa por nome', () => {
    const dupDb = { 'class-fighter': { classFeature: [
      { name: 'Second Wind', level: 1, source: 'XPHB', entries: ['x'] },
      { name: 'Indomitable', level: 9, source: 'XPHB', entries: ['a'] },
      { name: 'Indomitable', level: 13, source: 'XPHB', entries: ['b'] }, // melhoria re-listada
    ] } };
    const obj = { ...classObj, classFeatures: ['Second Wind|Fighter||1', 'Indomitable|Fighter||9', 'Indomitable|Fighter||13'] };
    const items = buildClassFeatureItems({ level: 13 }, obj, dupDb);
    expect(items.map((i) => i.name)).toEqual(['Second Wind', 'Indomitable']); // sem duplicata
    expect(items.find((i) => i.name === 'Second Wind').system.uses.max).toBe('@scale.fighter.second-wind');
  });

  // TC-0088. A dedup acima é a regra; a exceção é a re-listagem que o dnd5e
  // PUBLICA como documento próprio ("<Nome> (2)"). Sem ela, um Bárbaro que
  // ALCANÇOU o 17 exportava só o texto do 13 e perdia o upgrade (dano 2d10 +
  // dois efeitos de uma vez). O teste do Indomitable acima é a outra metade do
  // par: lá não existe documento numerado, então continua deduplicando.
  describe('re-listagem com documento numerado publicado (TC-0088)', () => {
    const barbDb = { 'class-barbarian': { classFeature: [
      { name: 'Rage', level: 1, source: 'XPHB', entries: ['x'] },
      { name: 'Improved Brutal Strike', level: 13, source: 'XPHB', entries: ['staggering blow'] },
      { name: 'Improved Brutal Strike', level: 17, source: 'XPHB', entries: ['damage rises to 2d10'] },
    ] } };
    const barbObj = {
      name: 'Barbarian', source: 'XPHB', hd: { faces: 12 }, proficiency: ['str', 'con'],
      startingProficiencies: { armor: [], weapons: ['simple'], skills: [] },
      classFeatures: [
        'Rage|Barbarian||1',
        'Improved Brutal Strike|Barbarian||13',
        'Improved Brutal Strike|Barbarian||17',
      ],
    };

    it('no nível 17 emite o item numerado, com o texto DAQUELE nível', () => {
      const items = buildClassFeatureItems({ level: 17 }, barbObj, barbDb);
      expect(items.map((i) => i.name)).toEqual([
        'Rage', 'Improved Brutal Strike', 'Improved Brutal Strike (2)',
      ]);
      const second = items.find((i) => i.name === 'Improved Brutal Strike (2)');
      expect(second.system.description.value).toContain('2d10');
      // O nome publicado é o que faz a procedência casar (DDL-0056).
      expect(second._stats.compendiumSource).toContain('phbbrbImp2Brutal');
    });

    it('abaixo do nível da re-listagem, nada muda', () => {
      expect(buildClassFeatureItems({ level: 16 }, barbObj, barbDb).map((i) => i.name))
        .toEqual(['Rage', 'Improved Brutal Strike']);
    });
  });

  it('buildClassItem liga as features via ItemGrant por nível', () => {
    const items = buildClassFeatureItems({ level: 5 }, classObj, db);
    const cls = buildClassItem({ level: 5, hitPoints: {} }, classObj, items);
    const grants = advList(cls).filter((a) => a.type === 'ItemGrant');
    expect(grants.map((g) => g.level).sort()).toEqual([1, 5]);
    const l1 = grants.find((g) => g.level === 1);
    const secondWind = items.find((i) => i.name === 'Second Wind');
    expect(Object.keys(l1.value.added)).toContain(secondWind._id);
  });
});

// Traits de escolha NO NÍVEL DELAS: é assim que o Foundry sabe perguntar pela
// perícia/expertise/ferramenta ao subir de nível. Gabarito = os premades.
describe('buildChoiceTraits', () => {
  const db = { 'items-base': { baseitem: [] } };

  it('expertise: mode expertise, pool aberto, com os escolhidos aplicados', () => {
    const desc = { id: 'expertise@1', kind: 'expertise', count: 2, level: 1, feature: { name: 'Expertise' } };
    const [t] = buildChoiceTraits([desc], { 'expertise@1': { picks: ['ath', 'ste'] } }, db);
    expect(t).toMatchObject({ type: 'Trait', level: 1, title: 'Expertise' });
    expect(t.configuration.mode).toBe('expertise');
    expect(t.configuration.choices).toEqual([{ count: 2, pool: ['skills:*'] }]);
    expect(t.value).toEqual({ chosen: ['skills:ath', 'skills:ste'] });
  });

  it('perícia restrita: pool = a lista do grant, título = nome da feature', () => {
    const desc = {
      id: 'skill@primal knowledge@3', kind: 'skill', count: 1, level: 3,
      feature: { name: 'Primal Knowledge' }, from: ['ani', 'ath', 'itm'],
    };
    const [t] = buildChoiceTraits([desc], {}, db);
    expect(t.title).toBe('Primal Knowledge');
    expect(t.level).toBe(3);
    expect(t.configuration.choices[0].pool).toEqual(['skills:ani', 'skills:ath', 'skills:itm']);
    expect(t.value).toEqual({}); // sem picks = pendente no Foundry
  });

  it('idioma e ferramenta usam as chaves de trait do Foundry', () => {
    const lang = { id: 'language@x@2', kind: 'language', count: 2, level: 2, feature: { name: 'Deft Explorer' } };
    const [t] = buildChoiceTraits([lang], { 'language@x@2': { picks: ['Elvish'] } }, db);
    expect(t.configuration.choices[0].pool).toEqual(['languages:standard:*', 'languages:exotic:*']);
    expect(t.value.chosen[0]).toMatch(/^languages:/);

    const tool = { id: 'tool@y@1', kind: 'tool', count: 3, level: 1, pool: { type: 'any', of: 'tool', category: 'INS' }, feature: { name: 'Bard' } };
    const [tt] = buildChoiceTraits([tool], {}, db);
    expect(tt.configuration.choices[0].pool).toEqual(['tool:music:*']);
  });

  it('kinds sem Trait correspondente são ignorados', () => {
    const feat = { id: 'feat@4', kind: 'feat', count: 1, level: 4, pool: { type: 'feat' } };
    const optional = { id: 'inv@2', kind: 'optionalfeature', count: 1, level: 2, pool: {} };
    expect(buildChoiceTraits([feat, optional], {}, db)).toEqual([]);
  });
});

// A escada dos níveis FUTUROS é o que faz o level-up DENTRO do Foundry conceder
// as features novas: sem ela, subir de 1 p/ 2 não concede nada. Gabarito = os
// premades oficiais de nível 1 (a receita está inteira desde o começo).
describe('escada de níveis futuros (ItemGrant de compêndio)', () => {
  const barbObj = {
    name: 'Barbarian', source: 'XPHB', hd: { faces: 12 }, proficiency: ['str', 'con'],
    startingProficiencies: { armor: [], weapons: ['simple', 'martial'], skills: [{ choose: { from: ['athletics'], count: 2 } }] },
    classFeatures: ['Rage|Barbarian||1', 'Danger Sense|Barbarian||2', 'Reckless Attack|Barbarian||2', 'Primal Knowledge|Barbarian||3'],
  };
  const barbDb = { 'class-barbarian': { classFeature: [
    { name: 'Rage', level: 1, source: 'XPHB', entries: ['x'] },
    { name: 'Danger Sense', level: 2, source: 'XPHB', entries: ['x'] },
    { name: 'Reckless Attack', level: 2, source: 'XPHB', entries: ['x'] },
    { name: 'Primal Knowledge', level: 3, source: 'XPHB', entries: ['x'] },
  ] } };

  it('classe: níveis acima do atual apontam para o compêndio, com value vazio', () => {
    const grants = buildClassFutureGrants({ level: 1 }, barbObj, barbDb);
    expect(grants.map((g) => g.level)).toEqual([2, 3]);
    const l2 = grants.find((g) => g.level === 2);
    expect(l2.configuration.items.map((i) => i.uuid)).toEqual([
      'Compendium.dnd5e.classes24.Item.phbbrbDangerSens',
      'Compendium.dnd5e.classes24.Item.phbbrbRecklessAt',
    ]);
    expect(l2.value).toEqual({}); // nível não alcançado - só a receita
    expect(l2.title).toBe('Class Features');
  });

  it('classe: nada abaixo ou igual ao nível atual (esses já são itens embutidos)', () => {
    expect(buildClassFutureGrants({ level: 3 }, barbObj, barbDb)).toEqual([]);
    expect(buildClassFutureGrants({ level: 2 }, barbObj, barbDb).map((g) => g.level)).toEqual([3]);
  });

  it('classe fora do SRD publicado pelo dnd5e não gera escada (não inventa uuid)', () => {
    const fake = { ...barbObj, name: 'Artificer' };
    const fakeDb = { 'class-artificer': barbDb['class-barbarian'] };
    expect(buildClassFutureGrants({ level: 1 }, fake, fakeDb)).toEqual([]);
  });

  // Uma feature SEM uuid no registro é dropada da escada em silêncio, e o efeito
  // só aparece muito depois: quem sobe de nível dentro do Foundry não a recebe.
  // Aconteceu com o Self-Restoration do Monge (@10), que o `packs/_source` do
  // dnd5e não publica como arquivo embora o compêndio compilado o tenha - os
  // premades do Perrin o referenciam. Ver SOURCE_GAPS em gen-compendium-uuids.js
  // e a rede permanente `npm run check:uuids`.
  it('monge nível 1: o passo @10 leva as DUAS features, não só a publicada', () => {
    const monkObj = {
      name: 'Monk', source: 'XPHB', hd: { faces: 8 }, proficiency: ['str', 'dex'],
      startingProficiencies: { armor: [], weapons: ['simple'], skills: [] },
      classFeatures: ['Heightened Focus|Monk||10', 'Self-Restoration|Monk||10'],
    };
    const monkDb = { 'class-monk': { classFeature: [
      { name: 'Heightened Focus', level: 10, source: 'XPHB', entries: ['x'] },
      { name: 'Self-Restoration', level: 10, source: 'XPHB', entries: ['x'] },
    ] } };

    const at10 = buildClassFutureGrants({ level: 1 }, monkObj, monkDb).find((g) => g.level === 10);
    expect(at10.configuration.items.map((i) => i.uuid)).toEqual([
      'Compendium.dnd5e.classes24.Item.phbmnkHeightened',
      'Compendium.dnd5e.classes24.Item.phbmnkSelfrestor',
    ]);
  });

  it('subclasse: features futuras + as magias concedidas por nível', () => {
    const sub = {
      name: 'Oath of Devotion',
      shortName: 'Devotion',
      source: 'XPHB',
      additionalSpells: [{ prepared: { 3: ['protection from evil and good', 'shield of faith'], 5: ['aid', 'zone of truth'] } }],
    };
    const db = { 'class-paladin': { subclassFeature: [
      { name: 'Sacred Weapon', subclassShortName: 'Devotion', subclassSource: 'XPHB', source: 'XPHB', level: 3, entries: ['x'] },
      { name: 'Aura of Devotion', subclassShortName: 'Devotion', subclassSource: 'XPHB', source: 'XPHB', level: 7, entries: ['x'] },
    ] } };
    const grants = buildSubclassFutureGrants(sub, 'paladin', db, 3);
    const features = grants.filter((g) => g.title === 'Subclass Features');
    expect(features.map((g) => g.level)).toEqual([7]);
    expect(features[0].configuration.items[0].uuid).toBe('Compendium.dnd5e.classes24.Item.phbpdnDevotionAu');
    // Magias: a escada cobre TODOS os níveis, inclusive os já alcançados - é o
    // que os premades trazem, e é o que diz ao Foundry de onde veio a magia que
    // o personagem já tem (TC-0072).
    const spells = grants.filter((g) => g.title === 'Oath of Devotion Spells');
    expect(spells.map((g) => g.level)).toEqual([3, 5]);
    expect(spells[1].configuration.items.map((i) => i.uuid).sort()).toEqual([
      'Compendium.dnd5e.spells24.Item.phbsplAid0000000',
      'Compendium.dnd5e.spells24.Item.phbsplZoneofTrut',
    ]);
    // Nível já alcançado: `value.added` liga ao item de magia EMBUTIDO.
    const withIds = buildSubclassFutureGrants(sub, 'paladin', db, 3, new Map([['shield of faith', 'abc123']]));
    const reached = withIds.find((g) => g.title === 'Oath of Devotion Spells' && g.level === 3);
    expect(reached.value.added).toEqual({ abc123: 'Compendium.dnd5e.spells24.Item.phbsplShieldofFa' });
  });

  it('feature RE-LISTADA num nível maior usa o segundo item do dnd5e ("<Nome> (2)")', () => {
    // Improved Brutal Strike do Barbarian: @13 e @17. Nós dedupamos por nome
    // (um item por feature), mas o dnd5e publica o segundo como "(2)" - é o
    // ÚNICO caso do dataset. Sem isso o nível 17 não concederia nada.
    const obj = {
      ...barbObj,
      classFeatures: ['Rage|Barbarian||1', 'Improved Brutal Strike|Barbarian||13', 'Improved Brutal Strike|Barbarian||17'],
    };
    const db = { 'class-barbarian': { classFeature: [
      { name: 'Rage', level: 1, source: 'XPHB', entries: ['x'] },
      { name: 'Improved Brutal Strike', level: 13, source: 'XPHB', entries: ['x'] },
      { name: 'Improved Brutal Strike', level: 17, source: 'XPHB', entries: ['x'] },
    ] } };
    const grants = buildClassFutureGrants({ level: 1 }, obj, db);
    expect(grants.find((g) => g.level === 13).configuration.items[0].uuid).toBe('Compendium.dnd5e.classes24.Item.phbbrbImpBrutalS');
    expect(grants.find((g) => g.level === 17).configuration.items[0].uuid).toBe('Compendium.dnd5e.classes24.Item.phbbrbImp2Brutal');
  });

  it('buildSubclassItem junta as duas escadas no advancement', () => {
    const sub = { name: 'Oath of Devotion', shortName: 'Devotion', source: 'XPHB' };
    const item = buildSubclassItem(sub, 'paladin', [], {
      futureGrants: buildSubclassFutureGrants(sub, 'paladin', { 'class-paladin': { subclassFeature: [
        { name: 'Aura of Devotion', subclassShortName: 'Devotion', subclassSource: 'XPHB', source: 'XPHB', level: 7, entries: ['x'] },
      ] } }, 3),
    });
    expect(advList(item).map((a) => a.level)).toEqual([7]);
  });
});

describe('subclass items', () => {
  const db = {
    'class-fighter': {
      subclassFeature: [
        { name: 'Champion', subclassShortName: 'Champion', source: 'XPHB', level: 3, entries: ['umbrella', { type: 'refSubclassFeature', subclassFeature: 'Improved Critical|Fighter|XPHB|Champion|XPHB|3' }] },
        { name: 'Improved Critical', subclassShortName: 'Champion', source: 'XPHB', level: 3, entries: ['crit on 19-20'] },
        { name: 'Remarkable Athlete', subclassShortName: 'Champion', source: 'XPHB', level: 3, entries: ['advantage on initiative'] },
        { name: 'Survivor', subclassShortName: 'Champion', source: 'XPHB', level: 18, entries: ['regain hp'] },
      ],
    },
  };
  const subclass = { shortName: 'Champion', name: 'Champion', source: 'XPHB' };

  it('gera itens das features reais, pulando a umbrella e as acima do nível', () => {
    const items = buildSubclassFeatureItems(subclass, 'fighter', db, 3);
    expect(items.map((i) => i.name)).toEqual(['Improved Critical', 'Remarkable Athlete']);
    expect(items.every((i) => i.system.type.value === 'class')).toBe(true);
  });

  it('Active Effect curado aplica-se a feature de subclasse (Remarkable Athlete)', () => {
    const items = buildSubclassFeatureItems(subclass, 'fighter', db, 3);
    const ra = items.find((i) => i.name === 'Remarkable Athlete');
    expect(ra.effects[0].changes[0]).toMatchObject({ key: 'flags.dnd5e.initiativeAdv' });
  });

  it('buildSubclassItem: type subclass, classIdentifier e ItemGrant', () => {
    const items = buildSubclassFeatureItems(subclass, 'fighter', db, 18);
    const sub = buildSubclassItem(subclass, 'fighter', items);
    expect(sub.type).toBe('subclass');
    expect(sub.system.identifier).toBe('champion');
    expect(sub.system.classIdentifier).toBe('fighter');
    const grants = advList(sub).filter((a) => a.type === 'ItemGrant');
    expect(grants.map((g) => g.level).sort((a, b) => a - b)).toEqual([3, 18]);
    expect(grants[0].title).toBe('Subclass Features');
  });

  it('subclasse nula → vazio/null', () => {
    expect(buildSubclassFeatureItems(null, 'fighter', db, 3)).toEqual([]);
    expect(buildSubclassItem(null, 'fighter', [])).toBeNull();
  });
});

describe('buildSpeciesItem', () => {
  // Variante de linhagem já resolvida (Elf; Drow Lineage): _baseName = 'Elf'.
  const drow = {
    name: 'Elf; Drow Lineage', _baseName: 'Elf', source: 'XPHB',
    size: ['M'], speed: 30, darkvision: 120, creatureTypes: ['humanoid'],
    entries: [{ type: 'entries', name: 'Elven Lineage (Drow)', entries: ['Darkvision 120.'] }],
  };

  it('monta item type race com identifier da BASE, size, movimento e darkvision', () => {
    const item = buildSpeciesItem(null, drow);
    expect(item.type).toBe('race');
    // Nome do documento do dnd5e, não o nome fundido do 5etools (é a MESMA
    // espécie; casar o nome dá procedência de compêndio ao item).
    expect(item.name).toBe('Elf, Drow');
    expect(item.system.identifier).toBe('elf'); // identifier estável da linhagem base
    expect(item.system.type).toEqual({ value: 'humanoid', custom: '', subtype: 'Elf' });
    expect(item.system.movement.walk).toBe('30');
    expect(item.system.senses.ranges.darkvision).toBe(120);
    expect(item.system.description.value).toContain('Darkvision 120');
  });

  it('advancement Size a partir do tamanho 5etools', () => {
    const size = advList(buildSpeciesItem(null, drow)).find((a) => a.type === 'Size');
    expect(size.configuration.sizes).toEqual(['med']);
    expect(size.value).toEqual({ size: 'med' });
  });

  it('speed como objeto com fly vira strings', () => {
    const item = buildSpeciesItem(null, { name: 'Aarakocra', source: 'XPHB', size: ['M'], speed: { walk: 30, fly: 50 } });
    expect(item.system.movement.walk).toBe('30');
    expect(item.system.movement.fly).toBe('50');
  });

  it('raça nula → null', () => {
    expect(buildSpeciesItem(null, null)).toBeNull();
  });

  it('sub-escolha de perícia (Elf Keen Senses) vira Trait com value.chosen', () => {
    const character = { species: { choices: { 'skill-0': { kind: 'skill', picks: ['prc'] } } } };
    const trait = advList(buildSpeciesItem(character, drow)).find((a) => a.type === 'Trait' && a.title === 'Skill Proficiencies');
    expect(trait.value.chosen).toEqual(['skills:prc']);
    expect(trait.configuration.grants).toEqual(['skills:prc']);
  });

  it('sub-escolha de talento de origem (Human Versatile) vira ItemGrant ligado ao item de feat', () => {
    const character = { species: { choices: { 'feat-0': { kind: 'feat', picks: ['Alert|XPHB'] } } } };
    const featItems = buildSpeciesFeatItems(character, featsDb);
    expect(featItems).toHaveLength(1);
    expect(featItems[0].name).toBe('Alert');
    expect(featItems[0].system.type.subtype).toBe('origin');

    const item = buildSpeciesItem(character, drow, featsDb, featItems);
    const grant = advList(item).find((a) => a.type === 'ItemGrant');
    expect(grant.value.added).toEqual({ [featItems[0]._id]: `.${featItems[0]._id}` });
  });

  it('sem escolhas de espécie → sem Trait/ItemGrant além do Size', () => {
    const adv = advList(buildSpeciesItem({ species: { choices: {} } }, drow));
    expect(adv).toHaveLength(1);
    expect(adv[0].type).toBe('Size');
  });

  // O 5etools usa o pseudo-idioma "other" para o idioma próprio do cenário
  // (Simic Hybrid GGR: "Elvish ou Vedalken"). Ele não tem chave no dnd5e.
  const langDb = { languages: { language: [{ name: 'Elvish', type: 'standard' }] } };

  it('idioma sem chave no dnd5e ("other") não vira Trait e volta pela flag', () => {
    const character = { species: { choices: { 'language-0': { kind: 'language', picks: ['other'] } } } };
    const item = buildSpeciesItem(character, drow, langDb);
    expect(advList(item).find((a) => a.title === 'Languages')).toBeUndefined();
    expect(item.flags.builder5e.choices['language-0'].picks).toEqual(['other']);
  });

  it('idioma REAL segue nativo, sem flag', () => {
    const character = { species: { choices: { 'language-0': { kind: 'language', picks: ['Elvish'] } } } };
    const item = buildSpeciesItem(character, drow, langDb);
    expect(advList(item).find((a) => a.title === 'Languages').value.chosen).toEqual(['languages:standard:elvish']);
    // Nenhuma escolha residual - só a linhagem, que o nome do SRD ("Elf, Drow")
    // não distingue e por isso viaja na flag.
    expect(item.flags.builder5e.choices).toBeUndefined();
    expect(item.flags.builder5e.lineage).toBe('Elf; Drow Lineage');
  });
});

describe('buildSpeciesFeatItems', () => {
  it('sem escolhas de espécie → []', () => {
    expect(buildSpeciesFeatItems({ species: { choices: {} } }, featsDb)).toEqual([]);
    expect(buildSpeciesFeatItems(null, featsDb)).toEqual([]);
  });
});

describe('buildBackgroundItem', () => {
  const character = {
    origin: {
      abilityBoosts: [{ ability: 'dex', amount: 2 }, { ability: 'con', amount: 1 }],
      skillProficiencies: ['ath', 'itm'],
      choices: { 'skill-0': { kind: 'skill', picks: ['prc'] } },
    },
  };

  it('monta item type background com ASI (boosts) + Trait de skills', () => {
    const bg = buildBackgroundItem(character);
    expect(bg.type).toBe('background');
    expect(bg.system.identifier).toBe('custom-background');
    const asi = advList(bg).find((a) => a.type === 'AbilityScoreImprovement');
    expect(asi.value).toEqual({ type: 'asi', assignments: { dex: 2, con: 1 } });
    expect(asi.configuration.points).toBe(3);
    const skills = advList(bg).find((a) => a.type === 'Trait');
    expect([...skills.configuration.grants].sort()).toEqual(['skills:ath', 'skills:itm', 'skills:prc']);
  });

  it('sem origem → null', () => {
    expect(buildBackgroundItem({})).toBeNull();
  });
});

// --- Fase T2 (TESTING-PLAN §5): progressão de conjuração (TC-0060) ------------
describe('fvttProgression + conjuração da subclasse', () => {
  it('as frações do 5etools viram as chaves do dnd5e', () => {
    expect(fvttProgression('1/2')).toBe('half');
    expect(fvttProgression('1/3')).toBe('third');
    // Preservados: são chaves válidas do sistema (artificer == half lá).
    expect(fvttProgression('full')).toBe('full');
    expect(fvttProgression('pact')).toBe('pact');
    expect(fvttProgression('artificer')).toBe('artificer');
    expect(fvttProgression(null)).toBe(null);
  });

  it('subclasse terço-conjuradora carrega a própria progressão', () => {
    const sub = { shortName: 'Eldritch Knight', name: 'Eldritch Knight', source: 'XPHB', casterProgression: '1/3', spellcastingAbility: 'int' };
    expect(buildSubclassItem(sub, 'fighter').system.spellcasting).toEqual({
      progression: 'third', ability: 'int', preparation: { formula: '' },
    });
  });

  it('subclasse sem conjuração segue com progression "none"', () => {
    const sub = { shortName: 'Champion', name: 'Champion', source: 'XPHB' };
    expect(buildSubclassItem(sub, 'fighter').system.spellcasting.progression).toBe('none');
  });
});

// --- Fase T2 / TC-0063: escadas de ItemChoice -------------------------------
describe('buildItemChoiceAdvancements', () => {
  const db = {
    'class-cleric': { classFeature: [
      { name: 'Divine Order', source: 'XPHB', className: 'Cleric', classSource: 'XPHB', level: 1, entries: [
        { type: 'options', count: 1, entries: [
          { type: 'refClassFeature', classFeature: 'Protector|Cleric|XPHB|1|XPHB' },
          { type: 'refClassFeature', classFeature: 'Thaumaturge|Cleric|XPHB|1|XPHB' },
        ] },
      ] },
      { name: 'Protector', source: 'XPHB', className: 'Cleric', classSource: 'XPHB', level: 1, entries: ['armadura'] },
      { name: 'Thaumaturge', source: 'XPHB', className: 'Cleric', classSource: 'XPHB', level: 1, entries: ['cantrip'] },
    ] },
  };
  const classObj = { name: 'Cleric', source: 'XPHB', classFeatures: ['Divine Order|Cleric|XPHB|1'] };
  const entry = (picks) => ({
    classId: 'cleric', source: 'XPHB', level: 5,
    choices: { 'featopt@Divine Order@1': { kind: 'featureoption', picks } },
  });

  it('emite o passo com o POOL das opções e o nível certo', () => {
    const [adv] = buildItemChoiceAdvancements(entry(['Protector|XPHB']), classObj, null, db, []);
    expect(adv).toMatchObject({ type: 'ItemChoice', title: 'Divine Order' });
    expect(adv.configuration.choices).toEqual({ 1: { count: 1, replacement: false } });
    // Os uuids vêm do registro do dnd5e (classes24) - 2 opções conhecidas.
    expect(adv.configuration.pool.length).toBe(2);
  });

  it('`value.added` aponta para o ITEM embutido já escolhido (não pergunta de novo)', () => {
    const item = { _id: 'OPT0000000000001', name: 'Divine Order: Protector' };
    const [adv] = buildItemChoiceAdvancements(entry(['Protector|XPHB']), classObj, null, db, [item]);
    expect(adv.value.added).toEqual({ 1: { OPT0000000000001: '.OPT0000000000001' } });
  });

  it('sem opção com uuid conhecido, nenhum passo é emitido (escada vazia é pior que nenhuma)', () => {
    const unknown = { name: 'Zzz', source: 'XPHB', classFeatures: ['Divine Order|Cleric|XPHB|1'] };
    expect(buildItemChoiceAdvancements({ ...entry([]), classId: 'zzz' }, unknown, null, db, [])).toEqual([]);
  });
});

describe('buildClassWeaponItems - o Unarmed Strike (A1 + 5.1)', () => {
  it('a classe que o SRD publica ganha o item, com a activity de ATAQUE', () => {
    const [item] = buildClassWeaponItems({ level: 5 }, { name: 'Monk' });
    expect(item.name).toBe('Unarmed Strike');
    expect(item.type).toBe('weapon');
    expect(item.system.type.value).toBe('natural');
    // É a activity que dá o botão de ataque na ficha do Foundry.
    expect(Object.values(item.system.activities).map((a) => a.type)).toContain('attack');
    // Procedência: o Monge aponta para a cópia do classes24, o Bárbaro para a do
    // equipment24 - por isso o uuid vem do documento da classe, não do nome.
    expect(item._stats.compendiumSource).toContain('classes24');
    expect(buildClassWeaponItems({ level: 1 }, { name: 'Barbarian' })[0]._stats.compendiumSource)
      .toContain('equipment24');
  });

  it('classe FORA do SRD ganha a cópia genérica, em passo de título próprio', () => {
    // Divergimos do SRD de propósito: a regra 2024 diz que toda criatura pode
    // fazer um Ataque Desarmado, e sem o item o personagem chega ao Foundry sem
    // botão nenhum de ataque quando está desarmado.
    const [item] = buildClassWeaponItems({ level: 20 }, { name: 'Fighter' });
    expect(item.name).toBe('Unarmed Strike');
    expect(item._stats.compendiumSource).toContain('equipment24');
    expect(item.flags.builder5e.srdGranted).toBe(false);
    const cls = buildClassItem({ classId: 'fighter', level: 1 }, { name: 'Fighter', source: 'XPHB', hd: { faces: 10 } }, [], {}, { weaponItems: [item] });
    // Título PRÓPRIO: o passo é nosso, não a escada oficial da classe.
    expect(advList(cls).find((a) => a.type === 'ItemGrant' && a.title === 'Unarmed Strike')).toBeTruthy();
    expect(buildClassWeaponItems({ level: 1 }, { name: 'Monk' })[0].flags.builder5e.srdGranted).toBe(true);
  });

  it('o item entra pelo advancement da classe, ligado por value.added', () => {
    const weaponItems = buildClassWeaponItems({ level: 1 }, { name: 'Monk' });
    const cls = buildClassItem({ classId: 'monk', level: 1 }, { name: 'Monk', source: 'XPHB', hd: { faces: 8 } }, [], {}, { weaponItems });
    const grant = advList(cls).find(
      (a) => a.type === 'ItemGrant' && Object.values(a.value?.added ?? {}).some((u) => String(u).includes('UnarmedStr')),
    );
    expect(grant.level).toBe(1);
    expect(grant.value.added[weaponItems[0]._id]).toBe(weaponItems[0]._stats.compendiumSource);
  });
});

describe('speciesTraitEntries - o benefício aninhado da ancestralidade (A4)', () => {
  // Forma real do Goliath: o boon escolhido mora numa lista DENTRO do traço
  // guarda-chuva, e o SRD publica os dois como documentos separados.
  const goliath = {
    name: 'Goliath; Cloud Giant Ancestry',
    _baseName: 'Goliath',
    source: 'XPHB',
    entries: [
      {
        name: 'Giant Ancestry (Cloud)',
        entries: ['You are descended from Giants.', { type: 'list', items: [{ type: 'item', name: "Cloud's Jaunt", entries: ['...'] }] }],
      },
      { name: 'Powerful Build', entries: ['...'] },
    ],
  };

  it('o boon vira uma entrada própria, marcada para o passo separado', () => {
    const names = speciesTraitEntries(goliath).map((e) => e.name);
    expect(names).toEqual(['Giant Ancestry (Cloud)', "Cloud's Jaunt", 'Powerful Build']);
    expect(speciesTraitEntries(goliath).find((e) => e.name === "Cloud's Jaunt")._boon).toBe(true);
  });

  it('a regra é ESTREITA: vários sub-itens nomeados não produzem boon', () => {
    // É o caso da BASE do Goliath, que lista os seis benefícios no mesmo traço.
    const base = {
      name: 'Goliath',
      source: 'XPHB',
      entries: [{
        name: 'Giant Ancestry',
        entries: [{ type: 'list', items: [
          { type: 'item', name: "Cloud's Jaunt (Cloud Giant)", entries: ['...'] },
          { type: 'item', name: "Fire's Burn (Fire Giant)", entries: ['...'] },
        ] }],
      }],
    };
    expect(speciesTraitEntries(base).map((e) => e.name)).toEqual(['Giant Ancestry']);
  });

  it('e o nome tem de existir no SRD (senão não é documento lá)', () => {
    const race = {
      name: 'Especie Inventada',
      source: 'XXX',
      entries: [{ name: 'Guarda-chuva', entries: [{ type: 'list', items: [{ type: 'item', name: 'Beneficio Que Nao Existe', entries: ['...'] }] }] }],
    };
    expect(speciesTraitEntries(race).map((e) => e.name)).toEqual(['Guarda-chuva']);
  });
});

describe('pack como CONTÊINER + conteúdo (C4)', () => {
  // Recorte real: o Priest's Pack XPHB e o que ele contém.
  const db = {
    items: {
      item: [
        {
          name: "Priest's Pack", source: 'XPHB', type: 'G|XPHB', weight: 29, value: 3300,
          packContents: ['backpack|xphb', 'blanket|xphb', { item: 'rations|xphb', quantity: 7 }],
        },
        { name: 'Backpack', source: 'XPHB', type: 'G|XPHB', weight: 5, value: 200 },
        { name: 'Blanket', source: 'XPHB', type: 'G|XPHB', weight: 3, value: 50 },
        { name: 'Rations', source: 'XPHB', type: 'G|XPHB', weight: 2, value: 50 },
      ],
    },
  };
  const char = { inventory: [{ uid: 'u', itemId: "Priest's Pack", source: 'XPHB', quantity: 1 }] };

  it('emite um `container` + os conteúdos apontando para ele', () => {
    const items = buildInventoryItems(char, db);
    const container = items.find((i) => i.type === 'container');
    expect(container.name).toBe("Priest's Pack");
    const inside = items.filter((i) => i.system.container === container._id);
    expect(inside.map((i) => i.name).sort()).toEqual(['Blanket', 'Rations']);
    expect(inside.find((i) => i.name === 'Rations').system.quantity).toBe(7);
  });

  it('o peso é o do RECIPIENTE, não o total do pack (senão o Foundry conta em dobro)', () => {
    const items = buildInventoryItems(char, db);
    const container = items.find((i) => i.type === 'container');
    // A Backpack (5 lb) é o recipiente; o pack inteiro pesa 29 no dado.
    expect(container.system.weight.value).toBe(5);
    // E o preço fica só no contêiner, pelo mesmo motivo.
    expect(container.system.price.value).toBe(33);
    for (const i of items.filter((x) => x.system.container)) expect(i.system.price.value).toBe(0);
  });

  it('item sem `packContents` continua sendo um item só', () => {
    const plain = { inventory: [{ uid: 'u', itemId: 'Blanket', source: 'XPHB', quantity: 1 }] };
    const items = buildInventoryItems(plain, db);
    expect(items).toHaveLength(1);
    expect(items[0].type).not.toBe('container');
  });
});
