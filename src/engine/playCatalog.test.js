// =============================================================================
// playCatalog.test: testes do catálogo de jogo
// =============================================================================
// FUNÇÕES
//   feat(name, system, extra): um item de feat do ator.
//   act(type, extra): uma activity com custo de ação.
//   classItem(identifier, levels, advancement): um item de classe com escalas.
//   baseDerived(extra): uma derivação mínima.
//
// DECISÕES E ARMADILHAS
//   - O ator e a derivação são FIXTURES pequenas, passadas pelo `opts` do
//     derivePlayCatalog: os testes miram as regras de leitura (chaves, consumo,
//     escalas), não a montagem do ator, que o survey cobre sobre a matriz inteira.
//   - Cada forma de alvo de consumo tem o seu teste, e o que NÃO resolve tem de
//     virar problema (o survey conta nisso).
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  evalUses, scaleValues, scaleRollData, actorResources, weaponAttacks, unarmedStrike, cantripAttacks,
  spellMechanics, hitDiceByFace, initiativeBonus, derivePlayCatalog,
} from './playCatalog';

const feat = (name, system = {}, extra = {}) => ({ type: 'feat', name, system: { identifier: '', uses: { max: '' }, ...system }, ...extra });
const act = (type, extra = {}) => ({ _id: `${type}1`, type, name: '', activation: { type: 'action' }, consumption: { targets: [] }, ...extra });
const classItem = (identifier, levels, advancement) => ({
  type: 'class', name: identifier, system: { identifier, levels, advancement: Object.fromEntries(advancement.map((a, i) => [`a${i}`, { type: 'ScaleValue', ...a }])) },
});
const baseDerived = (extra = {}) => ({
  level: 5,
  proficiencyBonus: 3,
  scores: { str: 16, dex: 14, con: 12, int: 10, wis: 18, cha: 8 },
  modifiers: { str: 3, dex: 2, con: 1, int: 0, wis: 4, cha: -1 },
  saves: { str: 3, dex: 2, con: 1, int: 0, wis: 7, cha: 2 },
  proficientSaves: ['wis', 'cha'],
  skills: { prc: { bonus: 7, proficiency: 1 } },
  classBreakdown: [{ classId: 'cleric', level: 4, hitDie: 8 }, { classId: 'fighter', level: 1, hitDie: 10 }],
  weapons: ['Simple Weapons'],
  inventory: [],
  maxHp: 38,
  armorClass: { total: 16 },
  spellcasting: { origins: [], slots: {}, pactSlots: null },
  ...extra,
});

describe('escalas', () => {
  const actor = {
    items: [
      classItem('cleric', 5, [
        { title: 'Divine Spark', configuration: { identifier: '', type: 'number', scale: { 2: { value: 1 }, 7: { value: 2 } } } },
        { title: 'Channel Divinity Uses', configuration: { identifier: 'channel-divinity', type: 'number', scale: { 2: { value: 2 }, 6: { value: 3 } } } },
        { title: 'Channel Divinity', configuration: { identifier: '', type: 'number', scale: { 1: { value: 0 }, 2: { value: 9 } } } },
        { title: 'Divine Strike', configuration: { identifier: 'strike', type: 'dice', scale: { 3: { number: 1, faces: 8 } } } },
      ]),
      { type: 'subclass', name: 'College of Whispers', system: { identifier: 'whispers', classIdentifier: 'cleric', advancement: { b: { type: 'ScaleValue', title: 'Psychic Blades', configuration: { identifier: 'psychic-blades', scale: { 3: { n: 2, die: 6 } } } } } } },
    ],
  };

  it('sem identifier a chave é o slug do título, e o explícito ganha na colisão', () => {
    const v = scaleValues(actor, 5);
    expect(v['cleric.divine-spark']).toBe(1);
    expect(v['cleric.channel-divinity']).toBe(2);
  });

  it('escala de dado: contagem na chave nua, .number e .faces à parte', () => {
    const v = scaleValues(actor, 5);
    expect(v['cleric.strike']).toBe(1);
    expect(v['cleric.strike.faces']).toBe(8);
  });

  it('para as fórmulas, o dado vira "NdF" com .die, e o dono responde pelo slug do nome', () => {
    const d = scaleRollData(actor, 5);
    expect(d['scale.cleric.strike']).toBe('1d8');
    expect(d['scale.cleric.strike.die']).toBe('d8');
    expect(d['scale.whispers.psychic-blades']).toBe('2d6');
    expect(d['scale.college-of-whispers.psychic-blades']).toBe('2d6');
  });

  it('evalUses aceita .number e .faces', () => {
    expect(evalUses('@scale.psi.die.number', { scales: { 'psi.die.number': 4 } })).toBe(4);
    expect(evalUses('@scale.psi.die', { scales: { 'psi.die': 4 } })).toBe(4);
  });
});

describe('actorResources', () => {
  it('lê o pool do item e o de cada activity, e pula ação básica', () => {
    const actor = {
      items: [
        feat('Second Wind', { identifier: 'second-wind', uses: { max: '2', recovery: [{ period: 'sr', type: 'recoverAll' }] } }),
        feat('Natural Recovery', { identifier: 'natural-recovery', activities: { a: { name: 'Cast Spell', uses: { max: '1' } }, b: { name: 'Recover Slots', uses: { max: '1' } } } }),
        feat('Dash', { uses: { max: '1' } }, { flags: { builder5e: { basicAction: true } } }),
      ],
    };
    expect(actorResources(actor, baseDerived()).map((r) => [r.key, r.name, r.max])).toEqual([
      ['pool:second-wind', 'Second Wind', 2],
      ['pool:natural-recovery:cast-spell', 'Natural Recovery: Cast Spell', 1],
      ['pool:natural-recovery:recover-slots', 'Natural Recovery: Recover Slots', 1],
    ]);
  });

  it('máximo que não resolve vira problema; zero sai em silêncio', () => {
    const problems = [];
    const actor = { items: [feat('Mystery', { uses: { max: '@scale.x.nope' } }), feat('Weak', { uses: { max: '@abilities.cha.mod' } })] };
    expect(actorResources(actor, { ...baseDerived(), modifiers: { cha: 0 } }, problems)).toEqual([]);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toMatch(/does not resolve/);
  });
});

describe('ataques', () => {
  const derived = baseDerived({
    inventory: [
      { uid: 'u1', group: 'weapon', kind: 'melee', category: 'martial', equipped: false, raw: { name: 'Rapier', dmg1: '1d8', dmgType: 'P', property: ['F'], mastery: ['Vex|XPHB'] } },
      { uid: 'u2', group: 'weapon', kind: 'ranged', category: 'simple', equipped: true, raw: { name: 'Light Crossbow', dmg1: '1d8', dmgType: 'P', property: ['A', 'LD'], range: '80/320', bonusWeapon: '+1' } },
    ],
  });
  const character = { classes: [{ choices: { m: { kind: 'weapon', picks: ['Rapier|XPHB'] } } }] };

  it('estrutura o acerto em partes rotuladas e o dano em dado, bônus e tipo', () => {
    const [bow, rapier] = weaponAttacks(character, derived);
    expect(bow).toMatchObject({ key: 'weapon:u2', range: 'ranged', ability: 'dex', proficient: true, ammunition: true, distance: '80/320' });
    expect(bow.toHit.total).toBe(6);
    expect(bow.toHit.parts.map((p) => p.label)).toEqual(['Dexterity', 'Proficiency', 'Magic']);
    expect(bow.damage).toEqual({ dice: '1d8', bonus: 3, types: ['piercing'] });
    expect(rapier).toMatchObject({ ability: 'str', proficient: false, mastery: 'Vex' });
    expect(rapier.toHit.total).toBe(3);
  });

  it('o desarmado é 1 + FOR de concussão, com o PB', () => {
    expect(unarmedStrike(derived)).toMatchObject({ toHit: { total: 6 }, damage: { dice: null, bonus: 4, types: ['bludgeoning'] } });
  });

  it('cantrip de save e de ataque, com o dado do nível', () => {
    const spellcasting = {
      origins: [{
        key: 'class:cleric', saveDc: 15, attackBonus: 7,
        cantrips: [
          { raw: { name: 'Sacred Flame', level: 0, damageInflict: ['radiant'], savingThrow: ['dexterity'], scalingLevelDice: { scaling: { 1: '1d8', 5: '2d8' } }, range: { type: 'point', distance: { type: 'feet', amount: 60 } } } },
          { raw: { name: 'Guidance', level: 0 } },
        ],
      }],
    };
    expect(cantripAttacks(spellcasting, 5)).toEqual([expect.objectContaining({
      key: 'spell:class:cleric|Sacred Flame', attack: null, save: { ability: 'dex', dc: 15 }, damage: { dice: '2d8', types: ['radiant'] },
    })]);
  });
});

describe('spellMechanics', () => {
  it('lê ataque, save, dano, cura e upcast do dado', () => {
    expect(spellMechanics({
      level: 3, damageInflict: ['fire'], savingThrow: ['dexterity'],
      entries: ['takes {@damage 8d6} fire damage'], entriesHigherLevel: [{ entries: ['increases by {@scaledamage 8d6|3-9|1d6}'] }],
    }, 5)).toEqual({ attack: null, save: 'dex', damage: { dice: '8d6', types: ['fire'] }, heal: null, upcast: '1d6' });
    expect(spellMechanics({ level: 1, miscTags: ['HL'], entries: ['regains {@dice 2d8} plus'] }, 5).heal).toEqual({ dice: '2d8', addMod: false });
    expect(spellMechanics({ level: 1, miscTags: ['HL'], entries: ['regains {@dice 2d8} plus your spellcasting ability modifier'] }, 5).heal.addMod).toBe(true);
    expect(spellMechanics({ level: 0, spellAttack: ['R'], damageInflict: ['force'], entries: ['{@damage 1d10}'] }, 11).attack).toBe('R');
  });
});

describe('ficha', () => {
  it('dados de vida por face, da maior para a menor', () => {
    expect(hitDiceByFace(baseDerived())).toEqual([{ faces: 10, count: 1 }, { faces: 8, count: 4 }]);
  });

  it('iniciativa soma o PB com o Alert', () => {
    expect(initiativeBonus({ origin: { originFeat: { id: 'Alert' } } }, baseDerived())).toBe(5);
    expect(initiativeBonus({ origin: {} }, baseDerived())).toBe(2);
  });
});

describe('derivePlayCatalog', () => {
  const actor = {
    items: [
      classItem('cleric', 4, [{ title: 'Channel Divinity Uses', configuration: { identifier: 'channel-divinity', scale: { 2: { value: 2 } } } }]),
      feat('Channel Divinity', {
        identifier: 'channel-divinity',
        uses: { max: '@scale.cleric.channel-divinity', recovery: [{ period: 'lr', type: 'recoverAll' }] },
        activities: {
          a: act('heal', { name: 'Divine Spark', consumption: { targets: [{ type: 'itemUses', value: '1', target: '' }] }, healing: { custom: { enabled: true, formula: '1d8 + @abilities.wis.mod' }, types: ['healing'] } }),
          b: act('save', { name: 'Turn Undead', consumption: { targets: [{ type: 'itemUses', value: '1' }] }, save: { ability: ['wis'], dc: { calculation: 'spellcasting' } } }),
        },
      }),
      feat('Sear Undead', { identifier: 'sear-undead', activities: { a: act('save', { consumption: { targets: [{ type: 'itemUses', value: '1', target: 'feat:channel-divinity-cleric' }] }, save: { ability: ['wis'], dc: { calculation: 'wis' } } }) } }),
      feat('Radiance', { identifier: 'radiance', activities: { a: act('utility', { consumption: { targets: [{ type: 'itemUses', value: '1', target: { consumes: { name: 'Channel Divinity' } } }] } }) } }),
      feat('Guided', { identifier: 'guided', activities: { a: act('utility', { consumption: { targets: [{ type: 'itemUses', value: '1', target: { prop: 'classFeature', uid: 'Channel Divinity|Cleric|XPHB|2' } }] } }) } }),
      feat('Lost', { identifier: 'lost', activities: { a: act('utility', { consumption: { targets: [{ type: 'itemUses', value: '1', target: { consumes: { name: 'Nothing' } } }] } }) } }),
      feat('Cunning', { identifier: 'cunning', activities: { a: act('utility', { consumption: { targets: [{ type: 'attribute', target: 'spells.pact.value', value: '-1' }] } }) } }),
      feat('Healing Light', { identifier: 'healing-light', activities: { a: act('heal', { healing: { custom: { enabled: true, formula: '(@scaling)d6' } } }) } }),
      feat('Broken', { identifier: 'broken', activities: { a: act('heal', { healing: { custom: { enabled: true, formula: '@scale.nope.die' } } }) } }),
      feat('Passive', { identifier: 'passive', activities: { a: act('heal', { activation: { type: '' }, healing: { custom: { enabled: true, formula: '2' } } }) } }),
      feat('Dash', {}, { flags: { builder5e: { basicAction: true } }, system: { activities: { a: act('utility') } } }),
    ],
  };
  const derived = baseDerived({
    spellcasting: {
      slots: { 1: 4, 2: 3 },
      pactSlots: { slots: 1, level: 1 },
      origins: [{
        key: 'class:cleric', kind: 'class', label: 'Cleric', ability: 'wis', saveDc: 15, attackBonus: 7, isPact: false,
        cantrips: [], prepared: [{ raw: { name: 'Bless', level: 1, duration: [{ concentration: true }] } }], unprepared: [],
        alwaysPrepared: [{ raw: { name: 'Misty Step', level: 2 }, castType: 'daily', uses: 1 }, { raw: { name: 'Alter Self', level: 2 }, castType: 'will' }],
        arcanumSpells: [{ raw: { name: 'Eyebite', level: 6 } }],
      }],
    },
  });
  const character = { origin: {}, classes: [{ classId: 'cleric', level: 4, choices: {} }] };
  const catalog = derivePlayCatalog(character, null, { derived, actor });
  const action = (key) => catalog.actions.find((a) => a.key === key);

  it('recursos: dados de vida, slots, pacto, magia concedida, arcanum e pools', () => {
    expect(catalog.resources.map((r) => `${r.key}=${r.max}`)).toEqual([
      'hd:d10=1', 'hd:d8=4', 'slot:1=4', 'slot:2=3', 'pact=1',
      'granted:class:cleric|Misty Step=1', 'granted:class:cleric|Eyebite=1', 'pool:channel-divinity=2',
    ]);
    expect(catalog.resources.find((r) => r.key === 'granted:class:cleric|Misty Step').recovery).toEqual([{ period: 'day', type: 'recoverAll' }]);
  });

  it('consumo: o próprio pool, prefixo, nome do item e uid de feature', () => {
    const cd = action('action:channel-divinity');
    expect(cd.pool).toBe('pool:channel-divinity');
    expect(cd.activities.map((a) => a.consumes)).toEqual([[{ key: 'pool:channel-divinity', amount: 1 }], [{ key: 'pool:channel-divinity', amount: 1 }]]);
    for (const k of ['action:sear-undead', 'action:radiance', 'action:guided']) {
      expect(action(k).activities[0].consumes).toEqual([{ key: 'pool:channel-divinity', amount: 1 }]);
    }
  });

  it('consumo de atributo vai cru; alvo que não resolve é problema', () => {
    expect(action('action:cunning').activities[0].consumes).toEqual([{ attribute: 'spells.pact.value', formula: '-1' }]);
    expect(action('action:lost').activities[0].consumes).toEqual([]);
    expect(catalog.problems.some((p) => p.where === 'Lost' && /does not resolve/.test(p.message))).toBe(true);
  });

  it('CD de save: a da conjuração da classe, ou 8 + PB + atributo', () => {
    expect(action('action:channel-divinity').activities[1].save).toEqual({ abilities: ['wis'], dc: 15 });
    expect(action('action:sear-undead').activities[0].save.dc).toBe(15);
  });

  it('fórmula: a que resolve passa, a que não resolve é problema, @scaling marca scalable', () => {
    expect(action('action:channel-divinity').activities[0].heal.formula).toBe('1d8 + @abilities.wis.mod');
    expect(action('action:healing-light').activities[0].scalable).toBe(true);
    expect(catalog.problems.some((p) => /@scale\.nope\.die/.test(p.message))).toBe(true);
    expect(catalog.problems.some((p) => /Healing Light/.test(p.where))).toBe(false);
  });

  it('activity sem custo fica fora; a ação básica entra no grupo basic', () => {
    expect(action('action:passive')).toBeUndefined();
    expect(catalog.actions.find((a) => a.name === 'Dash').group).toBe('basic');
  });

  it('magias por origem com preparo, concentração e o pool de uso', () => {
    const [cleric] = catalog.spells;
    expect(cleric).toMatchObject({ key: 'class:cleric', saveDc: 15, attackBonus: 7 });
    expect(cleric.spells.map((s) => [s.name, s.uses ?? null, s.castType ?? null])).toEqual([
      ['Bless', null, null],
      ['Misty Step', 'granted:class:cleric|Misty Step', 'daily'],
      ['Alter Self', null, 'will'],
      ['Eyebite', 'granted:class:cleric|Eyebite', null],
    ]);
    expect(cleric.spells[0].concentration).toBe(true);
  });

  it('dados das fórmulas, testes e números da ficha', () => {
    expect(catalog.rollData).toMatchObject({ prof: 3, abilities: { wis: { mod: 4 } }, classes: { cleric: { levels: 4 } }, 'scale.cleric.channel-divinity': 2 });
    expect(catalog.rollData.attributes.hd).toEqual({ largestAvailable: '1d10', smallestAvailable: '1d8' });
    expect(catalog.checks.abilities.find((a) => a.ability === 'wis')).toEqual({ ability: 'wis', mod: 4, save: 7, saveProf: true });
    expect(catalog.checks.skills.find((s) => s.skill === 'prc')).toMatchObject({ bonus: 7, prof: 1 });
    expect(catalog.stats).toEqual({ ac: 16, hpMax: 38, profBonus: 3, level: 5, initiative: 2, speed: null });
    expect(catalog.attacks.map((a) => a.key)).toEqual(['unarmed']);
  });

  it('sem ator, as features ficam de fora e o problema é registrado', () => {
    const c = derivePlayCatalog(character, null, { derived, actor: null });
    expect(c.actions).toEqual([]);
    expect(c.problems[0].where).toBe('actor');
  });
});
