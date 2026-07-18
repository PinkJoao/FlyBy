// =============================================================================
// Reprints - mostrar só as versões mais recentes
// =============================================================================
// O 5etools marca a versão ANTIGA com `reprintedAs: ["Nome|NOVAFONTE"]` (ver
// Renderer.isReprinted). Filtrar quem tem `reprintedAs` = comportamento do filtro
// "Reprinted" do 5etools: esconde o que já foi republicado, deixando o atual.
// -----------------------------------------------------------------------------

/** Remove entidades que foram republicadas (mantém só as versões atuais). */
export function latestOnly(list) {
  return (list ?? []).filter((e) => !e?.reprintedAs?.length);
}

/**
 * Colapsa por nome (para pick-lists planas como idiomas/ferramentas, onde dois
 * itens de mesmo nome confundem). Preferindo a fonte 2024 (XPHB) quando houver.
 */
export function dedupeByName(list) {
  const map = new Map();
  for (const x of list ?? []) {
    const cur = map.get(x.name);
    if (!cur || x.source === 'XPHB') map.set(x.name, x);
  }
  return [...map.values()];
}
