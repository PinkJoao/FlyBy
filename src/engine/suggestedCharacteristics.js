// =============================================================================
// suggestedCharacteristics - pools de traços/ideais/laços/defeitos (PURO)
// =============================================================================
// As publicações de 2014 traziam, em cada background, uma "Suggested
// Characteristics" com quatro tabelas de rolagem (Personality Trait d8, Ideal
// d6, Bond d6, Flaw d6). Os backgrounds de 2024 (XPHB) as removeram. Este módulo
// varre TODOS os backgrounds do 5etools e junta cada categoria num pool único e
// deduplicado, alimentando o randomizador da tela de biografia.
//
// Decisões (pedido do usuário): usar TODAS as fontes (máxima variedade) e
// REMOVER a tag de origem no fim de cada sugestão - seja alinhamento do ideal
// ("(Lawful)"), divindade ("(Bontu)") ou o background de origem ("(Puzzle,
// Star)") - para não restringir/poluir o texto. Essas tags aparecem sempre no
// fim.
//
// Puro: recebe `db` e devolve dados. O texto das linhas pode conter markup
// 5etools ({@b Guild}. ...) → convertido em texto simples.
// -----------------------------------------------------------------------------

/** Campo da ficha → rótulo da coluna da tabela no 5etools. */
export const FIELD_CATEGORY = {
  personality: 'Personality Trait',
  ideals: 'Ideal',
  bonds: 'Bond',
  flaws: 'Flaw',
};

const CATEGORY_ENTRIES = Object.entries(FIELD_CATEGORY);

/**
 * Remove a tag entre parênteses no FINAL do texto. É a referência à origem da
 * sugestão - alinhamento do ideal ("(Lawful)"), divindade ("(Bontu)") ou o
 * background de onde veio ("(Puzzle, Star)") - e aparece sempre no fim. Removemos
 * qualquer uma (e repete, caso haja mais de uma).
 */
function stripTrailingTag(text) {
  let s = text;
  let prev;
  do {
    prev = s;
    s = s.replace(/\s*\([^()]*\)\s*$/, '').trimEnd();
  } while (s !== prev);
  return s;
}

/** Converte markup inline do 5etools ({@b X}, {@item Name|Src}…) em texto simples. */
function plainText(str) {
  let s = String(str ?? '');
  let guard = 0;
  // Resolve as tags mais internas até não sobrar nenhuma (conteúdo antes do "|").
  while (s.includes('{@') && guard++ < 20) {
    const next = s.replace(/\{@(\w+)\s+([^{}]*)\}/g, (m, _tag, content) => content.split('|')[0]);
    if (next === s) break;
    s = next;
  }
  return s.replace(/\s+/g, ' ').trim();
}

/** Coleta todas as tabelas de um array de `entries` (recursivo). */
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

// Cache por `db` (a varredura percorre 161 backgrounds).
const _cache = new WeakMap();

/**
 * Pools deduplicados por campo, a partir de TODOS os backgrounds.
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
        // Resolve o markup, remove a tag de origem no fim, normaliza.
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
 * Uma sugestão aleatória para o campo, ou null se o pool estiver vazio.
 * @param {object} db
 * @param {'personality'|'ideals'|'bonds'|'flaws'} field
 * @param {() => number} [rng]  injeta o RNG nos testes (default Math.random)
 * @returns {string|null}
 */
export function randomSuggestion(db, field, rng = Math.random) {
  const pool = collectSuggestions(db)[field] ?? [];
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)];
}
