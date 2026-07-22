// =============================================================================
// SelectorPanel - seletor genérico com busca + filtros + preview
// =============================================================================
// Substitui o velho dropdown. Recebe uma config de entidade (entities/*.js) e o
// compêndio (db). Mobile-first: no celular os filtros viram uma gaveta.
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { applyFilters, deriveOptions, cycleOption } from './filterModel';
import DetailView from '../components/common/DetailView';
import BackButton from '../components/common/BackButton';
import styles from './SelectorPanel.module.css';

/** Arrastar o puxador da gaveta de filtros (mobile) mais do que isto a fecha. */
const DRAWER_CLOSE_PX = 70;

/** Quantos cards renderizar por vez. Catálogos grandes (loja ~4700 itens,
 * glossário ~7700) travavam o painel se TODOS os resultados virassem DOM de uma
 * vez; renderizamos em levas e um sentinel (IntersectionObserver) carrega a
 * próxima leva quando o scroll se aproxima do fim. */
const RENDER_CHUNK = 120;

/** Cache dos dados de card por item pré-computado: `entity.card` pode custar
 * caro (ex: preço derivado de item mágico na loja) e o card não muda enquanto
 * o item existir - sem cache, cada tecla/ajuste de carrinho recalculava todos.
 * Chaveado no WRAPPER do item (recriado quando entity/db mudam → cache novo). */
const cardCache = new WeakMap();
function cardOf(item, entity, db) {
  let c = cardCache.get(item);
  if (!c) {
    c = entity.card(item.raw, db);
    cardCache.set(item, c);
  }
  return c;
}

/* Cores dos badges de pré-requisito nos cards (atende / não atende / incerto). */
const PREREQ_CLASS = { ok: 'preOk', bad: 'preBad', unknown: 'preUnknown' };

/* Tons de badge (ex: tipos de classe - caster azul, half accent, martial vermelho). */
const TONE_CLASS = { blue: 'toneBlue', accent: 'toneAccent', red: 'toneRed', neutral: 'toneNeutral' };

export default function SelectorPanel({
  entity,
  db,
  currentId,
  onSelect,
  onClose,
  exclude,
  // Opcionais (usados pela loja): substituem o rodapé "Select" do preview por
  // um conteúdo próprio, adicionam uma faixa de ações abaixo de cada card, e
  // uma barra inferior fixa (carrinho). `renderBottomBar` recebe `setPreview`
  // para poder abrir o preview de um item (ex: tocar num item do carrinho).
  renderFooter,
  renderCardActions,
  renderBottomBar,
  // Filtros PRÉ-APLICADOS ao abrir (mesma forma do `filterState` interno:
  // `{ [filterId]: { [option]: 'include' | 'exclude' } }`). Ex: o Spellbook abre
  // o painel já marcado na classe da origem - mas o usuário pode desmarcá-la ou
  // marcar outra classe, porque é um filtro comum como qualquer outro.
  initialFilterState,
  // Modo "lista navegável" (glossário): SEM coluna/tela de preview - tocar num
  // card chama `onSelect(raw)` direto (quem abre decide o que fazer, ex: popup).
  noPreview,
  // Título do cabeçalho (default "Choose {título da entity}") e uma linha de
  // dica opcional abaixo dele.
  heading,
  hint,
}) {
  const [query, setQuery] = useState('');
  const [filterState, setFilterState] = useState(initialFilterState ?? {});
  const [hovered, setHovered] = useState(null);
  const [lastHovered, setLastHovered] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [detailItem, setDetailItem] = useState(null); // mobile: card → detalhe
  // Busca DENTRO dos filtros: escondida atrás de uma lupa no desktop (são muitos
  // filtros, mas o espaço é do conteúdo); no mobile o CSS a deixa sempre visível.
  const [filterSearchOpen, setFilterSearchOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  // Arrasto do puxador da gaveta (mobile).
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef(null);
  const dragged = useRef(false); // arrastou de verdade? (senão o `click` fecharia)

  const isMobile = () =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;

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
    const dy = Math.max(0, e.clientY - dragStart.current); // só para baixo
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
  // Tocar no puxador (sem arrastar) também fecha - mas um arrasto CURTO, que
  // volta ao lugar, não pode virar um clique.
  const onGrabClick = () => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    closeFilters();
  };

  // Pré-computa a lista uma vez (busca + valores de filtro).
  const items = useMemo(() => {
    const raw = entity.list(db);
    return raw.map((r) => ({ id: entity.idOf(r), raw: r, ...entity.precompute(r) }));
  }, [entity, db]);


  // Each filter's options as {value,label}. Derived filters take values from the
  // data (value === label); fixed filters carry their own labels.
  const filterOptions = useMemo(() => {
    const out = {};
    for (const f of entity.filters) {
      if (f.derive) {
        out[f.id] = deriveOptions(items, f.id).map((v) => ({ value: v, label: v }));
      } else {
        out[f.id] = (f.options ?? []).map((o) =>
          typeof o === 'string' ? { value: o, label: o } : o
        );
      }
    }
    return out;
  }, [entity, items]);

  const filtered = useMemo(
    () => applyFilters(items, { query, filterState }),
    [items, query, filterState]
  );
  // Esconde o que já está na ficha (dedup), via predicado opcional.
  const results = useMemo(
    () => (exclude ? filtered.filter((it) => !exclude(it.raw)) : filtered),
    [filtered, exclude]
  );

  // Renderização em levas (ver RENDER_CHUNK). Reseta ao REFINAR (busca/filtros/
  // entity) - não em qualquer mudança de `results`: o `exclude` da loja muda a
  // cada ajuste do carrinho e resetar aqui pularia o scroll de volta ao topo.
  // Reset via ajuste-durante-o-render (padrão do DetailView), não num effect.
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
    // Refinou → volta a lista ao topo (efeito de DOM, sem setState).
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
      // `root` é o container que ROLA (a coluna de resultados); a margem carrega
      // a próxima leva antes de o usuário alcançar o fim.
      { root: resultsRef.current, rootMargin: '800px' },
    );
    io.observe(sentinelRef.current);
    return () => io.disconnect();
    // `visibleCount` nos deps recria o observer após cada leva: se o sentinel
    // continuar visível (usuário já no fim), a próxima leva dispara na hora.
  }, [hasMore, results, visibleCount]);

  const activeCount = Object.values(filterState).reduce(
    (n, opts) => n + Object.values(opts).filter(Boolean).length,
    0
  );

  // Grupos de filtro visíveis: a busca casa o nome da OPÇÃO ou o do GRUPO (digitar
  // "school" mostra o grupo inteiro). Uma opção ATIVA nunca some - senão o usuário
  // perderia de vista um filtro que está mudando o resultado.
  const fq = filterQuery.trim().toLowerCase();
  const visibleGroups = useMemo(() => {
    if (!fq) return entity.filters.map((f) => ({ f, opts: filterOptions[f.id] }));
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

  // Item já selecionado na ficha (currentId): serve de LOCK do preview. Ao abrir
  // o painel para SUBSTITUIR algo, o preview mostra o selecionado e VOLTA a ele
  // quando o mouse sai de um card (como um item clicado/fixado) - em vez de ficar
  // preso no último hover. Vem de `items` (lista completa), não de `results`, para
  // aparecer mesmo se um filtro/exclude o escondesse. Sem seleção (1ª escolha),
  // é null e o comportamento antigo (último hover) segue igual.
  const selectedRaw = useMemo(
    () => (currentId != null ? items.find((it) => it.id === currentId)?.raw ?? null : null),
    [items, currentId],
  );

  // Hover atual > Item clicado/fixado > Selecionado na ficha > Último hover > 1º da lista
  const preview = hovered ?? detailItem ?? selectedRaw ?? lastHovered ?? results[0]?.raw ?? null;

  // Portal p/ document.body: o painel é `position: fixed` e deve preencher a
  // viewport; renderizado dentro de `.page` (ou de um overlay), um ancestral com
  // transform/filter/contain o prenderia numa caixa estreita.
  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2>{heading ?? `Choose ${entity.title}`}</h2>
            {hint && <p className={styles.hint}>{hint}</p>}
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        {/* Busca principal. No MOBILE ela some enquanto a gaveta de filtros está
            aberta: ocupa muito espaço, não filtra nada ali, e o usuário poderia
            confundi-la com a busca dos filtros. */}
        <div className={showFilters ? `${styles.searchBar} ${styles.searchBarHidden}` : styles.searchBar}>
          <input
            className={styles.search}
            type="search"
            placeholder={`Search ${entity.title.toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus={!isMobile()}
          />
          <button
            type="button"
            className={styles.filterToggle}
            onClick={() => setShowFilters((v) => !v)}
          >
            Filters{activeCount ? ` (${activeCount})` : ''}
          </button>
        </div>

        <div className={noPreview ? `${styles.body} ${styles.bodyNoPreview}` : styles.body}>
          {/* Filters */}
          <aside
            className={`${styles.filters} ${showFilters ? styles.filtersOpen : ''}`}
            style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
          >
            {/* Puxador (mobile): arrastar p/ baixo fecha a gaveta; tocar também. */}
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

            {/* Cabeçalho FIXO: a legenda e Clear/Apply seguem visíveis ao rolar. */}
            <div className={styles.filtersHead}>
              <div className={styles.filtersHeadRow}>
                {/* Legenda empilhada: em UMA linha ela e os botões se espremiam
                    quando o "Clear" aparecia; vertical sobra espaço horizontal. */}
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
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          className={`${styles.chip} ${
                            mode === 'include' ? styles.inc : mode === 'exclude' ? styles.exc : ''
                          }`}
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

          {/* Resultados */}
          <main className={styles.results} ref={resultsRef}>
            <div className={styles.count}>{results.length} result(s)</div>
            <ul className={styles.cards}>
              {shown.map((item) => {
                const card = cardOf(item, entity, db);
                const selected = item.id === currentId; // Verifica se é o item já salvo na ficha
                const isPinned = detailItem && entity.idOf(detailItem) === item.id; // Verifica se é o item atualmente clicado/fixado para preview
                const stateCls = `${selected ? styles.cardSel : ''} ${isPinned ? styles.cardPinned : ''}`;
                // Sem preview (glossário), o toque no card é a própria seleção
                // (abre o popup); hover não tem o que alimentar.
                const info = noPreview
                  ? { onClick: () => onSelect(item.raw) }
                  : {
                      onClick: () => setDetailItem(item.raw),
                      onMouseEnter: () => {
                        setHovered(item.raw);
                        setLastHovered(item.raw); // <-- SALVA O ÚLTIMO HOVER
                      },
                      onMouseLeave: () => setHovered(null),
                    };
                const body = (
                  <>
                    <span className={styles.cardTitle}>{card.title}</span>
                    {card.subtitle && <span className={styles.cardSub}>{card.subtitle}</span>}
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
                // Com ações (loja): o CARD é a caixa e contém o botão de info + o
                // stepper DENTRO dele. Sem ações: o próprio botão é o card.
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
              {/* Sentinel: entra na viewport → carrega a próxima leva. */}
              {hasMore && <li className={styles.sentinel} ref={sentinelRef} aria-hidden="true" />}
            </ul>
          </main>

          {/* Preview */}
          {!noPreview && (
            <aside className={styles.preview}>
              {preview ? (
                <>
                  <div className={styles.previewScroll}>
                    <DetailView entity={entity} raw={preview} db={db} capImage />
                  </div>
                  <div className={styles.previewFoot}>
                    {renderFooter ? (
                      renderFooter(preview)
                    ) : (
                      <button type="button" className={styles.selectBtn} onClick={() => onSelect(preview)}>
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

        {/* Barra inferior opcional (carrinho da loja). `setPreview` deixa a barra
          * abrir o preview de um item (no desktop fixa o preview; no mobile abre
          * a tela de detalhe). */}
        {renderBottomBar && renderBottomBar({ setPreview: setDetailItem })}

        {/* Tela de detalhe (mobile): tocar num card mostra info antes de selecionar. */}
        {!noPreview && detailItem && isMobile() && (
          <div className={styles.detailScreen}>
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
