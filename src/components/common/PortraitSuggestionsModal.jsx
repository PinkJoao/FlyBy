// =============================================================================
// PortraitSuggestionsModal: galeria de sugestões de retrato a partir da ficha
// =============================================================================
// O QUE FAZ
//   Exibe a galeria de retratos sugeridos para o personagem a partir do índice
//   estático (`src/data/portraitsIndex.json`, carregado via import dinâmico só
//   ao abrir o modal). Pré-marca as tags extraídas da ficha (espécie, linhagem,
//   classe, subclasse, armadura, armas e focos), embaralha a ordem dentro de
//   cada faixa de relevância a cada abertura do modal e permite alternar gênero
//   e faixa etária ou adicionar/remover tags livremente.
//
// FUNÇÕES
//   loadPortraitIndex(): importa e mantém em cache o portraitsIndex.json.
//   sameTagSet(a, b): verifica se duas listas de tags possuem os mesmos itens.
//   PortraitSuggestionsModal(props): o componente do modal.
//
// DECISÕES E ARMADILHAS
//   - Carregamento sob demanda (`import('../../data/portraitsIndex.json')`): não
//     pesa no pacote inicial do app; baixa apenas quando o usuário abre a galeria.
//   - Liberdade com filtros pré-marcados (§6.4): a galeria abre com as tags da
//     ficha ativas (incluindo armadura equipada como chip normal), mas qualquer
//     chip pode ser removido ou adicionado livremente.
//   - Embaralhamento automático ao abrir: `seed` nasce com um inteiro aleatório a
//     cada montagem do modal, renovando os retratos de mesma pontuação sem botão
//     manual de Shuffle.
//   - Imagens que falharem no carregamento (`onError`) entram em `brokenHashes` e
//     somem da grade na hora, sem ícone de imagem quebrada.
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import {
  characterPortraitTags,
  rankPortraits,
  tagCategoryOf,
  tagLabelOf,
} from '../../engine/portraitSuggestions';
import { useBackLayer } from '../../hooks/useBack';
import Icon from './Icon';
import SegmentedControl from './SegmentedControl';
import styles from './PortraitSuggestionsModal.module.css';

const PAGE_SIZE = 24;
const GENDER_GROUP = ['male', 'female'];
const AGE_GROUP = ['young', 'mature'];
const ARMOR_GROUP = ['heavy-armor', 'medium-armor', 'light-armor', 'robes'];
const QUICK_SET = new Set([...GENDER_GROUP, ...AGE_GROUP]);

let cachedIndexPromise = null;

/** Carrega e mantém em cache o índice estático de retratos. */
function loadPortraitIndex() {
  if (!cachedIndexPromise) {
    cachedIndexPromise = import('../../data/portraitsIndex.json').then((m) => m.default ?? m);
  }
  return cachedIndexPromise;
}

/** Verifica se duas listas de tags contêm exatamente os mesmos elementos. */
function sameTagSet(a, b) {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((x) => setB.has(x));
}

/**
 * Modal de sugestões de retratos baseado nas escolhas do personagem.
 * @param {{ character: object, onSelect: (url: string) => void, onClose: () => void }} props
 */
export default function PortraitSuggestionsModal({ character, onSelect, onClose }) {
  useBackLayer(true, onClose);

  const defaultTags = useMemo(() => characterPortraitTags(character), [character]);
  const [activeTags, setActiveTags] = useState(() => defaultTags);
  const [indexData, setIndexData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seed] = useState(() => Math.floor(Math.random() * 100000));
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [tagQuery, setTagQuery] = useState('');
  const [brokenHashes, setBrokenHashes] = useState(() => new Set());

  useEffect(() => {
    let alive = true;
    loadPortraitIndex()
      .then((data) => {
        if (!alive) return;
        setIndexData(data);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const toggleExclusiveGroup = (tag, group) => {
    setActiveTags((prev) => {
      const has = prev.includes(tag);
      const withoutGroup = prev.filter((t) => !group.includes(t));
      return has ? withoutGroup : [...withoutGroup, tag];
    });
    setVisibleCount(PAGE_SIZE);
  };

  const removeTag = (tag) => {
    setActiveTags((prev) => prev.filter((t) => t !== tag));
    setVisibleCount(PAGE_SIZE);
  };

  const addTag = (tag) => {
    if (GENDER_GROUP.includes(tag)) {
      toggleExclusiveGroup(tag, GENDER_GROUP);
    } else if (AGE_GROUP.includes(tag)) {
      toggleExclusiveGroup(tag, AGE_GROUP);
    } else if (ARMOR_GROUP.includes(tag)) {
      toggleExclusiveGroup(tag, ARMOR_GROUP);
    } else {
      setActiveTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
      setVisibleCount(PAGE_SIZE);
    }
    setTagQuery('');
  };

  const resetTags = () => {
    setActiveTags(defaultTags);
    setVisibleCount(PAGE_SIZE);
  };

  const ranked = useMemo(() => {
    if (!indexData) return { totalMatched: 0, items: [] };
    return rankPortraits(indexData, activeTags, { seed, limit: 240 });
  }, [indexData, activeTags, seed]);

  const filteredItems = useMemo(
    () => ranked.items.filter((item) => !brokenHashes.has(item.hash)),
    [ranked.items, brokenHashes],
  );

  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount],
  );

  const matchingSuggestions = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    if (!q || !indexData?.tags) return [];
    const activeSet = new Set(activeTags);
    const pool = [...new Set([...indexData.tags, ...ARMOR_GROUP])];
    return pool
      .filter((t) => !activeSet.has(t))
      .filter((t) => t.includes(q) || tagLabelOf(t).toLowerCase().includes(q))
      .slice(0, 12);
  }, [tagQuery, indexData, activeTags]);

  const chipTags = activeTags.filter((t) => !QUICK_SET.has(t));
  const isModified = !sameTagSet(activeTags, defaultTags);

  const markBroken = (hash) => {
    setBrokenHashes((prev) => {
      const next = new Set(prev);
      next.add(hash);
      return next;
    });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.panel} motion-pop`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <h2 className={styles.headTitle}>
            <Icon name="sparkles" />
            <span>Suggested portraits</span>
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        <div className={styles.controls}>
          <div className={styles.quickRow}>
            <div className={styles.quickGroup}>
              <span className={styles.quickLabel}>Gender</span>
              <SegmentedControl
                equal
                ariaLabel="Gender"
                value={GENDER_GROUP.find((g) => activeTags.includes(g)) ?? null}
                options={GENDER_GROUP.map((g) => [g, tagLabelOf(g)])}
                onChange={(g) => toggleExclusiveGroup(g, GENDER_GROUP)}
              />
            </div>

            <div className={styles.quickGroup}>
              <span className={styles.quickLabel}>Age</span>
              <SegmentedControl
                equal
                ariaLabel="Age"
                value={AGE_GROUP.find((a) => activeTags.includes(a)) ?? null}
                options={AGE_GROUP.map((a) => [a, tagLabelOf(a)])}
                onChange={(a) => toggleExclusiveGroup(a, AGE_GROUP)}
              />
            </div>
          </div>

          <div className={styles.tagsSection}>
            <div className={styles.tagsRow}>
              {chipTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={styles.tagChip}
                  onClick={() => removeTag(t)}
                  title={`Remove ${tagLabelOf(t)}`}
                >
                  <span>{tagLabelOf(t)}</span>
                  <span className={styles.tagChipRemove}>
                    <Icon name="close" />
                  </span>
                </button>
              ))}
              {isModified && (
                <button type="button" className={styles.resetBtn} onClick={resetTags}>
                  Reset to sheet
                </button>
              )}
            </div>

            <div className={styles.addWrap}>
              <input
                type="text"
                className={styles.addInput}
                placeholder="+ Add tag"
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
              />
              {matchingSuggestions.length > 0 && (
                <div className={styles.suggestionsDropdown}>
                  {matchingSuggestions.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={styles.suggestionOption}
                      onClick={() => addTag(t)}
                    >
                      <span>{tagLabelOf(t)}</span>
                      <span className={styles.suggestionOptionCat}>{tagCategoryOf(t)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.statusRow}>
          <span className={styles.countText}>
            {loading
              ? 'Loading portrait catalog…'
              : `${ranked.totalMatched.toLocaleString('en-US')} matching portraits · sorted by relevance`}
          </span>
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.emptyState}>Loading suggestions…</div>
          ) : visibleItems.length === 0 ? (
            <div className={styles.emptyState}>
              No portraits matched this combination. Try removing a filter or resetting to the sheet.
            </div>
          ) : (
            <>
              <div className={styles.grid}>
                {visibleItems.map((item) => (
                  <button
                    key={item.hash}
                    type="button"
                    className={styles.card}
                    onClick={() => onSelect(item.url)}
                    title={item.matchedTags.map(tagLabelOf).join(' · ')}
                  >
                    <img
                      className={styles.cardImg}
                      src={item.url}
                      alt="Suggested portrait"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={() => markBroken(item.hash)}
                    />
                    <div className={styles.cardBadges}>
                      {item.matchedTags.slice(0, 3).map((t) => (
                        <span key={t} className={styles.cardBadge}>
                          {tagLabelOf(t)}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>

              {visibleCount < filteredItems.length && (
                <div className={styles.moreRow}>
                  <button
                    type="button"
                    className={styles.moreBtn}
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  >
                    Show more ({filteredItems.length - visibleCount} more)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
