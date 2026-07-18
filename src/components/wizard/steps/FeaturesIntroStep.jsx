// =============================================================================
// FeaturesIntroStep - transição p/ features/magias (Fase D2, informativa)
// =============================================================================
// Marca o fim da criação "essencial": o personagem já é jogável. O que vem a
// seguir são as escolhas de FEATURES da classe (e magias, se conjurador). Sem
// entrada (status 'info': sem Skip, fora da Revisão). O texto é PERSONALIZADO com
// as escolhas REAIS da classe (via `buildClassChoices`/`isFeatureChoice`) para não
// citar features genéricas que não existem naquela classe.
// -----------------------------------------------------------------------------

import { buildClassChoices, isFeatureChoice } from '../../builder/classChoices';
import styles from './steps.module.css';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Rótulo de escolha → nome limpo p/ prosa: tira o prefixo "Level N - ". */
const cleanLabel = (label) => label.replace(/^Level\s+\d+\s*-\s*/i, '').trim();

/** "A" | "A and B" | "A, B, and C". */
function naturalList(items) {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export default function FeaturesIntroStep({ character, derived, db }) {
  const cls = character.classes?.[0] ?? null;
  const className = cap(cls?.classId) || 'class';
  const isCaster = (derived?.spellcasting?.origins ?? []).length > 0;

  // Rótulos das escolhas REAIS de feature da classe (deduplicados), + magias.
  const featureLabels = cls?.classId
    ? [...new Set(buildClassChoices(db, cls, character).filter(isFeatureChoice).map((c) => cleanLabel(c.label)).filter(Boolean))]
    : [];
  const items = [...featureLabels];
  if (isCaster) items.push('which spells to prepare');

  return (
    <div className={styles.step}>
      <div className={styles.introBlock}>
        <span className={styles.introEmoji}>✨</span>
        <p className={styles.introText}>
          <strong>Your character is ready to play!</strong> Class, species, background, ability
          scores and equipment are all set.
        </p>
        {items.length > 0 ? (
          <p className={styles.introText}>
            One thing left: your <strong>{className}</strong> lets you choose {naturalList(items)}.
            Let's take care of that now.
          </p>
        ) : (
          <p className={styles.introText}>
            Your <strong>{className}</strong> has no extra choices to make right now, so you're all set.
          </p>
        )}
        <p className={styles.introText}>
          Prefer to decide later? You can skip ahead and choose any time on the sheet.
        </p>
      </div>
    </div>
  );
}
