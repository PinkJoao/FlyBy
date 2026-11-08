// =============================================================================
// foundryMechanicsData: os registros GRANDES do export, carregados sob demanda
// =============================================================================
// O QUE FAZ
//   As activities das magias (srdSpellActivitiesData, 460 KB) e a mecânica dos
//   itens do SRD (srdItemMechanicsData, 635 KB) só servem ao export para o
//   Foundry. Importados direto, inflavam o pacote principal do app (medido: 1,62
//   para 2,03 MB só com as magias). Ficam num pedaço à parte, carregado por
//   loadFoundryMechanics antes do export.
//
// FUNÇÕES
//   loadFoundryMechanics(): carrega os dois registros (uma vez) e os devolve.
//   foundryMechanics(): os registros já carregados, ou null.
//
// DECISÕES E ARMADILHAS
//   - Sem carregar, o export funciona e só perde essas mecânicas (a magia cai no
//     overlay e no dado do 5etools; o item no dado do 5etools). Quem EXPORTA
//     (o menu da ficha, a lista de personagens, os scripts) chama
//     loadFoundryMechanics antes; o play mode monta o ator em memória sem elas,
//     porque o catálogo não lê activity de magia nem de item do SRD.
// -----------------------------------------------------------------------------

let loaded = null;
let pending = null;

/** Carrega os registros do export (uma vez) e os devolve. */
export async function loadFoundryMechanics() {
  if (loaded) return loaded;
  pending ??= Promise.all([import('./srdSpellActivitiesData'), import('./srdItemMechanicsData')])
    .then(([spells, items]) => {
      loaded = { spells: spells.SRD_SPELL_ACTIVITIES, items: items.SRD_ITEM_MECHANICS };
      return loaded;
    });
  return pending;
}

/** Os registros já carregados, ou null. */
export function foundryMechanics() {
  return loaded;
}
