// =============================================================================
// playEffects: condições, modificadores e efeitos que mexem nas rolagens
// =============================================================================
// O QUE FAZ
//   As três camadas de modificador do play mode (docs/PLAY-MODE-PLAN.md 3.6):
//   (1) as CONDIÇÕES, com o efeito mecânico do texto do XPHB (CONDITIONS);
//   (2) os modificadores MANUAIS do mestre ou de uma magia que o registro não
//   conhece ("-2 em tudo nesta cena"); (3) os efeitos CURADOS de feature e de
//   magia (Rage, Bless, Hunter's Mark), mais os "riders" de dano sempre
//   disponíveis (Sneak Attack) e as passivas (Improved Critical, Reliable
//   Talent). Para cada rolagem, rollEffects lista o que se aplica, com a origem,
//   e applyEffects soma o que o jogador deixou ligado.
//
// FUNÇÕES
//   healDiceMaxed(state): um efeito ligado põe no máximo os dados de toda cura que o personagem
//     recebe (`healMax`, o Gift of the Ever-Living Ones, DDL-0238).
//   Registro
//     conditionList(state): as condições ativas, com as incluídas (Paralyzed
//       inclui Incapacitated), e o nível da exaustão.
//     conditionId(name), conditionName(id): a chave de uma condição, status ou
//       doença no estado, e o nome dela de volta.
//   Rolagens
//     rollEffects(state, catalog, roll): o que se aplica a uma rolagem.
//     applyEffects(effects, enabledIds): vantagem, desvantagem, partes, piso,
//       limiar de crítico, falha automática e gastos do que ficou ligado; `oncePerCast`, os ids
//       do que vale numa rolagem de dano por lançamento.
//     castOnceEffects(effects, used): numa magia de várias rolagens (os grupos do Magic Missile, os
//       meteoros), o extra "one damage roll of that spell" já usado sai desligado com a nota (DDL-0250).
//     matches(targets, roll): um efeito de modificador vale para esta rolagem?
//   Ficha
//     effectiveDefenses(catalog, state): defesas com Rage, Petrified e afins (resistência e imunidade de um
//       modificador: o Tasha's Otherworldly Guise, DDL-0245).
//     attackRollContext(attack, kind, catalog): o contexto de rolagem de um ataque (acerto ou dano); no dano,
//       as mãos da arma (`hands`), a empunhadura padrão (`grip`), e a escola e a classe da magia.
//     defaultGrip(attack, catalog): a empunhadura padrão: duas mãos só se a arma pede, ou a Lance sem escudo
//       na mão (montado, uma mão, com escudo); um efeito com `grip` (o Dueling, o Great Weapon Fighting na
//       versátil e na Lance) começa ligado só nessa empunhadura (DDL-0247).
//     fixedRollBonus(state, catalog, roll): os efeitos ligados que são número fixo; a lista
//       de ataques soma (o arco do ranger com Archery dizia +7, e o diálogo rolava +9,
//       DDL-0221).
//     DAMAGE_TYPES: os 13 tipos de dano (o Petrified e o tipo opcional do Hurt).
//     effectiveAc(catalog, state), effectiveSpeed(catalog, state): CA e
//       deslocamento com condições e modificadores.
//     effectiveSpeeds(catalog, state): cada deslocamento (voo, natação...) com as
//       mesmas regras; o bônus de modificador vale só a pé.
//   Modificadores
//     makeModifier(fields): um modificador com id.
//     featureModifier(action, catalog), spellModifier(spell, catalog): o efeito
//       curado de uma feature usada ou de uma magia lançada, ou null.
//     sourceModifier(name): o efeito curado de uma magia lançada por OUTRO (o Add
//       effect do card), sem ligação com a concentração do personagem, ou null.
//     endConcentrationOps(state): termina a concentração e o que dependia dela (os
//       efeitos e, desde o DDL-0193, os summons ligados a ela; desde o DDL-0195, a
//       forma de uma magia de concentração, com os PV temporários dela).
//     restModifierOps(state, period): o que um descanso tira (o efeito `longRest` de feature, o Hex
//       Warrior e o Blessing of the Forge, só sai no longo, DDL-0242).
//     conditionEvent(args), modifierEvent(args), removeModifierEvent(args): os
//       eventos.
//
// DECISÕES E ARMADILHAS
//   Condições (texto do XPHB, conditionsdiseases.json, 2026-10-24)
//   - CONDITIONS guarda o efeito de cada condição: `attack`/`check`/
//     `initiative` ('adv' ou 'dis'), `autoFail` e `saveDis` por atributo,
//     `speedZero`, `resistAll`, `includes` (as condições que ela traz junto),
//     `conditional` (quando vale) e `notes` (o que vale para quem ataca).
//   - Só entra o que mexe numa rolagem ou número DO PRÓPRIO personagem; o que é
//     sobre quem ataca ("ataques contra você têm vantagem") fica como LEMBRETE.
//   - Frightened e Grappled são CONDICIONAIS (a fonte à vista, o alvo que não é
//     quem agarra): entram ligados, mas o diálogo os mostra para desligar.
//   - Exaustão: -2 por nível em todo teste de d20 (ataque, teste, save, morte,
//     concentração, iniciativa) e -5 pés por nível; nível 6 é a morte (lembrete).
//   - Incapacitated quebra a concentração e a Rage NO MESMO evento que o aplica.
//   - Petrified: resistência a todo dano (`resistAll`).
//   - Status e doença (Surprised, Sewer Plague) também são condições no estado
//     (DDL-0121): a chave é o NOME em minúsculas (conditionId), e o que não está
//     em CONDITIONS só aparece, sem mexer em rolagem. A concentração é a exceção:
//     tem o campo próprio `concentration`, e a tela a mostra entre as condições.
//   - Efeito de OUTRO jogador (sourceModifier): o mesmo registro SPELL_EFFECTS
//     pelo nome, com `source` de magia (some no descanso), sem `concentration`:
//     a concentração é de quem lançou, e tirar o efeito é à mão.
//   Modificador (o `modifiers[]` do estado de jogo)
//   - `{ id, label, source, duration, concentration?, endsOnIncapacitated?,
//     effects: [{ targets, formula?, mode?, when?, optional? }], resist?, ac?,
//     speed? }`. Alvos: 'attack', 'save', 'check', 'damage', 'initiative',
//     'save:<atributo>', 'check:<atributo>', 'skill:<perícia>'. `when` restringe
//     o dano: 'strAttack' (Rage) ou 'weaponAttack' (Divine Favor). `optional`
//     começa DESLIGADO no diálogo (um rider por alvo marcado).
//   - Duração: 'manual' (até remover), 'shortRest' e 'longRest' (o descanso
//     tira). Efeito de feature e de magia sem concentração some em qualquer
//     descanso; o de concentração some quando ela termina (endConcentrationOps).
//   Registros curados (texto do XPHB)
//   - FEATURE_EFFECTS: Rage (resistência a contundente, perfurante e cortante;
//     vantagem em testes e saves de FOR; dano extra da escala em ataque com FOR;
//     termina incapacitado; em combate dura no máximo 10 minutos, `maxRounds`) e
//     Dodge (vantagem em saves de DES, e a nota "ataques contra você têm
//     desvantagem", que é do atacante: até o começo do seu próximo turno, 1 rodada).
//   - A Rage soma a resistência do Primordial Bond (Path of the Elements, nível 10: frio, fogo e
//     raio, DDL-0234) quando o catálogo tem a feature.
//   - FEATURE_EFFECTS 'action:starry-form' (TC-0160): o Use da Starry Form liga o modificador da
//     forma: a resistência do Full of Stars, o piso 10 do Dragon como opção na rolagem (um
//     efeito de modificador aceita `d20Min`), o voo do Twinkling Constellations e o resto como nota.
//   - FEATURE_EFFECTS das formas (TC-0177, DDL-0251): Rage of the Gods, Ghost Walk, Djinni's Escape, Shadowform,
//     Form of Dread e Wrath of the Wild ligam no Use (a activity, ou o "Use" do registro e do Channel Divinity) as
//     resistências, a CA, o voo (`speeds` do modificador: um número ou 'walk', o maior vence em
//     effectiveSpeeds) e as notas; o 1d6 do Void Empowerment é efeito opcional só no dano de magia com espaço
//     psíquico ou necrótico (`when: 'slotSpell'`, `types`, DDL-0252).
//   - FEATURE_EFFECTS das runas do Rune Knight (TC-0167, DDL-0238): o Use do Frost Rune liga +2 nos
//     testes e salvaguardas de FOR e CON por 10 minutos, o do Hill Rune a resistência a contundente,
//     perfurante e cortante por 1 minuto, o do Storm Rune o estado profético como nota. No ator esses
//     efeitos saem desligados (INVOKED_EFFECTS em engine/foundryItems): antes valiam o tempo todo.
//   - SPELL_EFFECTS: Bless (+1d4 em ataques e saves), Shield of Faith (+2 CA),
//     Divine Favor (+1d4 radiante com arma), Hunter's Mark (+1d6 de força no alvo
//     marcado; 1d10 com o Foe Slayer do catálogo, TC-0153), Hex (+1d6 necrótico no alvo amaldiçoado). `self` diz se a magia é
//     só em si mesmo; senão a tela pergunta.
//   - RIDERS: os extras das features (Sneak Attack, Brutal Strike, Divine Strike,
//     Peerless Skill...) moram em engine/playFeatureRolls.js (DDL-0205); o que gasta
//     um pool leva `spend`, e applyEffects devolve os `spends` ligados.
//   - A vantagem que só a prosa declara (Fey Ancestry, Brave) vem de
//     engine/playProseEffects (DDL-0213); a feature com FEATURE_EFFECTS (a Rage) fica fora
//     dela pela chave da ação, e o Bloodied e a Rage ativa vão pelo estado.
//   - PASSIVES (pelo nome da feature no catálogo): Improved Critical (19),
//     Superior Critical (18), Reliable Talent (piso 10 nos testes com
//     proficiência), Indomitable Might (o TOTAL de teste e salvaguarda de FOR não fica abaixo
//     do valor de FOR, `totalMin`, TC-0151).
// -----------------------------------------------------------------------------

import { makeId } from '../schema/character';
import { rollFormula } from './dice';
import { makeEvent, hpView } from './playState';
import { revertOps } from './playForms';
import { featureRiders } from './playFeatureRolls';
import { bridgedEffects } from './playActorEffects';
import { proseEffects } from './playProseEffects';

/** Os 13 tipos de dano do XPHB, em ordem alfabética. */
export const DAMAGE_TYPES = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];

export const CONDITIONS = {
  blinded: { name: 'Blinded', attack: 'dis', notes: ['Auto-fail checks that need sight', 'Attacks against you have Advantage'] },
  charmed: { name: 'Charmed', notes: ["Can't attack the charmer", 'The charmer has Advantage on social checks against you'] },
  deafened: { name: 'Deafened', notes: ['Auto-fail checks that need hearing'] },
  exhaustion: { name: 'Exhaustion', levels: 6, notes: ['You die at level 6'] },
  frightened: { name: 'Frightened', attack: 'dis', check: 'dis', conditional: 'while the source of fear is in sight', notes: ["Can't move closer to the source"] },
  grappled: { name: 'Grappled', attack: 'dis', speedZero: true, conditional: 'against targets other than the grappler' },
  incapacitated: { name: 'Incapacitated', initiative: 'dis', breaksConcentration: true, notes: ["No Actions, Bonus Actions or Reactions; can't speak"] },
  invisible: { name: 'Invisible', attack: 'adv', initiative: 'adv', notes: ['Attacks against you have Disadvantage'] },
  paralyzed: { name: 'Paralyzed', includes: ['incapacitated'], speedZero: true, autoFail: ['str', 'dex'], notes: ['Hits from within 5 feet are critical'] },
  petrified: { name: 'Petrified', includes: ['incapacitated'], speedZero: true, autoFail: ['str', 'dex'], resistAll: true },
  poisoned: { name: 'Poisoned', attack: 'dis', check: 'dis' },
  prone: { name: 'Prone', attack: 'dis', notes: ['Attacks from within 5 feet have Advantage against you'] },
  restrained: { name: 'Restrained', attack: 'dis', speedZero: true, saveDis: ['dex'], notes: ['Attacks against you have Advantage'] },
  stunned: { name: 'Stunned', includes: ['incapacitated'], autoFail: ['str', 'dex'], notes: ['Attacks against you have Advantage'] },
  unconscious: { name: 'Unconscious', includes: ['incapacitated', 'prone'], speedZero: true, autoFail: ['str', 'dex'], notes: ['Hits from within 5 feet are critical'] },
};

const FEATURE_EFFECTS = {
  'action:starry-form': (catalog) => {
    const has = (n) => (catalog?.features ?? []).includes(n);
    return {
      label: 'Starry Form',
      source: 'feature',
      duration: 'manual',
      maxRounds: 100,
      endsOnIncapacitated: true,
      ...(has('full of stars') ? { resist: ['bludgeoning', 'piercing', 'slashing'] } : {}),
      notes: [
        'Archer: the Archer attack on the Features tab; Chalice: its Use after a healing spell with a slot',
        'Dragon: a d20 of 9 or lower counts as 10 on Intelligence and Wisdom checks and on Constitution saves to keep Concentration (an option in those rolls)',
        ...(has('twinkling constellations') ? ['Dragon: Fly Speed 20 feet, can hover; change the constellation at the start of each turn'] : []),
      ],
      effects: [{ targets: ['check:int', 'check:wis', 'save:con'], d20Min: 10, optional: true, label: 'Starry Form: Dragon' }],
    };
  },
  'action:frost-rune': () => ({
    label: 'Frost Rune',
    source: 'feature',
    duration: 'manual',
    maxRounds: 100,
    effects: [{ targets: ['check:str', 'save:str', 'check:con', 'save:con'], formula: '2', label: 'Frost Rune' }],
  }),
  'action:hill-rune': () => ({ label: 'Hill Rune', source: 'feature', duration: 'manual', maxRounds: 10, resist: ['bludgeoning', 'piercing', 'slashing'], effects: [] }),
  'action:storm-rune': () => ({
    label: 'Storm Rune',
    source: 'feature',
    duration: 'manual',
    maxRounds: 10,
    endsOnIncapacitated: true,
    notes: ['prophetic state: a Reaction gives Advantage or Disadvantage to an attack roll, save or check you can see within 60 feet'],
    effects: [],
  }),
  'action:rage': (catalog) => ({
    label: 'Rage',
    source: 'feature',
    duration: 'manual',
    endsOnIncapacitated: true,
    maxRounds: 100,
    resist: ['bludgeoning', 'piercing', 'slashing', ...((catalog.features ?? []).includes('primordial bond') ? ['cold', 'fire', 'lightning'] : [])],
    effects: [
      { targets: ['damage'], formula: catalog.rollData?.['scale.barbarian.rage-damage'] != null ? '@scale.barbarian.rage-damage' : '2', when: 'strAttack', label: 'Rage damage' },
      { targets: ['check:str', 'save:str'], mode: 'advantage', label: 'Rage' },
    ],
  }),

  'action:rage-of-the-gods': () => ({
    label: 'Rage of the Gods',
    source: 'feature',
    duration: 'manual',
    maxRounds: 10,
    resist: ['necrotic', 'psychic', 'radiant'],
    speeds: { fly: 'walk' },
    notes: ['Can hover; ends at 0 Hit Points', 'Revivification: a Reaction and a Rage use set a creature within 30 feet that would drop to 0 Hit Points to your Barbarian level in Hit Points'],
    effects: [],
  }),
  'action:ghost-walk': () => ({
    label: 'Ghost Walk',
    source: 'feature',
    duration: 'manual',
    maxRounds: 100,
    speeds: { fly: 10 },
    notes: ['Can hover', 'Attack rolls have Disadvantage against you', 'Move through creatures and objects as Difficult Terrain; 1d10 Force damage if you end your turn inside one'],
    effects: [],
  }),
  'action:djinnis-escape': () => ({
    label: "Djinni's Escape",
    source: 'feature',
    duration: 'manual',
    maxRounds: 2,
    resist: ['bludgeoning', 'piercing', 'slashing'],
    notes: ['Teleport up to 30 feet first', 'Immune to the Grappled, Prone and Restrained conditions', 'Lasts until the end of your next turn'],
    effects: [],
  }),
  'action:shadowform': () => ({
    label: 'Shadowform',
    source: 'feature',
    duration: 'manual',
    maxRounds: 10,
    endsOnIncapacitated: true,
    notes: ['Shadow Stealth: the Hide action as a Bonus Action in Dim Light or Darkness', 'Ends if you deal Radiant damage with a spell'],
    effects: [{ targets: ['damage'], formula: '1d6', optional: true, when: 'slotSpell', types: ['psychic', 'necrotic'], label: 'Void Empowerment (one damage roll of the spell)' }],
  }),
  'action:form-of-dread': () => ({
    label: 'Form of Dread',
    source: 'feature',
    duration: 'manual',
    maxRounds: 10,
    endsOnIncapacitated: true,
    notes: ['Immune to the Frightened condition (it ends if you had it)', 'Once per turn on a hit: the target makes a Wisdom save against your spell save DC or is Frightened until the end of your next turn'],
    effects: [],
  }),
  'action:wrath-of-the-wild': (catalog) => ({
    label: 'Wrath of the Wild',
    source: 'feature',
    duration: 'manual',
    maxRounds: 10,
    endsOnIncapacitated: true,
    ac: (catalog?.rollData?.classes?.ranger?.levels ?? 0) >= 11 ? 2 : 1,
    notes: ['Prowling Retribution: an Opportunity Attack against a creature within 5 feet that damages you or an ally', 'Unnerving Aura: at the start of each of your turns, creatures of your choice within 10 feet make a Wisdom save or are Frightened'],
    effects: [],
  }),
  'action:dodge': () => ({
    label: 'Dodge',
    source: 'feature',
    duration: 'manual',
    maxRounds: 1,
    notes: ['Attacks against you have Disadvantage'],
    effects: [{ targets: ['save:dex'], mode: 'advantage', label: 'Dodge' }],
  }),
};

const SPELL_EFFECTS = {
  bless: { self: false, make: () => ({ label: 'Bless', effects: [{ targets: ['attack', 'save'], formula: '1d4', label: 'Bless' }] }) },
  'shield of faith': { self: false, make: () => ({ label: 'Shield of Faith', ac: 2, effects: [] }) },
  'divine favor': { self: true, make: () => ({ label: 'Divine Favor', effects: [{ targets: ['damage'], formula: '1d4', when: 'weaponAttack', label: 'Divine Favor (radiant)' }] }) },
  "hunter's mark": { self: true, make: (c) => ({ label: "Hunter's Mark", effects: [{ targets: ['damage'], formula: (c?.features ?? []).includes('foe slayer') ? '1d10' : '1d6', optional: true, label: "Hunter's Mark (force, marked target)" }] }) },
  hex: { self: true, make: () => ({ label: 'Hex', effects: [{ targets: ['damage'], formula: '1d6', optional: true, label: 'Hex (necrotic, cursed target)' }] }) },
};

const PASSIVES = {
  'improved critical': { critThreshold: 19 },
  'superior critical': { critThreshold: 18 },
  'reliable talent': { d20Min: 10 },
  'indomitable might': { totalMin: 'str' },
};

/** Os nomes das features que as PASSIVES tratam (o levantamento as conta como `use`). */
export const PASSIVE_FEATURES = Object.keys(PASSIVES);

/** As condições ativas, com as incluídas, e o nível da exaustão. */
export function conditionList(state) {
  const ids = new Set();
  for (const [id, level] of Object.entries(state.conditions ?? {})) {
    if (!level) continue;
    ids.add(id);
    for (const inc of CONDITIONS[id]?.includes ?? []) ids.add(inc);
  }
  return { ids: [...ids], exhaustion: state.conditions?.exhaustion ?? 0 };
}

/** A chave de uma condição, status ou doença no estado: o nome em minúsculas. */
export function conditionId(name) {
  return String(name ?? '').trim().toLowerCase();
}

/** O nome de uma condição pela chave (a do registro, ou a chave com maiúsculas). */
export function conditionName(id) {
  return CONDITIONS[id]?.name ?? String(id).replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}

/** Um efeito de modificador vale para esta rolagem? */
function matches(targets, roll) {
  return (targets ?? []).some((t) => t === roll.kind
    || (roll.ability && t === `${roll.kind}:${roll.ability}`)
    || (roll.skill && t === `skill:${roll.skill}`)
    || (roll.kind === 'initiative' && t === 'check:dex'));
}

const D20_KINDS = new Set(['attack', 'check', 'save', 'initiative', 'deathSave', 'concentration']);

/**
 * O que se aplica a uma rolagem.
 * @param {{ kind: 'attack'|'check'|'save'|'initiative'|'deathSave'|'concentration'|'damage', ability?: string, skill?: string,
 *   proficient?: boolean, attackAbility?: string, weapon?: boolean }} roll
 * @returns {{ id: string, label: string, source: string, adv?: number, dis?: number, part?: object, autoFail?: boolean,
 *   d20Min?: number, critThreshold?: number, note?: string, defaultOn: boolean }[]}
 */
export function rollEffects(state, catalog, roll) {
  const out = [];
  const { ids, exhaustion } = conditionList(state);
  const asCheck = roll.kind === 'check' || roll.kind === 'initiative';
  const asSave = roll.kind === 'save' || roll.kind === 'concentration' || roll.kind === 'deathSave';
  const saveAbility = roll.kind === 'concentration' ? 'con' : roll.ability;

  for (const id of ids) {
    const c = CONDITIONS[id];
    if (!c) continue;
    const base = { source: c.name, defaultOn: true, ...(c.conditional ? { note: c.conditional } : {}) };
    if (roll.kind === 'attack' && c.attack) out.push({ id: `cond:${id}:attack`, label: c.name, ...base, [c.attack]: 1 });
    if (asCheck && c.check) out.push({ id: `cond:${id}:check`, label: c.name, ...base, dis: 1 });
    if (roll.kind === 'initiative' && c.initiative) out.push({ id: `cond:${id}:init`, label: c.name, ...base, [c.initiative]: 1 });
    if (asSave && saveAbility && (c.autoFail ?? []).includes(saveAbility)) out.push({ id: `cond:${id}:fail`, label: `${c.name}: automatic failure`, ...base, autoFail: true });
    if (asSave && saveAbility && (c.saveDis ?? []).includes(saveAbility)) out.push({ id: `cond:${id}:save`, label: c.name, ...base, dis: 1 });
  }
  if (exhaustion > 0 && D20_KINDS.has(roll.kind)) {
    out.push({ id: 'cond:exhaustion', label: `Exhaustion ${exhaustion}`, source: 'Exhaustion', part: { label: `Exhaustion ${exhaustion}`, formula: -2 * exhaustion }, defaultOn: true });
  }

  for (const m of state.modifiers ?? []) {
    (m.effects ?? []).forEach((e, i) => {
      if (!matches(e.targets, { ...roll, ability: roll.kind === 'concentration' ? 'con' : roll.ability, kind: roll.kind === 'concentration' || roll.kind === 'deathSave' ? 'save' : roll.kind })) return;
      if (e.when === 'strAttack' && roll.attackAbility !== 'str') return;
      if (e.when === 'weaponAttack' && !roll.weapon) return;
      if (e.when === 'spell' && !roll.spell) return;
      if (e.when === 'slotSpell' && (!roll.spell || roll.cantrip)) return;
      if (e.types && !(roll.types ?? []).some((t) => e.types.includes(String(t).toLowerCase()))) return;
      const entry = { id: `mod:${m.id}:${i}`, label: e.label ?? m.label, source: m.label, defaultOn: !e.optional };
      if (e.mode === 'advantage') entry.adv = 1;
      else if (e.mode === 'disadvantage') entry.dis = 1;
      else if (e.d20Min) entry.d20Min = e.d20Min;
      else if (e.formula != null && e.formula !== '') entry.part = { label: e.label ?? m.label, formula: e.formula };
      else return;
      out.push(entry);
    });
  }

  out.push(...featureRiders(state, catalog, roll));
  out.push(...bridgedEffects(state, catalog, roll, ids));
  const hp = hpView(state, catalog.stats?.hpMax ?? 0);
  out.push(...proseEffects(catalog, roll, { conditionIds: [...ids], skipKeys: Object.keys(FEATURE_EFFECTS), bloodied: hp.max > 0 && hp.current <= hp.max / 2, raging: (state.modifiers ?? []).some((m) => m.label === 'Rage'), concentrating: !!state.concentration, skipNames: Object.keys(PASSIVES) }));

  const features = new Set(catalog.features ?? []);
  for (const [name, p] of Object.entries(PASSIVES)) {
    if (!features.has(name)) continue;
    if (p.critThreshold && roll.kind === 'attack' && roll.weapon) out.push({ id: `passive:${name}`, label: `${name[0].toUpperCase()}${name.slice(1)} (crit on ${p.critThreshold})`, source: name, critThreshold: p.critThreshold, defaultOn: true });
    if (p.totalMin && (roll.kind === 'check' || roll.kind === 'save') && roll.ability === p.totalMin) {
      const score = (catalog.checks?.abilities ?? []).find((a) => a.ability === p.totalMin)?.score ?? 0;
      out.push({ id: `passive:${name}`, label: `Indomitable Might (a total below ${score} counts as ${score})`, source: name, totalMin: score, defaultOn: true });
    }
    if (p.d20Min && roll.kind === 'check' && roll.proficient) out.push({ id: `passive:${name}`, label: `Reliable Talent (9 or lower counts as ${p.d20Min})`, source: name, d20Min: p.d20Min, defaultOn: true });
  }
  return roll.grip ? out.map((e) => (e.grip ? { ...e, defaultOn: e.grip === roll.grip } : e)) : out;
}

/**
 * Soma o que ficou ligado.
 * @returns {{ advantage: number, disadvantage: number, parts: object[], d20Min: number|null, critThreshold: number|null, autoFail: boolean, labels: string[], spends: object[] }}
 */
export function applyEffects(effects, enabledIds = null) {
  const on = (effects ?? []).filter((e) => (enabledIds ? enabledIds.includes(e.id) : e.defaultOn));
  return {
    advantage: on.reduce((s, e) => s + (e.adv ?? 0), 0),
    disadvantage: on.reduce((s, e) => s + (e.dis ?? 0), 0),
    parts: on.filter((e) => e.part).map((e) => e.part),
    d20Min: on.reduce((m, e) => (e.d20Min ? Math.max(m ?? 0, e.d20Min) : m), null),
    totalMin: on.reduce((m, e) => (e.totalMin ? Math.max(m ?? 0, e.totalMin) : m), null),
    critThreshold: on.reduce((m, e) => (e.critThreshold ? Math.min(m ?? 20, e.critThreshold) : m), null),
    autoFail: on.some((e) => e.autoFail),
    labels: on.map((e) => e.label),
    spends: on.filter((e) => e.spend).map((e) => e.spend),
    twice: on.some((e) => e.twice),
    diceMin: on.reduce((m, e) => (e.diceMin ? Math.max(m ?? 0, e.diceMin) : m), null),
    forgo: on.reduce((s, e) => s + (e.forgo ?? 0), 0),
    forgoableMin: on.reduce((m, e) => (e.forgoableMin ? Math.max(m ?? 0, e.forgoableMin) : m), null),
    rerollOnes: on.some((e) => e.rerollOnes),
    elven: on.some((e) => e.elven),
    oncePerCast: on.filter((e) => e.oncePerCast).map((e) => e.id),
  };
}

/** Numa magia de várias rolagens de dano, o extra de "one damage roll of that spell" já usado sai desligado, com a nota. */
export function castOnceEffects(effects, used = []) {
  return (effects ?? []).map((e) => (e.oncePerCast && used.includes(e.id) ? { ...e, defaultOn: false, note: 'Already added to an earlier damage roll of this casting' } : e));
}

/** As defesas com os modificadores e as condições (Rage, Petrified). */
export function effectiveDefenses(catalog, state) {
  const base = catalog.defenses ?? { resist: [], immune: [], vulnerable: [] };
  const resist = new Set(base.resist);
  const immune = new Set(base.immune ?? []);
  for (const m of state.modifiers ?? []) for (const r of m.resist ?? []) resist.add(r);
  for (const m of state.modifiers ?? []) for (const r of m.immune ?? []) immune.add(r);
  const { ids } = conditionList(state);
  const all = ids.some((id) => CONDITIONS[id]?.resistAll);
  if (all) for (const t of DAMAGE_TYPES) resist.add(t);
  return { ...base, resist: [...resist], immune: [...immune] };
}

/** A CA com os modificadores (Shield of Faith, o +1 do mestre). */
export function effectiveAc(catalog, state) {
  const base = catalog.stats?.ac;
  if (base == null) return null;
  return base + (state.modifiers ?? []).reduce((s, m) => s + (Number(m.ac) || 0), 0);
}

/** O deslocamento com as condições (zero, exaustão) e os modificadores. */
export function effectiveSpeed(catalog, state) {
  const base = catalog.stats?.speed;
  if (base == null) return null;
  const { ids, exhaustion } = conditionList(state);
  if (ids.some((id) => CONDITIONS[id]?.speedZero)) return 0;
  const bonus = (state.modifiers ?? []).reduce((s, m) => s + (Number(m.speed) || 0), 0);
  return Math.max(0, base + bonus - 5 * exhaustion);
}

/** Cada deslocamento com condições e exaustão; o bônus de modificador só a pé. */
export function effectiveSpeeds(catalog, state) {
  const speeds = catalog.stats?.speeds ?? {};
  const { ids, exhaustion } = conditionList(state);
  const zero = ids.some((id) => CONDITIONS[id]?.speedZero);
  const bonus = (state.modifiers ?? []).reduce((s, m) => s + (Number(m.speed) || 0), 0);
  const out = {};
  const extra = {};
  for (const m of state.modifiers ?? []) {
    for (const [mode, v] of Object.entries(m.speeds ?? {})) {
      const feet = v === 'walk' ? (speeds.walk?.feet ?? 0) + bonus : Number(v) || 0;
      if (feet > (extra[mode]?.feet ?? 0)) extra[mode] = { feet, note: m.label };
    }
  }
  for (const [mode, s] of Object.entries({ ...extra, ...speeds })) {
    const own = s.feet + (mode === 'walk' ? bonus : 0);
    const raw = Math.max(own, extra[mode]?.feet ?? 0);
    const feet = zero ? 0 : Math.max(0, raw - 5 * exhaustion);
    out[mode] = { ...s, feet, base: s.feet };
  }
  return out;
}

/** Um modificador com id e os campos de sempre. */
export function makeModifier(fields) {
  return { id: makeId(), source: 'manual', duration: 'manual', effects: [], ...fields };
}

/** O efeito curado de uma feature usada (Rage), ou null. */
export function featureModifier(action, catalog) {
  const make = FEATURE_EFFECTS[action?.key];
  return make ? makeModifier(make(catalog)) : null;
}

/** O efeito curado de uma magia lançada, com `self` (só em si mesmo), ou null. */
export function spellModifier(spell, catalog = null) {
  const entry = SPELL_EFFECTS[String(spell?.name ?? '').toLowerCase()];
  if (!entry) return null;
  return {
    self: entry.self,
    modifier: makeModifier({ ...entry.make(catalog), source: 'spell', ...(spell.concentration ? { concentration: spell.key } : {}) }),
  };
}

/** O efeito curado de uma magia lançada por outro, pelo nome, ou null. */
export function sourceModifier(name) {
  const entry = SPELL_EFFECTS[String(name ?? '').toLowerCase()];
  return entry ? makeModifier({ ...entry.make(), source: 'spell' }) : null;
}

/** Termina a concentração e tira os modificadores que dependiam dela. */
export function endConcentrationOps(state) {
  if (!state.concentration) return [];
  return [
    { op: 'concentration', value: null },
    ...(state.modifiers ?? []).filter((m) => m.concentration).map((m) => ({ op: 'modifier', remove: m.id })),
    ...(state.summons ?? []).filter((g) => g.concentration).map((g) => ({ op: 'summon', remove: g.id })),
    ...(state.form?.concentration ? revertOps(state) : []),
  ];
}

/** A empunhadura padrão do ataque: duas mãos só quando a arma pede, ou a Lance sem escudo na mão. */
export function defaultGrip(attack, catalog = null) {
  const hands = attack?.hands ?? 'one';
  const shield = catalog?.shield && !catalog.shield.handsFree;
  if (hands === 'two') return 'two';
  if (hands === 'mounted') return shield ? 'one' : 'two';
  return 'one';
}

/** O contexto de rolagem de um ataque do catálogo (acerto ou dano), o mesmo da tela. */
export function attackRollContext(attack, kind = 'attack', catalog = null) {
  const hands = attack.hands ?? ((attack.properties ?? []).includes('2H') ? 'two' : attack.versatile ? 'versatile' : 'one');
  return {
    kind,
    weapon: attack.kind === 'weapon' || attack.kind === 'unarmed',
    melee: attack.range === 'melee',
    unarmed: attack.kind === 'unarmed',
    spell: attack.kind === 'spell' || attack.kind === 'cantrip',
    attackAbility: attack.ability,
    pact: !!attack.pact,
    cantrip: !!attack.cantrip,
    spellName: attack.kind === 'spell' || attack.kind === 'cantrip' ? attack.name : null,
    school: attack.school ?? null,
    spellClass: attack.spellClass ?? null,
    types: attack.damage?.types ?? null,
    ...(kind === 'damage' ? { hands, grip: defaultGrip(attack, catalog), twoHanded: hands === 'two', versatile: hands === 'versatile' || hands === 'mounted' } : {}),
  };
}

/** A soma dos efeitos LIGADOS por padrão que são número fixo (Archery, o extra da Rage), para a lista mostrar o que o diálogo rola. */
export function fixedRollBonus(state, catalog, roll) {
  let sum = 0;
  for (const e of rollEffects(state, catalog, roll)) {
    if (!e.defaultOn || !e.part) continue;
    try {
      const r = rollFormula(String(e.part.formula), { data: catalog.rollData ?? {} });
      if (!r.groups.length) sum += r.total;
    } catch {
      // ATENÇÃO: fórmula que não resolve não entra na soma; o diálogo a mostra como está.
    }
  }
  return sum;
}

/** O que um descanso tira: efeitos de feature e de magia sem concentração, e os manuais com a duração. */
export function restModifierOps(state, period) {
  return (state.modifiers ?? [])
    .filter((m) => (m.source !== 'manual' && !m.concentration && m.duration !== 'longRest')
      || m.duration === 'shortRest'
      || (period === 'lr' && (m.duration === 'longRest' || m.concentration)))
    .map((m) => ({ op: 'modifier', remove: m.id }));
}

/** Liga, muda o nível ou tira uma condição; incapacitar quebra concentração e Rage no mesmo evento. */
export function conditionEvent({ state, id, level, now = new Date() }) {
  const c = CONDITIONS[id];
  const ops = [{ op: 'condition', id, level }];
  const incapacitates = level > 0 && (id === 'incapacitated' || (c?.includes ?? []).includes('incapacitated'));
  if (incapacitates) {
    ops.push(...endConcentrationOps(state));
    ops.push(...(state.modifiers ?? []).filter((m) => m.endsOnIncapacitated).map((m) => ({ op: 'modifier', remove: m.id })));
  }
  const name = conditionName(id);
  const label = level > 0 ? (c?.levels ? `${name} ${level}` : name) : `${name} ended`;
  return makeEvent('condition', { label, ops, payload: { id, level } }, now);
}

/** Liga um modificador. */
export function modifierEvent({ modifier, now = new Date() }) {
  return makeEvent('modifier', { label: modifier.label, ops: [{ op: 'modifier', add: modifier }], payload: { added: true } }, now);
}

/** Tira um modificador. */
export function removeModifierEvent({ state, id, now = new Date() }) {
  const m = (state.modifiers ?? []).find((x) => x.id === id);
  return makeEvent('modifier', { label: `${m?.label ?? 'Effect'} ended`, ops: [{ op: 'modifier', remove: id }], payload: { added: false } }, now);
}

/** Um efeito ligado põe no máximo os dados de toda cura que o personagem recebe (Gift of the Ever-Living Ones). */
export function healDiceMaxed(state) {
  return (state?.modifiers ?? []).some((m) => m.healMax);
}
