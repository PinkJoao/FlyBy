// =============================================================================
// grantedSpellUses: as correções curadas das magias concedidas
// =============================================================================
// O QUE FAZ
//   A maioria do 5etools codifica a frequência no próprio `additionalSpells`, e o
//   conteúdo novo segue esse formato. Algumas entradas antigas trazem uma LISTA
//   CRUA sob `innate`, ambígua: no Aarakocra é 1 por descanso longo, no Yuan-Ti à
//   vontade, no Great Old One só "sempre preparada". A derivação não adivinha ("No
//   Spell Slot"), e a frequência real vem daqui, do texto do traço (DDL-0011).
//   Mais três registros da mesma família, onde a PROSA manda no dado:
//     INNATE_USES: a frequência (castType 'restLong', 'rest', 'will', ou null
//       quando NÃO há conjuração grátis).
//     MISSING_ADDITIONAL_SPELLS: concessões que o dado omite (TC-0026), fundidas
//       no PRIMEIRO grupo do dado, nunca como grupo novo (seria alternativa).
//     REGRADED_ADDITIONAL_SPELLS: concessões no nível errado (TC-0044).
//     REMOVED_ADDITIONAL_SPELLS: concessões que a regra não dá (TC-0082).
//   Chave "Nome|FONTE" da ENTIDADE (espécie, classe ou subclasse), e cada entrada
//   cita a prosa que a justifica.
//
// FUNÇÕES
//   overlayKey(entity): a chave da entidade.
//   pruneEmpty(node), takeSpell(node, spell), putSpell(node, path, spell): a
//     manipulação de um nó de nível.
//   applyRegrades(groups, regrades): move as magias de nível.
//   refName(s), stripSpells(node, wanted), applyRemovals(groups, spells): tira as
//     não-concedidas de todos os baldes, em qualquer profundidade.
//   curatedAdditionalSpells(entity): o campo com as três correções; sem entrada,
//     o original intacto. Nunca muta o dado.
//   applyUsesOverlay(spells, entity, level): a frequência curada.
//   tableColumnAt(entity, label, level): uma coluna da tabela da classe no nível.
//
// DECISÕES E ARMADILHAS
//   - applyUsesOverlay só toca no que o dado NÃO declara, em duas formas:
//     `castType: 'innate'` sem frequência, e sem castType nenhum quando a
//     conjuração GRÁTIS existe só na prosa. Este é o Contact Patron do Warlock @9
//     (DDL-0086): o dado diz `prepared` e só o texto dá o uso de 1 por descanso
//     longo; sem a linha, o jogador perdia o recurso no export. O Eldritch Hex é o
//     oposto: bucket `innate` mas sem conjuração grátis (castType null).
//   - Contagem que ESCALA com o nível (TC-0090, Favored Enemy do Ranger: 2 no 1,
//     até 6 no 17): `countColumn` lê a coluna da tabela da classe, sem curar
//     números. `poolOnFeature` diz que no Foundry o pool mora no ITEM da feature
//     (`@scale.ranger.favored-enemy`, como o SRD e o premade da Quillathe), então o
//     item da magia sai sem `uses`, senão seriam dois pools.
//   - Gnomish Lineage (Forest Gnome): a prosa dá as duas magias no nível 1; o dado
//     põe Speak with Animals no 3 (nenhuma outra espécie XPHB diverge assim).
//   - REMOVED (TC-0082): o 5etools guarda em `prepared` uma magia que a feature
//     só PERMITE conjurar. A varredura (refazer antes de acrescentar): cruzar toda
//     magia de `prepared`/`known` com o texto procurando "to cast {@spell X}"; dá
//     10 candidatos e 9 são falsos (a magia vem por outra via). Sobra o Wild
//     Companion do Druida: Find Familiar é permissão, não preparada.
//   - MISSING: o Channeler do College of Spirits RHW conhece Guidance @3; o dado só
//     codifica o Spirit Guardians @6 (a versão VRGR trazia).
//   - O curado em `subrace` (Merge with Stone) existe por completude: a derivação
//     ainda não consulta sub-raças por aqui.
// -----------------------------------------------------------------------------

/** @typedef {{ castType: 'restLong'|'rest'|'will'|null, count?: number, countColumn?: string, poolOnFeature?: string }} UsesOverride */

/** @type {Record<string, Record<string, UsesOverride>>} */
export const INNATE_USES = {
  'Warlock|XPHB': {
    'contact other plane': { castType: 'restLong', count: 1 },
  },

  'Ranger|XPHB': {
    "hunter's mark": { castType: 'restLong', countColumn: 'Favored Enemy', poolOnFeature: 'Favored Enemy' },
  },

  'Aarakocra|MPMM': {
    'gust of wind': { castType: 'restLong', count: 1 },
  },

  'Firbolg|MPMM': {
    'detect magic': { castType: 'restLong', count: 1 },
    'disguise self': { castType: 'restLong', count: 1 },
  },

  'Yuan-Ti|MPMM': {
    'animal friendship': { castType: 'will' },
  },
  'Yuan-ti Pureblood|VGM': {
    'animal friendship': { castType: 'will' },
  },

  'Earth|MPMM': {
    'pass without trace': { castType: 'restLong', count: 1 },
  },

  'Variant; Mark of Detection|ERLW': {
    'detect magic': { castType: 'restLong', count: 1 },
    'detect poison and disease': { castType: 'restLong', count: 1 },
  },
  'Variant; Mark of Finding|ERLW': {
    "hunter's mark": { castType: 'restLong', count: 1 },
  },
  'Mark of Healing|ERLW': {
    'cure wounds': { castType: 'restLong', count: 1 },
  },

  'Artificer|EFA': {
    mending: { castType: 'will' },
  },

  'Path of the Ancestral Guardian|XGE': {
    augury: { castType: 'rest', count: 1 },
    clairvoyance: { castType: 'rest', count: 1 },
  },

  'Path of the Giant|BGG': {
    druidcraft: { castType: 'will' },
    thaumaturgy: { castType: 'will' },
  },

  'College of Glamour|XGE': {
    command: { castType: 'restLong', count: 1 },
  },
  'College of Glamour|XPHB': {
    command: { castType: 'restLong', count: 1 },
  },

  'Great Old One Patron|XPHB': {
    hex: { castType: null },
  },

  'Diviner|XPHB': {
    'see invisibility': { castType: 'rest', count: 1 },
  },
};

/** A chave da entidade no overlay. */
function overlayKey(entity) {
  return entity?.name && entity?.source ? `${entity.name}|${entity.source}` : null;
}


/** @typedef {{ bucket: string, spell: string, from: number|string, to: number|string }} SpellRegrade */

/** @type {Record<string, SpellRegrade[]>} */
export const REGRADED_ADDITIONAL_SPELLS = {
  'Gnome; Forest Gnome Lineage|XPHB': [
    { bucket: 'innate', spell: 'speak with animals|xphb', from: 3, to: 1 },
  ],
};

/** @type {Record<string, string[]>} */
export const REMOVED_ADDITIONAL_SPELLS = {
  'Druid|XPHB': ['find familiar'],
};

/** @type {Record<string, object>} */
export const MISSING_ADDITIONAL_SPELLS = {
  // ATENÇÃO: cada entrada é FUNDIDA no primeiro grupo; um grupo novo viraria alternativa (TC-0011).
  'College of Spirits|RHW': { known: { 3: ['guidance|xphb#c'] } },
};

/** Poda arrays e objetos que ficaram vazios. */
function pruneEmpty(node) {
  if (Array.isArray(node)) return node.length ? node : null;
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      const p = pruneEmpty(v);
      if (p !== null) out[k] = p;
    }
    return Object.keys(out).length ? out : null;
  }
  return node;
}

/**
 * Remove a magia de um nó de nível e devolve o caminho de onde saiu.
 * @returns {{node: object|Array|null, path: string[]}|null}
 */
function takeSpell(node, spell) {
  if (Array.isArray(node)) {
    const i = node.findIndex((s) => typeof s === 'string' && s.toLowerCase() === spell);
    return i < 0 ? null : { node: node.filter((_, k) => k !== i), path: [] };
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      const found = takeSpell(v, spell);
      if (found) return { node: { ...node, [k]: found.node }, path: [k, ...found.path] };
    }
  }
  return null;
}

/** Insere a magia no nó de destino, no mesmo caminho. */
function putSpell(node, path, spell) {
  if (path.length === 0) return [...(Array.isArray(node) ? node : []), spell];
  const [k, ...rest] = path;
  const base = node && typeof node === 'object' && !Array.isArray(node) ? node : {};
  return { ...base, [k]: putSpell(base[k], rest, spell) };
}

/** Aplica as correções de nível curadas (TC-0044). */
function applyRegrades(groups, regrades) {
  return groups.map((group) => {
    let next = group;
    for (const { bucket, spell, from, to } of regrades) {
      const byLevel = next[bucket];
      const taken = byLevel?.[from] ? takeSpell(byLevel[from], spell.toLowerCase()) : null;
      if (!taken) continue;
      const merged = { ...byLevel, [from]: taken.node };
      const pruned = pruneEmpty(merged[from]);
      if (pruned === null) delete merged[from];
      else merged[from] = pruned;
      merged[to] = putSpell(merged[to], taken.path, spell);
      next = { ...next, [bucket]: merged };
    }
    return next;
  });
}

/** O nome nu de uma ref de magia. */
const refName = (s) => String(s).toLowerCase().split('|')[0].split('#')[0].trim();

/** Tira as magias curadas como não-concedidas (TC-0082) de todos os baldes. */
function stripSpells(node, wanted) {
  if (Array.isArray(node)) return node.filter((s) => !(typeof s === 'string' && wanted.has(refName(s))));
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, stripSpells(v, wanted)]));
  }
  return node;
}

function applyRemovals(groups, spells) {
  const wanted = new Set(spells.map((s) => refName(s)));
  return groups.map((group) =>
    Object.fromEntries(
      Object.entries(group).map(([bucket, byLevel]) => [bucket, pruneEmpty(stripSpells(byLevel, wanted)) ?? {}]),
    ),
  );
}

/**
 * O `additionalSpells` com as correções curadas, sem mutar o dado.
 * @param {{name?: string, source?: string, additionalSpells?: Array}|null} entity
 * @returns {Array<object>|undefined}
 */
export function curatedAdditionalSpells(entity) {
  const key = overlayKey(entity);
  const extra = MISSING_ADDITIONAL_SPELLS[key];
  const regrades = REGRADED_ADDITIONAL_SPELLS[key];
  const removed = REMOVED_ADDITIONAL_SPELLS[key];
  if (!extra && !regrades && !removed) return entity?.additionalSpells;
  let groups = entity?.additionalSpells ?? [];
  if (regrades) groups = applyRegrades(groups, regrades);
  if (removed) groups = applyRemovals(groups, removed);
  if (!extra) return groups;
  const first = { ...(groups[0] ?? {}) };
  for (const [bucket, byLevel] of Object.entries(extra)) {
    const merged = { ...(first[bucket] ?? {}) };
    for (const [lvl, spells] of Object.entries(byLevel)) {
      merged[lvl] = [...(merged[lvl] ?? []), ...spells];
    }
    first[bucket] = merged;
  }
  return [first, ...groups.slice(1)];
}

/**
 * Aplica a frequência curada às magias concedidas por uma entidade.
 * @param {Array<object>} spells
 * @param {{name?: string, source?: string}|null} entity
 * @returns {Array<object>}
 */
export function applyUsesOverlay(spells, entity, level = 1) {
  const table = INNATE_USES[overlayKey(entity)];
  if (!table) return spells ?? [];
  return (spells ?? []).map((s) => {
    if (s.castType && s.castType !== 'innate') return s;
    const override = table[s.name.toLowerCase()];
    if (!override) return s;
    const count = override.countColumn ? tableColumnAt(entity, override.countColumn, level) : (override.count ?? null);
    return {
      ...s,
      castType: override.castType,
      count,
      scale: null,
      ...(override.poolOnFeature ? { poolOnFeature: override.poolOnFeature } : {}),
    };
  });
}

/** O valor de uma coluna da tabela da classe num nível, ou null. */
export function tableColumnAt(entity, label, level) {
  for (const group of entity?.classTableGroups ?? []) {
    const col = (group.colLabels ?? []).findIndex((l) => String(l).toLowerCase() === label.toLowerCase());
    if (col === -1) continue;
    const cell = group.rows?.[Math.max(0, Math.min(20, level) - 1)]?.[col];
    const value = typeof cell === 'object' && cell !== null ? cell.value : cell;
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }
  return null;
}
