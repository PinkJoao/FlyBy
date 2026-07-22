import { describe, it, expect } from 'vitest';
import {
  translateOverlayEffects,
  overlayFeatEffects,
  overlayOptionalFeatureEffects,
  overlayClassFeatureEffects,
  overlaySubclassFeatureEffects,
  overlayRaceEffects,
  overlayMechanics,
  overlayRaceTraits,
  overlayClassAdvancement,
  overlaySubclassAdvancement,
} from './foundryOverlay';
import { buildFeatureItem, buildFeatItem, buildSpeciesItem, buildSpeciesTraitItems } from './foundryItems';

// db sintético com fatias REAIS do overlay (shapes copiados dos arquivos).
const db = {
  'foundry-feats': {
    feat: [
      { name: 'Alert', source: 'XPHB', effects: [{ transfer: true, changes: [{ key: 'flags.dnd5e.initiativeAlert', mode: 'OVERRIDE', value: true }] }] },
      { name: 'Tough', source: 'XPHB', effects: [{ transfer: true, changes: [{ key: 'system.attributes.hp.bonuses.level', mode: 'ADD', value: 2 }] }] },
    ],
  },
  'foundry-optionalfeatures': {
    optionalfeature: [
      { name: 'Gift of the Depths', source: 'XPHB', effects: [{ transfer: true, changes: [{ key: 'system.attributes.movement.swim', mode: 'ADD', value: 30 }] }] },
    ],
  },
  'foundry-class': {
    classFeature: [
      {
        name: 'Rage', className: 'Barbarian', classSource: 'XPHB', source: 'XPHB', level: 1,
        effects: [{ disabled: true, transfer: true, duration: { rounds: 10, seconds: 600 }, changes: [
          { key: 'system.traits.dr.value', mode: 'ADD', value: 'slashing' },
          { key: 'system.bonuses.mwak.damage', mode: 'ADD', value: '+@scale.barbarian.rage-damage' },
        ] }],
      },
      // Duas edições da mesma feature - o lookup NUNCA cruza fonte.
      {
        name: 'Jack of All Trades', className: 'Bard', source: 'PHB', level: 2,
        effects: [{ transfer: true, changes: [{ key: 'flags.dnd5e.jackOfAllTrades', mode: 'OVERRIDE', value: true }] }],
      },
      // Homônimas em níveis diferentes - nível exato vence, senão o mais baixo.
      { name: 'Expertise', className: 'Bard', source: 'XPHB', level: 2, effects: [{ transfer: true, changes: [{ key: 'flags.dnd5e.test', mode: 'OVERRIDE', value: 'lvl2' }] }] },
      { name: 'Expertise', className: 'Bard', source: 'XPHB', level: 9, effects: [{ transfer: true, changes: [{ key: 'flags.dnd5e.test', mode: 'OVERRIDE', value: 'lvl9' }] }] },
    ],
    subclassFeature: [
      {
        name: 'Draconic Resilience', className: 'Sorcerer', subclassShortName: 'Draconic', subclassSource: 'XPHB', source: 'XPHB', level: 3,
        effects: [
          { name: 'Draconic Resilience: Armor', transfer: true, changes: [{ key: 'system.attributes.ac.calc', mode: 'OVERRIDE', value: 'unarmoredBard' }] },
          { name: 'Draconic Resilience: HP', transfer: true, changes: [{ key: 'system.attributes.hp.bonuses.overall', mode: 'ADD', value: '@classes.sorcerer.levels' }] },
        ],
      },
      // Feature de subclasse SEM entrada curada - usada para checar só o roteamento
      // pelo índice de subclasse (o Draconic Resilience agora é curado, ver abaixo).
      {
        name: 'Fixture Routing Feature', className: 'Sorcerer', subclassShortName: 'Draconic', subclassSource: 'XPHB', source: 'XPHB', level: 6,
        effects: [{ name: 'Routing FX', transfer: true, changes: [{ key: 'flags.dnd5e.test', mode: 'OVERRIDE', value: true }] }],
      },
    ],
  },
  'foundry-races': {
    raceFeature: [
      { name: 'Luck', source: 'XPHB', raceName: 'Halfling', raceSource: 'XPHB', effects: [{ transfer: true, changes: [{ key: 'flags.dnd5e.halflingLucky', mode: 'OVERRIDE', value: true }] }] },
      { name: 'Brave', source: 'XPHB', raceName: 'Halfling', raceSource: 'XPHB', effects: [{ transfer: true, changes: [{ key: 'flags.dnd5e.test', mode: 'OVERRIDE', value: true }] }] },
      { name: 'Dwarven Toughness', source: 'XPHB', raceName: 'Dwarf', raceSource: 'XPHB', effects: [{ transfer: true, changes: [{ key: 'system.attributes.hp.bonuses.level', mode: 'ADD', value: 1 }] }] },
    ],
  },
};

describe('translateOverlayEffects', () => {
  it('traduz mode string → numérico e value não-string → string', () => {
    const [eff] = translateOverlayEffects(
      { effects: [{ transfer: true, changes: [{ key: 'flags.dnd5e.x', mode: 'OVERRIDE', value: true }, { key: 'system.attributes.ac.bonus', mode: 'ADD', value: 2 }] }] },
      'X',
    );
    expect(eff.changes).toEqual([
      { key: 'flags.dnd5e.x', mode: 5, value: 'true', priority: null },
      { key: 'system.attributes.ac.bonus', mode: 2, value: '2', priority: null },
    ]);
    expect(eff.name).toBe('X'); // fallback quando o efeito não tem nome
    expect(eff._id).toMatch(/^[A-Za-z0-9]{16}$/);
  });

  it('transfer ausente = false (efeito on-use), disabled/duration preservados', () => {
    const [eff] = translateOverlayEffects(
      { effects: [{ disabled: true, duration: { seconds: 600 }, changes: [{ key: 'system.traits.dr.value', mode: 'ADD', value: 'fire' }] }] },
      'X',
    );
    expect(eff.transfer).toBe(false);
    expect(eff.disabled).toBe(true);
    expect(eff.duration).toEqual({ seconds: 600 });
  });

  it('mantém efeitos só-de-status (alvo), com statuses', () => {
    const [eff] = translateOverlayEffects(
      { effects: [{ name: 'Turned', statuses: ['frightened', 'incapacitated'], duration: { seconds: 60 } }] },
      'Turn Undead',
    );
    expect(eff.statuses).toEqual(['frightened', 'incapacitated']);
    expect(eff.transfer).toBe(false);
  });

  it('pula encantamentos, chaves fora de system./flags. e changes de HP bônus', () => {
    const out = translateOverlayEffects(
      {
        effects: [
          { type: 'enchantment', changes: [{ key: 'system.attributes.ac.bonus', mode: 'ADD', value: 1 }] },
          { transfer: true, changes: [{ key: 'activities[enchant].consumption.targets', mode: 'OVERRIDE', value: {} }] },
          { transfer: true, changes: [{ key: 'system.attributes.hp.bonuses.overall', mode: 'ADD', value: 40 }] },
        ],
      },
      'X',
    );
    expect(out).toEqual([]); // todos filtrados (efeito vazio some)
  });

  it('serializa value objeto como JSON', () => {
    const [eff] = translateOverlayEffects(
      { effects: [{ transfer: true, changes: [{ key: 'system.damage.parts', mode: 'OVERRIDE', value: [['2d6', 'fire']] }] }] },
      'X',
    );
    expect(eff.changes[0].value).toBe('[["2d6","fire"]]');
  });
});

describe('lookups do overlay', () => {
  it('feat: nome+fonte exatos; fonte errada não cruza edição', () => {
    expect(overlayFeatEffects(db, 'Alert', 'XPHB')).toHaveLength(1);
    expect(overlayFeatEffects(db, 'Alert', 'PHB')).toEqual([]);
    expect(overlayFeatEffects(null, 'Alert', 'XPHB')).toEqual([]); // sem db
  });

  it('feat Tough fica vazio (HP bônus é export nativo, não AE)', () => {
    expect(overlayFeatEffects(db, 'Tough', 'XPHB')).toEqual([]);
  });

  it('optional feature: nome+fonte', () => {
    const [eff] = overlayOptionalFeatureEffects(db, 'Gift of the Depths', 'XPHB');
    expect(eff.changes[0]).toMatchObject({ key: 'system.attributes.movement.swim', mode: 2, value: '30' });
  });

  it('classFeature: classe+fonte, nível exato primeiro senão o mais baixo', () => {
    const rage = overlayClassFeatureEffects(db, { name: 'Rage', classId: 'barbarian', source: 'XPHB', level: 1 });
    expect(rage).toHaveLength(1);
    expect(rage[0].disabled).toBe(true);
    expect(rage[0].changes.map((c) => c.key)).toEqual(['system.traits.dr.value', 'system.bonuses.mwak.damage']);
    expect(overlayClassFeatureEffects(db, { name: 'Jack of All Trades', classId: 'bard', source: 'XPHB', level: 2 })).toEqual([]);
    const l9 = overlayClassFeatureEffects(db, { name: 'Expertise', classId: 'bard', source: 'XPHB', level: 9 });
    expect(l9[0].changes[0].value).toBe('lvl9');
    const noLevel = overlayClassFeatureEffects(db, { name: 'Expertise', classId: 'bard', source: 'XPHB', level: 4 });
    expect(noLevel[0].changes[0].value).toBe('lvl2'); // sem nível exato → mais baixo
  });

  it('subclassFeature: só a metade CA do Draconic Resilience sobrevive (HP é nativo)', () => {
    const out = overlaySubclassFeatureEffects(db, { name: 'Draconic Resilience', classId: 'sorcerer', shortName: 'Draconic', source: 'XPHB', level: 3 });
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Draconic Resilience: Armor');
    expect(out[0].changes[0]).toMatchObject({ key: 'system.attributes.ac.calc', mode: 5 });
  });

  it('raça: só traços presentes nas entries da raça resolvida', () => {
    const halfling = { name: 'Halfling', source: 'XPHB', entries: [{ name: 'Luck', entries: [] }, 'texto solto'] };
    const out = overlayRaceEffects(db, halfling); // Brave NÃO está nas entries
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Luck');
    expect(overlayRaceEffects(db, { name: 'Dwarf', source: 'XPHB', entries: [{ name: 'Dwarven Toughness' }] })).toEqual([]); // HP filtrado
    expect(overlayRaceEffects(db, null)).toEqual([]);
  });

  it('raça de _versions: cai no _baseName quando o nome mesclado não indexa', () => {
    const lineage = { name: 'Halfling; Lightfoot', _baseName: 'Halfling', source: 'XPHB', entries: [{ name: 'Luck' }] };
    expect(overlayRaceEffects(db, lineage)).toHaveLength(1);
  });
});

describe('integração com foundryItems (precedência curado > overlay)', () => {
  it('feature SEM entrada curada ganha os effects do overlay', () => {
    const item = buildFeatureItem({ name: 'Rage', level: 1, source: 'XPHB', entries: ['...'], classId: 'barbarian' }, db);
    expect(item.effects).toHaveLength(1);
    expect(item.effects[0].transfer).toBe(true);
  });

  it('feature COM entrada curada ignora o overlay (tudo-ou-nada)', () => {
    // Fast Movement tem entrada curada; um overlay homônimo não pode duplicar.
    const withOverlay = {
      ...db,
      'foundry-class': { classFeature: [{ name: 'Fast Movement', className: 'Barbarian', source: 'XPHB', level: 5, effects: [{ transfer: true, changes: [{ key: 'system.attributes.movement.walk', mode: 'ADD', value: 10 }] }] }] },
    };
    const item = buildFeatureItem({ name: 'Fast Movement', level: 5, source: 'XPHB', entries: ['...'], classId: 'barbarian' }, withOverlay);
    expect(item.effects).toHaveLength(1); // só o curado
    expect(item.effects[0].changes[0]).toMatchObject({ key: 'system.attributes.movement.walk', mode: 2, value: '10' });
  });

  it('feature de subclasse roteia pelo índice de subclasse', () => {
    const item = buildFeatureItem(
      { name: 'Fixture Routing Feature', level: 6, source: 'XPHB', entries: ['...'], classId: 'sorcerer', subclass: { shortName: 'Draconic' } },
      db,
    );
    expect(item.effects.map((e) => e.name)).toEqual(['Routing FX']);
  });

  it('Draconic Resilience: o curado (ac.calc custom 2024) vence o overlay', () => {
    const item = buildFeatureItem(
      { name: 'Draconic Resilience', level: 3, source: 'XPHB', entries: ['...'], classId: 'sorcerer', subclass: { shortName: 'Draconic' } },
      db,
    );
    // Entrada curada em foundryEffects: ac.calc=custom + formula 10+Dex+Cha.
    expect(item.effects).toHaveLength(1);
    const keys = item.effects[0].changes.map((c) => c.key);
    expect(keys).toContain('system.attributes.ac.calc');
    expect(keys).toContain('system.attributes.ac.formula');
  });

  it('overlayName redireciona o lookup (opção de featureoption)', () => {
    const item = buildFeatureItem(
      { name: 'Alguma Feature: Rage', level: 1, source: 'XPHB', entries: [], classId: 'barbarian', overlayName: 'Rage' },
      db,
    );
    expect(item.effects).toHaveLength(1);
  });

  it('talento sem entrada curada ganha o effect do overlay (Alert)', () => {
    const item = buildFeatItem({ name: 'Alert', source: 'XPHB', entries: ['...'] }, { level: 4, db });
    expect(item.effects).toHaveLength(1);
    expect(item.effects[0].changes[0]).toMatchObject({ key: 'flags.dnd5e.initiativeAlert', mode: 5, value: 'true' });
  });

  it('item de raça carrega os effects dos traços', () => {
    const halfling = { name: 'Halfling', source: 'XPHB', size: ['S'], speed: 30, entries: [{ name: 'Luck', entries: [] }] };
    const item = buildSpeciesItem(null, halfling, db);
    expect(item.effects).toHaveLength(1);
    expect(item.effects[0].transfer).toBe(true);
  });
});

// --- Adoção COMPLETA do overlay (DDL-0057): system / activities / advancement -
describe('overlayMechanics - system, activities e o link por foundryId', () => {
  const entry = {
    name: "Nature's Veil",
    system: { 'uses.max': '@prof', 'uses.recovery': [{ period: 'lr', type: 'recoverAll' }], 'range.value': 30, 'range.units': 'ft' },
    effects: [{ foundryId: 'naturesVeil', statuses: ['invisible'] }],
    activities: [{
      type: 'utility',
      activation: { type: 'bonus', value: 1 },
      consumption: { targets: [{ type: 'itemUses', value: '1' }] },
      effects: [{ foundryId: 'naturesVeil' }],
    }],
  };

  it('system vem em DOT-PATH e é expandido; uses ganha os campos que o dnd5e exige', () => {
    const { system } = overlayMechanics(entry, "Nature's Veil");
    expect(system.uses).toEqual({ max: '@prof', spent: 0, recovery: [{ period: 'lr', type: 'recoverAll' }] });
    expect(system.range).toEqual({ value: 30, units: 'ft' });
  });

  it('activities: array → mapa por _id, e o foundryId vira o _id REAL do effect', () => {
    const { effects, activities } = overlayMechanics(entry, "Nature's Veil");
    const [act] = Object.values(activities);
    expect(Object.keys(activities)).toEqual([act._id]);
    expect(act.type).toBe('utility');
    expect(act.foundryId).toBeUndefined(); // apelido interno, não é campo do dnd5e
    expect(act.effects).toEqual([{ _id: effects[0]._id }]);
  });

  it('link órfão (foundryId sem effect correspondente) é descartado, não emitido quebrado', () => {
    const { activities } = overlayMechanics(
      { activities: [{ type: 'utility', effects: [{ foundryId: 'naoExiste' }] }] },
      'X',
    );
    expect(Object.values(activities)[0].effects).toBeUndefined();
  });

  it('entrada nula devolve tudo vazio', () => {
    expect(overlayMechanics(null, 'X')).toEqual({ effects: [], activities: {}, system: {} });
  });
});

describe('advancement do overlay (ScaleValue)', () => {
  const advDb = { 'foundry-class': {
    class: [{ name: 'Fighter', source: 'XPHB', advancement: [
      { type: 'ScaleValue', title: 'Action Surge', configuration: { type: 'number', scale: { 2: { value: 1 } } } },
      { type: 'HitPoints', configuration: {} }, // tipos que não são escala são ignorados
    ] }],
    subclass: [{ name: 'Battle Master', shortName: 'Battle Master', className: 'Fighter', source: 'XPHB', advancement: [
      { type: 'ScaleValue', title: 'Superiority Dice', configuration: { identifier: 'superiority', type: 'dice', scale: { 3: { number: 4, faces: 8 } } } },
    ] }],
  } };

  it('classe: só ScaleValue, no nosso formato', () => {
    const out = overlayClassAdvancement(advDb, 'Fighter', 'XPHB');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: 'ScaleValue', title: 'Action Surge' });
    expect(out[0].configuration.scale).toEqual({ 2: { value: 1 } });
  });

  it('subclasse: casa por classe+shortName+fonte e preserva o identifier', () => {
    const [sv] = overlaySubclassAdvancement(advDb, { className: 'Fighter', shortName: 'Battle Master', source: 'XPHB' });
    expect(sv.title).toBe('Superiority Dice');
    expect(sv.configuration.identifier).toBe('superiority');
    expect(overlaySubclassAdvancement(advDb, { className: 'Fighter', shortName: 'Champion', source: 'XPHB' })).toEqual([]);
  });
});

describe('traços de espécie com mecânica própria', () => {
  const raceDb = { 'foundry-races': { raceFeature: [
    // Só Active Effect → fica no item de RAÇA (sem item próprio).
    { name: 'Luck', source: 'XPHB', raceName: 'Halfling', raceSource: 'XPHB', effects: [{ transfer: true, changes: [{ key: 'flags.dnd5e.halflingLucky', mode: 'OVERRIDE', value: true }] }] },
    // Tem activity → precisa de item próprio (uma ação só existe num item).
    { name: 'Second Chance', source: 'XPHB', raceName: 'Halfling', raceSource: 'XPHB', system: { 'uses.max': '1' }, activities: [{ type: 'utility' }] },
  ] } };
  const halfling = { name: 'Halfling', source: 'XPHB', entries: [{ name: 'Luck', entries: ['sorte'] }, { name: 'Second Chance', entries: ['de novo'] }] };

  it('separa os traços que precisam de item dos que não precisam', () => {
    const traits = overlayRaceTraits(raceDb, halfling);
    expect(traits.map((t) => [t.name, t.ownItem])).toEqual([['Luck', false], ['Second Chance', true]]);
  });

  it('o item de raça NÃO leva o effect de um traço que virou item (não duplica)', () => {
    expect(overlayRaceEffects(raceDb, halfling).map((e) => e.name)).toEqual(['Luck']);
  });

  it('buildSpeciesTraitItems monta o item no formato dos premades (feat/race)', () => {
    const [item] = buildSpeciesTraitItems(halfling, raceDb);
    expect(item.name).toBe('Second Chance');
    expect(item.type).toBe('feat');
    expect(item.system.type).toEqual({ value: 'race', subtype: '' });
    expect(item.system.uses.max).toBe('1');
    expect(Object.keys(item.system.activities)).toHaveLength(1);
    expect(item.flags.builder5e.level).toBe(0);
  });

  it('raça sem entrada no overlay não gera item nenhum', () => {
    expect(buildSpeciesTraitItems({ name: 'Nao Existe', source: 'XPHB', entries: [] }, raceDb)).toEqual([]);
  });
});
