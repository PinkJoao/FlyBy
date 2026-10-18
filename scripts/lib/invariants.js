// =============================================================================
// invariants: as checagens estruturais do sweep (Fase T)
// =============================================================================
// O QUE FAZ
//   Puras e sem db: varredura profunda por valores corrompidos (NaN, e undefined
//   dentro de arrays, que viraria null no JSON exportado) e sanidade dos números
//   derivados. As mensagens são curtas e estáveis, porque entram no report.
//
// FUNÇÕES
//   scanBadValues(value, path, seen, out, depth): os caminhos com NaN ou undefined
//     em array; `seen` evita revisitar objetos compartilhados (o derived referencia
//     os mesmos raws do compêndio em vários pontos). Reporta só os primeiros.
//   expectedProfBonus(level): o bônus de proficiência esperado para o nível total.
//   checkDerivedSanity(derived, opts): as violações do derived de um personagem COM
//     classe (vazia = ok).
//   checkActorShape(actor): sanidade estrutural do actor Foundry exportado (campos
//     mínimos por Item).
// -----------------------------------------------------------------------------

/**
 * Os caminhos com NaN ou undefined dentro de array.
 * @returns {string[]}
 */
export function scanBadValues(value, path = '', seen = new WeakSet(), out = [], depth = 0) {
  if (depth > 40 || out.length >= 25) return out;
  if (typeof value === 'number') {
    if (Number.isNaN(value)) out.push(`${path || '(root)'}: NaN`);
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  if (seen.has(value)) return out;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((v, i) => {
      if (v === undefined) out.push(`${path}[${i}]: undefined in array`);
      else scanBadValues(v, `${path}[${i}]`, seen, out, depth + 1);
    });
    return out;
  }
  for (const [k, v] of Object.entries(value)) {
    scanBadValues(v, path ? `${path}.${k}` : k, seen, out, depth + 1);
  }
  return out;
}

/** O bônus de proficiência esperado para o nível total. */
export const expectedProfBonus = (level) => 2 + Math.floor((Math.max(1, level) - 1) / 4);

/** As violações de sanidade do derived (vazia = ok). */
export function checkDerivedSanity(derived, { level }) {
  const out = [];
  if (!derived) return ['derived: null'];
  if (derived.level !== level) out.push(`level: derived ${derived.level} != expected ${level}`);
  if (derived.proficiencyBonus !== expectedProfBonus(level)) {
    out.push(`proficiencyBonus: ${derived.proficiencyBonus} != ${expectedProfBonus(level)}`);
  }
  if (!(derived.maxHp > 0)) out.push(`maxHp: ${derived.maxHp} (expected > 0)`);
  for (const o of derived.spellcasting?.origins ?? []) {
    for (const k of ['cantripLimit', 'prepareLimit']) {
      if (o[k] != null && Number.isNaN(o[k])) out.push(`spellcasting ${o.key}.${k}: NaN`);
    }
  }
  return out;
}

/** Sanidade estrutural do actor Foundry exportado. */
export function checkActorShape(actor) {
  const out = [];
  if (!actor || typeof actor !== 'object') return ['actor: not an object'];
  if (!actor.name) out.push('actor.name: empty');
  if (!actor.system) out.push('actor.system: missing');
  if (!Array.isArray(actor.items)) return [...out, 'actor.items: not an array'];
  actor.items.forEach((it, i) => {
    if (!it?.name) out.push(`items[${i}]: missing name`);
    if (!it?.type) out.push(`items[${i}] (${it?.name ?? '?'}): missing type`);
    if (!it?._id) out.push(`items[${i}] (${it?.name ?? '?'}): missing _id`);
    if (!it?.system) out.push(`items[${i}] (${it?.name ?? '?'}): missing system`);
  });
  return out;
}
