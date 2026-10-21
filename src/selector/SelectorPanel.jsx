// =============================================================================
// SelectorPanel: o seletor genérico: busca, filtros e preview
// =============================================================================
// O QUE FAZ
//   Recebe uma ENTITY (entities/*.js: a lista, o precompute, os filtros, o card, o
//   meta, os entries e o fluff de um tipo de conteúdo) e o compêndio, e monta o
//   painel de escolha que o app inteiro usa. Mobile-first: no celular os filtros
//   viram uma gaveta e tocar num card abre a tela de detalhe. É um dos dois
//   choke-points do app (§6.3): o que entra aqui chega a toda aba e passo do guia.
//
//   Props opcionais: a loja troca o rodapé do preview, acrescenta ações por card e
//   uma barra inferior fixa (o carrinho, que recebe `setPreview`);
//   `initialFilterState` pré-marca filtros (senão vale o da própria entity, como
//   as variantes de cenário da espécie); `noPreview` faz a lista navegável do
//   glossário (o toque no card já é a seleção); `title` e `hint` no cabeçalho.
//
// FUNÇÕES
//   cardOf(item, entity, db): os dados de card, com cache.
//   SelectorPanel(props): o painel.
//
// DECISÕES E ARMADILHAS
//   - Os filtros são filtros COMUNS, desmarcáveis: liberdade com aviso (DDL-0040).
//   - Opção FIXA que nenhum item do catálogo carrega é REMOVIDA ("zero SEMPRE",
//     contado no catálogo cru); opção que não alcança nada AGORA vira chip
//     DESABILITADO (facetCounts, "zero AGORA"; DDL-0077, DDL-0078). Catálogo vazio
//     (db carregando) não poda nada. Em dev, uma opção morta ao lado de um valor
//     emitido sem opção acusa um valor DIGITADO errado ("Very Rare" x "Very rare").
//   - Grupo de filtro sem opção some; a busca nos filtros casa a opção ou o grupo;
//     uma opção ATIVA nunca some nem desabilita.
//   - Renderização em levas (RENDER_CHUNK) com um sentinel: a loja (~4700 itens) e
//     o glossário (~7700) travavam o painel. O reset só acontece ao REFINAR (busca,
//     filtros, entity), nunca a cada mudança de resultados (o carrinho da loja muda
//     o `exclude` a cada ajuste e o scroll pularia ao topo). O cardCache evita
//     recalcular cards caros (preço derivado) a cada tecla.
//   - Preview: o hover vence, depois o item fixado, depois o JÁ SELECIONADO na
//     ficha (que trava o preview ao substituir algo; DDL-0048), depois o último
//     hover, depois o primeiro da lista.
//   - No mobile a busca principal some com a gaveta aberta (não filtra nada ali);
//     o puxador fecha arrastando ou tocando, e um arrasto curto não vira clique.
//   - O voltar do celular fecha, nesta ordem, o detalhe, a gaveta de filtros e o
//     painel (três useBackLayer, src/backStack.js).
//   - O tour do seletor (DDL-0069) dispara na 1a abertura de um seletor com preview
//     (o glossário e a loja ficam fora) e, no mobile, DIRIGE a gaveta e o detalhe
//     por `mobileAction` passo a passo; ao terminar, fecha os dois.
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { applyFilters, deriveOptions, cycleOption, facetCounts } from './filterModel';
import DetailView from '../components/common/DetailView';
import BackButton from '../components/common/BackButton';
import useTutorialStore, { maybeStartTutorial } from '../store/tutorialStore';
import { TUT } from '../tutorial/anchors';
import styles from './SelectorPanel.module.css';
import { useBackLayer } from '../hooks/useBack';

const DRAWER_CLOSE_PX = 70;

const RENDER_CHUNK = 120;

const cardCache = new WeakMap();
function cardOf(item, entity, db) {
  let c = cardCache.get(item);
  if (!c) {
    c = entity.card(item.raw, db);
    cardCache.set(item, c);
  }
  return c;
}

const PREREQ_CLASS = { ok: 'preOk', bad: 'preBad', unknown: 'preUnknown' };

const TONE_CLASS = { blue: 'toneBlue', accent: 'toneAccent', red: 'toneRed', neutral: 'toneNeutral' };

export default function SelectorPanel({
  entity,
  db,
  currentId,
  onSelect,
  onClose,
  exclude,
  renderFooter,
  renderCardActions,
  renderBottomBar,
  initialFilterState,
  noPreview,
  heading,
  hint,
}) {
  const [query, setQuery] = useState('');
  const [filterState, setFilterState] = useState(
    initialFilterState ?? entity?.initialFilterState ?? {},
  );
  const [hovered, setHovered] = useState(null);
  const [lastHovered, setLastHovered] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [filterSearchOpen, setFilterSearchOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [dragY, setDragY] = useState(0);

  useBackLayer(true, onClose);
  useBackLayer(showFilters, () => setShowFilters(false));
  useBackLayer(!!detailItem, () => setDetailItem(null));
  const dragStart = useRef(null);
  const dragged = useRef(false);

  const isMobile = () =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;

  useEffect(() => {
    if (noPreview) return undefined;
    const t = setTimeout(() => maybeStartTutorial('selector'), 250);
    return () => clearTimeout(t);
  }, [noPreview]);

  const closeFilters = () => {
    setShowFilters(false);
    setDragY(0);
  };

  const onGrabStart = (e) => {
    dragStart.current = e.clientY;
    dragged.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onGrabMove = (e) => {
    if (dragStart.current == null) return;
    const dy = Math.max(0, e.clientY - dragStart.current);
    if (dy > 4) dragged.current = true;
    setDragY(dy);
  };
  const onGrabEnd = () => {
    if (dragStart.current == null) return;
    const dy = dragY;
    dragStart.current = null;
    if (dy > DRAWER_CLOSE_PX) closeFilters();
    else setDragY(0);
  };
  const onGrabClick = () => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    closeFilters();
  };

  const items = useMemo(() => {
    const raw = entity.list(db);
    return raw.map((r) => ({ id: entity.idOf(r), raw: r, ...entity.precompute(r) }));
  }, [entity, db]);


  const filterOptions = useMemo(() => {
    const declared = {};
    for (const f of entity.filters) {
      declared[f.id] = f.derive
        ? deriveOptions(items, f.id).map((v) => ({ value: v, label: v }))
        : (f.options ?? []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
    }
    if (items.length === 0) return declared;

    const total = facetCounts(items, { filterIds: entity.filters.map((f) => f.id) });
    const out = {};
    for (const f of entity.filters) {
      out[f.id] = declared[f.id].filter((o) => total[f.id][o.value]);

      if (import.meta.env?.DEV && out[f.id].length < declared[f.id].length) {
        const covered = new Set(declared[f.id].map((o) => o.value));
        const uncovered = Object.keys(total[f.id]).filter((v) => !covered.has(v));
        if (uncovered.length) {
          const dead = declared[f.id].filter((o) => !total[f.id][o.value]).map((o) => o.value);
          console.warn(
            `[SelectorPanel] ${entity.type}/${f.id}: opção sem nenhum item (${dead.join(', ')}) ` +
              `enquanto o filtro emite valor sem opção (${uncovered.join(', ')}). ` +
              'Provável divergência entre o valor declarado e o do precompute.',
          );
        }
      }
    }
    return out;
  }, [entity, items]);

  const filtered = useMemo(
    () => applyFilters(items, { query, filterState }),
    [items, query, filterState]
  );

  const counts = useMemo(
    () =>
      facetCounts(items, {
        query,
        filterState,
        filterIds: entity.filters.map((f) => f.id),
      }),
    [items, query, filterState, entity.filters],
  );
  const results = useMemo(
    () => (exclude ? filtered.filter((it) => !exclude(it.raw)) : filtered),
    [filtered, exclude]
  );

  const tourId = useTutorialStore((s) => s.tourId);
  const tourSteps = useTutorialStore((s) => s.steps);
  const tourIndex = useTutorialStore((s) => s.index);

  const tourKey = `${tourId}:${tourIndex}`;
  const [prevTourKey, setPrevTourKey] = useState(tourKey);
  if (prevTourKey !== tourKey) {
    setPrevTourKey(tourKey);
    if (tourId === 'selector' && isMobile()) {
      const action = tourSteps[tourIndex]?.mobileAction ?? null;
      setShowFilters(action === 'filters');
      setDetailItem(action === 'detail' ? results[0]?.raw ?? null : null);
    }
  }

  useEffect(() => {
    if (tourId !== 'selector') return undefined;
    return () => {
      if (isMobile()) {
        setShowFilters(false);
        setDetailItem(null);
      }
    };
  }, [tourId]);

  const [visibleCount, setVisibleCount] = useState(RENDER_CHUNK);
  const resultsRef = useRef(null);
  const sentinelRef = useRef(null);
  const [prevRefine, setPrevRefine] = useState({ query, filterState, entity, db });
  if (
    prevRefine.query !== query ||
    prevRefine.filterState !== filterState ||
    prevRefine.entity !== entity ||
    prevRefine.db !== db
  ) {
    setPrevRefine({ query, filterState, entity, db });
    setVisibleCount(RENDER_CHUNK);
  }
  useEffect(() => {
    resultsRef.current?.scrollTo?.({ top: 0 });
  }, [query, filterState, entity, db]);
  const shown = results.length > visibleCount ? results.slice(0, visibleCount) : results;
  const hasMore = results.length > shown.length;
  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => c + RENDER_CHUNK);
        }
      },
      { root: resultsRef.current, rootMargin: '800px' },
    );
    io.observe(sentinelRef.current);
    return () => io.disconnect();
  }, [hasMore, results, visibleCount]);

  const activeCount = Object.values(filterState).reduce(
    (n, opts) => n + Object.values(opts).filter(Boolean).length,
    0
  );

  const fq = filterQuery.trim().toLowerCase();
  const visibleGroups = useMemo(() => {
    if (!fq) {
      return entity.filters
        .map((f) => ({ f, opts: filterOptions[f.id] }))
        .filter((g) => g.opts.length > 0);
    }
    return entity.filters
      .map((f) => {
        const groupHit = f.header.toLowerCase().includes(fq);
        const opts = filterOptions[f.id].filter(
          (o) => groupHit || o.label.toLowerCase().includes(fq) || filterState[f.id]?.[o.value],
        );
        return { f, opts };
      })
      .filter((g) => g.opts.length > 0);
  }, [entity.filters, filterOptions, fq, filterState]);

  const toggle = (filterId, value) => {
    setFilterState((prev) => {
      const next = { ...prev, [filterId]: { ...(prev[filterId] ?? {}) } };
      const mode = cycleOption(next[filterId][value]);
      if (mode) next[filterId][value] = mode;
      else delete next[filterId][value];
      return next;
    });
  };

  const clearFilters = () => setFilterState({});

  const selectedRaw = useMemo(
    () => (currentId != null ? items.find((it) => it.id === currentId)?.raw ?? null : null),
    [items, currentId],
  );

  const preview = hovered ?? detailItem ?? selectedRaw ?? lastHovered ?? results[0]?.raw ?? null;

  // ATENÇÃO: o portal para document.body é necessário; um ancestral com transform prenderia o painel.
  return createPortal(
    <div className={`${styles.overlay} motion-page`} onClick={onClose}>
      <div className={`${styles.panel} motion-pop`} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2>{heading ?? `Choose ${entity.title}`}</h2>
            {hint && <p className={styles.hint}>{hint}</p>}
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className={showFilters ? `${styles.searchBar} ${styles.searchBarHidden}` : styles.searchBar}>
          <input
            className={styles.search}
            data-tour={TUT.SELECTOR_SEARCH}
            type="search"
            placeholder={`Search ${entity.title.toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus={!isMobile()}
          />
          <button
            type="button"
            className={styles.filterToggle}
            data-tour={TUT.SELECTOR_FILTERS_TOGGLE}
            onClick={() => setShowFilters((v) => !v)}
          >
            Filters{activeCount ? ` (${activeCount})` : ''}
          </button>
        </div>

        <div className={noPreview ? `${styles.body} ${styles.bodyNoPreview}` : styles.body}>
          <aside
            className={`${styles.filters} ${showFilters ? styles.filtersOpen : ''}`}
            data-tour={TUT.SELECTOR_FILTERS}
            style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
          >
            <div
              className={styles.grabber}
              onPointerDown={onGrabStart}
              onPointerMove={onGrabMove}
              onPointerUp={onGrabEnd}
              onPointerCancel={onGrabEnd}
              onClick={onGrabClick}
              role="presentation"
            >
              <span className={styles.grabberBar} />
            </div>

            <div className={styles.filtersHead}>
              <div className={styles.filtersHeadRow}>
                <span className={styles.legend}>
                  <span className={styles.legendRow}>
                    <em className={styles.dotInc} /> include
                  </span>
                  <span className={styles.legendRow}>
                    <em className={styles.dotExc} /> exclude
                  </span>
                </span>
                <span className={styles.filtersActions}>
                  {activeCount > 0 && (
                    <button type="button" className={styles.clear} onClick={clearFilters}>
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    className={filterSearchOpen ? `${styles.filterSearchBtn} ${styles.filterSearchBtnOn}` : styles.filterSearchBtn}
                    onClick={() => {
                      setFilterSearchOpen((v) => !v);
                      if (filterSearchOpen) setFilterQuery('');
                    }}
                    aria-label="Search filters"
                    aria-pressed={filterSearchOpen}
                    title="Search filters"
                  >
                    ⌕
                  </button>
                  <button type="button" className={styles.applyFilters} onClick={closeFilters}>
                    Apply
                  </button>
                </span>
              </div>

              <div className={filterSearchOpen ? styles.filterSearch : `${styles.filterSearch} ${styles.filterSearchHidden}`}>
                <input
                  type="search"
                  className={styles.filterSearchInput}
                  placeholder="Search filters…"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                />
              </div>
            </div>

            {visibleGroups.length === 0 ? (
              <p className={styles.noFilters}>No filters match “{filterQuery}”.</p>
            ) : (
              visibleGroups.map(({ f, opts }) => (
                <div key={f.id} className={styles.filterGroup}>
                  <h3>{f.header}</h3>
                  <div className={styles.chips}>
                    {opts.map((opt) => {
                      const mode = filterState[f.id]?.[opt.value];
                      // ATENÇÃO: opção ATIVA nunca desabilita; senão não daria para desmarcá-la.
                      const empty = !mode && !counts[f.id]?.[opt.value];
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          className={`${styles.chip} ${
                            mode === 'include' ? styles.inc : mode === 'exclude' ? styles.exc : ''
                          } ${empty ? styles.chipEmpty : ''}`}
                          disabled={empty}
                          title={empty ? 'No results with the current filters' : undefined}
                          onClick={() => toggle(f.id, opt.value)}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </aside>

          <main className={styles.results} ref={resultsRef} data-tour={TUT.SELECTOR_RESULTS}>
            <div className={styles.count}>{results.length} result(s)</div>
            <ul className={styles.cards}>
              {shown.map((item) => {
                const card = cardOf(item, entity, db);
                const selected = item.id === currentId;
                const isPinned = detailItem && entity.idOf(detailItem) === item.id;
                const stateCls = `${selected ? styles.cardSel : ''} ${isPinned ? styles.cardPinned : ''}`;
                const info = noPreview
                  ? { onClick: () => onSelect(item.raw) }
                  : {
                      onClick: () => setDetailItem(item.raw),
                      onMouseEnter: () => {
                        setHovered(item.raw);
                        setLastHovered(item.raw);
                      },
                      onMouseLeave: () => setHovered(null),
                    };
                const body = (
                  <>
                    <span className={styles.cardTitle}>{card.title}</span>
                    {card.subtitle && (
                      <span className={styles.cardSub} title={card.subtitleFull}>
                        {card.subtitle}
                      </span>
                    )}
                    {card.meta && <span className={styles.cardMeta}>{card.meta}</span>}
                    {card.rarity && (
                      <span className={styles.badges}>
                        <em
                          className={styles.rarityBadge}
                          style={card.rarity.color ? { color: card.rarity.color, borderColor: card.rarity.color } : undefined}
                        >
                          {card.rarity.label}
                        </em>
                      </span>
                    )}
                    {card.prereqs?.length > 0 && (
                      <span className={styles.badges}>
                        {card.prereqs.map((p, pi) => (
                          <em key={pi} className={`${styles.prereq} ${styles[PREREQ_CLASS[p.status]] ?? ''}`}>
                            {p.text}
                          </em>
                        ))}
                      </span>
                    )}
                    {card.badges?.length > 0 && (
                      <span className={styles.badges}>
                        {card.badges.map((b, bi) => {
                          const text = typeof b === 'string' ? b : b.text;
                          const tone = typeof b === 'object' ? TONE_CLASS[b.tone] : null;
                          return (
                            <em key={bi} className={tone ? `${styles.badge} ${styles[tone]}` : styles.badge}>
                              {text}
                            </em>
                          );
                        })}
                      </span>
                    )}
                  </>
                );
                return (
                  <li key={item.id}>
                    {renderCardActions ? (
                      <div className={`${styles.card} ${styles.cardBox} ${stateCls}`}>
                        <button type="button" className={styles.cardInfo} {...info}>
                          {body}
                        </button>
                        <div className={styles.cardActions}>{renderCardActions(item.raw)}</div>
                      </div>
                    ) : (
                      <button type="button" className={`${styles.card} ${stateCls}`} {...info}>
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
              {hasMore && <li className={styles.sentinel} ref={sentinelRef} aria-hidden="true" />}
            </ul>
          </main>

          {!noPreview && (
            <aside className={styles.preview} data-tour={TUT.SELECTOR_PREVIEW}>
              {preview ? (
                <>
                  <div className={styles.previewScroll}>
                    <DetailView entity={entity} raw={preview} db={db} capImage />
                  </div>
                  <div className={styles.previewFoot}>
                    {renderFooter ? (
                      renderFooter(preview)
                    ) : (
                      <button
                        type="button"
                        className={styles.selectBtn}
                        data-tour={TUT.SELECTOR_SELECT}
                        onClick={() => onSelect(preview)}
                      >
                        Select
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className={styles.muted}>Nothing to show.</p>
              )}
            </aside>
          )}
        </div>

        {renderBottomBar && renderBottomBar({ setPreview: setDetailItem })}

        {!noPreview && detailItem && isMobile() && (
          <div className={`${styles.detailScreen} motion-next`} data-tour={TUT.SELECTOR_DETAIL}>
            <div className={styles.detailHead}>
              <BackButton onClick={() => setDetailItem(null)} label="results" />
            </div>
            <div className={styles.detailScroll}>
              <DetailView entity={entity} raw={detailItem} db={db} capImage />
            </div>
            <div className={styles.previewFoot}>
              {renderFooter ? (
                renderFooter(detailItem)
              ) : (
                <button type="button" className={styles.selectBtn} onClick={() => onSelect(detailItem)}>
                  Select
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
