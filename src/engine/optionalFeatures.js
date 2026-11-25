// =============================================================================
// optionalFeatures: resolve as refs de optional features para o texto completo
// =============================================================================
// O QUE FAZ
//   Manobras, invocações e metamagias vivem em optionalfeatures.json e aparecem
//   no texto como {type:'refOptionalfeature'}. Aqui a ref vira a feature INTEIRA
//   ({type:'entries', name, entries}), para o jogador ler as opções na progressão
//   e nos previews. Sem match, a ref fica (o EntryContent mostra o nome).
//
// FUNÇÕES
//   norm(s), findOptional(db, ref): a busca da feature.
//   resolveOptionalRefs(entries, db): a árvore com as refs resolvidas, sem mutar a
//     original.
// -----------------------------------------------------------------------------

const norm = (s) => (s ?? '').toString().trim().toLowerCase();

function findOptional(db, ref) {
  const [name, source] = String(ref).split('|');
  const list = db?.optionalfeatures?.optionalfeature ?? [];
  const matches = list.filter((o) => norm(o.name) === norm(name));
  if (matches.length === 0) return null;
  if (source) {
    const m = matches.find((o) => norm(o.source) === norm(source));
    if (m) return m;
  }
  return matches[matches.length - 1];
}

/**
 * Substitui recursivamente as refs de optional feature pelo conteúdo.
 * @param {Array} entries
 * @param {object} db
 * @returns {Array}
 */
export function resolveOptionalRefs(entries, db) {
  const walk = (e) => {
    if (Array.isArray(e)) return e.map(walk);
    if (!e || typeof e !== 'object') return e;
    if (e.type === 'refOptionalfeature') {
      const opt = findOptional(db, e.optionalfeature);
      if (opt) return { type: 'entries', name: opt.name, entries: walk(opt.entries ?? []) };
      return e;
    }
    const clone = { ...e };
    if (e.entries) clone.entries = walk(e.entries);
    if (e.items) clone.items = walk(e.items);
    return clone;
  };
  return walk(entries ?? []);
}
