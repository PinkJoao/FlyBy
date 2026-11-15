// =============================================================================
// playProseEffects.test: o que a prosa declara, lido para o jogo (G2 e G3)
// =============================================================================
// O QUE FAZ
//   Prova a leitura das frases nos dois lados (§6.1): o que tem de entrar (Fey Ancestry,
//   Gnomish Cunning, Hippo Build, Keen Smell, Bloodied Frenzy, Danger Sense) e o que não pode
//   (aliados, inimigos, "give yourself", "doesn't impose", "if you have advantage"), e a
//   escolha da rolagem certa no diálogo, ligada ou desligada. Desde o G3, o bônus (com o
//   alvo da condição da frente), o reroll do 1, o piso e a cura e os temporários do "Use".
//
// FUNÇÕES
//   feature(name, text, extra): uma feature do catálogo com um parágrafo.
//   effectsFor(features, roll, ctx, opts): os extras de uma rolagem para essas features.
//
// DECISÕES E ARMADILHAS
//   - Os textos são frases reais do 5etools (XPHB, MPMM, AAG, WoW, FRHoF), com as tags.
// -----------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { proseClauses, proseRollEffects, proseEffects, proseUses, exprFormula } from './playProseEffects';
import { rollEffects } from './playEffects';

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

  it('"a bonus to the check equal to your Wisdom modifier": o alvo vem da frente, e fica ligado', () => {
    const courtier = feature('Elegant Courtier', 'Whenever you make a Charisma ({@skill Persuasion}) check, you gain a bonus to the check equal to your Wisdom modifier.');
    expect(effectsFor([courtier], { kind: 'check', ability: 'cha', skill: 'per' })[0]).toMatchObject({ part: { formula: '@abilities.wis.mod' }, defaultOn: true });
    expect(effectsFor([courtier], { kind: 'check', ability: 'cha', skill: 'dec' })).toEqual([]);
  });

  it('"Add your Wisdom modifier to the damage you deal with any Cleric cantrip": parte no dano, com a nota', () => {
    const potent = feature('Potent Spellcasting', 'Add your Wisdom modifier to the damage you deal with any Cleric cantrip.');
    expect(effectsFor([potent], { kind: 'damage', spell: true })[0]).toMatchObject({ part: { formula: '@abilities.wis.mod' }, note: 'With any Cleric cantrip' });
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
