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
 * Quantos resultados restariam se cada opção fosse marcada. É o que permite
 * DESABILITAR um chip que não leva a lugar nenhum (uma espécie Small com natação,
 * quando já não sobrou nenhuma).
 *
 * ⭐ A contagem de um filtro ignora de propósito o estado DELE MESMO, e aplica
 * todos os OUTROS: é exatamente o que o clique produz. Se ela se contasse,
 * marcar "Small" zeraria todas as outras opções de tamanho e o grupo viraria um
 * beco sem saída - dá para incluir Small E Medium, porque dentro de um filtro o
 * include é OR.
 *
 * A contagem NÃO considera o `exclude` do painel (o predicado de dedup do que já
 * está na ficha): ele é uma closure recriada a cada render em vários chamadores,
 * e depender dele faria a conta refazer-se a cada hover. O custo é uma opção que
 * sobrevive habilitada levando só a itens já possuídos - raro e inofensivo.
 *
 * @param {Array} items itens pré-computados
 * @param {Object} opts
 * @param {string} [opts.query]
 * @param {Record<string, Record<string,'include'|'exclude'>>} [opts.filterState]
 * @param {string[]} [opts.filterIds] quais filtros contar
 * @returns {Record<string, Record<string, number>>} `{ [filtro]: { [opção]: n } }`
 */
export function facetCounts(items, { query = '', filterState = {}, filterIds = [] } = {}) {
  const q = query.trim().toLowerCase();

  const active = [];
  for (const [filterId, optionState] of Object.entries(filterState)) {
    const split = splitState(optionState);
    if (split.include.length || split.exclude.length) active.push([filterId, split]);
  }

  const counts = {};
  for (const id of filterIds) counts[id] = {};

  for (const item of items) {
    if (q && !item.searchText.includes(q)) continue;

    // Um item entra na base de um filtro quando não reprova em nenhum OUTRO
    // filtro ativo. Basta então saber QUANTOS ele reprova (e qual, se for um só):
    // 0 → entra na base de todos; 1 → só na do filtro que reprovou; 2+ → nenhuma.
    let failedId = null;
    let failed = 0;
    for (const [filterId, split] of active) {
      if (!passesFilter(item.filterValues[filterId], split)) {
        failed += 1;
        if (failed > 1) break;
        failedId = filterId;
      }
    }
    if (failed > 1) continue;

    for (const id of filterIds) {
      if (failed === 1 && failedId !== id) continue;
      const bucket = counts[id];
      for (const v of item.filterValues[id] ?? []) bucket[v] = (bucket[v] ?? 0) + 1;
    }
  }

  return counts;
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
