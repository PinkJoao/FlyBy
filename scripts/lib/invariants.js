// =============================================================================
// invariants - checagens estruturais do sweep (Fase T)
// =============================================================================
// Puras e sem db: varredura profunda por valores corrompidos (NaN, undefined
// dentro de arrays - que virariam null no JSON exportado) e sanidade dos
// números derivados. As mensagens são curtas e estáveis (entram no report).
// -----------------------------------------------------------------------------

/**
 * Varre um valor recursivamente atrás de NaN e de `undefined` dentro de arrays.
 * `seen` evita revisitar objetos compartilhados (o derived referencia os mesmos
 * raws do compêndio em vários pontos).
 * @returns {string[]}  caminhos problemáticos (ex: "spellcasting.origins.0.saveDc: NaN")
 */
export function scanBadValues(value, path = '', seen = new WeakSet(), out = [], depth = 0) {
  if (depth > 40 || out.length >= 25) return out; // limite: reporta os primeiros
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

/** Bônus de proficiência 5e esperado para o nível total. */
export const expectedProfBonus = (level) => 2 + Math.floor((Math.max(1, level) - 1) / 4);

/**
 * Sanidade do derived de um personagem COM classe: números centrais existem e
 * fazem sentido. Devolve uma lista de violações (vazia = ok).
 */
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

/** Sanidade estrutural do actor Foundry exportado (campos mínimos por Item). */
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
