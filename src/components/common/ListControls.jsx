// =============================================================================
// ListControls: Filtrar, Agrupar e Ordenar acima de uma lista da ficha
// =============================================================================
// O QUE FAZ
//   A linha de três botões acima do inventário e do grimório (DDL-0314): o filtro (o
//   que a lista mostra: todos os itens, as armas; todas as magias, um círculo), o
//   agrupamento (as seções da lista) e a ordenação. Os dois primeiros mostram a opção
//   escolhida (ChoiceMenuButton); o terceiro é o SortButton de sempre.
//
// FUNÇÕES
//   ListControls(props): `filterOptions`, `filter`, `onFilter`, `groupOptions` (sem
//     opção, o botão some), `groupBy`, `onGroup`, `sortOptions` (idem), `sortBy`, `sortDir`,
//     `onSort`, `dataTour`.
//
// DECISÕES E ARMADILHAS
//   - Substitui o alternador Group (GroupSortBar, DDL-0310 a DDL-0312) e as abas de
//     categoria (as do inventário e os círculos do grimório): três botões pequenos no
//     lugar de duas faixas, e o que está escolhido continua escrito no botão.
//   - Os três ficam juntos, à direita, e não quebram: o texto dos dois primeiros encolhe
//     com reticências; no celular os dois crescem e a linha fica cheia (DDL-0317).
//   - Sem `sortOptions` (as abas do jogo, que só filtram) não há botão de ordenar.
// -----------------------------------------------------------------------------

import ChoiceMenuButton from './ChoiceMenuButton';
import SortButton from './SortButton';
import styles from './ListControls.module.css';

/** A linha Filtrar, Agrupar, Ordenar. */
export default function ListControls({ filterOptions, filter, onFilter, groupOptions, groupBy, onGroup, sortOptions, sortBy, sortDir, onSort, dataTour }) {
  return (
    <div className={styles.bar} data-tour={dataTour}>
      {filterOptions?.length > 0 && (
        <ChoiceMenuButton icon="filter" label="Show" className={styles.choice} options={filterOptions} value={filter} onChange={onFilter} />
      )}
      {groupOptions?.length > 0 && (
        <ChoiceMenuButton icon="group" label="Group by" className={styles.choice} options={groupOptions} value={groupBy} onChange={onGroup} />
      )}
      {sortOptions?.length > 0 && <SortButton className={styles.square} options={sortOptions} value={sortBy} dir={sortDir} onChange={onSort} />}
    </div>
  );
}
