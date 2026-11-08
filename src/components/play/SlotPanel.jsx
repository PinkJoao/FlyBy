// =============================================================================
// SlotPanel: o que a ação, a ação bônus ou a reação do turno pode pagar
// =============================================================================
// O QUE FAZ
//   O painel que abre ao tocar num dos botões de combate (CombatControls, DDL-0161):
//   as ações básicas que aceitam esse gasto (Attack, Dash, Hide...) e as activities de
//   feature que o custam (Second Wind, Patient Defense), numa lista de linhas
//   tocáveis; e "Mark it used", para o que o jogador fez fora da ficha. Fecha com
//   { kind: 'basic', item } , { kind: 'feature', action, activity }, { kind: 'mark' }
//   ou null.
//
// FUNÇÕES
//   Row(props): uma linha tocável.
//   SlotPanel(props): o painel.
//
// DECISÕES E ARMADILHAS
//   - A lista vem de slotChoices (engine/playBasicActions): a ação básica já chega
//     só com o custo deste gasto, então o ActionPanel que abre em seguida não
//     pergunta de novo como pagar.
//   - Linha indisponível (o Attack sem a ação) aparece apagada e não toca.
//   - O desenho das linhas é o do ActionPanel (o mesmo CSS).
// -----------------------------------------------------------------------------

import { useDialogClose } from '../common/dialogContext';
import Button from '../common/Button';
import styles from './ActionPanel.module.css';

/** Uma linha tocável. */
function Row({ name, detail, disabled, onPick }) {
  return (
    <li>
      <button type="button" className={styles.pick} onClick={onPick} disabled={disabled}>
        <span className={styles.pickMain}>
          <span className={styles.pickName}>{name}</span>
          {detail && <span className={styles.pickDetail}>{detail}</span>}
        </span>
      </button>
    </li>
  );
}

/**
 * O painel de um gasto do turno.
 * @param {{ choices: { basics: object[], features: object[] }, slotLabel: string }} props
 */
export default function SlotPanel({ choices, slotLabel }) {
  const close = useDialogClose();
  const { basics, features } = choices;
  return (
    <div className={styles.panel}>
      {basics.length > 0 && (
        <div className={styles.group}>
          <h3 className={styles.heading}>Actions</h3>
          <ul className={styles.list}>
            {basics.map((b) => (
              <Row key={b.key} name={b.name} detail={b.item.costs.map((c) => c.source).filter((s) => s && s !== 'a spell').join(', ') || null} disabled={!b.available} onPick={() => close({ kind: 'basic', item: b.item })} />
            ))}
          </ul>
        </div>
      )}
      {features.length > 0 && (
        <div className={styles.group}>
          <h3 className={styles.heading}>Features</h3>
          <ul className={styles.list}>
            {features.map((f) => (
              <Row key={f.key} name={f.name} disabled={!f.available} onPick={() => close({ kind: 'feature', action: f.action, activity: f.activity })} />
            ))}
          </ul>
        </div>
      )}
      {!basics.length && !features.length && <p className={styles.note}>Nothing on the sheet uses your {slotLabel.toLowerCase()}.</p>}
      <Button variant="link" onClick={() => close({ kind: 'mark' })}>
        Mark the {slotLabel.toLowerCase()} as used
      </Button>
    </div>
  );
}
