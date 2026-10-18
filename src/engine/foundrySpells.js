// =============================================================================
// foundrySpells: as magias como itens spell e o bloco system.spells
// =============================================================================
// O QUE FAZ
//   Fase B2.5 (DDL-0008), alvo dnd5e 5.3.3. O schema, confirmado no spell.mjs e
//   nos premades:
//     system.method: 'spell', 'pact', 'atwill', 'innate' ou 'ritual'.
//     system.prepared: 0 não preparada, 1 preparada, 2 SEMPRE preparada.
//     system.uses: { max, spent, recovery: [{ period: 'lr'|'sr'|'day' }] }.
//     system.sourceItem: "class:<identifier>", a classe que a concede.
//   O par antigo `preparation: {mode, prepared}` está depreciado; o Plutonium
//   ainda o usa e o import aceita os dois.
//
// FUNÇÕES
//   foundryActivation(spell), foundryDuration(spell), foundryRange(spell),
//     foundryProperties(spell), foundryMaterials(spell): os campos da magia.
//   foundryUses(entry): os usos de uma concessão limitada.
//   foundryPreparation(entry, origin, isArcanum, opts): `method` e `prepared`.
//   buildSpellItem(entry, origin, opts): um item spell.
//   buildSpellItems(derived): todas, uma por ORIGEM.
//   buildUnassignedSpellItems(character, db): as da carga.
//   buildSpellSlots(derived): `spell1` a `spell9` e `pact`.
//
// DECISÕES E ARMADILHAS
//   - Como cada origem mapeia: classe 'spell' (ou 'pact') e prepared 1.
//     Concedida: prepared 2, com o uso GRÁTIS em `uses` quando tem frequência, e
//     o método segue 'spell'/'pact' DE PROPÓSITO, porque o RAW 2024 diz "you can
//     also cast the spell using any spell slots you have" e o premade encoda assim
//     (TC-0067; exportar 'innate' tirava o espaço do jogador). Mystic Arcanum:
//     'atwill', prepared 0, 1 por descanso longo, exatamente como o Warlock 17 do
//     premade (Sefris). 'will' vira 'atwill'; o `innate` CRU vira 'innate' (não
//     sabemos se gasta espaço, DDL-0011).
//   - Usos escalados exportam FÓRMULA (`@abilities.cha.mod`, `@prof`), não o
//     número: o Foundry recalcula quando o atributo muda.
//   - `poolOnFeature` (TC-0090): o pool grátis mora no item da FEATURE (o Favored
//     Enemy com `@scale.ranger.favored-enemy`, como o SRD), e a magia sai sem
//     `uses`; a contagem derivada serve à ficha do app.
//   - Warlock puro (`pactOnly`): a magia de círculo de raça ou talento é lançada
//     com o espaço de pacto, senão não teria espaço nenhum (o premade faz isso
//     com a Faerie Fire do Drow; o cantrip fica 'spell').
//   - Escolha não preparada exporta `prepared: 0` (o grimório, TC-0080); cantrip
//     nunca é despreparado. Origem nula é a carga: sai preparada simples, porque o
//     único objetivo do balde é o documento não se perder.
//   - Uma magia por ORIGEM: a mesma magia do Cleric e da raça são dois itens.
//   - Escolha da classe que a mesma origem CONCEDE (`shadowedPicks`, TC-0091):
//     sai o item da concessão (`prepared: 2`, o estado nativo certo) com a marca
//     `flags.builder5e.classPick`, a ref da escolha. O Foundry não tem campo para
//     "também escolhida", e sem a marca o import descartava a decisão.
// -----------------------------------------------------------------------------

import { randomFoundryId, itemStats, sourceBlock, slugify, entriesToHtml } from './foundryItems';
import { spellUuid } from './compendiumUuids';
import { resolveSpellObj } from './spells';

export const FOUNDRY_SCHOOL = {
  A: 'abj', C: 'con', D: 'div', E: 'enc', V: 'evo', I: 'ill', N: 'nec', T: 'trs',
};

const ACTIVATION_TYPE = {
  action: 'action', bonus: 'bonus', reaction: 'reaction',
  minute: 'minute', hour: 'hour', round: 'turn',
};

const DURATION_UNITS = {
  round: 'round', minute: 'minute', hour: 'hour', day: 'day', year: 'year', turn: 'turn',
};

const RANGE_UNITS = {
  feet: 'ft', miles: 'mi', touch: 'touch', self: 'self', sight: 'spec', unlimited: 'any',
};

const RECOVERY_PERIOD = { daily: 'day', restLong: 'lr', rest: 'sr' };

/** O `activation` a partir de `time[0]`. */
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

/** O `duration` a partir de `duration[0]`. */
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

/** O `range` da magia. */
export function foundryRange(spell) {
  const r = spell?.range;
  if (!r) return { units: '', special: '', value: '' };
  const dist = r.distance ?? {};
  const units = RANGE_UNITS[dist.type] ?? '';
  const value = dist.type === 'feet' || dist.type === 'miles' ? String(dist.amount ?? '') : '';
  return { units, special: '', value };
}

/** Os `properties`: componentes, concentração e ritual. */
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

/** Os `materials` a partir de `components.m`. */
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
 * Os `uses` de uma concessão limitada, com `max` em fórmula.
 * @param {{castType?: string, count?: number|null, scale?: string|null}} entry
 */
export function foundryUses(entry) {
  const empty = { max: '', spent: 0, recovery: [] };
  if (entry?.poolOnFeature) return empty;
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
 * O `method` e o `prepared` de uma entrada de magia.
 * @param {object} entry
 * @param {object} origin
 * @param {boolean} isArcanum
 * @param {{ pactOnly?: boolean }} [opts]
 */
export function foundryPreparation(entry, origin, isArcanum, opts = {}) {
  if (isArcanum) return { method: 'atwill', prepared: 0 };
  const leveled = (entry?.raw?.level ?? 0) > 0;
  const slotMethod = origin?.isPact || (opts.pactOnly && leveled) ? 'pact' : 'spell';

  if (entry.granted) {
    switch (entry.castType) {
      case 'will':
        return { method: 'atwill', prepared: 0 };
      case 'ritual':
        return { method: 'ritual', prepared: 0 };
      case 'innate':
        return { method: 'innate', prepared: 0 };
      default:
        return { method: slotMethod, prepared: 2 };
    }
  }
  return { method: slotMethod, prepared: leveled && entry.prepared === false ? 0 : 1 };
}

/** Um item spell do Foundry. */
export function buildSpellItem(entry, origin, { isArcanum = false, pactOnly = false } = {}) {
  const raw = entry.raw;
  const { method, prepared } = foundryPreparation(entry, origin, isArcanum, { pactOnly });
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
    ability: !origin || origin.kind === 'class' ? '' : (origin.ability ?? ''),
  };
  if (origin?.kind === 'class' && origin.classId) system.sourceItem = `class:${origin.classId}`;

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
 * Todos os itens spell, uma magia por origem.
 * @param {ReturnType<import('./resolve').deriveFromDb>} derived
 * @returns {object[]}
 */
export function buildSpellItems(derived) {
  const out = [];
  const sc = derived?.spellcasting;
  const pactOnly =
    !Object.values(sc?.slots ?? {}).some((n) => n > 0) && (sc?.pactSlots?.slots ?? 0) > 0;
  for (const origin of derived?.spellcasting?.origins ?? []) {
    const arcanumNames = new Set((origin.arcanumSpells ?? []).map((s) => s.raw.name));
    const picks = new Map((origin.shadowedPicks ?? []).map((s) => [s.raw.name.toLowerCase(), s]));
    const all = [
      ...origin.cantrips,
      ...origin.prepared,
      ...(origin.unprepared ?? []),
      ...(origin.arcanumSpells ?? []),
      ...origin.alwaysPrepared,
    ];
    for (const entry of all) {
      if (!entry.raw) continue;
      const item = buildSpellItem(entry, origin, { isArcanum: arcanumNames.has(entry.raw.name), pactOnly });
      const pick = entry.granted ? picks.get(entry.raw.name.toLowerCase()) : null;
      if (pick) {
        item.flags = { builder5e: { classPick: { id: pick.id, source: pick.source, ...(pick.prepared === false ? { prepared: false } : {}) } } };
      }
      out.push(item);
    }
  }
  return out;
}

/**
 * Os itens spell do balde de carga.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {object[]}
 */
export function buildUnassignedSpellItems(character, db) {
  const out = [];
  for (const ref of character?.unassignedSpells ?? []) {
    const raw = resolveSpellObj(db, ref?.id, ref?.source);
    if (!raw) continue;
    out.push(buildSpellItem({ raw, prepared: ref.prepared }, null));
  }
  return out;
}

/**
 * O bloco `system.spells` do ator.
 * @param {ReturnType<import('./resolve').deriveFromDb>} derived
 */
export function buildSpellSlots(derived) {
  const sc = derived?.spellcasting;
  const out = { pact: { value: sc?.pactSlots?.slots ?? 0, override: null } };
  for (let l = 1; l <= 9; l++) out[`spell${l}`] = { value: sc?.slots?.[l] ?? 0, override: null };
  return out;
}
