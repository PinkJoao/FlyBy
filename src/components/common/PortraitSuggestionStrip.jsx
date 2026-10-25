// =============================================================================
// PortraitSuggestionStrip: a faixa curta de retratos sugeridos nos escolhedores
// =============================================================================
// O QUE FAZ
//   Mostra, direto no escolhedor de retrato (PortraitSourceModal da página e o
//   passo NamePortraitStep do guia), os primeiros retratos sugeridos para a ficha,
//   com "See all" para a galeria completa (PortraitSuggestionsModal). Tocar num
//   abre a prévia em tela cheia (openPortraitPreview), com X e check.
//
// FUNÇÕES
//   PortraitSuggestionStrip(props): a faixa.
//
// DECISÕES E ARMADILHAS
//   - Altura fixa e largura natural: a miniatura não corta a imagem (DDL-0127).
//     As miniaturas vêm em 236px; a prévia e o retrato aplicado usam 736px.
//   - Usa o mesmo cache do índice da galeria (usePortraitIndex): abrir "See all"
//     depois não baixa de novo.
//   - Prefere os que casam todas as tags da ficha (o ranqueamento já os põe na
//     frente).
//   - Sem índice (carregando ou com erro) a faixa mostra placeholders ou some;
//     "See all" continua lá e a galeria trata o erro com "Try again".
// -----------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import { characterPortraitTags, portraitUrlFromHash, rankPortraits } from '../../engine/portraitSuggestions';
import { openPortraitPreview } from './portraitPreview';
import Icon from './Icon';
import { usePortraitIndex } from './usePortraitIndex';
import styles from './PortraitSuggestionStrip.module.css';

const COUNT = 8;

/**
 * Faixa de retratos sugeridos com "See all".
 * @param {{ character: object, onSelect: (url: string) => void, onSeeAll: () => void }} props
 */
export default function PortraitSuggestionStrip({ character, onSelect, onSeeAll }) {
  const { data, failed } = usePortraitIndex();
  const [seed] = useState(() => Math.floor(Math.random() * 100000));

  const items = useMemo(() => {
    if (!data) return [];
    return rankPortraits(data, characterPortraitTags(character), { seed, limit: COUNT }).items;
  }, [data, character, seed]);


  return (
    <div className={styles.strip}>
      <div className={styles.head}>
        <span className={styles.title}>
          <Icon name="sparkles" />
          Suggested for this character
        </span>
        <button type="button" className={styles.seeAll} onClick={onSeeAll}>
          See all
        </button>
      </div>
      {!failed && (
        <div className={styles.row}>
          {items.length === 0
            ? Array.from({ length: 4 }, (_, i) => <span key={i} className={styles.placeholder} />)
            : items.map((it, i) => (
                <button
                  key={it.hash}
                  type="button"
                  className={styles.thumb}
                  onClick={() => openPortraitPreview(items, i, onSelect)}
                  aria-label={`Preview suggested portrait ${i + 1}`}
                >
                  <img src={portraitUrlFromHash(it.hash, '236x')} alt="" loading="lazy" referrerPolicy="no-referrer" />
                </button>
              ))}
        </div>
      )}
    </div>
  );
}
