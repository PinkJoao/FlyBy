// =============================================================================
// SkillCheckPanel: escolher a perícia (ou o teste puro) de um atributo
// =============================================================================
// O QUE FAZ
//   O passo entre o Check de um atributo e a rolagem: a lista das perícias do
//   atributo e o teste puro, cada uma com o bônus total e as peças dele em três
//   grupos (engine/playChecks.testBreakdown): FIXOS (atributo, proficiência,
//   expertise), ROLADOS (um dado a mais, como o Guidance) e TEMPORÁRIOS OU
//   CONDICIONAIS (item, efeito ligado, condição, vantagem, desvantagem). Tocar numa
//   linha fecha com { test, name }, e a tela abre a rolagem. Quem o abre é o
//   playDialogs.jsx.
//
// FUNÇÕES
//   SkillCheckPanel(props): o conteúdo do diálogo.
//   Row(props): uma linha (perícia ou teste puro).
//   signedFormula(formula): "+1d4" a partir de "1d4".
//
// DECISÕES E ARMADILHAS
//   - As perícias vêm primeiro (são o caso comum) e o teste puro fecha a lista.
//   - O total soma o que é número; o que é dado aparece ao lado ("+7 +1d4"). Um
//     efeito opcional (desligado por padrão) aparece riscado e não soma.
//   - Ligar ou desligar um efeito é na rolagem, que vem a seguir; aqui só se vê.
//   - A legenda só aparece quando há mais de um grupo, e só lista os que aparecem.
// -----------------------------------------------------------------------------

import { useMemo } from 'react';
import { testBreakdown } from '../../engine/playChecks';
import { formatBonus } from '../../engine/math';
import { ABILITY_FULL, SKILL_LABEL } from '../builder/labels';
import { useDialogClose } from '../common/dialogContext';
import styles from './SkillCheckPanel.module.css';

/** "+1d4" a partir de "1d4" (o sinal que já existe fica). */
const signedFormula = (formula) => (/^[+-]/.test(String(formula).trim()) ? String(formula).trim() : `+${String(formula).trim()}`);

/** Uma linha: a perícia, o total e as peças. */
function Row({ name, prof, breakdown, onPick }) {
  const { fixed, rolled, conditional, total } = breakdown;
  return (
    <li>
      <button type="button" className={styles.row} onClick={onPick}>
        <span className={styles.head}>
          {prof != null && (
            <span className={prof >= 2 ? `${styles.dot} ${styles.dotExpert}` : prof >= 1 ? `${styles.dot} ${styles.dotProf}` : styles.dot} aria-hidden="true" />
          )}
          <span className={styles.name}>{name}</span>
          <span className={styles.total}>
            {formatBonus(total)}
            {rolled.filter((r) => r.on).map((r) => <span key={r.label} className={styles.totalDice}> {signedFormula(r.formula)}</span>)}
          </span>
        </span>
        <span className={styles.chips}>
          {fixed.map((p) => <span key={p.label} className={styles.chip}>{p.label} {formatBonus(p.value)}</span>)}
          {rolled.map((r) => (
            <span key={r.label} className={r.on ? `${styles.chip} ${styles.rolled}` : `${styles.chip} ${styles.rolled} ${styles.off}`}>{r.label} {signedFormula(r.formula)}</span>
          ))}
          {conditional.map((c) => (
            <span key={c.label} className={c.on ? `${styles.chip} ${styles.cond}` : `${styles.chip} ${styles.cond} ${styles.off}`}>
              {c.label}{typeof c.value === 'number' ? ` ${formatBonus(c.value)}` : c.formula ? ` ${signedFormula(c.formula)}` : c.text && !c.label.toLowerCase().includes(c.text) ? `: ${c.text}` : ''}
            </span>
          ))}
        </span>
      </button>
    </li>
  );
}

/**
 * O seletor de perícia de um atributo.
 * @param {{ catalog: object, state: object, ability: string }} props
 */
export default function SkillCheckPanel({ catalog, state, ability }) {
  const close = useDialogClose();
  const abilityName = ABILITY_FULL[ability] ?? ability;
  const rows = useMemo(() => {
    const skills = (catalog.checks?.skills ?? [])
      .filter((s) => s.ability === ability)
      .map((s) => ({ key: s.skill, name: SKILL_LABEL[s.skill] ?? s.skill, prof: s.prof, test: { type: 'skill', id: s.skill } }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const raw = { key: 'raw', name: `${abilityName} (no skill)`, prof: null, test: { type: 'ability', id: ability }, rollName: `${abilityName} check` };
    return [...skills, raw].map((r) => ({ ...r, breakdown: testBreakdown(catalog, state, r.test) }));
  }, [catalog, state, ability, abilityName]);

  const has = (k) => rows.some((r) => r.breakdown[k].length > 0);

  return (
    <div className={styles.panel}>
      {(has('rolled') || has('conditional')) && (
        <p className={styles.legend}>
          <span className={styles.chip}>Fixed</span>
          {has('rolled') && <span className={`${styles.chip} ${styles.rolled}`}>Rolled</span>}
          {has('conditional') && <span className={`${styles.chip} ${styles.cond}`}>Temporary or conditional</span>}
        </p>
      )}
      <ul className={styles.list}>
        {rows.map((r) => (
          <Row key={r.key} name={r.name} prof={r.prof} breakdown={r.breakdown} onPick={() => close({ test: r.test, name: r.rollName ?? r.name })} />
        ))}
      </ul>
    </div>
  );
}
