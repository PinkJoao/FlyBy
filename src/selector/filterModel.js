// =============================================================================
// Modelo de filtros (puro)
// =============================================================================
// Inspirado no padrão do 5etools (precompute de campos + matching), mas enxuto
// e independente da UI. Cada item é pré-computado uma vez (ver entities/*.js)
// num formato simples: { id, searchText, filterValues: { [filterId]: string[] }, raw }.
//
// Estado dos filtros (tri-state por opção):
//   filterState = { [filterId]: { [optionValue]: 'include' | 'exclude' } }
//
// Semântica de matching:
//   - Dentro de um filtro: OR entre os "include"; o item passa se tiver ao menos
//     um valor incluído (ou se não houver nenhum include nesse filtro).
//   - "exclude" sempre veta: se o item tiver QUALQUER valor excluído, é cortado.
//   - Entre filtros: AND.
// -----------------------------------------------------------------------------

/** Próximo estado ao tocar numa opção: off → include → exclude → off. */
export function cycleOption(current) {
  if (current === 'include') return 'exclude';
  if (current === 'exclude') return undefined; // off
  return 'include';
}

/** Separa as opções ativas de um filtro em listas de include/exclude. */
function splitState(optionState) {
  const include = [];
  const exclude = [];
  for (const [value, mode] of Object.entries(optionState ?? {})) {
    if (mode === 'include') include.push(value);
    else if (mode === 'exclude') exclude.push(value);
  }
  return { include, exclude };
}

/**
 * Um item passa por um filtro?
 * @param {string[]} itemValues  valores do item para esse filtro
 * @param {{include: string[], exclude: string[]}} active
 */
export function passesFilter(itemValues, active) {
  const values = itemValues ?? [];
  // veto por exclusão
  if (active.exclude.length && active.exclude.some((v) => values.includes(v))) {
    return false;
  }
  // exigência por inclusão (OR)
  if (active.include.length && !active.include.some((v) => values.includes(v))) {
    return false;
  }
  return true;
}

/**
 * Filtra itens pré-computados pela busca textual + estado dos filtros.
 * @param {Array<{id:string, searchText:string, filterValues:Record<string,string[]>}>} items
 * @param {Object} opts
 * @param {string} [opts.query]
 * @param {Record<string, Record<string,'include'|'exclude'>>} [opts.filterState]
 */
export function applyFilters(items, { query = '', filterState = {} } = {}) {
  const q = query.trim().toLowerCase();

  // pré-processa o estado dos filtros uma vez
  const active = {};
  let anyActive = false;
  for (const [filterId, optionState] of Object.entries(filterState)) {
    const split = splitState(optionState);
    if (split.include.length || split.exclude.length) {
      active[filterId] = split;
      anyActive = true;
    }
  }

  return items.filter((item) => {
    if (q && !item.searchText.includes(q)) return false;
    if (!anyActive) return true;
    for (const [filterId, split] of Object.entries(active)) {
      if (!passesFilter(item.filterValues[filterId], split)) return false;
    }
    return true;
  });
}

/**
 * Coleta as opções distintas de um filtro a partir dos itens pré-computados
 * (para filtros cujas opções vêm dos próprios dados).
 * @param {Array} items
 * @param {string} filterId
 * @returns {string[]} valores únicos, ordenados
 */
export function deriveOptions(items, filterId) {
  const set = new Set();
  for (const item of items) {
    for (const v of item.filterValues[filterId] ?? []) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
