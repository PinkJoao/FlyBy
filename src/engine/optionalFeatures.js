// =============================================================================
// optionalFeatures - resolve refs de optional features p/ o texto completo
// =============================================================================
// Manobras (Battle Master), eldritch invocations, metamagic etc. vivem em
// optionalfeatures.json e aparecem nos textos como {type:'refOptionalfeature',
// optionalfeature:'Nome|Fonte'}. Aqui trocamos a ref pela feature INTEIRA
// ({type:'entries', name, entries}) para o jogador ler as opções na progressão
// e nos previews. Sem match, a ref fica (o EntryContent mostra só o nome).
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
 * Substitui recursivamente refOptionalfeature pelo conteúdo resolvido.
 * @param {Array} entries
 * @param {object} db
 * @returns {Array} nova árvore (a original não é mutada)
 */
export function resolveOptionalRefs(entries, db) {
  const walk = (e) => {
    if (Array.isArray(e)) return e.map(walk);
    if (!e || typeof e !== 'object') return e;
    if (e.type === 'refOptionalfeature') {
      const opt = findOptional(db, e.optionalfeature);
      if (opt) return { type: 'entries', name: opt.name, entries: walk(opt.entries ?? []) };
      return e; // sem match: EntryContent mostra o nome da ref
    }
    const clone = { ...e };
    if (e.entries) clone.entries = walk(e.entries);
    if (e.items) clone.items = walk(e.items);
    return clone;
  };
  return walk(entries ?? []);
}
