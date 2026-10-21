// =============================================================================
// DetailView: a ficha de informação de uma entidade
// =============================================================================
// O QUE FAZ
//   Imagem (fluff), nome e fonte, os traços mecânicos (raw.entries) e a lore
//   (fluff.entries), como no 5etools. A entity pode expor `fluff(raw, db)` para
//   imagens e lore, e `sections(raw, db)` para SEÇÕES RETRÁTEIS entre as chips e o
//   corpo: informação verdadeira e volumosa que só ocupa espaço quando pedida (as
//   listas de uma magia). Como o corpo é `entries`, as tags viram links.
//
// FUNÇÕES
//   metaClass(m): a classe de um chip de meta (pré-requisito, tom, destaque).
//   Expando(props): uma seção retrátil, fechada por padrão.
//   DetailView(props): a ficha.
//
// DECISÕES E ARMADILHAS
//   - A imagem custom do usuário (item do inventário) sobrepõe a arte do fluff;
//     o src é calculado antes dos hooks e do guard (raw pode ser null).
//   - Galeria clicável (DDL-0067): expande em tela cheia, carrossel quando há
//     várias artes (as linhagens). Na imagem editável, o visualizador traz Change
//     e Remove (Remove só com imagem custom); sem arte, um "Add image".
//   - O erro de carregamento é resetado quando o src muda (ajuste no render).
// -----------------------------------------------------------------------------

import { useState } from 'react';
import EntryContent from './EntryContent';
import SourceTag from './SourceTag';
import ImageCarousel from './ImageCarousel';
import { showImageViewer } from '../../store/imageViewerStore';
import { imgUrl } from './media';
import styles from './DetailView.module.css';
import Icon from './Icon';
import Collapse from './Collapse';

const STATUS_CLASS = { ok: 'metaOk', bad: 'metaBad', unknown: 'metaUnknown' };
const TONE_CLASS = { blue: 'toneBlue', accent: 'toneAccent', red: 'toneRed', neutral: 'toneNeutral' };

/** A classe CSS de um chip de meta. */
function metaClass(m) {
  const extra = m.status
    ? styles[STATUS_CLASS[m.status]]
    : m.tone
      ? styles[TONE_CLASS[m.tone]]
      : m.highlight
        ? styles.metaHi
        : '';
  return extra ? `${styles.metaItem} ${extra}` : styles.metaItem;
}

/** Seção retrátil (chevron e rótulo), fechada por padrão. */
function Expando({ label, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={open ? `${styles.expando} ${styles.expandoOpen}` : styles.expando}>
      <button type="button" className={styles.expandoHead} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={styles.expandoChevron} aria-hidden="true"><Icon name="chevron" /></span>
        <span className={styles.expandoLabel}>{label}</span>
      </button>
      <Collapse open={open}>
        <div className={styles.expandoBody}>{children}</div>
      </Collapse>
    </div>
  );
}

export default function DetailView({
  entity,
  raw,
  db,
  capImage = false,
  customImg,
  onImgClick,
  onImgRemove,
  hideHeader = false,
}) {
  const fluff = raw ? (entity?.fluff?.(raw, db) ?? null) : null;
  const image = fluff?.images?.find((i) => i.href);
  const fluffSrc = image ? imgUrl(image.href) : null;
  const displaySrc = customImg || fluffSrc;
  const gallery = customImg
    ? [{ src: customImg, alt: raw?.name }]
    : (fluff?.images ?? [])
        .filter((i) => i.href)
        .map((i) => ({ src: imgUrl(i.href), credit: i.credit, alt: raw?.name }));

  const [imgOk, setImgOk] = useState(true);
  const [prevSrc, setPrevSrc] = useState(displaySrc);
  if (displaySrc !== prevSrc) {
    setPrevSrc(displaySrc);
    setImgOk(true);
  }
  if (!raw) return null;

  const meta = entity?.meta?.(raw, db) ?? [];
  const bodyEntries = entity?.entries?.(raw, db) ?? raw.entries;
  const sections = (entity?.sections?.(raw, db) ?? []).filter((s) => s?.entries?.length);
  const editable = typeof onImgClick === 'function';
  const imgClass = capImage ? `${styles.img} ${styles.imgCapped}` : styles.img;
  const editableActions = editable
    ? [
        { label: 'Change', onClick: onImgClick },
        ...(customImg && typeof onImgRemove === 'function'
          ? [{ label: 'Remove', tone: 'danger', onClick: onImgRemove }]
          : []),
      ]
    : undefined;

  return (
    <div className={styles.detail}>
      {editable ? (
        displaySrc && imgOk ? (
          <button
            type="button"
            className={styles.imgButton}
            onClick={() => showImageViewer(gallery, 0, editableActions)}
            title="View image"
          >
            <img className={imgClass} src={displaySrc} alt={raw.name} loading="lazy" onError={() => setImgOk(false)} />
          </button>
        ) : (
          <button type="button" className={styles.imgAddBtn} onClick={onImgClick}>
            <Icon name="addImage" /> Add image
          </button>
        )
      ) : (
        gallery.length > 0 && <ImageCarousel images={gallery} capped={capImage} alt={raw.name} />
      )}

      {!hideHeader && <h3 className={styles.name}>{raw.name}</h3>}
      {!hideHeader && raw.source && (
        <p className={styles.src}>
          <SourceTag source={raw.source} />
        </p>
      )}

      {meta.length > 0 && (
        <div className={styles.meta}>
          {meta.map((m, i) => (
            <span key={`${m.label ?? m.value}-${i}`} className={metaClass(m)}>
              {m.label ? <b>{m.label}</b> : null} {m.value}
            </span>
          ))}
        </div>
      )}

      {sections.map((s) => (
        <Expando key={s.id} label={s.label}>
          <EntryContent entries={s.entries} />
        </Expando>
      ))}

      {bodyEntries?.length > 0 && <EntryContent entries={bodyEntries} />}

      {fluff?.entries?.length > 0 && (
        <div className={styles.lore}>
          <span className={styles.loreLabel}>Lore</span>
          <EntryContent entries={fluff.entries} />
        </div>
      )}
    </div>
  );
}
