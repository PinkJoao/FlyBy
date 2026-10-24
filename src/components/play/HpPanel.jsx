// =============================================================================
// HpPanel: dano, cura e HP temporário num diálogo do play mode
// =============================================================================
// O QUE FAZ
//   O teclado do HP (docs/PLAY-MODE-PLAN.md 3.7): um número e três botões
//   (Damage, Heal, Temp HP). No dano, o tipo opcional aplica as defesas da ficha
//   (o catálogo diz se resiste, é imune ou vulnerável) e o crítico conta duas
//   falhas quando o personagem já está com 0 HP. No temporário, "replace" troca
//   pelo novo mesmo que seja menor (o padrão fica com o maior, XPHB).
//   Fecha com { action, amount, type, critical, replace }, ou null. Quem o abre
//   num diálogo é o hpDialog.jsx.
//
// FUNÇÕES
//   HpPanel(props): o conteúdo do diálogo.
//     finish(action): fecha com a ação e os campos.
//
// DECISÕES E ARMADILHAS
//   - O campo do número ganha o foco depois da montagem (setTimeout), pelo mesmo
//     motivo do RollPanel: o DialogHost foca o próprio cartão no efeito dele.
//   - Enter aplica DANO, a ação mais comum na mesa; a cura e o temporário são
//     botões.
//   - A frase da defesa sai de traitFor (engine/playHealth), a mesma regra que o
//     evento usa: o que a tela promete é o que o redutor grava.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { traitFor, adjustDamage } from '../../engine/playHealth';
import { useDialogClose } from '../common/dialogContext';
import styles from './HpPanel.module.css';

const DAMAGE_TYPES = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];

const TRAIT_TEXT = {
  immune: 'Immune: no damage',
  resist: 'Resistant: half damage',
  vulnerable: 'Vulnerable: double damage',
  'resist+vulnerable': 'Resistant and vulnerable',
};

/**
 * O conteúdo do diálogo de HP.
 * @param {{ catalog: object, vitals: object }} props
 */
export default function HpPanel({ catalog, vitals }) {
  const close = useDialogClose();
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('');
  const [critical, setCritical] = useState(false);
  const [replace, setReplace] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  const n = Math.max(0, Math.floor(Number(amount) || 0));
  const trait = traitFor(catalog, type);
  const ok = n > 0;

  /** Fecha com a ação escolhida e os campos. */
  const finish = (action) => {
    if (!ok) return;
    close({ action, amount: n, type, critical, replace });
  };

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        finish('damage');
      }}
    >
      <p className={styles.now}>
        {vitals.current} / {vitals.max} HP{vitals.temp ? ` · ${vitals.temp} temporary` : ''}
      </p>
      <input
        ref={inputRef}
        className={styles.amount}
        type="number"
        inputMode="numeric"
        min="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0"
        aria-label="Amount"
      />

      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>Damage type</span>
          <select className={styles.select} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Any (no defenses)</option>
            {DAMAGE_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
          </select>
        </label>
        {trait && <span className={styles.trait}>{TRAIT_TEXT[trait]}{ok ? `: ${adjustDamage(n, trait)}` : ''}</span>}
      </div>

      <label className={styles.check}>
        <input type="checkbox" checked={critical} onChange={(e) => setCritical(e.target.checked)} />
        <span>From a critical hit (two failures at 0 HP)</span>
      </label>
      <label className={styles.check}>
        <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
        <span>Temp HP: replace even if lower</span>
      </label>

      <div className={styles.actions}>
        <button type="submit" className={`${styles.btn} ${styles.damage}`} disabled={!ok}>Damage</button>
        <button type="button" className={`${styles.btn} ${styles.heal}`} disabled={!ok} onClick={() => finish('heal')}>Heal</button>
        <button type="button" className={styles.btn} disabled={!ok} onClick={() => finish('temp')}>Temp HP</button>
      </div>
    </form>
  );
}
