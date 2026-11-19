// =============================================================================
// HpPanels: os painéis do card de HP do play mode (Heal, Hurt, Hit dice)
// =============================================================================
// O QUE FAZ
//   Os três botões do card de HP aberto abrem um destes, cada um num diálogo do
//   app (playDialogs.jsx):
//   - HealPanel: o número e o tipo da cura: curar o HP, dar HP temporário ou
//     aumentar o HP máximo. Fecha com { kind, amount, replace }.
//   - HurtPanel: o número, o tipo de dano opcional, a salvaguarda de "metade no sucesso" (com o
//     Evasion, nada no sucesso e metade na falha, TC-0154) e se o dano corta também o HP
//     máximo. Fecha com { amount, type, affectMax }.
//   - HitDicePanel: quantos dados de vida rolar para curar; negativo devolve os
//     gastos. Fecha com { count }.
//   Cada um mostra antes o que vai acontecer. O número vem com menos, mais e
//   saltos (AmountStepper): Heal e Hurt de 1 em 1 e saltos de 5 e 10, os dados de
//   vida de 1 em 1.
//
// FUNÇÕES
//   HealPanel(props), HurtPanel(props), HitDicePanel(props): os painéis.
//   defenseLine(defenses): as defesas do personagem numa linha, para o Hurt.
//
// DECISÕES E ARMADILHAS
//   - O foco e o corte no mínimo são do AmountStepper (o foco só com mouse).
//   - A prévia é uma conta da TELA, curta, para o jogador conferir; o que vale é o
//     evento do engine (playHealth, playRest), que faz a mesma regra.
//   - O tipo de dano do Hurt é OPCIONAL e vazio por padrão (o DDL-0120 pedia só o
//     número): tocar um tipo aplica a defesa do personagem (`defenses`, já com a Rage
//     e as condições), e a nota diz quanto fica ("Resistant (halved): 10 becomes 5").
//     As defesas do personagem aparecem numa linha abaixo do título (`defenseLine`), não
//     no tom do Chip: o tom "info" ficava igual ao chip escolhido. A redução fixa (`defenses.reduce`, o
//     Heavy Armor Master) entra na linha e na conta, antes da resistência, como o evento (DDL-0261). Sem `defenses` (o
//     membro de um summon), não há tipo (TC-0134, DDL-0220).
//   - Temporário não soma (XPHB): o padrão fica com o maior, "replace" força o novo.
//   - Heal e Hurt servem também ao membro de um summon (DDL-0201): a mesma regra, o
//     mesmo painel; `maxNote` troca a nota do máximo. "To full" põe no número o que
//     falta para o máximo.
//   - Dados de vida: a maior face primeiro, ao gastar e ao devolver (engine/playRest).
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { useDialogClose } from '../common/dialogContext';
import SegmentedControl from '../common/SegmentedControl';
import AmountStepper from './AmountStepper';
import panel from './PlayPanels.module.css';
import styles from './HpPanels.module.css';
import Button from '../common/Button';
import Toggle from '../common/Toggle';
import Chip from '../common/Chip';
import { traitFor, adjustDamage, saveDamage, reductionFor } from '../../engine/playHealth';
import { DAMAGE_TYPES } from '../../engine/playEffects';

const HEAL_KINDS = [
  { value: 'heal', label: 'Heal' },
  { value: 'temp', label: 'Temporary' },
  { value: 'max', label: 'Max HP' },
];

const HP_JUMPS = [5, 10];

const TRAIT_NOTE = { immune: 'Immune', resist: 'Resistant (halved)', vulnerable: 'Vulnerable (doubled)', 'resist+vulnerable': 'Resistant and vulnerable' };

/** As defesas do personagem numa linha ("Resistant: bludgeoning, piercing, slashing"). */
function defenseLine(defenses) {
  const parts = [['Immune', defenses?.immune], ['Resistant', defenses?.resist], ['Vulnerable', defenses?.vulnerable]]
    .filter(([, list]) => list?.length)
    .map(([word, list]) => `${word}: ${list.join(', ')}`);
  for (const r of defenses?.reduce ?? []) parts.push(`${r.label}: -${r.amount} ${r.types.join(', ')}`);
  return parts.join(' · ');
}

/**
 * O painel de cura: HP, temporário ou máximo.
 * @param {{ vitals: { current: number, max: number, temp: number }, maxNote?: string }} props
 */
export function HealPanel({ vitals, maxNote = 'Like Aid: lasts until your next Long Rest.' }) {
  const close = useDialogClose();
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState('heal');
  const [replace, setReplace] = useState(false);
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  const missing = Math.max(0, vitals.max - vitals.current);

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
      {kind === 'heal' && missing > 0 && (
        <Button size="sm" variant="link" className={styles.full} onClick={() => setAmount(String(missing))}>
          To full (+{missing})
        </Button>
      )}
      {kind === 'temp' && (
        <Toggle checked={replace} onChange={setReplace} label="Replace even if lower" />
      )}
      {kind === 'max' && <p className={panel.note}>{maxNote}</p>}
      {n > 0 && <p className={styles.preview}>{preview}</p>}
      <div className={panel.actions}>
        <Button type="submit" variant="primary" disabled={n <= 0}>Apply</Button>
      </div>
    </form>
  );
}

/**
 * O painel de dano: o número, o tipo opcional (com `defenses`) e se corta o máximo.
 * @param {{ vitals: { current: number, max: number, temp: number }, defenses?: object }} props
 */
export function HurtPanel({ vitals, defenses = null, evasion = false }) {
  const close = useDialogClose();
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('');
  const [affectMax, setAffectMax] = useState(false);
  const [save, setSave] = useState('none');
  const typed = Math.max(0, Math.floor(Number(amount) || 0));
  const trait = defenses ? traitFor({ defenses }, type) : null;
  const cut = defenses ? reductionFor({ defenses }, type) : null;
  const n = adjustDamage(Math.max(0, saveDamage(typed, save, evasion) - (cut?.amount ?? 0)), trait);
  const toTemp = Math.min(vitals.temp, n);
  const toHp = Math.min(n - toTemp, vitals.current);
  const max = affectMax ? Math.max(0, vitals.max - (n - toTemp)) : vitals.max;
  const current = Math.min(vitals.current - toHp, max);

  return (
    <form
      className={panel.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (typed > 0) close({ amount: typed, type, affectMax, save: save === 'none' ? null : save, evasion });
      }}
    >
      <p className={styles.now}>{vitals.current} / {vitals.max} HP{vitals.temp ? ` · ${vitals.temp} temporary` : ''}</p>
      <AmountStepper value={amount} onChange={setAmount} jumps={HP_JUMPS} />
      {defenses && (
        <div className={panel.field}>
          <span className={panel.label}>Damage type (optional)</span>
          {defenseLine(defenses) && <span className={panel.note}>{defenseLine(defenses)}</span>}
          <div className={panel.chips}>
            {DAMAGE_TYPES.map((t) => (
              <Chip key={t} size="sm" active={type === t} onClick={() => setType(type === t ? '' : t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {defenses && (
        <div className={panel.field}>
          <span className={panel.label}>Save for half damage</span>
          {evasion && <span className={panel.note}>Evasion: no damage on a success, half on a failure</span>}
          <SegmentedControl block ariaLabel="Save for half damage" value={save} onChange={setSave} options={[['none', 'No save'], ['saved', 'Saved'], ['failed', 'Failed']]} />
        </div>
      )}
      <Toggle checked={affectMax} onChange={setAffectMax} label="Also lowers the hit point maximum" />
      {(trait || cut || save !== 'none') && typed > 0 && <p className={panel.note}>{trait ? TRAIT_NOTE[trait] : cut ? `${cut.label} (-${cut.amount})` : 'After the save'}: {typed} becomes {n}</p>}
      {typed > 0 && (
        <p className={styles.preview}>
          {toTemp ? `${toTemp} from temporary, ` : ''}{vitals.current} to {current} hit points{affectMax ? `, maximum ${vitals.max} to ${max}` : ''}
        </p>
      )}
      <div className={panel.actions}>
        <Button type="submit" variant="danger" disabled={typed <= 0}>Apply</Button>
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
        <Button type="submit" variant="primary" disabled={n === 0}>{n < 0 ? 'Recover' : 'Roll'}</Button>
      </div>
    </form>
  );
}
