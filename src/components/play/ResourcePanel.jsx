// =============================================================================
// ResourcePanel: tirar ou pôr à mão um recurso do play mode
// =============================================================================
// O QUE FAZ
//   O painel que abre ao tocar no contador de um recurso (as bolinhas de uma
//   feature, as gemas de um círculo de magia, as cargas de um item): Remove ou Add,
//   o número com menos e mais (AmountStepper) e a prévia do que fica. Fecha com
//   { delta } (positivo tira, negativo põe) ou null. Quem o abre é o playDialogs.jsx
//   (askResource).
//
// FUNÇÕES
//   ResourcePanel(props): o painel.
//
// DECISÕES E ARMADILHAS
//   - É para o que o MESTRE tira ou dá fora de um descanso (DDL-0202): o "só usar"
//     do jogo segue para o resto; o ajuste vira um evento "by hand" que o histórico
//     desfaz.
//   - Tirar para no que sobra e pôr para no que foi gasto (o modelo guarda o gasto, e
//     o máximo é da ficha): a prévia avisa quando o pedido passa disso, e o evento
//     (adjustResourceEvent com o estado) faz o mesmo corte.
//   - Começa em Add quando não sobra nada e em Remove quando nada foi gasto; o outro
//     lado fica desabilitado se não alcança nada (§6.4).
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { useDialogClose } from '../common/dialogContext';
import SegmentedControl from '../common/SegmentedControl';
import AmountStepper from './AmountStepper';
import Button from '../common/Button';
import { Pips } from './FeaturesTab';
import panel from './PlayPanels.module.css';
import styles from './HpPanels.module.css';

/**
 * O painel de ajuste à mão.
 * @param {{ left: number, max: number, shape?: string }} props
 */
export default function ResourcePanel({ left, max, shape }) {
  const close = useDialogClose();
  const spent = Math.max(0, max - left);
  const [mode, setMode] = useState(left > 0 ? 'remove' : 'add');
  const [amount, setAmount] = useState('1');
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  const room = mode === 'remove' ? left : spent;
  const real = Math.min(n, room);
  const next = mode === 'remove' ? left - real : left + real;

  return (
    <form
      className={panel.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (real > 0) close({ delta: mode === 'remove' ? real : -real });
      }}
    >
      <p className={styles.now}>
        <Pips left={left} max={max} shape={shape} /> {left} of {max} left
      </p>
      <SegmentedControl
        block
        ariaLabel="Remove or add"
        value={mode}
        options={[
          { value: 'remove', label: 'Remove', disabled: left === 0 },
          { value: 'add', label: 'Add', disabled: spent === 0 },
        ]}
        onChange={setMode}
      />
      <AmountStepper value={amount} onChange={setAmount} min={0} autoFocus={false} />
      {n > 0 && (
        <p className={styles.preview}>
          {left} to {next} of {max}
          {n > room ? (mode === 'remove' ? ` (only ${room} left to remove)` : ` (only ${room} spent to add back)`) : ''}
        </p>
      )}
      <p className={panel.note}>For what the DM takes away or grants outside a rest. You can undo it in the history.</p>
      <div className={panel.actions}>
        <Button type="submit" variant={mode === 'remove' ? 'danger' : 'primary'} disabled={real <= 0}>
          {mode === 'remove' ? 'Remove' : 'Add'}
        </Button>
      </div>
    </form>
  );
}
