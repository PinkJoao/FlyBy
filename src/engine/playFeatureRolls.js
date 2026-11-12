// =============================================================================
// playFeatureRolls: o registro curado das features que entram numa rolagem
// =============================================================================
// O QUE FAZ
//   A camada 2 do DDL-0203 (DDL-0205): as features sem activity que mexem numa
//   rolagem ou gastam ao serem usadas, uma entrada por feature, pelo texto do XPHB.
//   Três formas:
//   - `rider`: um extra que o diálogo da rolagem oferece (o dano do Divine Strike, o
//     d10 do Tactical Mind num teste), com o gasto de um pool ou do espaço do pacto
//     quando a feature gasta (Peerless Skill, Eldritch Smite);
//   - `toggle`: usar a feature liga um efeito (Reckless Attack: vantagem em ataques
//     de FOR até o seu próximo turno);
//   - `use`: usar gasta, rola (`roll`) e mostra a salvaguarda do alvo (Stunning
//     Strike, Commander's Strike, Inspiring Smite);
//   - `passive`: a feature só melhora outra entrada (Improved Blessed Strikes) ou é de
//     outra criatura (Combat Inspiration): fica PASSIVA mesmo com gatilho no texto.
//
// FUNÇÕES
//   featureRollOf(name): a entrada do registro de uma feature, ou null.
//   featureRiders(state, catalog, roll): os extras que valem para uma rolagem, no
//     formato de rollEffects (engine/playEffects).
//   spendKeyOf(catalog, spend): a chave do recurso que a entrada gasta (o pool pelo
//     nome do item, ou o espaço do pacto).
//   riderSpendOps(applied, catalog): as operações do gasto dos extras ligados.
//   featureUseOf(feature, catalog): o que o "Use" de uma feature `toggle` ou `use`
//     faz: o modificador, o gasto e a salvaguarda.
//   formulaOf(entry, rollData): a fórmula, que pode depender do nível.
//   byLevel(classId, steps), MARTIAL(count): a fórmula pelo nível de uma classe
//     ([[nível, fórmula], ...] do maior ao menor) e N rolagens do dado de Martial Arts.
//   ridersOf(entry): os extras de uma entrada (ela mesma, se for `rider`, e os `also`).
//   noteOf(entry, rollData): a nota, que pode citar uma CD calculada.
//   maneuverDc(rollData), SUPERIORITY(rollData), BARDIC(rollData): a CD das manobras
//     (8 + PB + FOR ou DES) e os dados de superioridade e de inspiração.
//   fits(when, roll): a rolagem casa com o `when` da entrada (arma, FOR, corpo a corpo).
//   CLERIC_STRIKE(rollData): a fórmula do Divine Strike pela escala do Cleric.
//   norm(s), slug(s): o nome comparável e o pedaço do id do extra.
//
// DECISÕES E ARMADILHAS
//   - A prova de cada entrada é a frase do texto, citada aqui (o corpo não leva
//     comentário). Sneak Attack (a escala do Rogue) e Brutal
//     Strike (a escala do Barbarian, só com FOR) moravam em rollEffects e vieram para
//     cá sem mudar o id (`rider:sneak-attack`). Frenzy: "roll a number of d6s equal to
//     your Rage Damage bonus", com Reckless Attack e Rage, FOR. Divine Fury: "1d6 plus
//     half your Barbarian level", com Rage. Radiant Strikes: "an extra 1d8 Radiant"
//     em todo acerto corpo a corpo, então começa LIGADO. Divine Strike (as versões
//     antigas, o tipo muda por domínio) e Blessed Strikes: 1d8, 2d8 no 14
//     (`@scale.cleric.divine-strike`). Primal Strike: 1d8, 2d8 no 15
//     (`@scale.druid.elemental-fury`). Dreadful Strikes: 1d4, 1d6 no Ranger 11.
//     Colossus Slayer (a opção do Hunter's Prey): 1d8 se o alvo perdeu PV. Eldritch
//     Smite: 1d8 mais 1d8 por círculo do espaço do pacto, que gasta. Peerless Skill:
//     o dado de Bardic Inspiration num teste ou ataque que falhou, gasta um uso.
//     Tactical Mind: 1d10 num teste que falhou, gasta um Second Wind. Reckless
//     Attack: vantagem em ataques de FOR "until the start of your next turn" (1
//     rodada). Stunning Strike: 1 Focus Point, save de CON contra 8 + PB + SAB.
//   - Segunda leva (DDL-0206, do `survey-feature-rolls.js`): manobras sem activity
//     (Goading e Menacing Attack somam o dado ao dano e pedem save de SAB; Ambush soma
//     o dado a Stealth ou à iniciativa; Commander's Strike e Bait and Switch rolam o
//     dado para o aliado ou para a CA), todas gastando Combat Superiority, e o próprio
//     Combat Superiority rola um dado (as manobras que ninguém registrou). Tandem
//     Footwork: o dado de inspiração na iniciativa. Dark One's Own Luck: 1d10 num teste
//     ou save. Boon of Fate: 2d4 num teste d20. Hurl Through Hell: 8d10 psíquico, um uso.
//     Fire's Burn (1d10 fogo) e Frost's Chill (1d6 frio) do Goliath, cada um com o pool
//     dele. Hand of Harm: o dado de Martial Arts mais SAB, desarmado, 1 Focus Point.
//     Charger: 1d8 corpo a corpo depois de andar 10 pés. Lunar Form: 2d10 radiante na
//     forma do Wild Shape. Inspiring Smite: 2d8 + nível de Paladin em PV temporários,
//     um Channel Divinity. Wild Magic Surge: o d20 depois da magia. Passivas: Improved
//     Blessed Strikes, Improved Elemental Fury e Improved Brutal Strike (a escala já
//     sobe o dado), Relentless e Heightened Focus (mudam outras), Combat Inspiration (o
//     dado é de quem o recebe), Pact Magic ("expend a slot" no texto a marcava ativa;
//     os espaços se gastam na aba Spells).
//   - Terceira leva (DDL-0207), os livros fora do XPHB, cada número pela frase do texto:
//     EFA: Alchemical Eruption 2d8 numa magia de Artificer; Lightning Launcher 1d6 do
//     Infiltrator (só o lançador, à distância); Detonate 3d10 do Explosive Cannon;
//     Arcane Jolt 2d6 (4d6 no Artificer 15, Improved Defender), um uso; Shifting
//     (Beasthide) 2 x PB + 1d6 e (Longtooth) 2 x PB em PV temporários. EGW: Reclaim
//     Potential 2d6 + CON temporários; Event Horizon 2d10; Violent Attraction 1d10. FTD:
//     Drake's Breath 8d6 (10d6 no 15); Breath of the Dragon duas rolagens do dado de
//     Martial Arts (três no 11). FRHoF: Group Recovery 1d4 + nível de Fighter; Blessing
//     of Moonlight 2d4; Lunar Vitality o dado de inspiração; Frostbite 1d4; Encourage Ally
//     2d6; Efreeti's Fury 2d4 no Divine Smite; Elemental Rebuke 2d10 + CAR; Fortifying
//     Soul 1d10 + nível de Ranger; Polar Strikes 1d4 (1d6 no 11); Frozen Haunt 2d4.
//     XPHB: Dreadful Strike (`@scale.gloom-stalker.dreadful-strike`, 2d6 sem a escala) e
//     a iniciativa + SAB do Dread Ambusher (`also`, ligada: "you can add"); Uncanny
//     Metabolism devolve TODO o Focus e cura o dado de Martial Arts + nível de Monk;
//     Searing Vengeance 2d8 + CAR. MPMM: Surprise Attack 2d6. RHW: Power from Beyond 1d6
//     numa magia de Bard; Spirits from Beyond o dado de inspiração; Pull of Death 1d4
//     (1d6 no Cleric 11); Hungering Might cura 1d10 + SAB; Knowledge from a Past Life 1d6
//     num teste que falhou; Form of Dread 1d10 + nível de Warlock temporários; Unholy
//     Resuscitation 2d10 + CAR. XGE: as flechas do Arcane Archer 2d6 (4d6 no 18; Piercing
//     1d6 e 2d6), um Arcane Shot; Warding Maneuver 1d8; Favored by the Gods 2d4; os
//     floreios do College of Swords com o dado de inspiração; Planar Warrior 1d8 (2d8 no
//     11); Slayer's Prey 1d6; Kensei's Shot 1d4 à distância; Deft Strike o dado de Martial
//     Arts, 1 Focus; Searing Sunburst 2d6. TCE: Halo of Spores 1d4, 1d6 no 6, 1d8 no 10,
//     1d10 no 14; Symbiotic Entity 4 x nível de Druid temporários, um Wild Shape, e 1d6
//     necrótico no corpo a corpo (`also`); Cauterizing Flames 2d10 + SAB; Unsettling
//     Words o dado de inspiração; Brace o dado de superioridade; Spirit Shield 2d6, 3d6 no
//     10, 4d6 no 14; Infectious Fury 2d12; Wild Surge a tabela de d8; Balm of Peace 2d6 +
//     SAB e Twilight Sanctuary 1d6 + nível de Cleric, um Channel Divinity; Guardian Coil e
//     Tentacle of the Deeps 1d8 (2d8 no Warlock 10); Giant's Might liga vantagem em FOR e
//     1d6 por turno (1d8 no 10, 1d10 no 18) por 1 minuto; Arms of the Astral Self duas
//     rolagens do dado, 1 Focus; Deflect Energy 1d10 + SAB; Gathered Swarm 1d6. SCAG e
//     PHB: Turn the Tide 1d6 + CAR; Touch of the Long Death 2d10 por ponto; Defy Death
//     1d8 + CON e Indestructible Life 1d8 + nível de Warlock (curam); Wrath of the Storm
//     2d8; Vigilant Rebuke 2d8 + CAR. BGG: Elemental Cleaver 1d6 com Rage (2d6 no 14,
//     Demiurgic Colossus). Passivas: Improved Defender, Bond of Fang and Scale,
//     Eventide's Splendor, Order's Wrath, Great Stature, Runic Juggernaut, Demiurgic
//     Colossus.
//   - `apply` ('heal' ou 'temp') faz o "Use" curar ou dar PV temporários com o total
//     rolado, pelas mesmas regras do card de HP (healOutcome, tempHpOutcome: o temporário
//     não soma). `restore` devolve todo o gasto de um pool (Uncanny Metabolism).
//   - Ficaram de fora, de propósito, as que trocam o próprio ataque ou dependem de uma
//     escolha que o app não guarda (Strike of the Giants, Fey Gift, Vampiric Bite, Form of
//     the Beast, as armas do Armorer, Psychic Blades), as de tabela sem dado conhecido
//     (Experimental Elixir, Mythal Touched) e as que não rolam para o personagem
//     (Overchannel, Limited Wish, Ghost Walk, Umbral Form): `survey-feature-rolls.js` as
//     lista.
//   - O extra começa DESLIGADO (o jogador decide, uma vez por turno) salvo
//     `defaultOn`. "Uma vez por turno" fica na nota: o app não conta.
//   - `needs: 'Rage'` só oferece o extra com a Rage ligada (o modificador de nome
//     Rage): a regra é inequívoca, então esconde (§6.4).
//   - O gasto do extra entra no MESMO evento da rolagem (`riderSpendOps`, chamado por
//     `roll` em pages/Play.jsx) e só quando o jogador o liga. Sem o que gastar, o extra
//     aparece com "(none left)" e pode ser ligado assim mesmo (liberdade com aviso).
//     Peerless Skill e Tactical Mind dizem que o uso não se gasta se ainda falhar: o
//     app gasta, e o desfazer devolve.
//   - Uma família nova entra aqui com a frase como prova; `survey-play-catalog.js`
//     não a vê, o teste deste arquivo segura as fórmulas.
// -----------------------------------------------------------------------------

import { rollFormula } from './dice';
import { remainingOf } from './playState';

const maneuverDc = (rd) => 8 + (rd.prof ?? 0) + Math.max(rd.abilities?.str?.mod ?? 0, rd.abilities?.dex?.mod ?? 0);
const SUPERIORITY = (rd) => `1${rd['scale.battle-master.superiority.die'] ?? 'd8'}`;
const BARDIC = (rd) => (rd['scale.bard.inspiration'] ? '@scale.bard.inspiration' : '1d6');
const SUP = { item: 'Combat Superiority' };

const byLevel = (classId, steps) => (rd) => {
  const level = rd.classes?.[classId]?.levels ?? 0;
  return (steps.find(([lv]) => level >= lv) ?? steps[steps.length - 1])[1];
};
const MARTIAL = (count) => (rd) => Array.from({ length: typeof count === 'function' ? count(rd) : count }, () => (rd['scale.monk.die'] ? '@scale.monk.die' : '1d6')).join(' + ');
const BI = { item: 'Bardic Inspiration' };
const CD = { item: 'Channel Divinity' };
const FOCUS = { item: "Monk's Focus" };
const SHOT = { item: 'Arcane Shot' };
const ARROW = byLevel('fighter', [[18, '4d6'], [0, '2d6']]);

const CLERIC_STRIKE = (rd) => (rd['scale.cleric.divine-strike'] ? '@scale.cleric.divine-strike' : '1d8');

export const FEATURE_ROLLS = {
  'sneak attack': { kind: 'rider', on: ['damage'], when: 'weapon', has: (c) => !!c.rollData?.['scale.rogue.sneak-attack'], formula: '@scale.rogue.sneak-attack', note: 'once per turn, Finesse or Ranged, with Advantage or an ally next to the target' },
  'brutal strike': { kind: 'rider', on: ['damage'], when: 'str', has: (c) => !!c.rollData?.['scale.barbarian.brutal-strike'], formula: '@scale.barbarian.brutal-strike', note: 'only if you gave up Advantage on the attack' },
  frenzy: { kind: 'rider', on: ['damage'], when: 'str', needs: 'Rage', formula: (rd) => `${rd['scale.barbarian.rage-damage'] ?? 2}d6`, note: 'with Reckless Attack, the first target you hit this turn' },
  'divine fury': { kind: 'rider', on: ['damage'], when: 'weapon', needs: 'Rage', formula: '1d6 + floor(@classes.barbarian.levels / 2)', note: 'first creature you hit on each turn; Necrotic or Radiant' },
  'radiant strikes': { kind: 'rider', on: ['damage'], when: 'melee', defaultOn: true, formula: '1d8', label: 'Radiant Strikes (radiant)', note: 'every hit with a Melee weapon or an Unarmed Strike' },
  'blessed strikes: divine strike': { kind: 'rider', on: ['damage'], when: 'weapon', formula: CLERIC_STRIKE, label: 'Divine Strike', note: 'once on each of your turns; Necrotic or Radiant' },
  'divine strike': { kind: 'rider', on: ['damage'], when: 'weapon', formula: CLERIC_STRIKE, note: 'once on each of your turns; the damage type is in the feature' },
  'elemental fury: primal strike': { kind: 'rider', on: ['damage'], when: 'weapon', formula: (rd) => (rd['scale.druid.elemental-fury'] ? '@scale.druid.elemental-fury' : '1d8'), label: 'Primal Strike', note: 'once on each of your turns; Cold, Fire, Lightning or Thunder' },
  'dreadful strikes': { kind: 'rider', on: ['damage'], when: 'weapon', formula: (rd) => ((rd.classes?.ranger?.levels ?? 0) >= 11 ? '1d6' : '1d4'), note: 'Psychic; a target takes it only once per turn' },
  "hunter's prey": { kind: 'rider', on: ['damage'], when: 'weapon', formula: '1d8', label: 'Colossus Slayer', note: 'only with the Colossus Slayer option, if the target is missing Hit Points; once per turn' },
  "hunter's prey: colossus slayer": { kind: 'rider', on: ['damage'], when: 'weapon', formula: '1d8', label: 'Colossus Slayer', note: 'if the target is missing Hit Points; once per turn' },
  'eldritch smite': { kind: 'rider', on: ['damage'], when: 'weapon', spend: { pact: true }, formula: (rd) => `${1 + (rd.spells?.pact?.level ?? 1)}d8`, note: 'pact weapon, once per turn; Force; a Huge or smaller target can be knocked Prone' },
  'peerless skill': { kind: 'rider', on: ['check', 'attack'], spend: { item: 'Bardic Inspiration' }, formula: (rd) => (rd['scale.bard.inspiration'] ? '@scale.bard.inspiration' : '1d6'), note: 'after you fail; not spent if it still fails' },
  'tactical mind': { kind: 'rider', on: ['check'], spend: { item: 'Second Wind' }, formula: '1d10', note: 'after you fail the check; not spent if it still fails' },
  'reckless attack': {
    kind: 'toggle',
    modifier: () => ({
      label: 'Reckless Attack',
      source: 'feature',
      duration: 'manual',
      maxRounds: 1,
      notes: ['Attack rolls against you have Advantage'],
      effects: [{ targets: ['attack'], mode: 'advantage', when: 'strAttack', label: 'Reckless Attack' }],
    }),
  },
  'stunning strike': { kind: 'use', spend: { item: "Monk's Focus" }, save: { ability: 'con', dc: '8 + @prof + @abilities.wis.mod' } },
  'goading attack': { kind: 'rider', on: ['damage'], spend: SUP, formula: SUPERIORITY, note: (rd) => `the target makes a DC ${maneuverDc(rd)} Wisdom save or has Disadvantage against others` },
  'menacing attack': { kind: 'rider', on: ['damage'], spend: SUP, formula: SUPERIORITY, note: (rd) => `the target makes a DC ${maneuverDc(rd)} Wisdom save or is Frightened` },
  ambush: { kind: 'rider', on: ['check', 'initiative'], when: 'stealth', spend: SUP, formula: SUPERIORITY, note: 'Stealth checks and Initiative' },
  "commander's strike": { kind: 'use', spend: SUP, roll: { label: "Ally's damage bonus", formula: SUPERIORITY } },
  'bait and switch': { kind: 'use', spend: SUP, roll: { label: 'AC bonus until your next turn', formula: SUPERIORITY } },
  'combat superiority': { kind: 'use', spend: SUP, roll: { label: 'Superiority Die', formula: SUPERIORITY } },
  'tandem footwork': { kind: 'rider', on: ['initiative'], spend: { item: 'Bardic Inspiration' }, formula: BARDIC, note: 'also for each ally within 30 feet' },
  "dark one's own luck": { kind: 'rider', on: ['check', 'save'], spend: { item: "Dark One's Own Luck" }, formula: '1d10', note: 'after seeing the roll; once per roll' },
  'boon of fate': { kind: 'rider', on: ['attack', 'check', 'save'], spend: { item: 'Boon of Fate' }, formula: '2d4', label: 'Improve Fate', note: 'a bonus or a penalty; again after Initiative or a rest' },
  'hurl through hell': { kind: 'rider', on: ['damage'], spend: { item: 'Hurl Through Hell' }, formula: '8d10', note: 'once per turn; Charisma save against your spell save DC; Psychic, not against a Fiend' },
  "fire's burn": { kind: 'rider', on: ['damage'], spend: { item: "Fire's Burn" }, formula: '1d10', note: 'Fire' },
  "frost's chill": { kind: 'rider', on: ['damage'], spend: { item: "Frost's Chill" }, formula: '1d6', note: 'Cold; the target loses 10 feet of Speed until your next turn' },
  'hand of harm': { kind: 'rider', on: ['damage'], when: 'unarmed', spend: { item: "Monk's Focus" }, formula: '@scale.monk.die + @abilities.wis.mod', note: 'once per turn; Necrotic' },
  charger: { kind: 'rider', on: ['damage'], when: 'melee', formula: '1d8', label: 'Charge Attack', note: 'after moving 10 feet straight at the target, once per turn (or push it instead)' },
  'lunar form': { kind: 'rider', on: ['damage'], formula: '2d10', label: 'Improved Lunar Radiance', note: "once per turn, with a Wild Shape form's attack; Radiant" },
  'inspiring smite': { kind: 'use', spend: { item: 'Channel Divinity' }, roll: { label: 'Temporary Hit Points to share', formula: '2d8 + @classes.paladin.levels' } },
  'wild magic surge': { kind: 'use', roll: { label: 'd20 (on a 20, roll on the table)', formula: '1d20' } },
  'improved blessed strikes': { kind: 'passive' },
  'improved elemental fury': { kind: 'passive' },
  'improved brutal strike (2)': { kind: 'passive' },
  relentless: { kind: 'passive' },
  'heightened focus': { kind: 'passive' },
  'combat inspiration': { kind: 'passive' },
  'pact magic': { kind: 'passive' },
  'chemical mastery': { kind: 'rider', on: ['damage'], when: 'spell', formula: '2d8', label: 'Alchemical Eruption', note: 'an Artificer spell dealing Acid, Fire or Poison; once per turn; Force' },
  infiltrator: { kind: 'rider', on: ['damage'], when: 'ranged', formula: '1d6', label: 'Lightning Launcher', note: 'with the launcher only; once per turn; Lightning' },
  'armor model: infiltrator': { kind: 'rider', on: ['damage'], when: 'ranged', formula: '1d6', label: 'Lightning Launcher', note: 'with the launcher only; once per turn; Lightning' },
  'explosive cannon': { kind: 'use', roll: { label: 'Detonate: Force within 20 feet (Dexterity save, half on success)', formula: '3d10' } },
  'arcane jolt': { kind: 'rider', on: ['damage'], when: 'weapon', spend: { item: 'Arcane Jolt' }, formula: byLevel('artificer', [[15, '4d6'], [0, '2d6']]), note: 'a magic weapon or your Steel Defender; or heal that much instead; once per turn; Force' },
  'improved defender': { kind: 'passive' },
  'shifting (beasthide)': { kind: 'use', apply: 'temp', roll: { label: 'Temporary Hit Points', formula: '2 * @prof + 1d6' } },
  'shifting (longtooth)': { kind: 'use', apply: 'temp', roll: { label: 'Temporary Hit Points', formula: '2 * @prof' } },
  'reclaim potential': { kind: 'use', apply: 'temp', roll: { label: 'Temporary Hit Points', formula: '2d6 + @abilities.con.mod' } },
  'event horizon': { kind: 'use', roll: { label: 'Force to a hostile creature starting its turn within 30 feet (Strength save, half on success)', formula: '2d10' } },
  'violent attraction': { kind: 'use', roll: { label: "Extra damage to the attack's target (2d10 for a fall)", formula: '1d10' } },
  'bond of fang and scale': { kind: 'passive' },
  "drake's breath": { kind: 'use', roll: { label: 'Breath damage (Dexterity save, half on success)', formula: byLevel('ranger', [[15, '10d6'], [0, '8d6']]) } },
  'breath of the dragon': { kind: 'use', roll: { label: 'Breath damage (Dexterity save, half on success)', formula: MARTIAL((rd) => ((rd.classes?.monk?.levels ?? 0) >= 11 ? 3 : 2)) } },
  'group recovery': { kind: 'use', roll: { label: 'Healing for each chosen ally', formula: '1d4 + @classes.fighter.levels' } },
  'blessing of moonlight': { kind: 'use', roll: { label: 'Healing for another creature', formula: '2d4' } },
  "moon's inspiration": { kind: 'use', spend: BI, roll: { label: 'Extra healing (Lunar Vitality)', formula: BARDIC } },
  "eventide's splendor": { kind: 'passive' },
  'cold caster': { kind: 'use', roll: { label: 'Subtracted from its next saving throw (Frostbite)', formula: '1d4' } },
  'purple dragon commandant': { kind: 'use', roll: { label: "Ally's Temporary Hit Points (add the feat's ability modifier)", formula: '2d6' } },
  "efreeti's fury": { kind: 'rider', on: ['damage'], when: 'spell', formula: '2d4', note: 'with Divine Smite; a second creature within 30 feet takes 2d4 too; Fire' },
  'elemental rebuke': { kind: 'use', roll: { label: "Attacker's damage (Dexterity save, half on success)", formula: '2d10 + @abilities.cha.mod' } },
  'fortifying soul': { kind: 'use', roll: { label: 'Healing for each chosen creature', formula: '1d10 + @classes.ranger.levels' } },
  'frigid explorer': { kind: 'rider', on: ['damage'], when: 'weapon', formula: byLevel('ranger', [[11, '1d6'], [0, '1d4']]), label: 'Polar Strikes', note: 'Cold; a target takes it only once per turn' },
  'frozen haunt': { kind: 'use', roll: { label: 'Cold to each chosen creature within 15 feet', formula: '2d4' } },
  'dread ambusher': {
    kind: 'rider',
    on: ['damage'],
    when: 'weapon',
    spend: { item: 'Dread Ambusher' },
    formula: (rd) => (rd['scale.gloom-stalker.dreadful-strike'] ? '@scale.gloom-stalker.dreadful-strike' : '2d6'),
    label: 'Dreadful Strike',
    note: 'once per turn; Psychic',
    also: [{ on: ['initiative'], formula: '@abilities.wis.mod', label: 'Dread Ambusher', defaultOn: true, note: 'Initiative Bonus' }],
  },
  'uncanny metabolism': { kind: 'use', apply: 'heal', restore: FOCUS, roll: { label: 'Hit Points regained', formula: '@scale.monk.die + @classes.monk.levels' } },
  'searing vengeance': { kind: 'use', roll: { label: 'Radiant to each chosen creature within 30 feet', formula: '2d8 + @abilities.cha.mod' } },
  'surprise attack': { kind: 'rider', on: ['damage'], formula: '2d6', note: "a creature that hasn't taken a turn yet in this combat" },
  'empowered channeling': { kind: 'rider', on: ['damage'], when: 'spell', formula: '1d6', label: 'Power from Beyond', note: 'a Bard spell cast with a slot; once per turn' },
  'spirits from beyond': { kind: 'use', spend: BI, roll: { label: 'Spirits from Beyond table', formula: BARDIC } },
  'circle of mortality': { kind: 'rider', on: ['damage'], formula: byLevel('cleric', [[11, '1d6'], [0, '1d4']]), label: 'Pull of Death', note: 'a creature missing Hit Points; once per turn; Necrotic' },
  'hungering might': { kind: 'use', apply: 'heal', roll: { label: 'Hit Points regained (Bloodied, transformed)', formula: '1d10 + @abilities.wis.mod' } },
  'knowledge from a past life': { kind: 'rider', on: ['check'], spend: { item: 'Knowledge from a Past Life' }, formula: '1d6', note: 'after you fail the check' },
  'form of dread': { kind: 'use', apply: 'temp', roll: { label: 'Temporary Hit Points', formula: '1d10 + @classes.warlock.levels' } },
  'necrotic husk': { kind: 'use', roll: { label: 'Necrotic around you (Constitution save, half on success)', formula: '2d10 + @abilities.cha.mod' } },
  'beguiling arrow': { kind: 'rider', on: ['damage'], when: 'ranged', spend: SHOT, formula: ARROW, note: 'Psychic; Wisdom save or Charmed by an ally' },
  'grasping arrow': { kind: 'rider', on: ['damage'], when: 'ranged', spend: SHOT, formula: ARROW, note: 'Poison; Speed -10 and the same in Slashing when it moves' },
  'shadow arrow': { kind: 'rider', on: ['damage'], when: 'ranged', spend: SHOT, formula: ARROW, note: 'Psychic; Wisdom save or sees only 5 feet' },
  'piercing arrow': { kind: 'rider', on: ['damage'], when: 'ranged', spend: SHOT, formula: byLevel('fighter', [[18, '2d6'], [0, '1d6']]), note: 'a 30-foot line, Dexterity save instead of the attack; Piercing' },
  'warding maneuver': { kind: 'use', roll: { label: 'AC bonus against the attack', formula: '1d8' } },
  'favored by the gods': { kind: 'rider', on: ['attack', 'save'], spend: { item: 'Favored by the Gods' }, formula: '2d4', note: 'after a failed save or a miss' },
  'defensive flourish': { kind: 'rider', on: ['damage'], when: 'weapon', spend: BI, formula: BARDIC, note: 'add the roll to your AC until your next turn' },
  'mobile flourish': { kind: 'rider', on: ['damage'], when: 'weapon', spend: BI, formula: BARDIC, note: 'push the target 5 feet plus the roll' },
  'slashing flourish': { kind: 'rider', on: ['damage'], when: 'weapon', spend: BI, formula: BARDIC, note: 'also to another creature within 5 feet of you' },
  'planar warrior': { kind: 'rider', on: ['damage'], when: 'weapon', formula: byLevel('ranger', [[11, '2d8'], [0, '1d8']]), note: 'the creature you chose this turn; all the damage becomes Force' },
  "slayer's prey": { kind: 'rider', on: ['damage'], when: 'weapon', formula: '1d6', note: 'your designated target; the first hit each turn' },
  "kensei's shot": { kind: 'rider', on: ['damage'], when: 'ranged', formula: '1d4', note: 'a kensei weapon, after the Bonus Action this turn' },
  'one with the blade': { kind: 'rider', on: ['damage'], when: 'weapon', spend: FOCUS, formula: '@scale.monk.die', label: 'Deft Strike', note: 'a kensei weapon; once per turn' },
  'searing sunburst': { kind: 'use', roll: { label: 'Radiant (Constitution save); +2d6 per Focus Point, up to 3', formula: '2d6' } },
  'halo of spores': { kind: 'use', roll: { label: 'Necrotic (Constitution save)', formula: byLevel('druid', [[14, '1d10'], [10, '1d8'], [6, '1d6'], [0, '1d4']]) } },
  'symbiotic entity': {
    kind: 'use',
    apply: 'temp',
    spend: { item: 'Wild Shape' },
    roll: { label: 'Temporary Hit Points', formula: '4 * @classes.druid.levels' },
    also: [{ on: ['damage'], when: 'melee', formula: '1d6', label: 'Symbiotic Entity', note: 'while it is active; Necrotic' }],
  },
  'cauterizing flames': { kind: 'use', roll: { label: 'Healing or Fire damage', formula: '2d10 + @abilities.wis.mod' } },
  'unsettling words': { kind: 'use', spend: BI, roll: { label: 'Subtracted from its next saving throw', formula: BARDIC } },
  brace: { kind: 'rider', on: ['damage'], when: 'weapon', spend: SUP, formula: SUPERIORITY, note: 'the reaction attack' },
  "order's wrath": { kind: 'passive' },
  'spirit shield': { kind: 'use', roll: { label: 'Damage reduced', formula: byLevel('barbarian', [[14, '4d6'], [10, '3d6'], [0, '2d6']]) } },
  'infectious fury': { kind: 'use', roll: { label: 'Psychic (Wisdom save against 8 + CON + PB)', formula: '2d12' } },
  'wild surge': { kind: 'use', roll: { label: 'Wild Magic table', formula: '1d8' } },
  'channel divinity: balm of peace': { kind: 'use', spend: CD, roll: { label: 'Healing for each creature you pass', formula: '2d6 + @abilities.wis.mod' } },
  'channel divinity: twilight sanctuary': { kind: 'use', spend: CD, roll: { label: 'Temporary Hit Points for a creature ending its turn in the sphere', formula: '1d6 + @classes.cleric.levels' } },
  'guardian coil': { kind: 'use', roll: { label: 'Damage reduced', formula: byLevel('warlock', [[10, '2d8'], [0, '1d8']]) } },
  'tentacle of the deeps': { kind: 'use', roll: { label: 'Cold on a hit (melee spell attack)', formula: byLevel('warlock', [[10, '2d8'], [0, '1d8']]) } },
  "giant's might": {
    kind: 'toggle',
    modifier: (rd) => ({
      label: "Giant's Might",
      source: 'feature',
      duration: 'manual',
      maxRounds: 10,
      effects: [
        { targets: ['check:str', 'save:str'], mode: 'advantage', label: "Giant's Might" },
        { targets: ['damage'], formula: byLevel('fighter', [[18, '1d10'], [10, '1d8'], [0, '1d6']])(rd), when: 'weaponAttack', optional: true, label: "Giant's Might (once per turn)" },
      ],
    }),
  },
  'great stature': { kind: 'passive' },
  'runic juggernaut': { kind: 'passive' },
  'arms of the astral self': { kind: 'use', spend: FOCUS, roll: { label: 'Force within 10 feet (Dexterity save)', formula: MARTIAL(2) } },
  'body of the astral self': { kind: 'use', roll: { label: 'Damage reduced (Deflect Energy)', formula: '1d10 + @abilities.wis.mod' } },
  'gathered swarm': { kind: 'rider', on: ['damage'], formula: '1d6', note: 'once per turn, Piercing (or push or move instead)' },
  'turn the tide': { kind: 'use', spend: CD, roll: { label: 'Healing for each creature at half its Hit Points or less', formula: '1d6 + @abilities.cha.mod' } },
  'touch of the long death': { kind: 'use', roll: { label: 'Necrotic per Focus Point spent (Constitution save, half on success)', formula: '2d10' } },
  'defy death': { kind: 'use', apply: 'heal', roll: { label: 'Hit Points regained', formula: '1d8 + @abilities.con.mod' } },
  'indestructible life': { kind: 'use', apply: 'heal', roll: { label: 'Hit Points regained', formula: '1d8 + @classes.warlock.levels' } },
  'wrath of the storm': { kind: 'use', roll: { label: 'Lightning or Thunder (Dexterity save, half on success)', formula: '2d8' } },
  'elemental cleaver': { kind: 'rider', on: ['damage'], when: 'weapon', needs: 'Rage', formula: byLevel('barbarian', [[14, '2d6'], [0, '1d6']]), note: 'the infused weapon; the type you chose when raging' },
  'demiurgic colossus': { kind: 'passive' },
  'vigilant rebuke': { kind: 'use', roll: { label: 'Force to the creature that forced the save', formula: '2d8 + @abilities.cha.mod' } },
};

const norm = (s) => String(s ?? '').trim().toLowerCase();
const slug = (s) => norm(s).replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A entrada do registro de uma feature, pelo nome, ou null. */
export function featureRollOf(name) {
  return FEATURE_ROLLS[norm(name)] ?? null;
}

/** A fórmula da entrada, resolvida pelo nível quando é função. */
export function formulaOf(entry, rollData = {}) {
  return typeof entry.formula === 'function' ? entry.formula(rollData) : entry.formula;
}

/** A nota, que pode citar uma CD calculada. */
export function noteOf(entry, rollData = {}) {
  return typeof entry.note === 'function' ? entry.note(rollData) : entry.note;
}

/** A chave do recurso que a entrada gasta, ou null. */
export function spendKeyOf(catalog, spend) {
  if (!spend) return null;
  const resources = catalog.resources ?? [];
  if (spend.pact) return resources.some((r) => r.key === 'pact') ? 'pact' : null;
  return resources.find((r) => r.kind === 'pool' && norm(r.item) === norm(spend.item))?.key ?? null;
}

/** Os extras de uma entrada: ela mesma, se for `rider`, e os `also`. */
export function ridersOf(entry) {
  return [...(entry.kind === 'rider' ? [entry] : []), ...(entry.also ?? [])];
}

/** A rolagem casa com o `when` da entrada? */
function fits(when, roll) {
  if (!when) return true;
  if (when === 'stealth') return roll.kind === 'initiative' || roll.skill === 'ste';
  if (when === 'spell') return !!roll.spell;
  if (!roll.weapon) return false;
  if (when === 'unarmed') return !!roll.unarmed;
  if (when === 'str') return roll.attackAbility === 'str';
  if (when === 'melee') return roll.melee !== false;
  if (when === 'ranged') return roll.melee === false;
  return true;
}

/** Os extras do registro que valem para uma rolagem, no formato de rollEffects. */
export function featureRiders(state, catalog, roll) {
  const features = new Set(catalog.features ?? []);
  const rd = catalog.rollData ?? {};
  const raging = (state.modifiers ?? []).some((m) => m.label === 'Rage');
  const out = [];
  for (const [name, entry] of Object.entries(FEATURE_ROLLS)) {
    if (!(entry.has ? entry.has(catalog) : features.has(name))) continue;
    ridersOf(entry).forEach((e, i) => {
      if (!e.on.includes(roll.kind)) return;
      if (e.needs === 'Rage' && !raging) return;
      if (!fits(e.when, roll)) return;
      const label = e.label ?? name.replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase());
      const key = spendKeyOf(catalog, e.spend);
      const max = key ? (catalog.resources ?? []).find((r) => r.key === key)?.max ?? 0 : 0;
      const none = e.spend && (!key || remainingOf(state, key, max) < 1);
      out.push({
        id: `rider:${slug(name)}${entry.kind === 'rider' ? (i ? `-${i}` : '') : `-${i + 1}`}`,
        label: none ? `${label} (none left)` : label,
        source: label,
        part: { label, formula: formulaOf(e, rd) },
        note: noteOf(e, rd),
        defaultOn: !!e.defaultOn,
        ...(key ? { spend: { key, amount: 1 } } : {}),
      });
    });
  }
  return out;
}

/** As operações de gasto dos extras ligados (o `applied` de applyEffects) e as linhas do card. */
export function riderSpendOps(applied, catalog) {
  const spends = applied?.spends ?? [];
  const ops = spends.map((s) => ({ op: 'spend', key: s.key, amount: s.amount }));
  const lines = spends.map((s) => ({ name: (catalog.resources ?? []).find((r) => r.key === s.key)?.name ?? s.key, amount: s.amount }));
  return { ops, lines };
}

/**
 * O que o "Use" de uma feature `toggle` ou `use` faz: o modificador (sem id), a chave
 * do gasto, a salvaguarda, a rolagem, o `apply` e a chave do `restore`. Null para o resto.
 */
export function featureUseOf(feature, catalog) {
  const e = featureRollOf(feature?.name);
  if (!e || (e.kind !== 'toggle' && e.kind !== 'use')) return null;
  const rd = catalog.rollData ?? {};
  let save = null;
  if (e.save) {
    let dc;
    try {
      dc = rollFormula(e.save.dc, { data: rd }).total;
    } catch {
      dc = null;
    }
    save = { abilities: [e.save.ability], dc };
  }
  const roll = e.roll ? { label: e.roll.label, formula: formulaOf(e.roll, rd) } : null;
  return { modifier: e.modifier ? e.modifier(rd) : null, spend: spendKeyOf(catalog, e.spend), save, roll, apply: e.apply ?? null, restore: spendKeyOf(catalog, e.restore) };
}
