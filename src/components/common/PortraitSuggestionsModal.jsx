// =============================================================================
// PortraitSuggestionsModal: galeria de sugestões de retrato a partir da ficha
// =============================================================================
// O QUE FAZ
//   Exibe a galeria de retratos sugeridos para o personagem a partir do índice
//   estático (`src/data/portraitsIndex.json`, via usePortraitIndex). Pré-marca as
//   tags extraídas da ficha (espécie, linhagem, classe, subclasse, armadura, armas
//   e focos), embaralha a ordem dentro de cada faixa de relevância a cada abertura
//   e permite alternar gênero e idade e escolher tags no seletor visual
//   (PortraitTagPicker). A grade mostra a imagem INTEIRA (colunas no estilo
//   alvenaria), em duas faixas: "Matches every tag" e "Close matches". Tocar num
//   retrato abre a prévia em tela cheia (openPortraitPreview): carrossel com
//   deslize e setas, X para recusar e check para usar.
//
// FUNÇÕES
//   sameTagSet(a, b): verifica se duas listas de tags possuem os mesmos itens.
//   PortraitSuggestionsModal(props): o componente do modal.
//     requestClose, toggleExclusiveGroup, toggleTag, resetTags, openPreview,
//     onBodyScroll: a saída animada, os filtros, a prévia e o recolher dos
//     controles.
//   useColumnCount(ref, minWidth): quantas colunas cabem na largura do elemento.
//   MasonryGrid(props): distribui os cartões em colunas, na ordem de relevância.
//   PortraitCard(props): o cartão com placeholder animado até a imagem carregar.
//
// DECISÕES E ARMADILHAS
//   - Sem corte (DDL-0127): `object-fit: cover` num cartão 3/4 cortava rosto e
//     cabeça. As colunas recebem os itens em rodízio (i % colunas), então a leitura
//     por linhas segue a relevância; cada imagem tem a altura natural. Antes de
//     carregar, o cartão guarda 3/4 com o placeholder, para não nascer com altura 0.
//   - Faixas: a pontuação soma qualquer tag que case, então o total CRESCIA ao
//     marcar mais uma tag. A contagem do topo é a de quem casa TODAS (`full`); os
//     outros vêm depois, como parecidos, com os selos do que casaram (na primeira
//     faixa os selos seriam iguais em todo cartão, então não aparecem).
//   - Prévia antes de aplicar: um toque sem querer ao rolar no celular trocava o
//     retrato. O carrossel da prévia é a lista ranqueada inteira (setas e swipe),
//     não só os cartões já montados.
//   - Saída animada como a dos diálogos (DialogHost): `requestClose` põe .closing
//     por EXIT_MS e só então fecha; com "reduzir movimento", fecha na hora. O
//     voltar do celular, o X, o clique fora e o Escape passam todos por ela.
//   - Rolagem infinita por IntersectionObserver com a própria grade como raiz; o
//     ranqueamento devolve até RANK_LIMIT.
//   - Controles recolhem ao rolar para baixo no celular (`compact`, com histerese
//     de SCROLL_SLACK px) e voltam ao rolar para cima ou no topo: no celular eles
//     ocupavam 40% da altura.
//   - Embaralhamento automático ao abrir: `seed` nasce com um inteiro aleatório a
//     cada montagem do modal.
//   - Escape e o voltar do celular fecham a camada de cima: o seletor de tags tem
//     a própria (useBackLayer e Escape nele), e o modal ignora o Escape enquanto o
//     seletor está aberto.
//   - Imagens que falharem no carregamento (`onError`) entram em `brokenHashes` e
//     somem da grade na hora, sem ícone de imagem quebrada.
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  characterPortraitTags,
  portraitTagGroups,
  rankPortraits,
  tagLabelOf,
} from '../../engine/portraitSuggestions';
import { useBackLayer } from '../../hooks/useBack';
import useMediaQuery from '../../hooks/useMediaQuery';
import { reducedMotion } from '../../motion';
import { openPortraitPreview } from './portraitPreview';
import Collapse from './Collapse';
import Icon from './Icon';
import PortraitTagPicker from './PortraitTagPicker';
import SegmentedControl from './SegmentedControl';
import { usePortraitIndex } from './usePortraitIndex';
import styles from './PortraitSuggestionsModal.module.css';

const PAGE_SIZE = 24;
const RANK_LIMIT = 600;
const SCROLL_SLACK = 32;
const EXIT_MS = 120;
const GENDER_GROUP = ['male', 'female'];
const AGE_GROUP = ['young', 'mature'];
const ARMOR_GROUP = ['heavy-armor', 'medium-armor', 'light-armor', 'robes'];
const QUICK_SET = new Set([...GENDER_GROUP, ...AGE_GROUP]);

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
  const [closing, setClosing] = useState(false);
  const requestClose = () => {
    if (closing) return;
    if (reducedMotion()) {
      onClose();
      return;
    }
    setClosing(true);
    setTimeout(onClose, EXIT_MS);
  };
  useBackLayer(true, requestClose);
  const narrow = useMediaQuery('(max-width: 560px)');
  const { data: indexData, loading, failed, retry } = usePortraitIndex();

  const defaultTags = useMemo(() => characterPortraitTags(character), [character]);
  const [activeTags, setActiveTags] = useState(() => defaultTags);
  const [seed] = useState(() => Math.floor(Math.random() * 100000));
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [brokenHashes, setBrokenHashes] = useState(() => new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const bodyRef = useRef(null);
  const sentinelRef = useRef(null);
  const scrollRef = useRef({ last: 0, anchor: 0, down: true });

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (!pickerOpen) requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const changeTags = (fn) => {
    setActiveTags(fn);
    setVisibleCount(PAGE_SIZE);
    bodyRef.current?.scrollTo({ top: 0 });
  };

  const toggleExclusiveGroup = (tag, group) => {
    changeTags((prev) => {
      const has = prev.includes(tag);
      const withoutGroup = prev.filter((t) => !group.includes(t));
      return has ? withoutGroup : [...withoutGroup, tag];
    });
  };

  const toggleTag = (tag) => {
    if (ARMOR_GROUP.includes(tag)) {
      toggleExclusiveGroup(tag, ARMOR_GROUP);
      return;
    }
    changeTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const resetTags = () => changeTags(() => defaultTags);

  const ranked = useMemo(() => {
    if (!indexData) return { totalMatched: 0, fullMatched: 0, items: [] };
    return rankPortraits(indexData, activeTags, { seed, limit: RANK_LIMIT });
  }, [indexData, activeTags, seed]);

  const tagGroups = useMemo(() => portraitTagGroups(indexData), [indexData]);

  const filteredItems = useMemo(
    () => ranked.items.filter((item) => !brokenHashes.has(item.hash)),
    [ranked.items, brokenHashes],
  );
  const visibleItems = useMemo(() => filteredItems.slice(0, visibleCount), [filteredItems, visibleCount]);
  const fullItems = visibleItems.filter((item) => item.full);
  const closeItems = visibleItems.filter((item) => !item.full);
  const hasMore = visibleCount < filteredItems.length;

  useEffect(() => {
    const root = bodyRef.current;
    const target = sentinelRef.current;
    if (!root || !target || !hasMore || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisibleCount((c) => c + PAGE_SIZE);
      },
      { root, rootMargin: '600px 0px' },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [hasMore, visibleItems.length]);

  const onBodyScroll = (e) => {
    if (!narrow) return;
    const top = e.currentTarget.scrollTop;
    const s = scrollRef.current;
    const down = top > s.last;
    if (down !== s.down) {
      s.down = down;
      s.anchor = s.last;
    }
    if (top < 8) setCompact(false);
    else if (down && top - s.anchor > SCROLL_SLACK) setCompact(true);
    else if (!down && s.anchor - top > SCROLL_SLACK) setCompact(false);
    s.last = top;
  };

  const openPreview = (item) => openPortraitPreview(filteredItems, filteredItems.indexOf(item), onSelect);

  const markBroken = (hash) => {
    setBrokenHashes((prev) => new Set(prev).add(hash));
  };

  const chipTags = activeTags.filter((t) => !QUICK_SET.has(t));
  const isModified = !sameTagSet(activeTags, defaultTags);
  const closeCount = ranked.totalMatched - ranked.fullMatched;

  return (
    <div className={closing ? `${styles.overlay} ${styles.closing}` : styles.overlay} onClick={requestClose}>
      <div className={`${styles.panel} motion-pop`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <h2 className={styles.headTitle}>
            <Icon name="sparkles" />
            <span>Suggested portraits</span>
          </h2>
          <button type="button" className={styles.closeBtn} onClick={requestClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        <Collapse open={!narrow || !compact}>
          <div className={styles.controls}>
            <div className={styles.quickRow}>
              <SegmentedControl
                equal
                size="sm"
                ariaLabel="Gender"
                value={GENDER_GROUP.find((g) => activeTags.includes(g)) ?? null}
                options={GENDER_GROUP.map((g) => [g, tagLabelOf(g)])}
                onChange={(g) => toggleExclusiveGroup(g, GENDER_GROUP)}
              />
              <SegmentedControl
                equal
                size="sm"
                ariaLabel="Age"
                value={AGE_GROUP.find((a) => activeTags.includes(a)) ?? null}
                options={AGE_GROUP.map((a) => [a, tagLabelOf(a)])}
                onChange={(a) => toggleExclusiveGroup(a, AGE_GROUP)}
              />
            </div>

            <div className={styles.tagsRow}>
              {chipTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={styles.tagChip}
                  onClick={() => toggleTag(t)}
                  title={`Remove ${tagLabelOf(t)}`}
                >
                  <span>{tagLabelOf(t)}</span>
                  <span className={styles.tagChipRemove}>
                    <Icon name="close" />
                  </span>
                </button>
              ))}
              <button
                type="button"
                className={styles.addChip}
                onClick={() => setPickerOpen(true)}
                disabled={!indexData}
              >
                <Icon name="plus" />
                <span>Tag</span>
              </button>
              {isModified && (
                <button type="button" className={styles.resetBtn} onClick={resetTags}>
                  Reset to sheet
                </button>
              )}
            </div>
          </div>
        </Collapse>

        <div className={styles.statusRow}>
          <span className={styles.countText}>
            {loading
              ? 'Loading portrait catalog…'
              : failed
                ? 'The portrait catalog could not be loaded.'
                : `${ranked.fullMatched.toLocaleString('en-US')} match every tag${
                    closeCount > 0 ? ` · ${closeCount.toLocaleString('en-US')} close` : ''
                  }`}
          </span>
        </div>

        <div className={styles.body} ref={bodyRef} onScroll={onBodyScroll}>
          {loading ? (
            <div className={styles.skeletonGrid} aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className={styles.skeleton} />
              ))}
            </div>
          ) : failed ? (
            <div className={styles.emptyState}>
              <p>Could not load the portrait catalog. Check your connection and try again.</p>
              <button type="button" className={styles.moreBtn} onClick={retry}>
                Try again
              </button>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className={styles.emptyState}>
              No portraits matched this combination. Try removing a tag or resetting to the sheet.
            </div>
          ) : (
            <>
              {fullItems.length > 0 && (
                <>
                  {closeItems.length > 0 && <h3 className={styles.tierTitle}>Matches every tag</h3>}
                  <MasonryGrid
                    items={fullItems}
                    renderItem={(item) => (
                      <PortraitCard key={item.hash} item={item} onOpen={openPreview} onBroken={markBroken} />
                    )}
                  />
                </>
              )}
              {closeItems.length > 0 && (
                <>
                  <h3 className={styles.tierTitle}>
                    {fullItems.length > 0 ? 'Close matches' : 'Nothing matches every tag · close matches'}
                  </h3>
                  <MasonryGrid
                    items={closeItems}
                    renderItem={(item) => (
                      <PortraitCard
                        key={item.hash}
                        item={item}
                        badges={item.matchedTags}
                        onOpen={openPreview}
                        onBroken={markBroken}
                      />
                    )}
                  />
                </>
              )}
              {hasMore && <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />}
            </>
          )}
        </div>

        {pickerOpen && tagGroups.length > 0 && (
          <PortraitTagPicker
            groups={tagGroups}
            activeTags={activeTags}
            onToggle={toggleTag}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Quantas colunas de pelo menos `minWidth` px cabem na largura do elemento.
 * @param {{ current: HTMLElement|null }} ref
 * @param {number} minWidth
 */
function useColumnCount(ref, minWidth) {
  const [cols, setCols] = useState(2);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setCols(Math.max(2, Math.min(6, Math.floor((w + 10) / (minWidth + 10)))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, minWidth]);
  return cols;
}

/** Distribui os cartões em colunas por rodízio, preservando a ordem por linhas. */
function MasonryGrid({ items, renderItem }) {
  const ref = useRef(null);
  const cols = useColumnCount(ref, 150);
  const columns = Array.from({ length: cols }, () => []);
  items.forEach((item, i) => columns[i % cols].push(item));
  return (
    <div ref={ref} className={styles.masonry}>
      {columns.map((col, c) => (
        <div key={c} className={styles.column}>
          {col.map(renderItem)}
        </div>
      ))}
    </div>
  );
}

/** O cartão de um retrato: placeholder animado até carregar, depois a imagem inteira. */
function PortraitCard({ item, badges, onOpen, onBroken }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <button
      type="button"
      className={loaded ? `${styles.card} ${styles.cardLoaded}` : styles.card}
      onClick={() => onOpen(item)}
      title={item.matchedTags.map(tagLabelOf).join(' · ')}
    >
      <img
        className={styles.cardImg}
        src={item.url}
        alt="Suggested portrait"
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => onBroken(item.hash)}
      />
      {badges?.length > 0 && (
        <span className={styles.cardBadges}>
          {badges.slice(0, 3).map((t) => (
            <span key={t} className={styles.cardBadge}>
              {tagLabelOf(t)}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
