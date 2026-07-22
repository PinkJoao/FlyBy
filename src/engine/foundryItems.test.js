import { describe, it, expect } from 'vitest';
import { buildClassItem, buildChoiceTraits, buildFeatureItem, buildFeatItem, buildClassChosenFeats, buildClassTraitValues, buildOriginFeatItem, buildClassFeatureItems, buildClassFutureGrants, buildSubclassFeatureItems, buildSubclassFutureGrants, buildSubclassItem, buildSpeciesItem, buildSpeciesFeatItems, buildBackgroundItem, hitPointsValue, randomFoundryId } from './foundryItems';

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
    // Magias: só o DELTA do nível 5 (as do 3 já são itens embutidos).
    const spells = grants.filter((g) => g.title === 'Oath of Devotion Spells');
    expect(spells.map((g) => g.level)).toEqual([5]);
    expect(spells[0].configuration.items.map((i) => i.uuid).sort()).toEqual([
      'Compendium.dnd5e.spells24.Item.phbsplAid0000000',
      'Compendium.dnd5e.spells24.Item.phbsplZoneofTrut',
    ]);
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
    expect(item.name).toBe('Elf; Drow Lineage');
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
