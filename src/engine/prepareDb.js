// =============================================================================
// prepareDb: o compêndio pronto para os consumidores (a herança `_copy` dos itens resolvida)
// =============================================================================
// O QUE FAZ
//   Recebe o db como veio da fonte (o cache do app, o pacote do SRD ou o snapshot local dos scripts) e devolve uma
//   cópia rasa com os itens que herdam de outro via `_copy` já completos: a loja, a ficha, o export e o jogo leem o
//   mesmo objeto. Chamado pelo useDataEngine (app) e pelo loadDb (scripts).
//
// FUNÇÕES
//   prepareDb(db): o db com `items.item` resolvido, ou o próprio db quando não há o que resolver.
//
// DECISÕES E ARMADILHAS
//   - 90 itens do seletor eram `_copy` sem resolver (o Ashbringer (True State) do WoW, os Ascendant do FTD, as Ashen
//     Band do ICC, os Wave-Swept do EGW): a loja mostrava "Type Other" sem texto e a derivação os lia sem tipo,
//     raridade nem texto (DDL-0267). O pai pode estar entre os itens base, então a resolução corre sobre os itens
//     base mais os itens e devolve só a parte dos itens.
//   - Puro e sem efeito no objeto recebido: o cache guarda o dado cru, e resolver de novo a cada carga é barato.
// -----------------------------------------------------------------------------

import { resolveCopies } from '../selector/copy';

/** O db com a herança `_copy` dos itens resolvida (cópia rasa), ou o próprio db sem o que resolver. */
export function prepareDb(db) {
  const items = db?.items?.item;
  if (!Array.isArray(items) || !items.some((i) => i?._copy)) return db;
  const bases = db?.['items-base']?.baseitem ?? [];
  const resolved = resolveCopies([...bases, ...items]).slice(bases.length);
  return { ...db, items: { ...db.items, item: resolved } };
}
