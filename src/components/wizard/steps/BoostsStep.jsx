// =============================================================================
// BoostsStep: o passo dos aumentos de atributo do background
// =============================================================================
// O QUE FAZ
//   O background 2024 dá +2/+1 ou +1/+1/+1. Usa o BoostPicker da aba (OriginParts) e
//   escreve `origin.abilityBoosts` (DDL-0013), com o +2/+1 preparado por padrão e o
//   resultado ao vivo por habilidade. Com um background pronto, só os três atributos
//   dele (DDL-0328).
//
// FUNÇÕES
//   BoostsStep(props): o passo.
// -----------------------------------------------------------------------------

import StepExplain from './StepExplain';
import { ABILITIES } from '../../../schema/character';
import { formatBonus } from '../../../engine/math';
import { allowedBoostAbilities, backgroundOf } from '../../../engine/backgrounds';
import { BoostPicker } from '../../builder/OriginParts';
import { ABILITY_FULL } from '../../builder/labels';
import styles from './steps.module.css';

export default function BoostsStep({ character, db, derived, onChange }) {
  const origin = character.origin;
  const boosts = origin.abilityBoosts ?? [];
  const bg = backgroundOf(character, db);
  const allowed = allowedBoostAbilities(origin, db);

  const boostFor = (a) => boosts.filter((b) => b.ability === a).reduce((s, b) => s + b.amount, 0);

  return (
    <div className={styles.step}>
      <StepExplain>
        Your Ability Boosts reflect the physical conditioning, mental training, and social talents 
        you <strong>developed</strong> through your <strong>past experiences</strong> and <strong>background</strong>.
        Choose one of two spreads: <strong>+2 and +1</strong> to two different abilities, or
        <strong> +1 to three</strong> different abilities. Put them where your class needs them most.
      </StepExplain>

      {bg && (
        <p className={styles.note}>
          {bg.name} lets you raise {allowed.map((x) => ABILITY_FULL[x]).join(', ').replace(/, ([^,]*)$/, ' or $1')}.
        </p>
      )}

      <BoostPicker character={character} db={db} onChangeOrigin={(o) => onChange({ ...character, origin: o })} />

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
