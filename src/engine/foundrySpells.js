// =============================================================================
// foundrySpells - magias → Items `spell` do Foundry + bloco `system.spells`
// =============================================================================
// Puro: sem rede/DOM. Fase B2.5 (DDL-0008), alvo dnd5e 5.3.3.
//
// SCHEMA (confirmado no `module/data/item/spell.mjs` e nos premades reais):
//   system.method   - 'spell' | 'pact' | 'atwill' | 'innate' | 'ritual'
//   system.prepared - 0 não preparada | 1 preparada | 2 SEMPRE preparada
//   system.uses     - { max, spent, recovery: [{ period: 'lr'|'sr'|'day', type }] }
//   system.sourceItem - "class:<identifier>", liga a magia à classe que a concede
// (o par antigo `preparation: {mode, prepared}` está DEPRECIADO; os exports do
// Plutonium ainda o usam, e o importador aceita ambos.)
//
// COMO CADA ORIGEM MAPEIA:
//   • classe leveled  → method 'spell'   (pact → 'pact'), prepared 1
//   • concedida       → prepared 2 (sempre preparada; não conta no limite)
//   • Mystic Arcanum  → method 'atwill', prepared 0, uses 1/descanso longo.
//     Não é chute: é exatamente o que o premade oficial de Warlock 17 (Sefris)
//     faz com Create Undead / Forcecage / Dominate Monster / True Polymorph.
//   • concessão inata → method 'innate' + uses (1/Day, 1/Long Rest…); 'will' vira
//     'atwill' e 'ritual' vira 'ritual'.
//
// USOS ESCALADOS: `uses.max` do Foundry é uma FÓRMULA. Um "CHA×/dia" exporta
// `@abilities.cha.mod`, não o número já cozido - o Foundry recalcula quando o
// atributo muda (DDL-0011).
// -----------------------------------------------------------------------------

import { randomFoundryId, itemStats, sourceBlock, slugify, entriesToHtml } from './foundryItems';
import { spellUuid } from './compendiumUuids';

/** Escola do 5etools (letra) → código do dnd5e. */
export const FOUNDRY_SCHOOL = {
  A: 'abj', C: 'con', D: 'div', E: 'enc', V: 'evo', I: 'ill', N: 'nec', T: 'trs',
};

/** Unidade de tempo do 5etools → `activation.type`. */
const ACTIVATION_TYPE = {
  action: 'action', bonus: 'bonus', reaction: 'reaction',
  minute: 'minute', hour: 'hour', round: 'turn',
};

/** Unidade de duração do 5etools → `duration.units`. */
const DURATION_UNITS = {
  round: 'round', minute: 'minute', hour: 'hour', day: 'day', year: 'year', turn: 'turn',
};

/** Tipo de distância do 5etools → `range.units`. */
const RANGE_UNITS = {
  feet: 'ft', miles: 'mi', touch: 'touch', self: 'self', sight: 'spec', unlimited: 'any',
};

/** Período de recarga do dnd5e por tipo de conjuração nosso. */
const RECOVERY_PERIOD = { daily: 'day', restLong: 'lr', rest: 'sr' };

/** `activation` a partir de `time[0]`. */
export function foundryActivation(spell) {
  const t = spell?.time?.[0];
  if (!t) return { type: '', condition: '', value: null };
  const n = t.number ?? 1;
  return {
    type: ACTIVATION_TYPE[t.unit] ?? '',
    condition: '',
    value: n > 1 ? n : null,
  };
}

/** `duration` a partir de `duration[0]`. */
export function foundryDuration(spell) {
  const d = spell?.duration?.[0];
  if (!d) return { value: '', units: 'inst' };
  if (d.type === 'instant') return { value: '', units: 'inst' };
  if (d.type === 'permanent') return { value: '', units: 'perm' };
  if (d.type === 'special') return { value: '', units: 'spec' };
  if (d.type === 'timed' && d.duration) {
    return { value: String(d.duration.amount ?? 1), units: DURATION_UNITS[d.duration.type] ?? 'spec' };
  }
  return { value: '', units: 'spec' };
}

/** `range` a partir de `range`. */
export function foundryRange(spell) {
  const r = spell?.range;
  if (!r) return { units: '', special: '', value: '' };
  const dist = r.distance ?? {};
  const units = RANGE_UNITS[dist.type] ?? '';
  const value = dist.type === 'feet' || dist.type === 'miles' ? String(dist.amount ?? '') : '';
  return { units, special: '', value };
}

/** `properties[]`: componentes + concentração + ritual. */
export function foundryProperties(spell) {
  const out = [];
  const c = spell?.components ?? {};
  if (c.v) out.push('vocal');
  if (c.s) out.push('somatic');
  if (c.m) out.push('material');
  if ((spell?.duration ?? []).some((d) => d.concentration)) out.push('concentration');
  if (spell?.meta?.ritual) out.push('ritual');
  return out;
}

/** `materials` a partir de `components.m` (string ou { text, cost, consume }). */
export function foundryMaterials(spell) {
  const m = spell?.components?.m;
  if (!m) return { value: '', consumed: false, cost: 0, supply: 0 };
  if (typeof m === 'string') return { value: m, consumed: false, cost: 0, supply: 0 };
  return {
    value: m.text ?? '',
    consumed: !!m.consume,
    cost: Number(m.cost ?? 0),
    supply: 0,
  };
}

/**
 * `uses` de uma concessão limitada. `max` é FÓRMULA: um uso escalado exporta
 * `@prof` / `@abilities.cha.mod` em vez do número já resolvido.
 * @param {{castType?: string, count?: number|null, scale?: string|null}} entry
 */
export function foundryUses(entry) {
  const empty = { max: '', spent: 0, recovery: [] };
  const period = RECOVERY_PERIOD[entry?.castType];
  if (!period) return empty;
  let max = '';
  if (entry.scale === 'pb') max = '@prof';
  else if (entry.scale) max = `@abilities.${entry.scale}.mod`;
  else if (entry.count) max = String(entry.count);
  if (!max) return empty;
  return { max, spent: 0, recovery: [{ period, type: 'recoverAll' }] };
}

/**
 * `method` + `prepared` de uma entrada de magia.
 * @param {object} entry            entrada derivada (granted? castType? …)
 * @param {object} origin           origem da derivação
 * @param {boolean} isArcanum
 */
export function foundryPreparation(entry, origin, isArcanum) {
  // Mystic Arcanum: sem espaço de magia, 1×/descanso longo (como o premade oficial).
  if (isArcanum) return { method: 'atwill', prepared: 0 };

  if (entry.granted) {
    switch (entry.castType) {
      case 'will':
        return { method: 'atwill', prepared: 0 };
      case 'ritual':
        return { method: 'ritual', prepared: 0 };
      case 'daily':
      case 'rest':
      case 'restLong':
      case 'innate':
        // 'innate' cru = conjura sem espaço, frequência desconhecida (DDL-0011).
        return { method: 'innate', prepared: 0 };
      default:
        // Concedida que GASTA espaço (Life Domain, Hex do Great Old One).
        return { method: origin.isPact ? 'pact' : 'spell', prepared: 2 };
    }
  }
  // Escolha do jogador.
  return { method: origin.isPact ? 'pact' : 'spell', prepared: 1 };
}

/** Um Item `spell` do Foundry. */
export function buildSpellItem(entry, origin, { isArcanum = false } = {}) {
  const raw = entry.raw;
  const { method, prepared } = foundryPreparation(entry, origin, isArcanum);
  const uses = isArcanum
    ? { max: '1', spent: 0, recovery: [{ period: 'lr', type: 'recoverAll' }] }
    : foundryUses(entry);

  const system = {
    description: {
      value: entriesToHtml([...(raw.entries ?? []), ...(raw.entriesHigherLevel ?? [])]),
      chat: '',
    },
    source: sourceBlock(raw.source),
    activation: foundryActivation(raw),
    duration: foundryDuration(raw),
    target: { affects: { choice: false, count: '', type: '' }, template: { units: 'ft', contiguous: false, type: '', stationary: false } },
    range: foundryRange(raw),
    uses,
    level: raw.level ?? 0,
    school: FOUNDRY_SCHOOL[raw.school] ?? '',
    properties: foundryProperties(raw),
    materials: foundryMaterials(raw),
    identifier: slugify(raw.name),
    method,
    prepared,
    // Origens de classe conjuram pelo atributo da classe (o Foundry resolve pelo
    // `sourceItem`); racial/talento carregam o próprio atributo.
    ability: origin.kind === 'class' ? '' : (origin.ability ?? ''),
  };
  if (origin.kind === 'class' && origin.classId) system.sourceItem = `class:${origin.classId}`;

  return {
    _id: randomFoundryId(),
    name: raw.name,
    type: 'spell',
    img: 'icons/magic/symbols/rune-sigil-rough-white.webp',
    system,
    effects: [],
    folder: null,
    sort: 0,
    flags: {},
    _stats: itemStats(spellUuid(raw.name)),
  };
}

/**
 * Todos os Items `spell` do personagem, a partir da derivação. Uma magia por
 * ORIGEM: a mesma magia preparada pelo Cleric e concedida pela raça vira dois
 * Items (com métodos diferentes), como no Foundry.
 * @param {ReturnType<import('./resolve').deriveFromDb>} derived
 * @returns {object[]}
 */
export function buildSpellItems(derived) {
  const out = [];
  for (const origin of derived?.spellcasting?.origins ?? []) {
    const arcanumNames = new Set((origin.arcanumSpells ?? []).map((s) => s.raw.name));
    const all = [
      ...origin.cantrips,
      ...origin.prepared,
      ...(origin.arcanumSpells ?? []),
      ...origin.alwaysPrepared,
    ];
    for (const entry of all) {
      if (!entry.raw) continue;
      out.push(buildSpellItem(entry, origin, { isArcanum: arcanumNames.has(entry.raw.name) }));
    }
  }
  return out;
}

/**
 * Bloco `system.spells` do ator: `spell1..9` + `pact`. O Foundry DERIVA o máximo
 * das progressões da classe; aqui só dizemos quantos espaços estão disponíveis
 * (ficha nova = cheia).
 * @param {ReturnType<import('./resolve').deriveFromDb>} derived
 */
export function buildSpellSlots(derived) {
  const sc = derived?.spellcasting;
  const out = { pact: { value: sc?.pactSlots?.slots ?? 0, override: null } };
  for (let l = 1; l <= 9; l++) out[`spell${l}`] = { value: sc?.slots?.[l] ?? 0, override: null };
  return out;
}
