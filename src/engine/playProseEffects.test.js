// =============================================================================
// playProseEffects.test: o que a prosa declara, lido para o jogo (G2 e G3)
// =============================================================================
// O QUE FAZ
//   Prova a leitura das frases nos dois lados (§6.1): o que tem de entrar (Fey Ancestry,
//   Gnomish Cunning, Hippo Build, Keen Smell, Bloodied Frenzy, Danger Sense) e o que não pode
//   (aliados, inimigos, "give yourself", "doesn't impose", "if you have advantage"), e a
//   escolha da rolagem certa no diálogo, ligada ou desligada. Desde o G3, o bônus (com o
//   alvo da condição da frente), o reroll do 1, o piso e a cura e os temporários do "Use"; o dado
//   somado das marcas de dragão, com ferramentas e o Greater Mark (DDL-0239).
//
// FUNÇÕES
//   feature(name, text, extra): uma feature do catálogo com um parágrafo.
//   effectsFor(features, roll, ctx, opts): os extras de uma rolagem para essas features.
//
// DECISÕES E ARMADILHAS
//   - Os textos são frases reais do 5etools (XPHB, MPMM, AAG, WoW, FRHoF), com as tags.
// -----------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { proseClauses, proseRollEffects, proseEffects, proseUses, exprFormula, fitsProse } from './playProseEffects';
import { rollEffects, applyEffects, castOnceEffects } from './playEffects';

const feature = (name, text, extra = {}) => ({ name, actionKey: `action:${name.toLowerCase()}`, entries: [text], costs: [], ...extra });
const effectsFor = (features, roll, ctx = {}, opts = {}) => proseEffects({ proseEffects: proseRollEffects(features, opts) }, roll, ctx);

const FEY = feature('Fey Ancestry', 'You have Advantage on saving throws you make to avoid or end the {@condition Charmed|XPHB} condition.');
const GNOME = feature('Gnomish Cunning', 'You have Advantage on Intelligence, Wisdom, and Charisma saving throws.');
const HIPPO = feature('Hippo Build', 'You have advantage on Strength-based ability checks and Strength saving throws.');
const SMELL = feature('Keen Smell', 'Thanks to your sensitive trunk, you have advantage on Wisdom ({@skill Perception}), Wisdom ({@skill Survival}), and Intelligence ({@skill Investigation}) checks that involve smell.');

describe('o que entra', () => {
  it('Gnomish Cunning: ligado nas salvaguardas de INT, SAB e CAR, e só nelas', () => {
    expect(effectsFor([GNOME], { kind: 'save', ability: 'wis' })).toMatchObject([{ label: 'Gnomish Cunning', adv: 1, defaultOn: true }]);
    expect(effectsFor([GNOME], { kind: 'save', ability: 'dex' })).toEqual([]);
    expect(effectsFor([GNOME], { kind: 'check', ability: 'wis' })).toEqual([]);
  });

  it('Fey Ancestry: em toda salvaguarda, desligado, com a condição do texto na nota', () => {
    const [e] = effectsFor([FEY], { kind: 'save', ability: 'wis' });
    expect(e).toMatchObject({ adv: 1, defaultOn: false, note: 'To avoid or end the Charmed condition' });
    expect(effectsFor([FEY], { kind: 'check', ability: 'wis' })).toEqual([]);
    expect(effectsFor([FEY], { kind: 'deathSave' })).toEqual([]);
  });

  it('Hippo Build: o substantivo sem atributo herda o anterior; teste de FOR e salvaguarda de FOR', () => {
    const [c] = proseClauses(HIPPO.entries);
    expect(c.groups).toEqual([{ kind: 'check', abilities: ['str'], skills: [] }, { kind: 'save', abilities: ['str'], skills: [] }]);
    expect(effectsFor([HIPPO], { kind: 'check', ability: 'str', skill: 'ath' })[0].defaultOn).toBe(true);
    expect(effectsFor([HIPPO], { kind: 'save', ability: 'str' })).toHaveLength(1);
    expect(effectsFor([HIPPO], { kind: 'initiative' })).toEqual([]);
  });

  it('Keen Smell: as perícias entre parênteses, desligado pelo "that involve smell"', () => {
    const [e] = effectsFor([SMELL], { kind: 'check', ability: 'wis', skill: 'sur' });
    expect(e).toMatchObject({ defaultOn: false, note: 'That involve smell' });
    expect(effectsFor([SMELL], { kind: 'check', ability: 'wis', skill: 'ins' })).toEqual([]);
  });

  it('as condições que o app confere: Bloodied, Incapacitated e uma condição do estado', () => {
    const frenzy = feature('Bloodied Frenzy', 'While {@condition Bloodied|XPHB}, you have Advantage on attack rolls.');
    expect(effectsFor([frenzy], { kind: 'attack' }, { bloodied: false })[0].defaultOn).toBe(false);
    expect(effectsFor([frenzy], { kind: 'attack' }, { bloodied: true })[0].defaultOn).toBe(true);
    const sense = feature('Uncanny Sense', 'You have Advantage on Dexterity saving throws unless you have the {@condition Incapacitated|XPHB} condition.');
    expect(effectsFor([sense], { kind: 'save', ability: 'dex' })[0].defaultOn).toBe(true);
    expect(effectsFor([sense], { kind: 'save', ability: 'dex' }, { conditionIds: ['incapacitated'] })[0].defaultOn).toBe(false);
    const whispers = feature('Gathered Whispers', 'While {@condition Deafened|XPHB}, you have Disadvantage on ability checks and attack rolls.');
    expect(effectsFor([whispers], { kind: 'attack' })[0]).toMatchObject({ dis: 1, defaultOn: false });
    expect(effectsFor([whispers], { kind: 'attack' }, { conditionIds: ['deafened'] })[0].defaultOn).toBe(true);
  });

  it('a feature ativada vale depois de usada: desligada, "After you use"', () => {
    const vow = feature('Watchful Oath', 'You have Advantage on Wisdom saving throws.', { costs: ['bonus'] });
    expect(effectsFor([vow], { kind: 'save', ability: 'wis' }, {}, { activated: (f) => f.costs.length > 0 })[0])
      .toMatchObject({ defaultOn: false, note: 'After you use Watchful Oath' });
  });

  it('"to maintain that Concentration" vale só na concentração', () => {
    const ext = feature('Extended Spell', 'If the affected spell requires {@status Concentration|XPHB}, you have Advantage on any saving throw you make to maintain that Concentration.');
    expect(effectsFor([ext], { kind: 'concentration' })).toHaveLength(1);
    expect(effectsFor([ext], { kind: 'save', ability: 'con' })).toEqual([]);
  });

  it('a oração coordenada e o "Starting at" não são condição', () => {
    const nature = feature('Mechanical Nature', 'You have resistance to poison damage and immunity to disease, and you have advantage on Constitution saving throws.');
    const spirit = feature('Unyielding', 'Starting at 15th level, you have advantage on Wisdom saving throws.');
    expect(effectsFor([nature], { kind: 'save', ability: 'con' })[0].defaultOn).toBe(true);
    expect(effectsFor([spirit], { kind: 'save', ability: 'wis' })[0].defaultOn).toBe(true);
  });
});

describe('o que não entra', () => {
  const none = (text) => expect(proseClauses([text])).toEqual([]);

  it('a vantagem de outra criatura', () => {
    none('Your allies have Advantage on attack rolls against a creature Grappled by you.');
    none('It has advantage on attack rolls and disadvantage on saving throws.');
    none('While your Rage is active, any of your enemies within 5 feet of you have Disadvantage on attack rolls against targets other than you.');
    none('Up to ten other creatures of your choice within 60 feet of you that can hear you gain advantage on attack rolls and saving throws until the start of your next turn.');
  });

  it('o uso de uma vez, o que só tira desvantagem e a vantagem dentro de uma condição', () => {
    none('You can manipulate chaos itself to give yourself Advantage on one D20 Test before you roll the d20.');
    none("Being within 5 feet of an enemy doesn't impose Disadvantage on your attack rolls with crossbows.");
    none('If you take the Attack action on your turn and have advantage on an attack roll against one of the targets, you can forgo the advantage.');
    none("You can use your Sneak Attack against that target even if you don't have advantage on the attack roll.");
  });

  it('"all other" para a leitura (Cloak of Flies fica só com a parte que entende)', () => {
    const [c, ...rest] = proseClauses(['The aura grants you advantage on Charisma ({@skill Intimidation}) checks but disadvantage on all other Charisma checks.']);
    expect(c.groups).toEqual([{ kind: 'check', abilities: ['cha'], skills: ['itm'] }]);
    expect(rest).toEqual([]);
  });

  it('a feature que já tem dono: o registro curado, a ponte do ator e a Rage', () => {
    const danger = feature('Danger Sense', 'You have Advantage on Dexterity saving throws unless you have the Incapacitated condition.');
    expect(proseRollEffects([danger], { bridged: [{ name: 'Danger Sense', mode: 'adv' }] })).toEqual([]);
    expect(proseRollEffects([feature('Sneak Attack', 'You have Advantage on attack rolls.')])).toEqual([]);
    const rage = feature('Rage', 'You have Advantage on Strength checks and Strength saving throws.');
    const catalog = { proseEffects: proseRollEffects([rage]), stats: { hpMax: 30 } };
    expect(rollEffects({ conditions: {}, modifiers: [], damage: 0 }, catalog, { kind: 'save', ability: 'str' }).filter((e) => e.id.startsWith('prose:'))).toEqual([]);
  });
});

describe('no diálogo da rolagem', () => {
  it('rollEffects soma o extra da prosa, com o Bloodied do estado', () => {
    const frenzy = feature('Bloodied Frenzy', 'While Bloodied, you have Advantage on attack rolls.');
    const catalog = { proseEffects: proseRollEffects([frenzy]), stats: { hpMax: 20 } };
    const at = (damage) => rollEffects({ conditions: {}, modifiers: [], damage }, catalog, { kind: 'attack' }).find((e) => e.id.startsWith('prose:'));
    expect(at(5).defaultOn).toBe(false);
    expect(at(10).defaultOn).toBe(true);
  });
});

describe('G3: bônus, reroll do 1, piso', () => {
  it('"+2 bonus to the damage roll": desligado, com a condição da frente', () => {
    const thrown = feature('Thrown Weapon Fighting', 'When you hit with a ranged attack roll using a weapon that has the {@itemProperty T|XPHB|Thrown} property, you gain a +2 bonus to the damage roll.');
    const [e] = effectsFor([thrown], { kind: 'damage', weapon: true, melee: false });
    expect(e).toMatchObject({ part: { formula: '2' }, defaultOn: false });
    expect(effectsFor([thrown], { kind: 'attack', weapon: true })).toEqual([]);
  });

  it('"of that spell" só repete o escopo; a condição da frente que só diz a magia vira `spellOf` (DDL-0247)', () => {
    const empowered = feature('Empowered Evocation', 'Whenever you cast a Wizard spell from the {@filter Evocation|spells|school=V} school, you can add your Intelligence modifier to one damage roll of that spell.');
    const [e] = proseRollEffects([empowered]);
    expect(e).toMatchObject({ part: { formula: '@abilities.int.mod' }, defaultOn: true, spellOf: { school: 'V', cls: 'wizard' } });
    expect(e.note).toBe('One damage roll each time you cast the spell');
  });

  it('"a bonus to the check equal to your Wisdom modifier": o alvo vem da frente, e fica ligado', () => {
    const courtier = feature('Elegant Courtier', 'Whenever you make a Charisma ({@skill Persuasion}) check, you gain a bonus to the check equal to your Wisdom modifier.');
    expect(effectsFor([courtier], { kind: 'check', ability: 'cha', skill: 'per' })[0]).toMatchObject({ part: { formula: '@abilities.wis.mod' }, defaultOn: true });
    expect(effectsFor([courtier], { kind: 'check', ability: 'cha', skill: 'dec' })).toEqual([]);
  });

  it('"Add your Wisdom modifier to the damage you deal with any Cleric cantrip": ligada só no cantrip do clérigo (DDL-0249)', () => {
    const potent = feature('Potent Spellcasting', 'Add your Wisdom modifier to the damage you deal with any Cleric cantrip.');
    expect(effectsFor([potent], { kind: 'damage', spell: true, cantrip: true, spellClass: 'cleric' })[0]).toMatchObject({ part: { formula: '@abilities.wis.mod' }, defaultOn: true });
    expect(effectsFor([potent], { kind: 'damage', spell: true, cantrip: false, spellClass: 'cleric' })).toEqual([]);
    expect(effectsFor([potent], { kind: 'damage', spell: true, cantrip: true, spellClass: 'wizard' })).toEqual([]);
  });

  it('a concentração confere o Durable Magic; "+1 per magic item" e "as normal" saem', () => {
    const durable = feature('Durable Magic', 'While you maintain concentration on a spell, you have a +2 bonus to AC and all saving throws.');
    expect(effectsFor([durable], { kind: 'save', ability: 'dex' }, { concentrating: false })[0].defaultOn).toBe(false);
    expect(effectsFor([durable], { kind: 'save', ability: 'dex' }, { concentrating: true })[0]).toMatchObject({ part: { formula: '2' }, defaultOn: true });
    expect(proseClauses(['You gain a +1 bonus to all saving throws per magic item you are currently attuned to.'])).toEqual([]);
    expect(proseClauses(['It counts as a simple melee weapon for you, and you add your Strength modifier to the attack and damage rolls when you attack with it, as normal.'])).toEqual([]);
  });

  it('o Luck das linhagens antigas rola de novo o 1; Silver Tongue põe o piso 10', () => {
    const luck = feature('Luck', 'When you roll a 1 on the d20 of a {@variantrule D20 Test|XPHB}, you can reroll the die, and you must use the new roll.');
    expect(effectsFor([luck], { kind: 'save', ability: 'wis' })[0]).toMatchObject({ rerollOnes: true, defaultOn: true });
    const silver = feature('Silver Tongue', 'When you make a Charisma ({@skill Persuasion}) or Charisma ({@skill Deception}) check, you can treat a d20 roll of 9 or lower as a 10.');
    expect(effectsFor([silver], { kind: 'check', ability: 'cha', skill: 'dec' })[0]).toMatchObject({ d20Min: 10, defaultOn: true });
    expect(effectsFor([silver], { kind: 'check', ability: 'cha', skill: 'itm' })).toEqual([]);
  });
});

describe('G3: a cura e os temporários do "Use"', () => {
  it('as expressões do texto viram fórmula, ou nada', () => {
    expect(exprFormula('1d10 plus your Ranger level')).toBe('1d10 + @classes.ranger.levels');
    expect(exprFormula('your Charisma modifier plus your Warlock level (minimum of 1 Temporary Hit Points)')).toBe('max(1, @abilities.cha.mod + @classes.warlock.levels)');
    expect(exprFormula('1d6 + half your paladin level')).toBe('1d6 + floor(@classes.paladin.levels / 2)');
    expect(exprFormula('2 times your Proficiency')).toBe('2 * @prof');
    expect(exprFormula('the total rolled')).toBeNull();
    expect(exprFormula('2 plus the spell slot level')).toBeNull();
  });

  it('as formas: "equal to", "per level", "gain 10" e "These ... equal"', () => {
    const uses = proseUses([
      feature("Dark One's Blessing", 'When you reduce an enemy to 0 Hit Points, you gain Temporary Hit Points equal to your Charisma modifier plus your Warlock level (minimum of 1 Temporary Hit Point).'),
      feature('Tomb of Levistus', 'You gain 10 temporary hit points per warlock level, which take as much of the triggering damage as possible.'),
      feature('Boon of the Bright Sun', 'At the start of each of your turns, you and allies you can see in your Daylight Presence gain 10 Temporary Hit Points.'),
      feature('Celestial Resilience', 'You gain Temporary Hit Points whenever you use your Magical Cunning feature or finish a Short Rest or Long Rest. These Temporary Hit Points equal your Warlock level plus your Charisma modifier.'),
      feature('Bolstering Flames', 'You or one creature you can see within 30 feet of yourself gains Temporary Hit Points equal to 1d4 plus your Charisma modifier.'),
    ]);
    expect(uses.map((u) => [u.name, u.apply, u.formula])).toEqual([
      ["Dark One's Blessing", 'temp', 'max(1, @abilities.cha.mod + @classes.warlock.levels)'],
      ['Tomb of Levistus', 'temp', '10 * @classes.warlock.levels'],
      ['Boon of the Bright Sun', 'temp', '10'],
      ['Celestial Resilience', 'temp', '@classes.warlock.levels + @abilities.cha.mod'],
      ['Bolstering Flames', 'temp', '1d4 + @abilities.cha.mod'],
    ]);
    expect(uses[4].note).toMatch(/another creature/);
  });

  it('a de outra criatura e a feature com activity ficam fora', () => {
    expect(proseUses([feature('Fortifying Spell', 'One target of the spell gains a number of Temporary Hit Points equal to 2d8 plus your Cleric level.')])).toEqual([]);
    const withActivity = feature('Second Wind', 'You regain Hit Points equal to 1d10 plus your Fighter level.');
    expect(proseUses([withActivity], { hasActivity: () => true })).toEqual([]);
  });
});

describe('o dado somado das marcas de dragão (DDL-0239)', () => {
  const warding = { name: 'Mark of Warding', entries: [{ type: 'entries', name: "Warder's Intuition", entries: ["When you make an Intelligence ({@skill Investigation}) check or an ability check using {@item Thieves' Tools|XPHB}, you can roll {@dice 1d4} and add the number rolled to the ability check."] }] };
  const detection = { name: 'Mark of Detection', entries: ['When you make an Intelligence ({@skill Investigation}) or Wisdom ({@skill Insight}) check, you can roll {@dice 1d4} and add the number rolled to the ability check.'] };
  const greater = { name: 'Greater Mark of Detection', entries: [{ type: 'entries', name: 'Improved Intuition', entries: ['When you use the Deductive Intuition benefit of your Mark of Detection feat, you can roll {@dice 1d6} instead of {@dice 1d4}.'] }] };

  it('vale na perícia e na ferramenta citadas, nunca em todo teste', () => {
    const [e] = proseRollEffects([warding]);
    expect(e).toMatchObject({ part: { formula: '1d4' }, defaultOn: true });
    expect(fitsProse(e, { kind: 'check', ability: 'int', skill: 'inv' })).toBe(true);
    expect(fitsProse(e, { kind: 'check', ability: 'dex', tool: "Thieves' Tools" })).toBe(true);
    expect(fitsProse(e, { kind: 'check', ability: 'str', skill: 'ath' })).toBe(false);
  });

  it('o Greater Mark troca o dado da marca base', () => {
    expect(proseRollEffects([detection])[0].part.formula).toBe('1d4');
    expect(proseRollEffects([detection, greater])[0].part).toEqual({ label: 'Mark of Detection (Greater Mark of Detection)', formula: '1d6' });
  });
});

describe('a escola e a classe da magia (DDL-0247)', () => {
  const evocation = { name: 'Empowered Evocation', entries: ['Whenever you cast a Wizard spell from the Evocation school, you can add your Intelligence modifier to one damage roll of that spell.'] };

  it('vale ligada na magia de Evocação do mago e não aparece nas outras', () => {
    const catalog = { proseEffects: proseRollEffects([evocation]), features: [], rollData: {} };
    const on = proseEffects(catalog, { kind: 'damage', spell: true, school: 'V', spellClass: 'wizard' });
    expect(on).toHaveLength(1);
    expect(on[0].defaultOn).toBe(true);
    expect(proseEffects(catalog, { kind: 'damage', spell: true, school: 'N', spellClass: 'wizard' })).toEqual([]);
    expect(proseEffects(catalog, { kind: 'damage', spell: true, school: 'V', spellClass: null })).toEqual([]);
    expect(proseEffects(catalog, { kind: 'damage', weapon: true })).toEqual([]);
  });
});

describe('o tipo do dano da magia (DDL-0249)', () => {
  const soul = { name: 'Radiant Soul', entries: ["You have Resistance to Radiant damage. Once per turn, when a spell you cast deals Radiant or Fire damage, you can add your Charisma modifier to that spell's damage against one of the spell's targets."] };

  it('o Radiant Soul vale ligado na magia radiante ou de fogo e não aparece nas outras', () => {
    const catalog = { proseEffects: proseRollEffects([soul]), features: [], rollData: {} };
    const flame = proseEffects(catalog, { kind: 'damage', spell: true, types: ['radiant'] });
    expect(flame).toHaveLength(1);
    expect(flame[0]).toMatchObject({ defaultOn: true, part: { formula: '@abilities.cha.mod' }, note: "Once per turn, against one of the spell's targets" });
    expect(proseEffects(catalog, { kind: 'damage', spell: true, types: ['fire'] })).toHaveLength(1);
    expect(proseEffects(catalog, { kind: 'damage', spell: true, types: ['force'] })).toEqual([]);
    expect(proseEffects(catalog, { kind: 'damage', weapon: true, types: ['radiant'] })).toEqual([]);
  });
});


describe('uma rolagem de dano por lançamento e o tipo escolhido', () => {
  const affinity = { name: 'Elemental Affinity', entries: ['Your draconic magic has an affinity with a damage type associated with dragons. Choose one of those types: Acid, Cold, Fire, Lightning, or Poison.', 'You have Resistance to that damage type, and when you cast a spell that deals damage of that type, you can add your Charisma modifier to one damage roll of that spell.'] };
  const evocation = { name: 'Empowered Evocation', entries: ['Whenever you cast a Wizard spell from the Evocation school, you can add your Intelligence modifier to one damage roll of that spell.'] };

  it('o Elemental Affinity vale ligado só na magia do tipo escolhido', () => {
    const catalog = { proseEffects: proseRollEffects([affinity], { chosenTypes: () => ['fire'] }), features: [], rollData: {} };
    const fire = proseEffects(catalog, { kind: 'damage', spell: true, types: ['fire'] });
    expect(fire).toHaveLength(1);
    expect(fire[0]).toMatchObject({ defaultOn: true, oncePerCast: true, part: { formula: '@abilities.cha.mod' } });
    expect(proseEffects(catalog, { kind: 'damage', spell: true, types: ['cold'] })).toEqual([]);
    expect(proseEffects(catalog, { kind: 'damage', weapon: true, types: ['fire'] })).toEqual([]);
  });

  it('sem o tipo escolhido, o Elemental Affinity fica desligado com a condição do texto', () => {
    const [e] = proseRollEffects([affinity]);
    expect(e.defaultOn).toBe(false);
    expect(e.spellOf).toBeUndefined();
  });

  it('a Empowered Evocation já usada numa rolagem do lançamento sai desligada nas seguintes', () => {
    const catalog = { proseEffects: proseRollEffects([evocation]), features: [], rollData: {} };
    const first = proseEffects(catalog, { kind: 'damage', spell: true, school: 'V', spellClass: 'wizard' });
    expect(first[0].oncePerCast).toBe(true);
    const used = applyEffects(first).oncePerCast;
    expect(used).toEqual([first[0].id]);
    const [later] = castOnceEffects(first, used);
    expect(later.defaultOn).toBe(false);
    expect(later.note).toMatch(/earlier damage roll/);
    expect(castOnceEffects(first, [])[0].defaultOn).toBe(true);
  });
});

describe('o piso "treat a roll of 7 or lower on the d20 as an 8" (Ear for Deceit, DDL-0253)', () => {
  const ear = { name: 'Ear for Deceit', entries: ['Whenever you make a Wisdom ({@skill Insight}) check to determine whether a creature is lying, treat a roll of 7 or lower on the {@dice d20} as an 8.'] };
  it('vale no Insight, desligado com a condição; nada no Perception', () => {
    const catalog = { proseEffects: proseRollEffects([ear]), features: [], rollData: {} };
    const ins = proseEffects(catalog, { kind: 'check', ability: 'wis', skill: 'ins' });
    expect(ins).toHaveLength(1);
    expect(ins[0]).toMatchObject({ d20Min: 8 });
    expect(proseEffects(catalog, { kind: 'check', ability: 'wis', skill: 'prc' })).toEqual([]);
  });
});
