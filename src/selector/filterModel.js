// =============================================================================
// filterModel: o modelo de filtros
// =============================================================================
// O QUE FAZ
//   Inspirado no 5etools (precompute de campos e matching), enxuto e independente
//   da UI. Cada item é pré-computado uma vez: { id, searchText, filterValues: {
//   [filterId]: string[] }, raw }. O estado é tri-state por opção:
//   filterState = { [filterId]: { [opção]: 'include' | 'exclude' } }.
//   Matching: dentro de um filtro, OU entre os includes (sem include, passa);
//   exclude sempre veta; entre filtros, E.
//
// FUNÇÕES
//   cycleOption(current): off, include, exclude, off.
//   splitState(optionState): as listas de include e exclude.
//   passesFilter(itemValues, active): um item passa por um filtro?
//   applyFilters(items, opts): busca e filtros.
//   facetCounts(items, opts): quantos restariam se cada opção fosse marcada.
//   deriveOptions(items, filterId): as opções vindas dos dados.
//
// DECISÕES E ARMADILHAS
//   - facetCounts (DDL-0077) ignora de propósito o estado do PRÓPRIO filtro e aplica
//     os outros: é o que o clique produz. Contando-se, marcar Small zeraria as
//     outras opções de tamanho, e o include é OU. Um item entra na base de um
//     filtro se não reprova em nenhum OUTRO: basta contar quantos reprova.
//   - Não considera o `exclude` do painel (o dedup da ficha): ele é recriado a
//     cada render, e depender dele refaria a conta a cada hover. O custo é raro.
// -----------------------------------------------------------------------------

/** O próximo estado ao tocar numa opção. */
export function cycleOption(current) {
  if (current === 'include') return 'exclude';
  if (current === 'exclude') return undefined;
  return 'include';
}

/** As opções ativas de um filtro em include e exclude. */
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
 * @param {string[]} itemValues
 * @param {{include: string[], exclude: string[]}} active
 */
export function passesFilter(itemValues, active) {
  const values = itemValues ?? [];
  if (active.exclude.length && active.exclude.some((v) => values.includes(v))) {
    return false;
  }
  if (active.include.length && !active.include.some((v) => values.includes(v))) {
    return false;
  }
  return true;
}

/**
 * Filtra os itens pela busca e pelos filtros.
 * @param {Array<{id:string, searchText:string, filterValues:Record<string,string[]>}>} items
 * @param {Object} opts
 * @param {string} [opts.query]
 * @param {Record<string, Record<string,'include'|'exclude'>>} [opts.filterState]
 */
export function applyFilters(items, { query = '', filterState = {} } = {}) {
  const q = query.trim().toLowerCase();

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
 * Quantos resultados cada opção ainda alcança (ignora o próprio filtro).
 * @param {Array} items
 * @param {Object} opts
 * @param {string} [opts.query]
 * @param {Record<string, Record<string,'include'|'exclude'>>} [opts.filterState]
 * @param {string[]} [opts.filterIds]
 * @returns {Record<string, Record<string, number>>}
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
 * As opções distintas de um filtro, a partir dos itens.
 * @param {Array} items
 * @param {string} filterId
 * @returns {string[]}
 */
export function deriveOptions(items, filterId) {
  const set = new Set();
  for (const item of items) {
    for (const v of item.filterValues[filterId] ?? []) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
