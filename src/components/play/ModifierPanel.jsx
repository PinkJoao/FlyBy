// =============================================================================
// ModifierPanel: o modificador manual do mestre (ou de uma magia sem registro)
// =============================================================================
// O QUE FAZ
//   A segunda camada de modificador (docs/PLAY-MODE-PLAN.md 3.6): um nome, onde
//   vale (ataques, saves, testes, dano, ou só uma perícia), o que faz (um bônus em
//   fórmula, vantagem ou desvantagem), um bônus de CA opcional e a duração (até
//   remover, até um descanso curto ou longo, ou N rodadas em combate). Fecha com o modificador pronto
//   (engine/playEffects.makeModifier) ou null. Quem o abre é o playDialogs.jsx.
//
// FUNÇÕES
//   ModifierPanel(props): o conteúdo do diálogo.
//     submit(e): monta o modificador e fecha.
//
// DECISÕES E ARMADILHAS
//   - O bônus é validado com os dados das fórmulas do catálogo, como o do diálogo
//     de rolagem: "+@prof" vale; uma ref errada aparece na hora.
//   - `initialLabel` e `initialRounds` preenchem o nome e a duração quando o
//     efeito vem de um causador sem efeito curado (o Add effect, DDL-0121).
//   - "N rounds" só aparece em combate: fecha com `rounds`, e a tela conta da
//     rodada atual (playCombat.withRounds); o "Next turn" o tira ao passar.
//   - Um modificador sem efeito nenhum (nem alvo com bônus ou vantagem, nem CA) não
//     fecha: não há o que ligar.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { validateFormula } from '../../engine/dice';
import { makeModifier } from '../../engine/playEffects';
import { useDialogClose } from '../common/dialogContext';
import SegmentedControl from '../common/SegmentedControl';
import { SKILL_LABEL } from '../builder/labels';
import styles from './PlayPanels.module.css';

const TARGETS = [
  { value: 'attack', label: 'Attack rolls' },
  { value: 'save', label: 'Saving throws' },
  { value: 'check', label: 'Ability checks' },
  { value: 'damage', label: 'Damage rolls' },
];

const DURATIONS = [
  { value: 'manual', label: 'Until I remove it' },
  { value: 'shortRest', label: 'Until a Short or Long Rest' },
  { value: 'longRest', label: 'Until a Long Rest' },
];

/**
 * O conteúdo do diálogo de modificador.
 * @param {{ rollData: object, inCombat?: boolean, initialLabel?: string, initialRounds?: number|null }} props
 */
export default function ModifierPanel({ rollData, inCombat = false, initialLabel = '', initialRounds = null }) {
  const close = useDialogClose();
  const [label, setLabel] = useState(initialLabel);
  const [targets, setTargets] = useState(['attack']);
  const [skill, setSkill] = useState('');
  const [mode, setMode] = useState('bonus');
  const [formula, setFormula] = useState('');
  const [ac, setAc] = useState('');
  const [duration, setDuration] = useState(inCombat && initialRounds ? 'rounds' : 'manual');
  const [rounds, setRounds] = useState(String(initialRounds || 10));

  const formulaError = mode === 'bonus' && formula.trim() ? validateFormula(formula, rollData) : null;
  const allTargets = [...targets, ...(skill ? [`skill:${skill}`] : [])];
  const hasEffect = (allTargets.length > 0 && (mode !== 'bonus' || formula.trim())) || Number(ac);
  const roundCount = Math.trunc(Number(rounds) || 0);
  const ok = label.trim() && hasEffect && !formulaError && (duration !== 'rounds' || roundCount > 0);

  /** Monta o modificador e fecha. */
  const submit = (e) => {
    e.preventDefault();
    if (!ok) return;
    const effects = allTargets.length && (mode !== 'bonus' || formula.trim())
      ? [{ targets: allTargets, ...(mode === 'bonus' ? { formula: formula.trim() } : { mode }) }]
      : [];
    const modifier = makeModifier({ label: label.trim(), duration: duration === 'rounds' ? 'manual' : duration, effects, ...(Number(ac) ? { ac: Number(ac) } : {}) });
    close(duration === 'rounds' ? { ...modifier, rounds: roundCount } : modifier);
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <label className={styles.field}>
        <span className={styles.label}>Name</span>
        <input className={styles.input} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Blessed by the DM" autoComplete="off" />
      </label>

      <div className={styles.field}>
        <span className={styles.label}>Applies to</span>
        {TARGETS.map((t) => (
          <label key={t.value} className={styles.check}>
            <input
              type="checkbox"
              checked={targets.includes(t.value)}
              onChange={(e) => setTargets(e.target.checked ? [...targets, t.value] : targets.filter((x) => x !== t.value))}
            />
            <span>{t.label}</span>
          </label>
        ))}
        <select className={styles.input} value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="One skill">
          <option value="">Also one skill (optional)</option>
          {Object.entries(SKILL_LABEL).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </div>

      <SegmentedControl
        block
        value={mode}
        options={[['bonus', 'Bonus'], ['advantage', 'Advantage'], ['disadvantage', 'Disadvantage']]}
        onChange={setMode}
      />
      {mode === 'bonus' && (
        <label className={styles.field}>
          <span className={styles.label}>Bonus or penalty</span>
          <input className={styles.input} value={formula} onChange={(e) => setFormula(e.target.value)} placeholder="e.g. 1d4 or -2" autoComplete="off" />
          {formulaError && <span className={styles.short}>{formulaError}</span>}
        </label>
      )}

      <label className={styles.field}>
        <span className={styles.label}>Armor Class bonus (optional)</span>
        <input className={styles.input} type="number" value={ac} onChange={(e) => setAc(e.target.value)} placeholder="0" />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Duration</span>
        <select className={styles.input} value={duration} onChange={(e) => setDuration(e.target.value)}>
          {DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          {inCombat && <option value="rounds">A number of rounds</option>}
        </select>
      </label>
      {duration === 'rounds' && (
        <label className={styles.field}>
          <span className={styles.label}>Rounds (1 minute is 10)</span>
          <input className={styles.input} type="number" min="1" value={rounds} onChange={(e) => setRounds(e.target.value)} />
        </label>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.btn} onClick={() => close(null)}>Cancel</button>
        <button type="submit" className={`${styles.btn} ${styles.primary}`} disabled={!ok}>Add</button>
      </div>
    </form>
  );
}
