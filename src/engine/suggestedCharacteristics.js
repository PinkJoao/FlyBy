// =============================================================================
// suggestedCharacteristics: os pools de traços, ideais, laços e defeitos sugeridos
// =============================================================================
// O QUE FAZ
//   Os backgrounds de 2014 traziam "Suggested Characteristics" com quatro tabelas
//   (Personality Trait d8, Ideal, Bond e Flaw d6); os de 2024 as removeram. Este
//   módulo varre TODOS os backgrounds e junta cada categoria num pool único e
//   deduplicado, para o randomizador da biografia.
//
// FUNÇÕES
//   stripTrailingTag(text): remove a tag de origem no fim.
//   plainText(str): markup do 5etools em texto simples.
//   collectTables(entries): as tabelas de uma árvore de entries.
//   collectSuggestions(db): os pools por campo (cache por db; são 161
//     backgrounds).
//   randomSuggestion(db, field, rng): uma sugestão, ou null.
//
// DECISÕES E ARMADILHAS
//   - Pedido do usuário: TODAS as fontes (máxima variedade) e SEM a tag de origem
//     no fim de cada sugestão (o alinhamento do ideal "(Lawful)", a divindade
//     "(Bontu)", o background "(Puzzle, Star)"), que sempre vem no fim e pode
//     repetir.
// -----------------------------------------------------------------------------

export const FIELD_CATEGORY = {
  personality: 'Personality Trait',
  ideals: 'Ideal',
  bonds: 'Bond',
  flaws: 'Flaw',
};

const CATEGORY_ENTRIES = Object.entries(FIELD_CATEGORY);

/** Remove a tag entre parênteses no fim do texto. */
function stripTrailingTag(text) {
  let s = text;
  let prev;
  do {
    prev = s;
    s = s.replace(/\s*\([^()]*\)\s*$/, '').trimEnd();
  } while (s !== prev);
  return s;
}

/** Markup inline do 5etools em texto simples. */
function plainText(str) {
  let s = String(str ?? '');
  let guard = 0;
  while (s.includes('{@') && guard++ < 20) {
    const next = s.replace(/\{@(\w+)\s+([^{}]*)\}/g, (m, _tag, content) => content.split('|')[0]);
    if (next === s) break;
    s = next;
  }
  return s.replace(/\s+/g, ' ').trim();
}

/** Todas as tabelas de um array de entries. */
function collectTables(entries) {
  const out = [];
  const walk = (e) => {
    if (Array.isArray(e)) {
      e.forEach(walk);
      return;
    }
    if (!e || typeof e !== 'object') return;
    if (e.type === 'table') out.push(e);
    if (e.entries) walk(e.entries);
    if (e.items) walk(e.items);
  };
  walk(entries);
  return out;
}

const _cache = new WeakMap();

/**
 * Os pools deduplicados por campo, de todos os backgrounds.
 * @param {object} db
 * @returns {{personality:string[], ideals:string[], bonds:string[], flaws:string[]}}
 */
export function collectSuggestions(db) {
  if (!db) return { personality: [], ideals: [], bonds: [], flaws: [] };
  const cached = _cache.get(db);
  if (cached) return cached;

  const seen = { personality: new Set(), ideals: new Set(), bonds: new Set(), flaws: new Set() };
  const pools = { personality: [], ideals: [], bonds: [], flaws: [] };

  for (const bg of db.backgrounds?.background ?? []) {
    for (const table of collectTables(bg.entries)) {
      const label = String(table.colLabels?.[1] ?? '');
      const field = CATEGORY_ENTRIES.find(([, cat]) => label.includes(cat))?.[0];
      if (!field) continue;
      for (const row of table.rows ?? []) {
        const raw = Array.isArray(row) ? row[1] : null;
        if (typeof raw !== 'string') continue;
        const text = stripTrailingTag(plainText(raw)).trim();
        const key = text.toLowerCase();
        if (text && !seen[field].has(key)) {
          seen[field].add(key);
          pools[field].push(text);
        }
      }
    }
  }

  _cache.set(db, pools);
  return pools;
}

/**
 * Uma sugestão aleatória para o campo, ou null.
 * @param {object} db
 * @param {'personality'|'ideals'|'bonds'|'flaws'} field
 * @param {() => number} [rng]
 * @returns {string|null}
 */
export function randomSuggestion(db, field, rng = Math.random) {
  const pool = collectSuggestions(db)[field] ?? [];
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)];
}
