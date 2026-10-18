// =============================================================================
// roundtrip: o oráculo export -> import do sweep (Fase T)
// =============================================================================
// O QUE FAZ
//   Normaliza as DECISÕES de um personagem (nunca o estado derivado) numa árvore
//   comparável, lista os caminhos que divergem entre o original e o reimportado, e
//   separa cada divergência em: real (bug novo, falha a linha); known (casa com um
//   TC ABERTO em testing/ISSUES.md: não falha, mas fica no report, e o padrão sai
//   daqui quando o TC fechar); waived (perda permanente ACEITA e documentada).
//
// FUNÇÕES
//   normPick(pick, kind): um pick estável para comparar; `kind` desambigua formatos
//     aceitos em duplicidade (maestria 'Club' na UI e 'Club|PHB' no import, TC-0003;
//     pools 'ability' e misto).
//   normalizeBag(bag): o choice-bag na forma canônica {id: {kind, picks ordenados,
//     sub?}}, sem as entradas vazias.
//   bagPicks(bag, kind): os picks de um kind, só nas entradas de topo.
//   decisionSummary(c): as decisões numa árvore normalizada.
//   diffSummaries(a, b, path, out): as diferenças folha a folha (com teto de ruído
//     por linha).
//   classifyDiffs(diffs, opts): {real, known, waived}.
//
// DECISÕES E ARMADILHAS
//   - decisionSummary funde as proficiências da ORIGEM do choice-bag com os arrays
//     legados (`skillProficiencies`...): o builder grava no bag, o import nos arrays,
//     mesma decisão em duas casas (o engine lê ambas).
//   - Os scores entram como BASE, validando a reconstrução `final` menos `boosts` do
//     import: um boost perdido ou duplicado aparece aqui.
//   - Também são decisão, e por isso entram: o estado de PREPARAÇÃO da magia (o
//     grimório do Mago), o contêiner de cada item (pelo NOME do pai, porque o uid é
//     regerado no import) e a moeda, que o export zerava sem o oráculo ver (TC-0055).
//   - diffSummaries percorre arrays de objetos POR ÍNDICE (senão um único diff em
//     `classes` engoliria os caminhos internos); arrays de primitivas comparam como
//     um valor só.
//   - WAIVERS só aceita o que foi investigado e documentado: um waiver sem
//     referência é bug varrido para debaixo do tapete. Vazio desde 2026-07-16 (o do
//     tamanho caiu: ele viaja na flag do item de raça, DDL-0028).
//   - KNOWN_ISSUES não falha a linha, para o sweep seguir pegando REGRESSÕES, mas
//     conta no report; tirar o padrão é parte de fechar o TC. Vazio desde
//     2026-07-16 (TC-0001..TC-0010 corrigidos, DDL-0028): o sweep roda limpo em modo
//     estrito.
// -----------------------------------------------------------------------------

/** Um pick normalizado para comparação estável. */
function normPick(pick, kind) {
  if (pick && typeof pick === 'object') {
    if (pick.ability) return `${pick.ability}+${pick.amount}`;
    if (pick.kind) return `${pick.kind}:${String(pick.value).toLowerCase()}`;
    return JSON.stringify(pick);
  }
  const v = String(pick).toLowerCase();
  return kind === 'weapon' ? v.split('|')[0] : v;
}

/** Choice-bag -> forma canônica. */
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
    if (picks.length === 0 && Object.keys(sub).length === 0) continue;
    out[id] = { kind: entry.kind, picks, ...(Object.keys(sub).length ? { sub } : {}) };
  }
  return out;
}

/** Os picks de um kind num bag (só o topo). */
const bagPicks = (bag, kind) =>
  Object.values(bag ?? {})
    .filter((e) => e?.kind === kind)
    .flatMap((e) => e.picks ?? []);

/** As decisões do personagem numa árvore normalizada e comparável. */
export function decisionSummary(c) {
  const originSet = (kind, legacy) =>
    [...new Set([...bagPicks(c.origin?.choices, kind), ...(legacy ?? [])].map((v) => String(v).toLowerCase()))].sort();
  return {
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
        spells: (x.spells ?? [])
          .map((s) => `${String(s.id).toLowerCase()}${s.prepared === false ? ' [known]' : ''}`)
          .sort(),
      })),
    inventory: (() => {
      const nameByUid = new Map((c.inventory ?? []).map((i) => [i.uid, String(i.itemId).toLowerCase()]));
      return (c.inventory ?? [])
        .map((i) => {
          const parent = i.container ? nameByUid.get(i.container) : null;
          return `${String(i.itemId).toLowerCase()} x${i.quantity}${i.equipped ? ' [eq]' : ''}${parent ? ` in ${parent}` : ''}`;
        })
        .sort();
    })(),
    currency: { ...(c.currency ?? {}) },
  };
}

/**
 * As diferenças folha a folha entre duas árvores de decisão.
 * @returns {Array<{path:string, before:any, after:any}>}
 */
export function diffSummaries(a, b, path = '', out = []) {
  if (out.length >= 80) return out;
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

/** Perdas de round-trip PERMANENTEMENTE aceitas, com o porquê (DDL). */
export const WAIVERS = [
];

/** Divergências já triadas como bugs abertos (TC-xxxx). */
export const KNOWN_ISSUES = [
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
