// =============================================================================
// reprints: só as versões mais recentes
// =============================================================================
// O QUE FAZ
//   O 5etools marca a versão ANTIGA com `reprintedAs`. Filtrar quem a tem é o
//   filtro "Reprinted" do 5etools: esconde o republicado, deixa o atual.
//
// FUNÇÕES
//   latestOnly(list): só as versões atuais.
//   dedupeByName(list): colapsa por nome, preferindo XPHB (para listas planas como
//     idiomas e ferramentas).
// -----------------------------------------------------------------------------

/** Remove as entidades republicadas. */
export function latestOnly(list) {
  return (list ?? []).filter((e) => !e?.reprintedAs?.length);
}

/** Colapsa por nome, preferindo a fonte 2024. */
export function dedupeByName(list) {
  const map = new Map();
  for (const x of list ?? []) {
    const cur = map.get(x.name);
    if (!cur || x.source === 'XPHB') map.set(x.name, x);
  }
  return [...map.values()];
}
