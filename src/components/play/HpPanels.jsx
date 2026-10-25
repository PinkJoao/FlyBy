// =============================================================================
// HpPanels: os painéis do card de HP do play mode (Heal, Hurt, Hit dice)
// =============================================================================
// O QUE FAZ
//   Os três botões do card de HP aberto abrem um destes, cada um num diálogo do
//   app (playDialogs.jsx):
//   - HealPanel: o número e o tipo da cura: curar o HP, dar HP temporário ou
//     aumentar o HP máximo. Fecha com { kind, amount, replace }.
//   - HurtPanel: o número e se o dano corta também o HP máximo. Fecha com
//     { amount, affectMax }.
//   - HitDicePanel: quantos dados de vida rolar para curar; negativo devolve os
//     gastos. Fecha com { count }.
//   Cada um mostra antes o que vai acontecer. O número vem com menos, mais e
//   saltos (AmountStepper): Heal e Hurt de 1 em 1 e saltos de 5 e 10, os dados de
//   vida de 1 em 1.
//
// FUNÇÕES
//   HealPanel(props), HurtPanel(props), HitDicePanel(props): os painéis.
//
// DECISÕES E ARMADILHAS
//   - O foco e o corte no mínimo são do AmountStepper (o foco só com mouse).
//   - A prévia é uma conta da TELA, curta, para o jogador conferir; o que vale é o
//     evento do engine (playHealth, playRest), que faz a mesma regra.
//   - O Hurt não tem tipo de dano (pedido do usuário): resistência e imunidade não
//     entram; o dano de um ataque, que tem tipo, é outro caminho.
//   - Temporário não soma (XPHB): o padrão fica com o maior, "replace" força o novo.
//   - Dados de vida: a maior face primeiro, ao gastar e ao devolver (engine/playRest).
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { useDialogClose } from '../common/dialogContext';
import SegmentedControl from '../common/SegmentedControl';
import AmountStepper from './AmountStepper';
import panel from './PlayPanels.module.css';
import styles from './HpPanels.module.css';

const HEAL_KINDS = [
  { value: 'heal', label: 'Heal' },
  { value: 'temp', label: 'Temporary' },
  { value: 'max', label: 'Max HP' },
];

const HP_JUMPS = [5, 10];

/**
 * O painel de cura: HP, temporário ou máximo.
 * @param {{ vitals: { current: number, max: number, temp: number } }} props
 */
export function HealPanel({ vitals }) {
  const close = useDialogClose();
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState('heal');
  const [replace, setReplace] = useState(false);
  const n = Math.max(0, Math.floor(Number(amount) || 0));

  let preview;
  if (kind === 'heal') preview = `${vitals.current} to ${Math.min(vitals.max, vitals.current + n)} hit points`;
  else if (kind === 'temp') preview = `Temporary ${vitals.temp} to ${replace ? n : Math.max(vitals.temp, n)}${!replace && vitals.temp > n && n ? ' (you keep the higher)' : ''}`;
  else preview = `Maximum ${vitals.max} to ${vitals.max + n}, current ${vitals.current} to ${vitals.current + n}`;

  return (
    <form
      className={panel.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (n > 0) close({ kind, amount: n, replace });
      }}
    >
      <p className={styles.now}>{vitals.current} / {vitals.max} HP{vitals.temp ? ` · ${vitals.temp} temporary` : ''}</p>
      <AmountStepper value={amount} onChange={setAmount} jumps={HP_JUMPS} />
      <SegmentedControl
        block
        ariaLabel="Kind of healing"
        value={kind}
        options={HEAL_KINDS}
        onChange={setKind}
      />
      {kind === 'temp' && (
        <label className={panel.check}>
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          <span>Replace even if lower</span>
        </label>
      )}
      {kind === 'max' && <p className={panel.note}>Like Aid: lasts until your next Long Rest.</p>}
      {n > 0 && <p className={styles.preview}>{preview}</p>}
      <div className={panel.actions}>
        <button type="submit" className={`${panel.btn} ${styles.heal}`} disabled={n <= 0}>Apply</button>
      </div>
    </form>
  );
}

/**
 * O painel de dano: o número e se corta o máximo.
 * @param {{ vitals: { current: number, max: number, temp: number } }} props
 */
export function HurtPanel({ vitals }) {
  const close = useDialogClose();
  const [amount, setAmount] = useState('');
  const [affectMax, setAffectMax] = useState(false);
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  const toTemp = Math.min(vitals.temp, n);
  const toHp = Math.min(n - toTemp, vitals.current);
  const max = affectMax ? Math.max(0, vitals.max - (n - toTemp)) : vitals.max;
  const current = Math.min(vitals.current - toHp, max);

  return (
    <form
      className={panel.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (n > 0) close({ amount: n, affectMax });
      }}
    >
      <p className={styles.now}>{vitals.current} / {vitals.max} HP{vitals.temp ? ` · ${vitals.temp} temporary` : ''}</p>
      <AmountStepper value={amount} onChange={setAmount} jumps={HP_JUMPS} />
      <label className={panel.check}>
        <input type="checkbox" checked={affectMax} onChange={(e) => setAffectMax(e.target.checked)} />
        <span>Also lowers the hit point maximum</span>
      </label>
      {n > 0 && (
        <p className={styles.preview}>
          {toTemp ? `${toTemp} from temporary, ` : ''}{vitals.current} to {current} hit points{affectMax ? `, maximum ${vitals.max} to ${max}` : ''}
        </p>
      )}
      <div className={panel.actions}>
        <button type="submit" className={`${panel.btn} ${styles.damage}`} disabled={n <= 0}>Apply</button>
      </div>
    </form>
  );
}

/**
 * O painel dos dados de vida: positivo rola e cura, negativo devolve.
 * @param {{ dice: { faces: number, max: number, left: number }[], vitals: object }} props
 */
export function HitDicePanel({ dice, vitals }) {
  const close = useDialogClose();
  const [count, setCount] = useState('1');
  const n = Math.trunc(Number(count) || 0);
  const left = dice.reduce((s, d) => s + d.left, 0);
  const spent = dice.reduce((s, d) => s + d.max - d.left, 0);

  let preview = '';
  if (n > 0) preview = n > left ? `Only ${left} left to spend` : `Rolls ${n} and heals (${vitals.current} / ${vitals.max} now)`;
  else if (n < 0) preview = -n > spent ? `Only ${spent} spent to recover` : `Recovers ${-n} spent`;

  return (
    <form
      className={panel.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (n !== 0) close({ count: n });
      }}
    >
      <p className={styles.now}>{dice.map((d) => `${d.left}/${d.max} d${d.faces}`).join(' · ') || 'No hit dice'}</p>
      <AmountStepper value={count} onChange={setCount} min={null} label="Hit dice" />
      <p className={panel.note}>Each die heals its roll plus your Constitution modifier (at least 1). A negative number gives spent dice back.</p>
      {preview && <p className={styles.preview}>{preview}</p>}
      <div className={panel.actions}>
        <button type="submit" className={`${panel.btn} ${panel.primary}`} disabled={n === 0}>{n < 0 ? 'Recover' : 'Roll'}</button>
      </div>
    </form>
  );
}
