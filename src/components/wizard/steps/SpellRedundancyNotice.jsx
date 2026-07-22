// =============================================================================
// SpellRedundancyNotice - sugestão do guia sobre magias obtidas em duplicidade
// =============================================================================
// QoL para novatos: quando o personagem GANHA uma magia sempre-preparada (via
// subclasse/talento/raça) e TAMBÉM a tem por outra via - preparada à mão numa
// outra classe (multiclasse) ou concedida por outra fonte (Magic Initiate) -,
// esta faixa chama atenção. Preparar a mesma magia por múltiplas vias é legal e
// às vezes desejado, então é APENAS uma sugestão: nada é bloqueado nem removido.
// -----------------------------------------------------------------------------

import { useMemo } from 'react';
import { redundantPreparations } from '../../../engine/spellcasting';
import { spellLevelLabel } from '../../../engine/spells';
import styles from './steps.module.css';

/** Junta rótulos em "A", "A and B", "A, B, and C". */
function joinLabels(labels) {
  if (labels.length <= 1) return labels[0] ?? '';
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

/**
 * @param {object} props
 * @param {Array}  props.origins  derived.spellcasting.origins (TODAS as origens)
 * @param {'cantrip'|'leveled'|'all'} [props.filter='all']  quais círculos mostrar
 *   (a tela de cantrips mostra só nível 0; a de magias, só ≥1; o level-up, ambos).
 */
export default function SpellRedundancyNotice({ origins, filter = 'all' }) {
  const items = useMemo(() => {
    const all = redundantPreparations(origins);
    if (filter === 'cantrip') return all.filter((r) => r.level === 0);
    if (filter === 'leveled') return all.filter((r) => r.level >= 1);
    return all;
  }, [origins, filter]);

  if (items.length === 0) return null;

  return (
    <div className={styles.suggestion}>
      <p className={styles.suggestionHead}>💡 Some spells overlap</p>
      <ul className={styles.suggestionList}>
        {items.map((r) => {
          const granted = joinLabels(r.grantedFrom);
          const noun = r.level === 0 ? 'cantrip' : `${spellLevelLabel(r.level).toLowerCase()} spell`;
          return (
            <li key={r.name.toLowerCase()}>
              {r.alsoFrom.length > 0 ? (
                <>
                  Your <strong>{granted}</strong> already grants <strong>{r.name}</strong> for
                  free (always prepared), but you also prepared it in{' '}
                  <strong>{joinLabels(r.alsoFrom)}</strong>. It's uncommon to need the same {noun}{' '}
                  twice - you could swap that copy for a different one.
                </>
              ) : (
                <>
                  <strong>{r.name}</strong> is granted for free by more than one source (
                  <strong>{granted}</strong>). It's uncommon to need the same {noun} twice - you
                  might change one of those for something else.
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
