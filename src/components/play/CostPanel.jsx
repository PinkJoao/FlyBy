// =============================================================================
// CostPanel: com que gasto do turno fazer algo (lançar uma magia por outra via)
// =============================================================================
// O QUE FAZ
//   A lista de "How do you pay for it?" sozinha, para quando a única escolha é o
//   gasto: a magia que tem outro custo por uma feature (o Quickened Spell pela bônus,
//   o Command do Mantle of Majesty, DDL-0165). Um toque escolhe e fecha com o gasto;
//   null se cancelado.
//
// FUNÇÕES
//   CostPanel(props): o painel.
//
// DECISÕES E ARMADILHAS
//   - As linhas são as do ActionPanel (CostRow): o mesmo desenho, a cor do gasto e o
//     "Used" quando aquela parte do turno já foi, no celular e no desktop.
//   - O recurso que o gasto cobra vai junto da origem ("Quickened Spell, 2 Sorcery
//     Points"), para o jogador ver o preço antes de tocar.
// -----------------------------------------------------------------------------

import { useDialogClose } from '../common/dialogContext';
import { CostRow } from './ActionPanel';
import styles from './ActionPanel.module.css';

/**
 * O painel dos gastos.
 * @param {{ costs: object[], inCombat: boolean }} props
 */
export default function CostPanel({ costs, inCombat }) {
  const close = useDialogClose();
  return (
    <div className={styles.panel}>
      <div className={styles.group}>
        <h3 className={styles.heading}>How do you pay for it?</h3>
        <ul className={styles.list} role="radiogroup" aria-label="Cost">
          {costs.map((c, i) => (
            <CostRow
              key={`${c.cost}-${c.source}-${i}`}
              cost={{ ...c, with: [], source: [c.source, c.spend ? `${c.spend.amount} ${c.spend.name}` : null, c.note].filter(Boolean).join(', ') }}
              selected={false}
              inCombat={inCombat}
              onPick={() => close(c)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
