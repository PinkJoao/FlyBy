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
//   Registro
//     conditionList(state): as condições ativas, com as incluídas (Paralyzed
//       inclui Incapacitated), e o nível da exaustão.
//   Rolagens
//     rollEffects(state, catalog, roll): o que se aplica a uma rolagem.
//     applyEffects(effects, enabledIds): vantagem, desvantagem, partes, piso,
//       limiar de crítico e falha automática do que ficou ligado.
//     matches(targets, roll): um efeito de modificador vale para esta rolagem?
//   Ficha
//     effectiveDefenses(catalog, state): defesas com Rage, Petrified e afins.
//     effectiveAc(catalog, state), effectiveSpeed(catalog, state): CA e
//       deslocamento com condições e modificadores.
//   Modificadores
//     makeModifier(fields): um modificador com id.
//     featureModifier(action, catalog), spellModifier(spell, catalog): o efeito
//       curado de uma feature usada ou de uma magia lançada, ou null.
//     endConcentrationOps(state): termina a concentração e o que dependia dela.
//     restModifierOps(state, period): o que um descanso tira.
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
//     termina incapacitado; em combate dura no máximo 10 minutos, `maxRounds`).
//   - SPELL_EFFECTS: Bless (+1d4 em ataques e saves), Shield of Faith (+2 CA),
//     Divine Favor (+1d4 radiante com arma), Hunter's Mark (+1d6 de força no alvo
//     marcado), Hex (+1d6 necrótico no alvo amaldiçoado). `self` diz se a magia é
//     só em si mesmo; senão a tela pergunta.
//   - RIDERS: Sneak Attack (a escala do Rogue, uma vez por turno, opcional) e
//     Brutal Strike (troca a vantagem pelo dado, opcional).
//   - PASSIVES (pelo nome da feature no catálogo): Improved Critical (19),
//     Superior Critical (18), Reliable Talent (piso 10 nos testes com
//     proficiência).
// -----------------------------------------------------------------------------

import { makeId } from '../schema/character';
import { makeEvent } from './playState';

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
  'action:rage': (catalog) => ({
    label: 'Rage',
    source: 'feature',
    duration: 'manual',
    endsOnIncapacitated: true,
    maxRounds: 100,
    resist: ['bludgeoning', 'piercing', 'slashing'],
    effects: [
      { targets: ['damage'], formula: catalog.rollData?.['scale.barbarian.rage-damage'] != null ? '@scale.barbarian.rage-damage' : '2', when: 'strAttack', label: 'Rage damage' },
      { targets: ['check:str', 'save:str'], mode: 'advantage', label: 'Rage' },
    ],
  }),
};

const SPELL_EFFECTS = {
  bless: { self: false, make: () => ({ label: 'Bless', effects: [{ targets: ['attack', 'save'], formula: '1d4', label: 'Bless' }] }) },
  'shield of faith': { self: false, make: () => ({ label: 'Shield of Faith', ac: 2, effects: [] }) },
  'divine favor': { self: true, make: () => ({ label: 'Divine Favor', effects: [{ targets: ['damage'], formula: '1d4', when: 'weaponAttack', label: 'Divine Favor (radiant)' }] }) },
  "hunter's mark": { self: true, make: () => ({ label: "Hunter's Mark", effects: [{ targets: ['damage'], formula: '1d6', optional: true, label: "Hunter's Mark (force, marked target)" }] }) },
  hex: { self: true, make: () => ({ label: 'Hex', effects: [{ targets: ['damage'], formula: '1d6', optional: true, label: 'Hex (necrotic, cursed target)' }] }) },
};

const PASSIVES = {
  'improved critical': { critThreshold: 19 },
  'superior critical': { critThreshold: 18 },
  'reliable talent': { d20Min: 10 },
};

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
      const entry = { id: `mod:${m.id}:${i}`, label: e.label ?? m.label, source: m.label, defaultOn: !e.optional };
      if (e.mode === 'advantage') entry.adv = 1;
      else if (e.mode === 'disadvantage') entry.dis = 1;
      else if (e.formula != null && e.formula !== '') entry.part = { label: e.label ?? m.label, formula: e.formula };
      else return;
      out.push(entry);
    });
  }

  if (roll.kind === 'damage' && roll.weapon) {
    if (catalog.rollData?.['scale.rogue.sneak-attack']) {
      out.push({ id: 'rider:sneak-attack', label: 'Sneak Attack', source: 'Sneak Attack', part: { label: 'Sneak Attack', formula: '@scale.rogue.sneak-attack' }, note: 'once per turn, Finesse or Ranged, with Advantage or an ally next to the target', defaultOn: false });
    }
    if (catalog.rollData?.['scale.barbarian.brutal-strike'] && roll.attackAbility === 'str') {
      out.push({ id: 'rider:brutal-strike', label: 'Brutal Strike', source: 'Brutal Strike', part: { label: 'Brutal Strike', formula: '@scale.barbarian.brutal-strike' }, note: 'only if you gave up Advantage on the attack', defaultOn: false });
    }
  }

  const features = new Set(catalog.features ?? []);
  for (const [name, p] of Object.entries(PASSIVES)) {
    if (!features.has(name)) continue;
    if (p.critThreshold && roll.kind === 'attack' && roll.weapon) out.push({ id: `passive:${name}`, label: `${name[0].toUpperCase()}${name.slice(1)} (crit on ${p.critThreshold})`, source: name, critThreshold: p.critThreshold, defaultOn: true });
    if (p.d20Min && roll.kind === 'check' && roll.proficient) out.push({ id: `passive:${name}`, label: `Reliable Talent (9 or lower counts as ${p.d20Min})`, source: name, d20Min: p.d20Min, defaultOn: true });
  }
  return out;
}

/**
 * Soma o que ficou ligado.
 * @returns {{ advantage: number, disadvantage: number, parts: object[], d20Min: number|null, critThreshold: number|null, autoFail: boolean, labels: string[] }}
 */
export function applyEffects(effects, enabledIds = null) {
  const on = (effects ?? []).filter((e) => (enabledIds ? enabledIds.includes(e.id) : e.defaultOn));
  return {
    advantage: on.reduce((s, e) => s + (e.adv ?? 0), 0),
    disadvantage: on.reduce((s, e) => s + (e.dis ?? 0), 0),
    parts: on.filter((e) => e.part).map((e) => e.part),
    d20Min: on.reduce((m, e) => (e.d20Min ? Math.max(m ?? 0, e.d20Min) : m), null),
    critThreshold: on.reduce((m, e) => (e.critThreshold ? Math.min(m ?? 20, e.critThreshold) : m), null),
    autoFail: on.some((e) => e.autoFail),
    labels: on.map((e) => e.label),
  };
}

/** As defesas com os modificadores e as condições (Rage, Petrified). */
export function effectiveDefenses(catalog, state) {
  const base = catalog.defenses ?? { resist: [], immune: [], vulnerable: [] };
  const resist = new Set(base.resist);
  for (const m of state.modifiers ?? []) for (const r of m.resist ?? []) resist.add(r);
  const { ids } = conditionList(state);
  const all = ids.some((id) => CONDITIONS[id]?.resistAll);
  if (all) for (const t of ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder']) resist.add(t);
  return { ...base, resist: [...resist] };
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
export function spellModifier(spell) {
  const entry = SPELL_EFFECTS[String(spell?.name ?? '').toLowerCase()];
  if (!entry) return null;
  return {
    self: entry.self,
    modifier: makeModifier({ ...entry.make(), source: 'spell', ...(spell.concentration ? { concentration: spell.key } : {}) }),
  };
}

/** Termina a concentração e tira os modificadores que dependiam dela. */
export function endConcentrationOps(state) {
  if (!state.concentration) return [];
  return [
    { op: 'concentration', value: null },
    ...(state.modifiers ?? []).filter((m) => m.concentration).map((m) => ({ op: 'modifier', remove: m.id })),
  ];
}

/** O que um descanso tira: efeitos de feature e de magia sem concentração, e os manuais com a duração. */
export function restModifierOps(state, period) {
  return (state.modifiers ?? [])
    .filter((m) => (m.source !== 'manual' && !m.concentration)
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
  const name = c?.name ?? id;
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
