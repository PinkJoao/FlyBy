// =============================================================================
// SelectorCarousel: o modo carrossel de um seletor (classe, espécie, subclasse)
// =============================================================================
// O QUE FAZ
//   Mostra uma entrada por vez num cartão grande: a arte (ou o ícone, sem arte), o
//   nome e a fonte, as chips de meta da entity e um resumo tirado do dado
//   (`entity.teaser`); "Read more" troca o resumo pelo texto inteiro no próprio
//   cartão. Os vizinhos aparecem nas bordas e se navega deslizando, pelas setas,
//   pelas teclas ou pela faixa de miniaturas com o nome de cada entrada (em todo
//   carrossel desde o DDL-0293; antes, pontinhos até 15 itens). Usado no SelectorPanel (o botão Lista | Cartões) e no próprio passo do
//   guia de criação (DDL-0286).
//
// FUNÇÕES
//   galleryOf(entity, raw, db): as artes do fluff da entrada.
//   artShape(entity, raw, db): a forma da arte pela proporção do fluff ('wide', 'tall'
//     ou 'mid') e a proporção.
//   CarouselCard(props): um cartão.
//   SelectorCarousel(props): o carrossel. `items` são os resultados do seletor
//     ({ id, raw }), `index` e `onIndex` o controle, `currentId` o já escolhido,
//     `footer(raw)` o que vai embaixo (o Select do painel, o Choose do guia),
//     `onChoose(raw)` o que o toque ou o duplo clique no cartão do centro faz.
//
// DECISÕES E ARMADILHAS
//   - Na faixa, um nome que se repete na lista ("Gnome" do PHB e do XPHB) leva a fonte
//     embaixo (DDL-0301).
//   - A faixa calcula as artes uma vez por lista (useMemo); as miniaturas são lazy, e a
//     rolagem lateral só baixa as que chegam perto.
//   - Só os cartões perto do atual (WINDOW) são desenhados; os outros são quadros
//     vazios do mesmo tamanho, para o trilho não pular e as 179 espécies não pesarem.
//   - O cartão vizinho é coberto por um botão transparente que o traz ao centro: os
//     controles de dentro dele não recebem clique nem foco.
//   - O deslocamento do trilho é CSS (--i e --peek em SelectorCarousel.module.css);
//     o cartão vira horizontal (arte à esquerda) num container largo (desktop).
//   - A forma do quadro da arte segue a PROPORÇÃO da primeira arte (`width` e `height` do
//     fluff, DDL-0328): a faixa larga (os backgrounds, mediana 2,6 para 1) fica em cima com a
//     altura dela, também no desktop; a alta (as classes, 0,78) ganha mais altura no celular
//     e o corte pelo alto; o resto como antes. Sem tamanho no dado, 'mid'.
//   - O texto vem só do dado (§6.4). Sem `teaser`, o cartão mostra o corpo inteiro.
//   - "Read more" CONTINUA o resumo (DDL-0300): o resumo fica e o resto do texto abre
//     embaixo dele, animado (Collapse), sem o parágrafo já lido e sem repetir o nome da
//     entrada (DetailView `skip`); "Show less" fecha. Antes (DDL-0290) trocava o resumo
//     pelo texto inteiro, que começava de novo.
//   - O "Read more" fica logo abaixo do texto que ele estende, antes das chips (DDL-0293).
//   - O cartão do centro ESCOLHE como o botão de baixo: o toque basta no celular, e com o mouse é o
//     duplo clique, como na grade do SelectorPanel (os ouvintes do CarouselCard). O tipo do ponteiro vem do
//     `pointerdown` (o `click` nem sempre o traz, e o `dblclick` nunca): um toque duplo não escolhe
//     duas vezes, e o clique simples do mouse segue só lendo. Um toque que andou (o deslize para o
//     vizinho, a rolagem do texto) não escolhe, e o que cai num controle de dentro (a arte, Read
//     more, um link de regra, uma chip) faz só o dele. Quem chama decide o que escolher o já
//     escolhido faz (o guia não faz nada).
//   - O resumo vem ANTES das chips: no celular as chips da classe (sete) empurravam o
//     texto para fora do cartão, e o texto é o que o novato precisa ler primeiro.
// -----------------------------------------------------------------------------

import Button from '../components/common/Button';
import { useMemo, useRef, useState } from 'react';
import Thumb from '../components/common/Thumb';
import Icon from '../components/common/Icon';
import Tag from '../components/common/Tag';
import Chip from '../components/common/Chip';
import SourceTag from '../components/common/SourceTag';
import EntryContent from '../components/common/EntryContent';
import DetailView from '../components/common/DetailView';
import Collapse from '../components/common/Collapse';
import { metaChip } from '../components/common/metaChip';
import { showImageViewer } from '../store/imageViewerStore';
import { imgUrl } from '../components/common/media';
import { useSwipe } from '../components/common/imageNav';
import useActiveInView from '../hooks/useActiveInView';
import styles from './SelectorCarousel.module.css';

const WINDOW = 2;
const CONTROL = 'button, a, input, select, textarea, label, summary, [role="button"], [role="link"], [role="tab"]';

/** As artes do fluff da entrada, prontas para o ImageViewer. */
function galleryOf(entity, raw, db) {
  const fluff = entity.fluff?.(raw, db);
  return (fluff?.images ?? [])
    .filter((i) => i.href)
    .map((i) => ({ src: imgUrl(i.href), credit: i.credit, alt: raw.name }));
}

/** A forma da arte pela proporção do fluff. */
function artShape(entity, raw, db) {
  const img = (entity.fluff?.(raw, db)?.images ?? []).find((i) => i.href);
  const ratio = img?.width && img?.height ? img.width / img.height : null;
  if (!ratio) return { shape: 'mid', ratio: null };
  return { shape: ratio >= 1.5 ? 'wide' : ratio < 0.8 ? 'tall' : 'mid', ratio };
}

/** Um cartão do carrossel. */
function CarouselCard({ entity, db, raw, active, chosen, onPick, onChoose }) {
  const [more, setMore] = useState(false);
  const gallery = galleryOf(entity, raw, db);
  const meta = entity.meta?.(raw, db) ?? [];
  const teaser = entity.teaser?.(raw, db) ?? null;
  const icon = entity.icon?.(raw) ?? 'info';
  const tab = active ? 0 : -1;
  const art = gallery.length > 0 ? artShape(entity, raw, db) : { shape: 'mid', ratio: null };
  const down = useRef(null);
  const onControl = (e) => !!e.target.closest?.(CONTROL);
  const gesture = active && onChoose ? {
    onPointerDown: (e) => {
      down.current = { type: e.pointerType, x: e.clientX, y: e.clientY };
    },
    onClick: (e) => {
      const d = down.current;
      if (!d || d.type === 'mouse' || onControl(e)) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) return;
      onChoose();
    },
    onDoubleClick: (e) => {
      if (down.current?.type !== 'mouse' || onControl(e)) return;
      window.getSelection?.()?.removeAllRanges();
      onChoose();
    },
  } : {};

  return (
    <article
      className={active ? `${styles.card} ${styles.cardActive}` : styles.card}
      data-carousel-active={active ? '' : undefined}
      data-art={art.shape}
      style={art.ratio ? { '--art-ratio': art.ratio.toFixed(3) } : undefined}
      {...gesture}
    >
      <div className={styles.art}>
        {gallery.length > 0 ? (
          <button
            type="button"
            className={styles.artBtn}
            tabIndex={tab}
            onClick={() => showImageViewer(gallery, 0)}
            aria-label={`View ${raw.name} art`}
          >
            <Thumb src={gallery[0].src} icon={icon} width={art.shape === 'wide' ? 900 : 360} className={styles.thumb} alt="" />
          </button>
        ) : (
          <Thumb icon={icon} width={360} className={`${styles.thumb} ${styles.thumbIcon}`} />
        )}
        {chosen && (
          <Tag tone="success" className={styles.chosen}>
            <Icon name="check" /> Chosen
          </Tag>
        )}
      </div>
      <div className={styles.body}>
        <div className={styles.head}>
          <h3 className={styles.name}>{raw.name}</h3>
          {raw.source && <SourceTag source={raw.source} />}
        </div>
        {teaser?.length > 0 && (
          <div className={styles.teaser}>
            <EntryContent entries={teaser} />
          </div>
        )}
        {teaser?.length > 0 && (
          <Collapse open={more}>
            <div className={styles.rest}>
              <DetailView entity={entity} raw={raw} db={db} hideHeader hideImage hideMeta skip={typeof teaser[0] === 'string' ? teaser[0] : null} />
            </div>
          </Collapse>
        )}
        {teaser?.length > 0 && (
          <Button variant="link" className={styles.more} tabIndex={tab} onClick={() => setMore((v) => !v)}>
            {more ? 'Show less' : 'Read more'}
          </Button>
        )}
        {meta.length > 0 && (
          <div className={styles.meta}>
            {meta.map((m, i) => (
              <Chip key={`${m.label ?? m.value}-${i}`} onCard wrap {...metaChip(m)}>
                {m.label ? <b>{m.label}</b> : null} {m.value}
              </Chip>
            ))}
          </div>
        )}
        {!teaser?.length && <DetailView entity={entity} raw={raw} db={db} hideHeader hideImage hideMeta />}
      </div>
      {!active && (
        <button type="button" className={styles.pick} onClick={onPick} aria-label={`Show ${raw.name}`} />
      )}
    </article>
  );
}

/**
 * O carrossel de um seletor.
 * @param {{ entity: object, db: object, items: { id: string, raw: object }[], currentId?: string|null,
 *   index: number, onIndex: (i: number) => void, footer?: (raw: object) => any,
 *   onChoose?: (raw: object) => void }} props
 */
export default function SelectorCarousel({ entity, db, items, currentId, index, onIndex, footer, onChoose }) {
  const count = items.length;
  const at = Math.max(0, Math.min(index, count - 1));
  const go = (i) => onIndex(Math.max(0, Math.min(count - 1, i)));
  const swipe = useSwipe(() => go(at - 1), () => go(at + 1));
  const stripRef = useRef(null);
  useActiveInView(stripRef, at);
  const dupNames = useMemo(() => {
    const seen = new Set();
    const dup = new Set();
    for (const it of items) (seen.has(it.raw.name) ? dup : seen).add(it.raw.name);
    return dup;
  }, [items]);
  const stripArt = useMemo(
    () => items.map((it) => galleryOf(entity, it.raw, db)[0]?.src ?? null),
    [items, entity, db],
  );

  if (!count) return <p className={styles.empty}>Nothing to show.</p>;
  const cur = items[at];

  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(at - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(at + 1);
    }
  };

  return (
    <div className={styles.root}>
      <div
        className={styles.viewport}
        tabIndex={0}
        onKeyDown={onKeyDown}
        data-own-swipe=""
        aria-roledescription="carousel"
        aria-label={`${entity.title}: ${at + 1} of ${count}`}
        {...swipe}
      >
        <div className={styles.track} style={{ '--i': at }}>
          {items.map((it, i) => (
            <div key={it.id} className={styles.slot}>
              {Math.abs(i - at) <= WINDOW && (
                <CarouselCard
                  entity={entity}
                  db={db}
                  raw={it.raw}
                  active={i === at}
                  chosen={it.id === currentId}
                  onPick={() => go(i)}
                  onChoose={i === at && onChoose ? () => onChoose(it.raw) : null}
                />
              )}
            </div>
          ))}
        </div>
        {at > 0 && (
          <button type="button" className={`${styles.arrow} ${styles.prev}`} onClick={() => go(at - 1)} aria-label="Previous">
            <Icon name="chevronLeft" />
          </button>
        )}
        {at < count - 1 && (
          <button type="button" className={`${styles.arrow} ${styles.next}`} onClick={() => go(at + 1)} aria-label="Next">
            <Icon name="chevronRight" />
          </button>
        )}
      </div>

      <div className={styles.strip} ref={stripRef} data-wheel-x="" data-carousel-strip="">
        {items.map((it, i) => (
          <button
            key={it.id}
            type="button"
            className={i === at ? `${styles.stripItem} ${styles.stripOn}` : styles.stripItem}
            data-active={i === at ? 'true' : undefined}
            onClick={() => go(i)}
          >
            <Thumb
              src={stripArt[i]}
              icon={entity.icon?.(it.raw) ?? 'info'}
              width={52}
              className={styles.stripThumb}
            />
            <span className={styles.stripName}>{it.raw.name}</span>
            {dupNames.has(it.raw.name) && it.raw.source && <span className={styles.stripSource}>{it.raw.source}</span>}
          </button>
        ))}
      </div>

      {footer && <div className={styles.foot}>{footer(cur.raw)}</div>}
    </div>
  );
}
