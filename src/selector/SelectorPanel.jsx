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
//   glossário (o toque no card já é a seleção); `title` e `hint` no cabeçalho;
//   `defaultView` ('list' ou 'cards') é o modo de quem abre, quando a pessoa ainda
//   não escolheu um para o tipo.
//
// FUNÇÕES
//   cardOf(item, entity, db): os dados de card (com a miniatura e as linhas extras,
//     quando a entity as tem), com cache.
//   warnOverflow(entity, card, shape): o aviso em dev de peça sem lugar na forma.
//   imagesReady(roots, ms): espera as imagens visíveis carregarem, até `ms`.
//   SelectorPanel(props): o painel.
//
// DECISÕES E ARMADILHAS
//   - Entrada do SRD 5.1 no pacote embutido (`srd51`, DDL-0107) ganha o badge
//     "Legacy (SRD 5.1)" no card, aqui, para valer em todo seletor (espécie,
//     invocação, item) sem cada entity repetir a regra.
//   - Linhas EXTRAS (`entity.cardExtra`, DDL-0288): o espaço que a forma reserva e o card
//     não usa (o item mundano sem etiqueta) recebe o básico da entrada (peso,
//     propriedades, duração), só as linhas que cabem inteiras; o essencial vem antes.
//   - Card de forma FIXA por entity (`cardShape`, selector/cardShape.js, DDL-0286):
//     título, fonte, meta e etiquetas reservam o mesmo espaço em todo card, cheio ou
//     vazio, e o que passa é cortado (inteiro no `title` e no preview). Todos os cards
//     de uma categoria têm o mesmo tamanho e o stepper da loja fica sempre no mesmo
//     lugar. Em dev, um card que preenche uma peça que a forma não reserva avisa.
//   - Modo CARROSSEL (DDL-0286): a entity com `carousel: true` (classe, espécie,
//     subclasse) ganha o botão List | Cards ao lado do contador; o carrossel
//     (SelectorCarousel) percorre os mesmos resultados (busca, filtros, ordenação e
//     `exclude` valem) e traz o Select embaixo, sem a coluna do preview. O modo fica
//     lembrado por tipo (settingsStore.selectorView); sem escolha, vale `defaultView`.
//     Refinar volta o carrossel ao já escolhido, ou ao primeiro.
//   - No celular, o modo carrossel ENXUGA o painel (DDL-0287, pedido do dono: o cartão ficava
//     espremido): a linha da busca some e vira dois ícones na linha do contador (a lupa
//     abre a busca, o filtro abre a gaveta, com o número de filtros ativos), o
//     contador diz "12 of 92" e o botão List | Cards fica só com os ícones.
//   - Desde o DDL-0288 esses botões sobem para a linha do TÍTULO (uma linha a menos), e
//     desde o DDL-0293 o título sai de vista (fica só para leitor de tela) para caber um
//     campo de busca de verdade, o filtro, o alternador List | Cards completo (o mesmo da
//     lista) e o ordenar, ao lado do X. O contador some nesse modo (a faixa já mostra a
//     posição).
//   - DDL-0298: o List | Cards só com ícones em todo tamanho; no desktop o topo é uma GRADE
//     com as colunas do corpo (filtros | lista | preview): o título na dos filtros, a busca e
//     os botões exatamente na largura da lista, o X na do preview; a borda direita desconta a
//     barra de rolagem da lista (`--results-sb`, medida no painel), que varia por sistema.
//     A linha de cima fica PARADA (DDL-0299): nem o modo Cards nem a coluna de filtros
//     escondida mudam a grade dela; a barra de rolagem só é medida na lista (o carrossel
//     não rola e daria 0).
//   - DDL-0297: na linha de cima o ordenar vem logo depois do filtro (os dois mexem na
//     lista) e o List | Cards por último; no desktop a busca começa logo depois do título,
//     sem o vão do meio. O preview do seletor não leva o tipo ("Species": o título do
//     painel já diz), e a coluna de filtros tem a legenda numa linha e a busca dos filtros
//     sempre à vista, ao lado do Clear (a lupa saiu).
//   - Desde o DDL-0296 a mesma linha é o topo do DESKTOP também, nos dois modos (a
//     faixa da busca e a linha do contador saíram): lá o título fica à vista, o List |
//     Cards mostra os nomes e o botão do filtro mostra e esconde a coluna de filtros
//     (`filtersHidden`; no celular ele abre e fecha a gaveta).
//   - Desde o DDL-0294 essa linha é o topo de TODO seletor no celular, em Lista e em
//     Cards (os dois modos tinham topos diferentes): a busca leva o contador dentro
//     ("92" na lista, "3/92" no carrossel) e o nome do tipo no placeholder; um título
//     próprio (`heading`), a dica e o "1 of 3" da escolha múltipla vão numa legenda
//     fina logo abaixo, igual nos dois modos.
//   - A troca Lista | Cards é animada pela View Transitions API (`switchView`,
//     DDL-0294): o topo fica parado, o card em foco (o primeiro visível na lista, o
//     atual no carrossel) cresce até o cartão do carrossel ou encolhe de volta ao seu
//     lugar na lista, que rola só ela até ele, e a faixa sobe. Os nomes de transição
//     são postos só durante a troca (o guia tem outro carrossel na página, e nome
//     repetido cancela a transição). Sem a API ou com "reduzir movimento", só troca.
//     Ao ir para Cards a transição espera a arte do cartão e as miniaturas da faixa
//     (`imagesReady`, até 350 ms; elas são `lazy` e só começariam a baixar com a tela
//     nova já à vista, e "piscavam" chegando depois, DDL-0300).
//   - Miniatura (`cardShape.thumb`, a loja) só no celular (useMediaQuery, não CSS:
//     o desktop nem baixa a arte), porque lá o preview não fica à vista (DDL-0285).
//   - Os filtros são filtros COMUNS, desmarcáveis: liberdade com aviso (DDL-0040).
//   - Opção FIXA que nenhum item do catálogo carrega é REMOVIDA ("zero SEMPRE",
//     contado no catálogo cru); opção que não alcança nada AGORA vira chip
//     DESABILITADO (facetCounts, "zero AGORA"; DDL-0077, DDL-0078). Catálogo vazio
//     (db carregando) não poda nada. Em dev, uma opção morta ao lado de um valor
//     emitido sem opção acusa um valor DIGITADO errado ("Very Rare" x "Very rare").
//   - Grupo de filtro sem opção some; a busca nos filtros casa a opção ou o grupo;
//     uma opção ATIVA nunca some nem desabilita.
//   - Cada opção mostra quantos resultados ela alcança com os OUTROS filtros (o
//     `count` do Chip, DDL-0199): a mesma conta que a desabilita no zero. A conta
//     passa antes pelo `exclude` de quem chama (as formas fora do ND, o que já foi
//     escolhido), para o número bater com a lista.
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
//   - O preview usa a moldura única de todo preview (PreviewShell, DDL-0295): no
//     desktop a coluna da direita; no celular uma GAVETA que sobe sobre a lista (antes
//     uma tela que entrava pela direita, com "Back"), com o mesmo topo (o tipo, a
//     fonte, o nome e o X), fecha arrastando para baixo, tocando fora ou no voltar, e
//     o rodapé com o Select (ou o da loja). O botão do filtro alterna a gaveta de
//     filtros (abre e fecha).
//   - Desktop: duplo clique num card seleciona (o clique simples só fixa a
//     prévia). Fora no celular (o toque abre o detalhe e o toque duplo é zoom) e
//     na loja (`renderFooter`: não há um Select para imitar).
//   - Escolha MÚLTIPLA (`multi = { total, chosen: [{ key, label }], onRemove }`):
//     o título ganha "(n of total)", o botão diz "Next" enquanto faltar mais de
//     um, e a faixa "Chosen" mostra o que já foi escolhido, com desfazer. Quem
//     chama decide fechar só quando completa; a seleção é esperada (`choose`
//     aguarda o onSelect, que pode abrir uma confirmação) e, se o painel seguir
//     aberto, a prévia, o detalhe do celular e a busca voltam ao começo.
//   - Ordenação pelo CONTEXTO, como os filtros: a entity declara `sorts` (Level e
//     School nas magias, Price, Weight e Rarity nos itens...) e, se a lista tem
//     uma ordem própria, `naturalSort` (o glossário, regras primeiro). O padrão é
//     o nome, de A a Z; o botão (SortButton) fica à direita do contador e só
//     aparece com mais de uma opção. A ordenação é por cima do que os filtros e o
//     `exclude` deixaram (src/sorting.js). Uma entrada `pinned` (o Custom Background,
//     DDL-0328) vem antes de tudo, fora dos filtros e da ordem; a busca ainda vale.
//   - O seletor com o botão List | Cards dispara o micro-tour `selector-view` quando nenhum
//     outro está aberto (depois do `selector`, na mesma abertura ou na próxima; DDL-0288).
//   - O tour do seletor (DDL-0069) dispara na 1a abertura de um seletor com preview
//     (o glossário e a loja ficam fora) e, no mobile, DIRIGE a gaveta e o detalhe
//     por `mobileAction` passo a passo; ao terminar, fecha os dois.
// -----------------------------------------------------------------------------

import SearchField from '../components/common/SearchField';
import { PHONE_QUERY } from '../breakpoints';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { reducedMotion } from '../motion';
import { applyFilters, deriveOptions, cycleOption, facetCounts } from './filterModel';
import DetailView from '../components/common/DetailView';
import PreviewShell from '../components/common/PreviewShell';
import Button from '../components/common/Button';
import useTutorialStore, { maybeStartTutorial } from '../store/tutorialStore';
import { TUT } from '../tutorial/anchors';
import styles from './SelectorPanel.module.css';
import { useBackLayer } from '../hooks/useBack';
import Icon from '../components/common/Icon';
import SortButton from '../components/common/SortButton';
import { NAME_SORT, sortList } from '../sorting';
import CloseButton from '../components/common/CloseButton';
import Chip from '../components/common/Chip';
import Tag from '../components/common/Tag';
import Thumb from '../components/common/Thumb';
import useMediaQuery from '../hooks/useMediaQuery';
import { cardShapeOf, cardTags, cardVars, overflowSlots } from './cardShape';
import SelectorCarousel from './SelectorCarousel';
import SegmentedControl from '../components/common/SegmentedControl';
import useSettingsStore from '../store/settingsStore';

const DRAWER_CLOSE_PX = 70;

const RENDER_CHUNK = 120;

const cardCache = new WeakMap();
function cardOf(item, entity, db) {
  let c = cardCache.get(item);
  if (!c) {
    c = entity.card(item.raw, db);
    if (item.raw?.srd51) c = { ...c, badges: [{ text: 'Legacy (SRD 5.1)', tone: 'neutral' }, ...(c.badges ?? [])] };
    if (entity.thumb) c = { ...c, thumb: entity.thumb(item.raw, db) };
    if (entity.cardExtra) c = { ...c, extra: entity.cardExtra(item.raw, db) ?? [] };
    cardCache.set(item, c);
  }
  return c;
}

/** Espera as imagens visíveis dentro de `roots` terminarem de carregar (ou `ms`, o que vier antes). */
function imagesReady(roots, ms = 350) {
  const pending = roots
    .filter(Boolean)
    .flatMap((r) => [...r.querySelectorAll('img')])
    .filter((img) => !img.complete && img.getBoundingClientRect().width > 0)
    .map((img) => new Promise((res) => {
      img.loading = 'eager';
      img.addEventListener('load', res, { once: true });
      img.addEventListener('error', res, { once: true });
    }));
  if (!pending.length) return Promise.resolve();
  return Promise.race([Promise.all(pending), new Promise((res) => setTimeout(res, ms))]);
}

const warned = new Set();
/** Em dev, avisa uma vez por entity quando um card preenche uma peça que a forma não reserva. */
function warnOverflow(entity, card, shape) {
  if (!import.meta.env?.DEV || warned.has(entity.type)) return;
  const extra = overflowSlots(card, shape);
  if (!extra.length) return;
  warned.add(entity.type);
  console.warn(`[SelectorPanel] ${entity.type}: o card "${card.title}" preenche ${extra.join(', ')} sem lugar na cardShape.`);
}

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
  multi,
  defaultView = 'list',
}) {
  const [query, setQuery] = useState('');
  const [filterState, setFilterState] = useState(
    initialFilterState ?? entity?.initialFilterState ?? {},
  );
  const [hovered, setHovered] = useState(null);
  const [lastHovered, setLastHovered] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [detailClosing, setDetailClosing] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [dragY, setDragY] = useState(0);

  useBackLayer(true, onClose);
  useBackLayer(showFilters, () => setShowFilters(false));
  useBackLayer(!!detailItem, () => setDetailItem(null));
  const dragStart = useRef(null);
  const dragged = useRef(false);

  const phone = useMediaQuery(PHONE_QUERY);
  const shape = useMemo(() => cardShapeOf(entity), [entity]);
  const showThumb = shape.thumb && phone;

  const isMobile = () =>
    typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches;

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
    return raw.map((r) => ({ id: entity.idOf(r), raw: r, ...entity.precompute(r, db) }));
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

  const countable = useMemo(() => (exclude ? items.filter((it) => !exclude(it.raw)) : items), [items, exclude]);
  const counts = useMemo(
    () =>
      facetCounts(countable, {
        query,
        filterState,
        filterIds: entity.filters.map((f) => f.id),
      }),
    [countable, query, filterState, entity.filters],
  );
  const sortOptions = useMemo(() => {
    const own = (entity.sorts ?? []).map((o) => ({ ...o, keyOf: o.keyOf && ((raw) => o.keyOf(raw, db)) }));
    return entity.naturalSort ? [entity.naturalSort, NAME_SORT, ...own] : [NAME_SORT, ...own];
  }, [entity, db]);
  const [sort, setSort] = useState(() => ({ value: sortOptions[0].value, dir: sortOptions[0].defaultDir ?? 'asc' }));
  const activeSort = sortOptions.find((o) => o.value === sort.value) ?? sortOptions[0];

  const results = useMemo(() => {
    const kept = exclude ? filtered.filter((it) => !exclude(it.raw)) : filtered;
    const sorted = sortList(kept, { option: activeSort, dir: sort.dir, rawOf: (it) => it.raw });
    if (!entity.pinned) return sorted;
    const pinned = applyFilters(items, { query, filterState: {} }).filter((it) => entity.pinned(it.raw));
    return [...pinned, ...sorted.filter((it) => !entity.pinned(it.raw))];
  }, [filtered, exclude, activeSort, sort.dir, entity, items, query]);

  const savedView = useSettingsStore((s) => s.selectorView?.[entity?.type]);
  const setSelectorView = useSettingsStore((s) => s.setSelectorView);
  const view = entity?.carousel && !noPreview ? (savedView ?? defaultView) : 'list';
  const cards = view === 'cards';
  const chosenIndex = () => Math.max(0, results.findIndex((it) => it.id === currentId));
  const [carouselIndex, setCarouselIndex] = useState(chosenIndex);
  const compact = phone;
  const [filtersHidden, setFiltersHidden] = useState(false);
  const panelRef = useRef(null);

  const tourId = useTutorialStore((s) => s.tourId);
  const hasViewToggle = !!entity?.carousel && !noPreview;
  useEffect(() => {
    if (!hasViewToggle || tourId) return undefined;
    const t = setTimeout(() => maybeStartTutorial('selector-view'), 400);
    return () => clearTimeout(t);
  }, [hasViewToggle, tourId]);
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
  const [prevRefine, setPrevRefine] = useState({ query, filterState, entity, db, sort });
  if (
    prevRefine.query !== query ||
    prevRefine.filterState !== filterState ||
    prevRefine.entity !== entity ||
    prevRefine.db !== db ||
    prevRefine.sort !== sort
  ) {
    setPrevRefine({ query, filterState, entity, db, sort });
    setVisibleCount(RENDER_CHUNK);
    setCarouselIndex(chosenIndex());
  }
  useEffect(() => {
    resultsRef.current?.scrollTo?.({ top: 0 });
  }, [query, filterState, entity, db, sort]);
  useEffect(() => {
    const el = resultsRef.current;
    if (el && !cards) panelRef.current?.style.setProperty('--results-sb', `${el.offsetWidth - el.clientWidth}px`);
  }, [cards, results.length, phone]);
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

  const remaining = multi ? Math.max(0, multi.total - multi.chosen.length) : 0;
  const selectLabel = multi && remaining > 1 ? 'Next' : 'Select';
  const title = heading ?? `Choose ${entity.title}`;
  const shownTitle = multi && multi.total > 1 && remaining > 0 ? `${title} (${multi.chosen.length + 1} of ${multi.total})` : title;

  /** Seleciona; num painel múltiplo que segue aberto, volta à lista limpa para a próxima. */
  const choose = async (raw) => {
    await onSelect(raw);
    if (!multi) return;
    setDetailItem(null);
    setHovered(null);
    setLastHovered(null);
    setQuery('');
    setCarouselIndex(0);
  };

  /** O rodapé de um preview: o da loja (`renderFooter`) ou o Select. */
  const footerFor = (raw) =>
    renderFooter ? (
      renderFooter(raw)
    ) : (
      <Button variant="primary" data-tour={TUT.SELECTOR_SELECT} onClick={() => choose(raw)}>
        {selectLabel}
      </Button>
    );

  /** Fecha a gaveta de detalhe do celular com a animação de saída. */
  const closeDetail = () => {
    if (reducedMotion()) {
      setDetailItem(null);
      return;
    }
    setDetailClosing(true);
    setTimeout(() => {
      setDetailItem(null);
      setDetailClosing(false);
    }, 160);
  };

  const sortButton = sortOptions.length > 1 && (
    <SortButton
      options={sortOptions}
      value={activeSort.value}
      dir={sort.dir}
      onChange={(value, dir) => setSort({ value, dir })}
      size="sm"
    />
  );

  /** Troca Lista | Cards; com View Transitions, o card em foco cresce (ou encolhe) até o outro modo. */
  const switchView = (next) => {
    if (next === view) return;
    const root = panelRef.current;
    const listCards = () => [...(root?.querySelectorAll('[data-item-id]') ?? [])];
    let heroId = results[Math.min(carouselIndex, results.length - 1)]?.id ?? null;
    let oldHero = null;
    if (next === 'cards') {
      const top = resultsRef.current?.getBoundingClientRect().top ?? 0;
      const seen = listCards().find((li) => li.getBoundingClientRect().bottom > top + 40);
      if (seen) {
        heroId = seen.dataset.itemId;
        oldHero = seen.firstElementChild;
      }
    } else {
      oldHero = root?.querySelector('[data-carousel-active]');
    }
    const heroAt = Math.max(0, results.findIndex((it) => it.id === heroId));
    const apply = () => {
      if (next === 'cards') setCarouselIndex(heroAt);
      else setVisibleCount((c) => Math.max(c, heroAt + 1));
      setSelectorView(entity.type, next);
    };
    if (!root || !document.startViewTransition || reducedMotion()) {
      apply();
      return;
    }
    const named = [];
    const tag = (el, name) => {
      if (!el) return;
      el.style.viewTransitionName = name;
      named.push(el);
    };
    tag(root.querySelector('header'), 'sel-head');
    tag(oldHero, 'sel-hero');
    tag(root.querySelector('[data-carousel-strip]'), 'sel-strip');
    const vt = document.startViewTransition(async () => {
      flushSync(apply);
      if (next === 'cards') {
        const card = root.querySelector('[data-carousel-active]');
        const strip = root.querySelector('[data-carousel-strip]');
        tag(card, 'sel-hero');
        tag(strip, 'sel-strip');
        await imagesReady([card, strip]);
      } else {
        const li = listCards().find((el) => el.dataset.itemId === heroId);
        const box = resultsRef.current;
        if (li && box) {
          const a = li.getBoundingClientRect();
          const b = box.getBoundingClientRect();
          // ATENÇÃO: scrollIntoView rolaria também o painel e a página; só a lista rola.
          box.scrollTop += a.top - b.top - (b.height - a.height) / 2;
        }
        tag(li?.firstElementChild, 'sel-hero');
      }
    });
    vt.finished.finally(() => named.forEach((el) => (el.style.viewTransitionName = '')));
  };

  const viewToggle = entity?.carousel && !noPreview && (
    <SegmentedControl
      size="sm"
      ariaLabel="View"
      value={view}
      onChange={switchView}
      className={styles.viewToggle}
      dataTour={TUT.SELECTOR_VIEW}
      options={[
        ['list', <span key="l" className={styles.viewOpt} title="List"><Icon name="viewGrid" /><span className={styles.srOnly}>List</span></span>],
        ['cards', <span key="c" className={styles.viewOpt} title="Cards"><Icon name="viewCards" /><span className={styles.srOnly}>Cards</span></span>],
      ]}
    />
  );

  const toolbar = (
    <div className={styles.headerTools}>
      <SearchField
        size="sm"
        className={styles.headerSearch}
        data-tour={TUT.SELECTOR_SEARCH}
        placeholder={`Search ${entity.title.toLowerCase()}…`}
        value={query}
        onChange={setQuery}
        autoFocus={!isMobile()}
        count={cards && results.length ? `${Math.min(carouselIndex, results.length - 1) + 1}/${results.length}` : results.length}
      />
      <Button
        icon
        size="sm"
        data-tour={TUT.SELECTOR_FILTERS_TOGGLE}
        className={activeCount ? `${styles.filterBtn} ${styles.filterBtnOn}` : styles.filterBtn}
        aria-label={`Filters${activeCount ? ` (${activeCount})` : ''}`}
        aria-pressed={phone ? showFilters : !filtersHidden}
        onClick={() => {
          if (!phone) setFiltersHidden((v) => !v);
          else if (showFilters) closeFilters();
          else setShowFilters(true);
        }}
      >
        <Icon name="filter" />
        {activeCount > 0 && <span className={styles.iconBadge}>{activeCount}</span>}
      </Button>
      {sortButton}
      {viewToggle}
    </div>
  );

  // ATENÇÃO: o portal para document.body é necessário; um ancestral com transform prenderia o painel.
  return createPortal(
    <div className={`${styles.overlay} motion-page`} onClick={onClose}>
      <div className={`${styles.panel} motion-pop`} ref={panelRef} onClick={(e) => e.stopPropagation()}>
        <header
          className={[
            styles.header,
            styles.headerCompact,
            noPreview ? styles.headerNoPreview : null,
          ].filter(Boolean).join(' ')}
        >
          <div className={compact ? styles.srOnly : styles.headerText}>
            <h2>{shownTitle}</h2>
            {hint && <p className={styles.hint}>{hint}</p>}
          </div>
          {toolbar}
          <CloseButton onClick={onClose} />
        </header>
        {compact && (heading || hint || (multi && multi.total > 1)) && (
          <div className={styles.caption} aria-hidden="true">
            {(heading || multi) && <span className={styles.captionTitle}>{shownTitle}</span>}
            {hint && <span className={styles.captionHint}>{hint}</span>}
          </div>
        )}

        {multi && multi.chosen.length > 0 && (
          <div className={styles.chosenStrip} aria-label="Already chosen">
            <span className={styles.chosenLabel}>Chosen</span>
            {multi.chosen.map((c) => (
              <Chip key={c.key} className="motion-pop" onRemove={() => multi.onRemove(c.key)}>{c.label}</Chip>
            ))}
          </div>
        )}

        <div
          className={[
            styles.body,
            noPreview || cards ? styles.bodyNoPreview : null,
            filtersHidden && !phone ? styles.bodyNoFilters : null,
          ].filter(Boolean).join(' ')}
        >
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
              <span className={styles.legend}>
                <span className={styles.legendRow}>
                  <em className={styles.dotInc} /> include
                </span>
                <span className={styles.legendRow}>
                  <em className={styles.dotExc} /> exclude
                </span>
              </span>
              <div className={styles.filtersHeadRow}>
                <SearchField
                  size="sm"
                  placeholder="Search"
                  ariaLabel="Search filters"
                  value={filterQuery}
                  onChange={setFilterQuery}
                />
                {activeCount > 0 && (
                  <Button size="sm" onPage className={styles.clear} onClick={clearFilters}>
                    Clear
                  </Button>
                )}
                <Button size="sm" variant="primary" onPage className={styles.applyFilters} onClick={closeFilters}>
                  Apply
                </Button>
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
                      const n = counts[f.id]?.[opt.value] ?? 0;
                      const empty = !mode && !n;
                      return (
                        <Chip
                          key={opt.value}
                          active={mode === 'include'}
                          tone={mode === 'exclude' ? 'danger' : undefined}
                          struck={mode === 'exclude'}
                          count={n}
                          disabled={empty}
                          title={empty ? 'No results with the current filters' : `${n} result${n === 1 ? '' : 's'} with this option and the other filters`}
                          onClick={() => toggle(f.id, opt.value)}
                        >
                          {opt.label}
                        </Chip>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </aside>

          <main className={cards ? `${styles.results} ${styles.resultsCards}` : styles.results} ref={resultsRef} data-tour={TUT.SELECTOR_RESULTS}>
            {cards && (
              <SelectorCarousel
                entity={entity}
                db={db}
                items={results}
                currentId={currentId}
                index={carouselIndex}
                onIndex={setCarouselIndex}
                footer={(raw) => (
                  <Button variant="primary" block onPage data-tour={TUT.SELECTOR_SELECT} onClick={() => choose(raw)}>
                    {selectLabel === 'Next' ? 'Next' : `Select ${raw.name}`}
                  </Button>
                )}
              />
            )}
            {!cards && <ul className={styles.cards}>
              {shown.map((item) => {
                const card = cardOf(item, entity, db);
                const selected = item.id === currentId;
                const isPinned = detailItem && entity.idOf(detailItem) === item.id;
                const stateCls = `${selected ? styles.cardSel : ''} ${isPinned ? styles.cardPinned : ''}`;
                const info = noPreview
                  ? { onClick: () => choose(item.raw) }
                  : {
                      onClick: () => setDetailItem(item.raw),
                      onDoubleClick: renderFooter || isMobile() ? undefined : () => choose(item.raw),
                      onMouseEnter: () => {
                        setHovered(item.raw);
                        setLastHovered(item.raw);
                      },
                      onMouseLeave: () => setHovered(null),
                    };
                warnOverflow(entity, card, shape);
                const tags = shape.tags > 0 ? cardTags(card) : [];
                const body = (
                  <>
                    {showThumb && (
                      <Thumb
                        src={card.thumb?.src}
                        icon={card.thumb?.icon}
                        tint={card.thumb?.tint}
                        width={170}
                        fit="contain"
                        className={styles.cardThumb}
                      />
                    )}
                    <span className={styles.cardBody}>
                      <span className={styles.cardTitle} title={card.title}>{card.title}</span>
                      {shape.subtitle && card.subtitle && (
                        <span className={styles.cardSub} title={card.subtitleFull ?? card.subtitle}>{card.subtitle}</span>
                      )}
                      {shape.meta > 0 && card.meta && (
                        <span className={styles.cardMeta} title={card.meta}>{card.meta}</span>
                      )}
                      {tags.length > 0 && (
                        <span className={shape.tags === 1 ? `${styles.badges} ${styles.badgesOne}` : styles.badges}>
                          {tags.map((t, ti) => (
                            <Tag key={ti} tone={t.tone} color={t.color} title={t.text} className={styles.cardTag}>{t.text}</Tag>
                          ))}
                        </span>
                      )}
                      {card.extra?.length > 0 && (
                        <span className={styles.cardExtra}>
                          {card.extra.map((x, xi) => (
                            <span key={xi} className={styles.cardExtraLine} title={x}>{x}</span>
                          ))}
                        </span>
                      )}
                    </span>
                  </>
                );
                return (
                  <li key={item.id} data-item-id={item.id}>
                    {renderCardActions ? (
                      <div className={`${styles.card} ${styles.cardBox} ${showThumb ? styles.cardWithThumb : ''} ${stateCls}`} style={cardVars(shape)}>
                        <button type="button" className={styles.cardInfo} {...info}>
                          {body}
                        </button>
                        <div className={styles.cardActions}>{renderCardActions(item.raw)}</div>
                      </div>
                    ) : (
                      <button type="button" className={`${styles.card} ${showThumb ? styles.cardWithThumb : ''} ${stateCls}`} style={cardVars(shape)} {...info}>
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
              {hasMore && <li className={styles.sentinel} ref={sentinelRef} aria-hidden="true" />}
            </ul>}
          </main>

          {!noPreview && !cards && (
            <aside className={styles.preview} data-tour={TUT.SELECTOR_PREVIEW}>
              {preview ? (
                <PreviewShell source={preview.source} title={preview.name} footer={footerFor(preview)}>
                  <DetailView entity={entity} raw={preview} db={db} capImage hideHeader />
                </PreviewShell>
              ) : (
                <p className={styles.muted}>Nothing to show.</p>
              )}
            </aside>
          )}
        </div>

        {renderBottomBar && renderBottomBar({ setPreview: setDetailItem })}

        {!noPreview && detailItem && isMobile() && (
          <div className={detailClosing ? `${styles.detailScrim} ${styles.detailClosing}` : styles.detailScrim} onClick={closeDetail}>
            <div className={styles.detailSheet} data-tour={TUT.SELECTOR_DETAIL} onClick={(e) => e.stopPropagation()}>
              <PreviewShell
                sheet
                source={detailItem.source}
                title={detailItem.name}
                onClose={closeDetail}
                footer={footerFor(detailItem)}
              >
                <DetailView entity={entity} raw={detailItem} db={db} capImage hideHeader />
              </PreviewShell>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
