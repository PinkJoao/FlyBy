// =============================================================================
// playCatalog.test: testes do catálogo de jogo
// =============================================================================
// FUNÇÕES
//   feat(name, system, extra): um item de feat do ator.
//   act(type, extra): uma activity com custo de ação.
//   classItem(identifier, levels, advancement): um item de classe com escalas.
//   baseDerived(extra): uma derivação mínima.
//
// O QUE FAZ
//   Também as armas naturais lidas na prosa (Claws, Horns, Dragon Hide, o Animal Enhancement só
//   com a opção escolhida, DDL-0239).
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
  spellMechanics, hitDiceByFace, initiativeBonus, derivePlayCatalog, withMartialArts, spendsChannelDivinity, naturalAttacks, spellTypeOptions,
  itemSpellOrigins, spellStores,
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

  it('a regra condicional do ladino (marcial com Finesse ou Light) dá o PB pela lista de armas', () => {
    const rogue = {
      ...derived,
      weapons: ['Simple Weapons', 'Martial weapons that have the Finesse or Light property'],
      weaponNames: ['Rapier', 'Scimitar', 'Shortsword'],
    };
    const rapier = weaponAttacks(character, rogue).find((a) => a.name === 'Rapier');
    expect(rapier).toMatchObject({ proficient: true });
    expect(rapier.toHit.parts.map((p) => p.label)).toContain('Proficiency');
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
    expect(catalog.rollData.attributes.hd).toEqual({ largestAvailable: '1d10', smallestAvailable: '1d8', largestFace: 10, smallestFace: 8 });
    expect(catalog.checks.abilities.find((a) => a.ability === 'wis')).toEqual({
      ability: 'wis', score: 18, mod: 4, save: 7, saveProf: true,
      checkParts: [{ kind: 'ability', ability: 'wis', value: 4 }],
      saveParts: [{ kind: 'ability', ability: 'wis', value: 4 }, { kind: 'proficiency', level: 1, value: 3 }],
    });
    expect(catalog.checks.skills.find((s) => s.skill === 'prc')).toMatchObject({
      bonus: 7, prof: 1, parts: [{ kind: 'ability', ability: 'wis', value: 4 }, { kind: 'proficiency', level: 1, value: 3 }],
    });
    expect(catalog.stats).toEqual({ ac: 16, hasArmor: false, acBreakdown: [], hpMax: 38, profBonus: 3, level: 5, initiative: 2, speed: null, speeds: {} });
    expect(catalog.attacks.map((a) => a.key)).toEqual(['unarmed']);
  });

  it('sem ator, as features ficam de fora e o problema é registrado', () => {
    const c = derivePlayCatalog(character, null, { derived, actor: null });
    expect(c.actions).toEqual([]);
    expect(c.problems[0].where).toBe('actor');
  });
});

describe('withMartialArts', () => {
  const derived = { modifiers: { str: -1, dex: 4 }, armorClass: { hasArmor: false, hasShield: false } };
  const rollData = { 'scale.monk.die': '1d8' };
  const weapon = (name, extra) => ({ kind: 'weapon', name, range: 'melee', category: 'simple', ability: 'str', properties: [], toHit: { total: 2, parts: [{ label: 'Strength', formula: -1 }, { label: 'Proficiency', formula: 3 }] }, damage: { dice: '1d6', bonus: -1, types: ['piercing'] }, ...extra });
  const unarmed = { kind: 'unarmed', name: 'Unarmed Strike', range: 'melee', ability: 'str', toHit: { total: 2, parts: [{ label: 'Strength', formula: -1 }, { label: 'Proficiency', formula: 3 }] }, damage: { dice: null, bonus: 0, types: ['bludgeoning'] } };
  const ctx = { derived, rollData, features: ['martial arts'] };

  it('o desarmado rola o dado da tabela com DES, sem o 1 fixo', () => {
    const [u] = withMartialArts([unarmed], ctx);
    expect(u).toMatchObject({ ability: 'dex', martialArts: true, toHit: { total: 7 }, damage: { dice: '1d8', bonus: 4, types: ['bludgeoning'] } });
    expect(u.toHit.parts[0]).toEqual({ label: 'Dexterity', formula: 4 });
  });

  it('arma de monge troca o dado pelo maior e guarda o bônus mágico', () => {
    const [j] = withMartialArts([weapon('Javelin', { damage: { dice: '1d6', bonus: 0, types: ['piercing'] } })], ctx);
    expect(j.damage).toEqual({ dice: '1d8', bonus: 5, types: ['piercing'] });
    const [q] = withMartialArts([weapon('Quarterstaff', { damage: { dice: '1d10', bonus: -1, types: ['bludgeoning'] } })], ctx);
    expect(q.damage.dice).toBe('1d10');
  });

  it('marcial pesada, à distância, com armadura ou sem a feature ficam como estão', () => {
    const heavy = weapon('Greatsword', { category: 'martial', properties: ['H', '2H'] });
    const shortsword = weapon('Shortsword', { category: 'martial', properties: ['F', 'L'] });
    const bow = weapon('Shortbow', { range: 'ranged' });
    const out = withMartialArts([heavy, shortsword, bow], ctx);
    expect(out[0]).toBe(heavy);
    expect(out[1].martialArts).toBe(true);
    expect(out[2]).toBe(bow);
    expect(withMartialArts([unarmed], { ...ctx, derived: { ...derived, armorClass: { hasArmor: true } } })[0]).toBe(unarmed);
    expect(withMartialArts([unarmed], { ...ctx, features: [] })[0]).toBe(unarmed);
  });
});


describe('spendsChannelDivinity', () => {
  const f = (name, text) => ({ name, entries: [text] });
  it('a opção que gasta o Channel Divinity, pela frase ou pelo nome', () => {
    expect(spendsChannelDivinity(f('Conquering Presence', 'You can use your Channel Divinity to exude a terrifying presence.'))).toBe(true);
    expect(spendsChannelDivinity(f('Holy Bolt', 'As a Bonus Action, you expend a use of your Channel Divinity to make a ranged spell attack.'))).toBe(true);
    expect(spendsChannelDivinity(f("Oketra's Blessing", 'you can use your reaction to grant that creature a +10 bonus, using your Channel Divinity.'))).toBe(true);
    expect(spendsChannelDivinity(f('Channel Divinity: Touch of Death', 'When you hit a creature with a melee attack, you can deal extra necrotic damage.'))).toBe(true);
  });
  it('nem a que só cita as opções nem a feature guarda-chuva', () => {
    expect(spendsChannelDivinity(f('Inescapable Destruction', "Necrotic damage dealt by your cleric spells and Channel Divinity options ignores resistance."))).toBe(false);
    expect(spendsChannelDivinity(f('Supreme Healing', 'When you would roll dice to restore Hit Points with a spell or Channel Divinity, use the highest number.'))).toBe(false);
    expect(spendsChannelDivinity(f('Channel Divinity', 'You can use your Channel Divinity to fuel magical effects.'))).toBe(false);
  });
});

describe('armas naturais pela prosa (DDL-0239)', () => {
  const d = { modifiers: { str: 3 }, proficiencyBonus: 2 };
  const f = (name, entries) => ({ name, entries });

  it('"the strike deals 1d6 + your Strength modifier slashing damage" vira um Unarmed Strike', () => {
    const [a] = naturalAttacks([f('Claws', ['You have claws that you can use to make unarmed strikes. When you hit with them, the strike deals 1d6 + your Strength modifier slashing damage, instead of the bludgeoning damage normal for an unarmed strike.'])], d);
    expect(a).toMatchObject({ name: 'Unarmed Strike (Claws)', kind: 'unarmed', toHit: { total: 5 }, damage: { dice: '1d6', bonus: 3, types: ['slashing'] } });
  });

  it('"plus your Strength modifier" e o texto num item de lista sem nome (Tauren, Dragon Hide)', () => {
    expect(naturalAttacks([f('Horns', ['When you hit with your Unarmed Strike and deal damage, you can deal Piercing damage equal to 1d6 plus your Strength modifier instead of the normal damage of an Unarmed Strike.'])], d)[0].damage).toMatchObject({ dice: '1d6', types: ['piercing'] });
    expect(naturalAttacks([f('Dragon Hide', [{ type: 'list', items: ['The claws are natural weapons. If you hit with them, you deal slashing damage equal to 1d4 + your Strength modifier, instead of the normal bludgeoning damage.'] }])], d)[0]).toMatchObject({ name: 'Unarmed Strike (Dragon Hide)', damage: { dice: '1d4' } });
  });

  it('numa feature de opções, só a escolhida (Animal Enhancement)', () => {
    const ae = f('Animal Enhancement', [{ type: 'list', items: [{ type: 'item', name: 'Grappling Appendages', entries: ['If you hit with it, the target takes bludgeoning damage equal to 1d6 + your Strength modifier, instead of the bludgeoning damage normal for an unarmed strike.'] }, { type: 'item', name: 'Manta Glide', entries: ['You can glide.'] }] }]);
    expect(naturalAttacks([ae], d)).toEqual([]);
    expect(naturalAttacks([ae], d, new Set(['Grappling Appendages'])).map((a) => a.name)).toEqual(['Unarmed Strike (Grappling Appendages)']);
  });
});

describe('tipo de dano à escolha nas magias (DDL-0240)', () => {
  it('todos os do dado com "of your choice"; só o par em "(your choice)"', () => {
    expect(spellTypeOptions({ damageInflict: ['acid', 'cold', 'fire'], entries: ['You hurl an orb. Choose Acid, Cold, or Fire damage of your choice.'] })).toEqual(['acid', 'cold', 'fire']);
    expect(spellTypeOptions({ damageInflict: ['necrotic', 'radiant', 'thunder'], entries: ['Each creature takes 5d6 Thunder damage and 5d6 Radiant or Necrotic damage (your choice).'] })).toEqual(['radiant', 'necrotic']);
    expect(spellTypeOptions({ damageInflict: ['bludgeoning', 'cold'], entries: ['2d10 Bludgeoning damage and 4d6 Cold damage.'] })).toBeNull();
  });
});

describe('o modificador e o tipo do dano pela frase (DDL-0245)', () => {
  it('soma o modificador só no dado da frase que diz', () => {
    const sw = spellMechanics({ level: 2, damageInflict: ['force'], spellAttack: ['M'], entries: ['On a hit, the target takes Force damage equal to {@damage 1d8} plus your spellcasting ability modifier.'] }, 3);
    expect(sw.damage).toMatchObject({ dice: '1d8', addMod: true });
    const bigby = spellMechanics({ level: 5, damageInflict: ['bludgeoning', 'force'], entries: ['Clenched Fist. The target takes {@damage 5d8} Force damage.', 'Grasping Hand. You deal {@damage 2d6} plus your spellcasting ability modifier Bludgeoning damage.'] }, 9);
    expect(bigby.damage.addMod).toBeUndefined();
  });
  it('sem damageInflict, os tipos vêm do par do texto (Holy Star of Mystra)', () => {
    const star = spellMechanics({ level: 8, spellAttack: ['R'], entries: ['On a hit, the target takes Force or Radiant damage (your choice) equal to {@damage 4d10} plus your spellcasting ability modifier.'] }, 15);
    expect(star.damage).toMatchObject({ dice: '4d10', types: ['force', 'radiant'], typeOptions: ['force', 'radiant'], addMod: true });
  });
});

describe('o dano que só vem depois do lançamento (DDL-0247)', () => {
  it("Hunter's Mark e Produce Flame: `later`; Fireball e Witch Bolt não", () => {
    const mark = { name: "Hunter's Mark", level: 1, damageInflict: ['force'], entries: ['You magically mark one creature you can see within range as your quarry. Until the spell ends, you deal an extra {@damage 1d6} Force damage to the target whenever you hit it with an attack roll.'] };
    const flame = { name: 'Produce Flame', level: 0, damageInflict: ['fire'], spellAttack: ['R'], entries: ['A flickering flame appears in your hand and remains there for the duration.', 'Until the spell ends, you can take a Magic action to hurl fire at a creature or an object within 60 feet of you. Make a ranged spell attack. On a hit, the target takes {@damage 1d8} Fire damage.'] };
    const fireball = { name: 'Fireball', level: 3, damageInflict: ['fire'], entries: ['A bright streak flashes from you to a point you choose within range and then blossoms with a low roar into a fiery explosion. Each creature in a 20-foot-radius Sphere centered on that point makes a Dexterity saving throw, taking {@damage 8d6} Fire damage on a failed save or half as much damage on a successful one.'] };
    const bolt = { name: 'Witch Bolt', level: 1, damageInflict: ['lightning'], spellAttack: ['R'], entries: ['A beam of crackling energy lances toward a creature within range, forming a sustained arc of lightning between you and the target. Make a ranged spell attack against it. On a hit, the target takes {@damage 2d12} Lightning damage.', 'On each of your subsequent turns, you can take a Bonus Action to deal {@damage 1d12} Lightning damage to the target automatically, even if the first attack missed.'] };
    expect(spellMechanics(mark, 5).damage.later).toBe(true);
    expect(spellMechanics(flame, 5).damage.later).toBe(true);
    expect(spellMechanics(fireball, 5).damage.later).toBeUndefined();
    expect(spellMechanics(bolt, 5).damage.later).toBeUndefined();
  });
});

describe('itemSpellOrigins: as magias dos itens (DDL-0257)', () => {
  const sp = (name, level) => ({ name, source: 'XPHB', level, school: 'V', time: [{ number: 1, unit: 'action' }], duration: [{ type: 'instant' }], entries: [] });
  const db = { 'spells-xphb': { spell: [sp('Fireball', 3), sp('Jump', 1), sp('Misty Step', 2)] } };
  const wand = {
    uid: 'w1', attuned: true,
    raw: { name: 'Wand of Fireballs', reqAttune: 'by a spellcaster', charges: 7, attachedSpells: { charges: { 1: ['fireball|xphb'] } }, entries: ['While holding it, you can expend no more than 3 charges to cast {@spell Fireball|XPHB} (save 15) from it. You can increase the spell\'s level by 1 for each additional charge you expend.'] },
  };
  const ring = { uid: 'r1', attuned: true, raw: { name: 'Ring of Jumping', reqAttune: true, attachedSpells: { will: ['jump|xphb'] }, entries: ['You can cast Jump from the ring.'] } };
  const cloak = { uid: 'c1', attuned: false, raw: { name: 'Cloak', reqAttune: true, attachedSpells: { daily: { '1e': ['misty step|xphb'] } }, entries: [] } };

  it('cargas: a chave, o custo, o upcast e o teto do texto; a CD do texto', () => {
    const { origins } = itemSpellOrigins([wand], db, 10, { spellDc: 14, spellAttack: 6 });
    expect(origins).toHaveLength(1);
    expect(origins[0]).toMatchObject({ key: 'item:w1', kind: 'item', label: 'Wand of Fireballs', saveDc: 15, attackBonus: 6 });
    expect(origins[0].spells[0]).toMatchObject({ name: 'Fireball', level: 3, itemUid: 'w1', chargeKey: 'charges:w1', chargeCost: 1, chargeUpcast: true, chargeCap: 3 });
  });

  it('à vontade e por dia (o uso vira recurso); o item não atunado não lança', () => {
    const { origins, resources } = itemSpellOrigins([ring, { ...cloak, attuned: true }, cloak], db, 5, { spellDc: 13 });
    expect(origins.map((o) => o.spells[0].castType)).toEqual(['will', 'daily']);
    expect(origins[0].saveDc).toBe(13);
    expect(resources).toEqual([expect.objectContaining({ key: 'granted:item:c1|misty step', max: 1, recovery: [{ period: 'day', type: 'recoverAll' }] })]);
    expect(itemSpellOrigins([cloak], db, 5).origins).toEqual([]);
  });
});

describe('a magia escolhida e a guardada (DDL-0258)', () => {
  const sp = (name, level) => ({ name, source: 'XPHB', level, school: 'C', time: [{ number: 1, unit: 'action' }], duration: [{ type: 'instant' }], entries: [] });
  const db = { 'spells-xphb': { spell: [sp('Misty Step', 2), sp('Shield', 1)] } };
  const staff = { uid: 's1', attuned: true, boundSpell: 'Misty Step|XPHB', raw: { name: 'Enspelled Staff (Level 2)', reqAttune: true, charges: 6, entries: ['Bound into this staff is a level 2 spell.', 'The spell\'s saving throw DC is 13, and its attack bonus is 5.'] } };
  const ring = { uid: 'r1', attuned: true, stored: [{ name: 'Shield', source: 'XPHB', level: 1, dc: 15, attack: 7, mod: 3 }], raw: { name: 'Ring of Spell Storing', reqAttune: true, entries: ['The ring can store up to 5 levels worth of spells at a time.', 'Any creature can cast a spell of 1st through 5th level into the ring.'] } };

  it('o Enspelled lança a escolhida pela carga, com a CD e o ataque do texto', () => {
    const [o] = itemSpellOrigins([staff], db, 9).origins;
    expect(o).toMatchObject({ saveDc: 13, attackBonus: 5 });
    expect(o.spells[0]).toMatchObject({ name: 'Misty Step', chargeKey: 'charges:s1', chargeCost: 1, bound: true });
    expect(itemSpellOrigins([{ ...staff, boundSpell: null }], db, 9).origins).toEqual([]);
  });

  it('a guardada vem com o círculo e os números de quem lançou; o lugar que sobra', () => {
    const [o] = itemSpellOrigins([ring], db, 9, { spellDc: 17 }).origins;
    expect(o.spells[0]).toMatchObject({ name: 'Shield', key: 'spell:item:r1|Shield#0', stored: { uid: 'r1', index: 0, level: 1, dc: 15, attack: 7, mod: 3 } });
    expect(spellStores([ring])).toEqual([{ uid: 'r1', name: 'Ring of Spell Storing', one: false, maxLevel: 5, room: 4 }]);
    expect(spellStores([{ ...ring, attuned: false }])).toEqual([]);
  });
});

describe('itemSpellOrigins: as formas do DDL-0262', () => {
  const sp = (name, level) => ({ name, source: 'XPHB', level, school: 'V', time: [{ number: 1, unit: 'action' }], duration: [{ type: 'instant' }], entries: [] });
  const db = { 'spells-xphb': { spell: [sp('Fabricate', 4), sp('Move Earth', 6), sp('Web', 2), sp('Fog Cloud', 1), sp('Bane', 1), sp('Flesh to Stone', 6), sp('Detect Magic', 1), sp('Knock', 2), sp('Thunderwave', 1), sp('Wish', 9), sp('Haste', 3)] } };
  const it1 = (raw) => itemSpellOrigins([{ uid: 'i1', attuned: true, raw: { reqAttune: true, entries: [], ...raw } }], db, 11, {});

  it('daily sem "e" é um pool só; a prosa "that spell again" separa', () => {
    const adze = it1({ name: 'Adze', attachedSpells: { daily: { 1: ['fabricate|xphb', 'move earth|xphb'] } } });
    expect(adze.resources).toEqual([expect.objectContaining({ key: 'granted:item:i1|daily:1', max: 1, name: 'Adze: fabricate or move earth' })]);
    expect(adze.origins[0].spells.map((s) => s.uses)).toEqual(['granted:item:i1|daily:1', 'granted:item:i1|daily:1']);
    const horn = it1({ name: 'Horn', attachedSpells: { daily: { 1: ['web|xphb', 'fog cloud|xphb'] } }, entries: ["Once the horn has been used to cast a spell, it can't be used to cast that spell again until the next dawn."] });
    expect(horn.resources.map((r) => r.key)).toEqual(['granted:item:i1|web', 'granted:item:i1|fog cloud']);
  });

  it('rest volta no curto, limited não volta, ritual só como ritual', () => {
    expect(it1({ name: 'Shield', attachedSpells: { rest: { '1e': ['bane|xphb'] } } }).resources[0].recovery).toEqual([{ period: 'sr', type: 'recoverAll' }]);
    const bracelet = it1({ name: 'Bracelet', attachedSpells: { limited: { 3: ['flesh to stone|xphb'] } } });
    expect(bracelet.resources[0]).toMatchObject({ max: 3, recovery: [] });
    expect(bracelet.origins[0].spells[0]).toMatchObject({ castType: 'limited', count: 3 });
    expect(it1({ name: 'Scale', attachedSpells: { ritual: ['detect magic|xphb'] } }).origins[0].spells[0]).toMatchObject({ castType: 'ritual', ritualOnly: true });
  });

  it('a lista solta: carga pelo texto, uma vez por dia pela frase, senão pelo texto do item', () => {
    const charm = it1({ name: 'Charm', charges: 3, attachedSpells: ['knock|xphb'], entries: ['This charm has 3 charges. You can expend 1 charge as an action to cast the knock spell.'] });
    expect(charm.origins[0].spells[0]).toMatchObject({ chargeKey: 'charges:i1', chargeCost: 1 });
    const axe = it1({ name: 'Axe', attachedSpells: { other: ['knock|xphb'] }, entries: ['You can cast Knock from the axe. You can\'t use this property again until the next dawn.'] });
    expect(axe.origins[0].spells[0]).toMatchObject({ castType: 'daily', count: 1 });
    expect(it1({ name: 'Chime', attachedSpells: ['knock|xphb'], entries: ['As a Magic action, you can strike the chime to cast Knock.'] }).origins[0].spells[0].castType).toBe('item');
    expect(it1({ name: 'Book', charges: 3, attachedSpells: ['knock|xphb'], entries: ['It functions as a spellbook for you.'] }).origins).toEqual([]);
    expect(it1({ name: 'Potion of Speed', type: 'P', attachedSpells: ['haste|xphb'] }).origins).toEqual([]);
  });

  it('cargas sem número no campo e o círculo fixo de "magia#4"', () => {
    const ring = it1({ name: 'Ring of Three Wishes', attachedSpells: { charges: { 1: ['wish|xphb'] } }, entries: ['While wearing this ring, you can expend 1 of its 3 charges to cast Wish from it.'] });
    expect(ring.origins[0].spells[0]).toMatchObject({ name: 'Wish', chargeKey: 'charges:i1' });
    expect(it1({ name: 'Scepter', attachedSpells: { will: ['thunderwave#4'] } }).origins[0].spells[0]).toMatchObject({ name: 'Thunderwave', level: 1, castLevel: 4 });
  });
});
