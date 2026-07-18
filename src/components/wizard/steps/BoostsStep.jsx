// =============================================================================
// BoostsStep - os aumentos de atributo do background (Fase D2, passo 5b)
// =============================================================================
// Separado do passo de scores para dar espaço à explicação. O background 2024
// concede +2/+1 (a duas habilidades) OU +1/+1/+1 (a três). Reusa o modelo da
// BackgroundTab (mode + ClearableSelect por linha) e escreve `origin.abilityBoosts`
// - nenhuma regra nova (guard-rail DDL-0013). Mostra o resultado ao vivo por
// habilidade (base + boost = total), com `derived` como fonte dos totais.
// -----------------------------------------------------------------------------

import { useEffect } from 'react';
import { ABILITIES } from '../../../schema/character';
import { formatBonus } from '../../../engine/math';
import { ABILITY_FULL } from '../../builder/labels';
import ClearableSelect from '../../common/ClearableSelect';
import styles from './steps.module.css';

/** Deriva o modo a partir do array salvo (mesma lógica da BackgroundTab). */
function boostMode(boosts) {
  if (!boosts || boosts.length === 0) return '2-1';
  return boosts.some((b) => b.amount === 2) ? '2-1' : '1-1-1';
}

export default function BoostsStep({ character, derived, onChange }) {
  const origin = character.origin;
  const boosts = origin.abilityBoosts ?? [];
  const mode = boostMode(boosts);
  const usedByBoost = new Set(boosts.map((b) => b.ability).filter(Boolean));

  const setMode = (m) => {
    const next = m === '2-1' ? [{ ability: '', amount: 2 }, { ability: '', amount: 1 }]
      : [{ ability: '', amount: 1 }, { ability: '', amount: 1 }, { ability: '', amount: 1 }];
    onChange({ ...character, origin: { ...origin, abilityBoosts: next } });
  };
  const setBoostAbility = (i, ability) =>
    onChange({ ...character, origin: { ...origin, abilityBoosts: boosts.map((b, x) => (x === i ? { ...b, ability } : b)) } });

  // Padrão +2/+1 já vem preparado (linhas prontas para escolher a habilidade).
  useEffect(() => {
    if (boosts.length === 0) setMode('2-1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const boostFor = (a) => boosts.filter((b) => b.ability === a).reduce((s, b) => s + b.amount, 0);

  return (
    <div className={styles.step}>
      <p className={styles.callout}>
        Your Ability Boosts reflect the physical conditioning, mental training, and social talents 
        you <strong>developed</strong> through your <strong>past experiences</strong> and <strong>background</strong>.
        Choose one of two spreads: <strong>+2 and +1</strong> to two different abilities, or
        <strong> +1 to three</strong> different abilities. Put them where your class needs them most.
      </p>

      {/* Modo */}
      <div className={styles.methods}>
        <button type="button" className={mode === '2-1' ? `${styles.methodBtn} ${styles.methodActive}` : styles.methodBtn} onClick={() => setMode('2-1')}>
          +2 | +1
        </button>
        <button type="button" className={mode === '1-1-1' ? `${styles.methodBtn} ${styles.methodActive}` : styles.methodBtn} onClick={() => setMode('1-1-1')}>
          +1 | +1 | +1
        </button>
      </div>

      {/* Escolha das habilidades que recebem cada aumento */}
      <div className={styles.boostRows}>
        {boosts.map((b, i) => (
          <div className={styles.boostRow} key={i}>
            <span className={styles.boostAmount}>+{b.amount}</span>
            <ClearableSelect value={b.ability} onChange={(v) => setBoostAbility(i, v)} placeholder="Choose ability…">
              {ABILITIES.filter((x) => !usedByBoost.has(x) || x === b.ability).map((x) => (
                <option key={x} value={x}>{ABILITY_FULL[x]}</option>
              ))}
            </ClearableSelect>
          </div>
        ))}
      </div>

      {/* Resultado ao vivo: base + boost = total (mod) por habilidade */}
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Result</span>
        <div className={styles.abilityGrid}>
          {ABILITIES.map((a) => {
            const boost = boostFor(a);
            return (
              <div className={styles.resultRow} key={a}>
                <span className={styles.abilityName}>{ABILITY_FULL[a]}</span>
                <span className={styles.boostBase}>{character.scores[a]}</span>
                <span className={boost ? styles.boostBadge : styles.boostBadgeEmpty}>{boost ? `+${boost}` : '-'}</span>
                <span className={styles.abilityTotal}>{derived.scores[a]}</span>
                <span className={styles.abilityMod}>{formatBonus(derived.modifiers[a])}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
