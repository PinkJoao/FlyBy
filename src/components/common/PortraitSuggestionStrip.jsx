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
//   PortraitSuggestionStrip(props): a faixa, dentro de uma barreira de erro.
//   StripBody(props): o corpo da faixa.
//
// DECISÕES E ARMADILHAS
//   - Altura fixa e largura natural: a miniatura não corta a imagem (DDL-0127).
//     A miniatura é o `thumb` do item e a prévia o `url` (cada fonte diz os seus
//     modelos no manifesto, DDL-0137).
//   - Usa o mesmo cache do índice da galeria (usePortraitIndex): abrir "See all"
//     depois não baixa de novo.
//   - Prefere os que casam todas as tags da ficha (o ranqueamento já os põe na
//     frente).
//   - A roda do mouse rola a fileira de lado sem Shift (`data-wheel-x`, o ouvinte
//     global de src/wheelScroll.js, DDL-0130).
//   - Embaixo, a busca guiada (PortraitSearchLinks, DDL-0137), que funciona mesmo
//     sem catálogo.
//   - Sem índice (carregando ou com erro) a faixa mostra placeholders ou some;
//     "See all" continua lá e a galeria trata o erro com "Try again".
// -----------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import { characterPortraitTags, rankPortraits } from '../../engine/portraitSuggestions';
import { openPortraitPreview } from './portraitPreview';
import PortraitSearchLinks from './PortraitSearchLinks';
import Button from './Button';
import ErrorBoundary from './ErrorBoundary';
import Icon from './Icon';
import { usePortraitIndex } from './usePortraitIndex';
import styles from './PortraitSuggestionStrip.module.css';

const COUNT = 8;

/**
 * Faixa de retratos sugeridos com "See all".
 * @param {{ character: object, onSelect: (item: object) => void, onSeeAll: () => void }} props
 */
export default function PortraitSuggestionStrip(props) {
  return (
    <ErrorBoundary>
      <StripBody {...props} />
    </ErrorBoundary>
  );
}

/** O corpo da faixa (dentro da barreira de erro). */
function StripBody({ character, onSelect, onSeeAll }) {
  const { data, failed } = usePortraitIndex();
  const [seed] = useState(() => Math.floor(Math.random() * 100000));

  const tags = useMemo(() => characterPortraitTags(character), [character]);
  const items = useMemo(() => {
    if (!data) return [];
    return rankPortraits(data, tags, { seed, limit: COUNT }).items;
  }, [data, tags, seed]);


  return (
    <div className={styles.strip}>
      <div className={styles.head}>
        <span className={styles.title}>
          <Icon name="sparkles" />
          Suggested for this character
        </span>
        <Button variant="link" size="sm" onClick={onSeeAll}>
          See all
        </Button>
      </div>
      {!failed && (
        <div className={styles.row} data-wheel-x="">
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
                  <img src={it.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" />
                </button>
              ))}
        </div>
      )}
      <PortraitSearchLinks tags={tags} />
    </div>
  );
}
