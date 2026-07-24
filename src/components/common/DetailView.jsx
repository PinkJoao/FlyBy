// =============================================================================
// DetailView - ficha de informação de uma entidade (raça, talento…)
// =============================================================================
// Mostra imagem (fluff), nome/fonte, os traços mecânicos (raw.entries) e a lore
// (fluff.entries), estilo 5etools. A entity pode expor `fluff(raw, db)` para
// fornecer imagens + lore; sem isso, mostra só os entries mecânicos.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import EntryContent from './EntryContent';
import SourceTag from './SourceTag';
import ImageCarousel from './ImageCarousel';
import { showImageViewer } from '../../store/imageViewerStore';
import { imgUrl } from './media';
import styles from './DetailView.module.css';

const STATUS_CLASS = { ok: 'metaOk', bad: 'metaBad', unknown: 'metaUnknown' };
const TONE_CLASS = { blue: 'toneBlue', accent: 'toneAccent', red: 'toneRed', neutral: 'toneNeutral' };

/** Classe do chip de meta: status de pré-requisito, TOM (tipos de classe) ou destaque. */
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
  // src candidato ANTES dos hooks/guard (raw pode ser null): imagem custom do
  // usuário tem prioridade sobre a arte do fluff.
  const fluff = raw ? (entity?.fluff?.(raw, db) ?? null) : null;
  const image = fluff?.images?.find((i) => i.href);
  const fluffSrc = image ? imgUrl(image.href) : null;
  const displaySrc = customImg || fluffSrc;
  // Galeria clicável (expande em tela cheia; carrossel quando há várias artes -
  // ex. as linhagens de uma espécie). A imagem custom do usuário, quando houver,
  // é uma única e sobrepõe a arte do fluff.
  const gallery = customImg
    ? [{ src: customImg, alt: raw?.name }]
    : (fluff?.images ?? [])
        .filter((i) => i.href)
        .map((i) => ({ src: imgUrl(i.href), credit: i.credit, alt: raw?.name }));

  const [imgOk, setImgOk] = useState(true);
  // Reseta o estado de erro quando o src muda (ajuste no render, sem effect).
  const [prevSrc, setPrevSrc] = useState(displaySrc);
  if (displaySrc !== prevSrc) {
    setPrevSrc(displaySrc);
    setImgOk(true);
  }
  if (!raw) return null;

  const meta = entity?.meta?.(raw, db) ?? [];
  // Entidades como classe/subclasse montam os entries (fluff/features resolvidas).
  const bodyEntries = entity?.entries?.(raw, db) ?? raw.entries;
  const editable = typeof onImgClick === 'function';
  const imgClass = capImage ? `${styles.img} ${styles.imgCapped}` : styles.img;
  // Ações do visualizador de imagem editável (item do inventário): Change sempre;
  // Remove só quando há uma imagem custom para desfazer.
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
        // Imagem editável (overlay de item): toca p/ EXPANDIR em tela cheia, com
        // os botões Change / Remove no visualizador (molde do retrato). SEM arte,
        // um botão pequeno "Add image". `customImg` sobrepõe a arte original;
        // Remove só aparece quando há imagem custom (volta à arte do 5etools).
        // Sem selo ✎: a edição vive no visualizador, como no retrato.
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
            <span aria-hidden="true">🖼️</span> Add image
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
