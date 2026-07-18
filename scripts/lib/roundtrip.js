// =============================================================================
// roundtrip - o oráculo export→import do sweep (Fase T)
// =============================================================================
// `decisionSummary` normaliza as DECISÕES de um personagem (nunca o estado
// derivado) numa árvore comparável; `diffSummaries` lista os caminhos que
// divergem entre o original e o reimportado; `classifyDiffs` separa cada
// divergência em:
//   real   - bug novo (falha a linha);
//   known  - casa com um TC ABERTO em testing/ISSUES.md (não falha a linha,
//            mas fica no report; o padrão sai daqui quando o TC fechar);
//   waived - perda permanente ACEITA e documentada (DDL).
// -----------------------------------------------------------------------------

/** Normaliza um pick para comparação estável. `kind` desambigua formatos que o
 *  app aceita em duplicidade (weapon mastery: 'Club' na UI, 'Club|PHB' no
 *  import - mesmo dado; ver TC-0003 em testing/ISSUES.md). */
function normPick(pick, kind) {
  if (pick && typeof pick === 'object') {
    if (pick.ability) return `${pick.ability}+${pick.amount}`; // pool 'ability'
    if (pick.kind) return `${pick.kind}:${String(pick.value).toLowerCase()}`; // pool misto
    return JSON.stringify(pick);
  }
  const v = String(pick).toLowerCase();
  return kind === 'weapon' ? v.split('|')[0] : v;
}

/** Choice-bag → forma canônica: { id: { kind, picks[sorted], sub? } }. */
export function normalizeBag(bag) {
  const out = {};
  for (const [id, entry] of Object.entries(bag ?? {})) {
    if (!entry || typeof entry !== 'object') continue;
    const picks = (entry.picks ?? []).map((p) => normPick(p, entry.kind)).sort();
    const sub = {};
    for (const [pick, sb] of Object.entries(entry.sub ?? {})) {
      const nb = normalizeBag(sb);
      if (Object.keys(nb).length) sub[pick.toLowerCase()] = nb;
    }
    if (picks.length === 0 && Object.keys(sub).length === 0) continue; // entrada vazia
    out[id] = { kind: entry.kind, picks, ...(Object.keys(sub).length ? { sub } : {}) };
  }
  return out;
}

/** Picks de um kind num bag (raso - só as entradas de topo). */
const bagPicks = (bag, kind) =>
  Object.values(bag ?? {})
    .filter((e) => e?.kind === kind)
    .flatMap((e) => e.picks ?? []);

/**
 * As decisões do personagem numa árvore normalizada e comparável. Só DECISÕES
 * (espécie/origem/classes/escolhas/magias/inventário) - nada derivado.
 * As proficiências da ORIGEM fundem o choice-bag com os arrays legados
 * (`skillProficiencies`…): o builder grava no bag, o import grava nos arrays -
 * mesma decisão, duas casas (o engine lê ambas).
 */
export function decisionSummary(c) {
  const originSet = (kind, legacy) =>
    [...new Set([...bagPicks(c.origin?.choices, kind), ...(legacy ?? [])].map((v) => String(v).toLowerCase()))].sort();
  return {
    // Scores BASE: valida a reconstrução `final - boosts` do import (um boost
    // perdido/duplicado em qualquer flag ou advancement aparece aqui).
    scores: { ...c.scores },
    species: c.species
      ? {
          id: c.species.id?.toLowerCase() ?? null,
          lineage: c.species.lineage ?? null,
          choices: normalizeBag(c.species.choices),
        }
      : null,
    origin: {
      boosts: (c.origin?.abilityBoosts ?? [])
        .filter((b) => b.ability)
        .map((b) => `${b.ability}+${b.amount}`)
        .sort(),
      feat: c.origin?.originFeat ? `${c.origin.originFeat.id}|${c.origin.originFeat.source}`.toLowerCase() : null,
      featChoices: normalizeBag(c.origin?.originFeat?.choices),
      skills: originSet('skill', c.origin?.skillProficiencies),
      tools: originSet('tool', c.origin?.toolProficiencies),
      languages: originSet('language', c.origin?.languages),
    },
    classes: (c.classes ?? [])
      .filter((x) => x.classId)
      .map((x) => ({
        classId: x.classId,
        level: x.level,
        subclass: x.subclassId ?? null,
        choices: normalizeBag(x.choices),
        spells: (x.spells ?? []).map((s) => String(s.id).toLowerCase()).sort(),
      })),
    inventory: (c.inventory ?? [])
      .map((i) => `${String(i.itemId).toLowerCase()} x${i.quantity}${i.equipped ? ' [eq]' : ''}`)
      .sort(),
  };
}

/**
 * Diferenças folha-a-folha entre duas árvores de decisão. Arrays de objetos são
 * percorridos POR ÍNDICE (senão um único diff em `classes` engoliria todos os
 * caminhos internos); arrays de primitivas comparam como um valor só.
 * @returns {Array<{path:string, before:any, after:any}>}
 */
export function diffSummaries(a, b, path = '', out = []) {
  if (out.length >= 80) return out; // teto de ruído por linha
  const isObj = (v) => v && typeof v === 'object';
  if (!isObj(a) || !isObj(b)) {
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ path: path || '(root)', before: a, after: b });
    return out;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const allPrimitive = [...a, ...b].every((v) => !isObj(v));
    if (allPrimitive) {
      if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ path, before: a, after: b });
      return out;
    }
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) diffSummaries(a[i], b[i], `${path}[${i}]`, out);
    return out;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    out.push({ path, before: a, after: b });
    return out;
  }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    diffSummaries(a[k], b[k], path ? `${path}.${k}` : k, out);
  }
  return out;
}

/**
 * WAIVERS: perdas de round-trip PERMANENTEMENTE aceitas, com o porquê (DDL).
 * Só entra aqui o que foi investigado e documentado - um waiver sem referência
 * é um bug varrido para debaixo do tapete.
 */
export const WAIVERS = [
  // Vazio desde 2026-07-16: o antigo waiver do pick de tamanho (DDL-0017) caiu -
  // o tamanho agora viaja na flag do item de raça e faz round-trip (DDL-0028).
];

/**
 * KNOWN ISSUES: divergências já TRIADAS como bugs abertos (TC-xxxx em
 * testing/ISSUES.md). Não falham a linha - o sweep continua útil para pegar
 * REGRESSÕES novas - mas ficam contadas no report. Remover o padrão daqui é
 * parte de fechar o TC correspondente.
 */
export const KNOWN_ISSUES = [
  // Vazio desde 2026-07-16: TC-0001..TC-0010 corrigidos (ver testing/ISSUES.md;
  // a arquitetura das correções está em DDL-0028). O sweep roda limpo em modo
  // estrito - QUALQUER diff de round-trip novo volta a falhar a linha.
];

/** Classifica os diffs em {real, known, waived}. */
export function classifyDiffs(diffs, { waivers = WAIVERS, known = KNOWN_ISSUES } = {}) {
  const real = [];
  const knownHits = [];
  const waived = [];
  for (const d of diffs) {
    const w = waivers.find((w) => w.test(d));
    if (w) {
      waived.push({ ...d, waiver: w.id });
      continue;
    }
    const k = known.find((k) => k.test(d));
    if (k) knownHits.push({ ...d, issue: k.id });
    else real.push(d);
  }
  return { real, known: knownHits, waived };
}
