// =============================================================================
// AbilitiesStep - scores base + método (Fase D2, passo 5a)
// =============================================================================
// Só os scores BASE e o método de geração (Point Buy / Standard Array / Manual).
// Os boosts do background moram no passo seguinte (BoostsStep) - separá-los dá
// espaço a texto explicativo em cada um. Os totais/modificadores (base + boosts
// já atribuídos) vêm do `derived`, ao vivo. Métodos são só restrições de entrada
// sobre `character.scores` - a derivação não muda (guard-rail DDL-0013).
// -----------------------------------------------------------------------------

import { ABILITIES } from '../../../schema/character';
import { formatBonus } from '../../../engine/math';
import {
  POINT_BUY_MIN,
  POINT_BUY_MAX,
  pointsRemaining,
  canPointBuyStep,
  initialScores,
  assignStandardArray,
  recommendedScores,
  STANDARD_ARRAY,
} from '../../../engine/abilityMethods';
import { ABILITY_FULL } from '../../builder/labels';
import Stepper from '../../common/Stepper';
import styles from './steps.module.css';

const METHODS = [
  { id: 'point-buy', label: 'Point Buy' },
  { id: 'standard-array', label: 'Standard Array' },
  { id: 'manual', label: 'Manual' },
];

const METHOD_HELP = {
  'point-buy': 'Spend 27 points to raise scores from 8 to 15 for a balanced, fair spread.',
  'standard-array': 'Assign the fixed set 15, 14, 13, 12, 10, 8 across your six abilities.',
  manual: 'Type any scores you like for rolled stats or a custom spread.',
};

const STEPPER = { bg: 'var(--bg)', buttonSize: 26, fontSize: 15, numberColor: 'var(--text-h)', style: { width: '100%' } };

export default function AbilitiesStep({ character, derived, onChange }) {
  const scores = character.scores;
  const method = character.scoreMethod?.type ?? 'manual';
  const classId = character.classes?.[0]?.classId ?? null;

  // Trocar de método reinicia os scores base para o ponto de partida do método
  // - que, quando há classe, é a distribuição recomendada dela (não o genérico).
  const setMethod = (m) => {
    if (m === method) return;
    onChange({ ...character, scoreMethod: { type: m }, scores: initialScores(m, ABILITIES, classId) });
  };
  const setScore = (a, v) => onChange({ ...character, scores: { ...scores, [a]: v } });
  const swapStandard = (a, v) => onChange({ ...character, scores: assignStandardArray(scores, ABILITIES, a, v) });

  const pointsLeft = pointsRemaining(scores, ABILITIES);
  const hasRec = !!recommendedScores(classId);
  const className = classId ? `${classId.charAt(0).toUpperCase()}${classId.slice(1)}` : '';

  return (
    <div className={styles.step}>
      <div className={styles.callout}>
        <p>
          Your six ability scores represent your character's natural physical and mental talents. Each
          ability measures a different aspect of your character:
        </p>
        <ul className={styles.abilityList}>
          <li><strong>Strength:</strong> Physical power, lifting, climbing, and athletic ability.</li>
          <li><strong>Dexterity:</strong> Agility, reflexes, balance and finesse.</li>
          <li><strong>Constitution:</strong> Health, stamina, resilience, and resistance to harm.</li>
          <li><strong>Intelligence:</strong> Knowledge, reasoning, memory, and analysis.</li>
          <li><strong>Wisdom:</strong> Awareness, intuition, perception, and common sense.</li>
          <li><strong>Charisma:</strong> Confidence, presence, leadership, and force of personality.</li>
        </ul>
        <p>
          Select one of the methods below to determine your starting ability scores.
        </p>
      </div>

      {/* Método */}
      <div className={styles.methods}>
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            className={m.id === method ? `${styles.methodBtn} ${styles.methodActive}` : styles.methodBtn}
            onClick={() => setMethod(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className={pointsLeft < 0 && method === 'point-buy' ? `${styles.methodHelp} ${styles.pointsOver}` : styles.methodHelp}>
        {METHOD_HELP[method]}
        {method === 'point-buy' && <> Points left: <strong>{pointsLeft}</strong>.</>}
      </p>
      {hasRec && (
        <p className={styles.methodHelp}>
          Pre-filled with a spread recommended for a <strong>{className}</strong>. Adjust it however you like.
        </p>
      )}

      {/* Grade de atributos: nome · controle base · total (mod) */}
      <div className={styles.abilityGrid}>
        {ABILITIES.map((a) => (
          <div className={styles.abilityRow} key={a}>
            <span className={styles.abilityName}>{ABILITY_FULL[a]}</span>
            <div className={styles.abilityControl}>
              {method === 'standard-array' ? (
                <select className={styles.arraySelect} value={scores[a]} onChange={(e) => swapStandard(a, Number(e.target.value))}>
                  {STANDARD_ARRAY.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              ) : (
                <Stepper
                  value={scores[a]}
                  min={method === 'point-buy' ? POINT_BUY_MIN : 1}
                  max={method === 'point-buy' ? (canPointBuyStep(scores, ABILITIES, a, 1) ? POINT_BUY_MAX : scores[a]) : 30}
                  maxDigits={2}
                  onChange={(n) => setScore(a, n)}
                  ariaLabel={`Base ${ABILITY_FULL[a]}`}
                  {...STEPPER}
                />
              )}
            </div>
            <span className={styles.abilityTotal}>{derived.scores[a]}</span>
            <span className={styles.abilityMod}>{formatBonus(derived.modifiers[a])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
