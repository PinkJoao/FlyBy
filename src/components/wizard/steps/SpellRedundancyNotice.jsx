// =============================================================================
// SpellRedundancyNotice: a sugestão do guia sobre magias obtidas em duplicidade
// =============================================================================
// O QUE FAZ
//   Quando o personagem ganha uma magia sempre-preparada e TAMBÉM a tem por outra
//   via, esta faixa chama a atenção (DDL-0048). É legal e às vezes desejado, então
//   é só sugestão: nada é bloqueado nem removido.
//
// FUNÇÕES
//   joinLabels(labels): "A, B, and C".
//   SpellRedundancyNotice(props): a faixa (`filter`: cantrips, de círculo ou ambos).
// -----------------------------------------------------------------------------

import { useMemo } from 'react';
import { redundantPreparations } from '../../../engine/spellcasting';
import { spellLevelLabel } from '../../../engine/spells';
import styles from './steps.module.css';
import Icon from '../../common/Icon';

/** Junta rótulos em "A", "A and B", "A, B, and C". */
function joinLabels(labels) {
  if (labels.length <= 1) return labels[0] ?? '';
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

/**
 * A faixa de sugestão de magias duplicadas.
 * @param {object} props
 * @param {Array} props.origins
 * @param {'cantrip'|'leveled'|'all'} [props.filter='all']
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
      <p className={styles.suggestionHead}><Icon name="idea" /> Some spells overlap</p>
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
