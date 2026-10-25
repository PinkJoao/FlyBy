// =============================================================================
// CharacterIdentity: retrato, nome e classe da página do personagem
// =============================================================================
// O QUE FAZ
//   O bloco de identidade do topo da página (DDL-0119), o MESMO nos modos ficha e
//   jogo: o retrato (adicionar por upload, URL ou imagem colada, ver em tela cheia,
//   trocar, baixar, remover), o nome editável e a linha da classe. À direita fica um lugar vazio
//   (`slotRef`) onde cada modo põe o seu controle: o nível na ficha, os descansos no
//   jogo.
//
// FUNÇÕES
//   CharacterIdentity(props): o bloco.
//     rename(name), applyPortraitFile(file), onPortraitFile(e), setPortraitUrl(url),
//     clearPortrait(), onPortraitClick(): o nome e o retrato.
//   portraitFilename(name, src): o nome do arquivo para baixar o retrato.
//   PortraitViewer(props): o retrato em tela cheia (trocar, baixar, remover).
//   PortraitSourceModal(props): upload, URL ou imagem colada.
//
// DECISÕES E ARMADILHAS
//   - Nome e retrato são editáveis nos dois modos: não mudam a jogatina, e travar
//     no modo jogo só obrigaria a trocar de modo para corrigir um nome.
//   - O bloco vive na pages/Character, FORA do conteúdo de cada modo: não remonta na
//     troca, então nunca anima nem pisca.
//   - O CSS é o da ficha (Builder.module.css): .identity e o resto continuam lá.
//   - Retrato: o upload vira data-URL redimensionada; a URL da web é guardada
//     direto (como o seletor de imagem do Foundry).
//   - Imagem COLADA: com o escolhedor ou o retrato em tela cheia abertos, o Ctrl+V
//     de uma imagem em qualquer lugar a usa (useImagePaste); no celular, o campo de
//     URL é editável e recebe a imagem do teclado (ImageUrlField). As duas vão pelo
//     mesmo caminho do upload (fileToPortrait).
// -----------------------------------------------------------------------------

import { useRef, useState } from 'react';
import { classSummary } from '../../schema/character';
import { fileToPortrait } from '../common/imageFile';
import { useImagePaste } from '../common/imagePaste';
import ImageUrlField from '../common/ImageUrlField';
import { useBackLayer } from '../../hooks/useBack';
import { TUT } from '../../tutorial/anchors';
import Icon from '../common/Icon';
import styles from '../../pages/Builder.module.css';

/**
 * O bloco de identidade.
 * @param {{ character: object, save: Function, slotRef: Function }} props
 */
export default function CharacterIdentity({ character, save, slotRef }) {
  const fileRef = useRef(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const rename = (name) => save({ ...character, meta: { ...character.meta, name } });

  const applyPortraitFile = async (file) => {
    try {
      const portrait = await fileToPortrait(file);
      save({ ...character, meta: { ...character.meta, portrait } });
      setPickerOpen(false);
      setViewerOpen(false);
    } catch {
      // arquivo ilegível/não-imagem: mantém como está
    }
  };
  const onPortraitFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) applyPortraitFile(file);
  };
  useImagePaste(applyPortraitFile, pickerOpen || viewerOpen);
  const setPortraitUrl = (url) => {
    save({ ...character, meta: { ...character.meta, portrait: url } });
    setPickerOpen(false);
    setViewerOpen(false);
  };
  const clearPortrait = () => {
    save({ ...character, meta: { ...character.meta, portrait: null } });
    setViewerOpen(false);
  };
  const onPortraitClick = () => {
    if (character.meta.portrait) setViewerOpen(true);
    else setPickerOpen(true);
  };

  return (
    <>
      <div className={styles.identity} data-tour={TUT.SHEET_IDENTITY}>
        <div className={styles.portraitWrap}>
          <button
            type="button"
            className={
              character.meta.portrait ? `${styles.portrait} ${styles.portraitFilled}` : styles.portrait
            }
            title={character.meta.portrait ? 'View portrait' : 'Add a portrait'}
            onClick={onPortraitClick}
          >
            {character.meta.portrait ? <img src={character.meta.portrait} alt="Portrait" /> : <Icon name="portrait" />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onPortraitFile}
          />
        </div>
        <div className={styles.nameWrap}>
          <input
            className={styles.name}
            value={character.meta.name}
            onChange={(e) => rename(e.target.value)}
            placeholder="Character name"
          />
          <p className={styles.sub}>{classSummary(character) || 'No class set'}</p>
        </div>
        <div ref={slotRef} className={styles.levelSlot} data-tour={TUT.SHEET_LEVEL} />
      </div>

      {viewerOpen && character.meta.portrait && (
        <PortraitViewer
          src={character.meta.portrait}
          name={character.meta.name}
          onChange={() => {
            setViewerOpen(false);
            setPickerOpen(true);
          }}
          onRemove={clearPortrait}
          onClose={() => setViewerOpen(false)}
        />
      )}

      {pickerOpen && (
        <PortraitSourceModal
          onUpload={() => {
            setPickerOpen(false);
            fileRef.current?.click();
          }}
          onUseUrl={setPortraitUrl}
          onImage={applyPortraitFile}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

/** O nome do arquivo para baixar o retrato. */
function portraitFilename(name, src) {
  let ext = 'png';
  if (/^data:/.test(src)) {
    const mime = String(src).slice(5, String(src).indexOf(';'));
    ext = (mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
  } else {
    const m = String(src).match(/\.([a-zA-Z0-9]{2,4})(?:[?#]|$)/);
    if (m) ext = m[1].toLowerCase();
  }
  const base = (name || 'character').trim().replace(/[^\w-]+/g, '-').toLowerCase() || 'character';
  return `${base}-portrait.${ext}`;
}

/** O retrato em tela cheia: trocar, baixar, remover. */
function PortraitViewer({ src, name, onChange, onRemove, onClose }) {
  useBackLayer(true, onClose);
  return (
    <div className={styles.viewerOverlay} onClick={onClose}>
      <img className={styles.viewerImg} src={src} alt="Portrait" onClick={(e) => e.stopPropagation()} />
      <div className={styles.viewerActions} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.viewerBtn} onClick={onChange}>
          Change
        </button>
        <a className={styles.viewerBtn} href={src} download={portraitFilename(name, src)}>
          Download
        </a>
        <button type="button" className={`${styles.viewerBtn} ${styles.viewerDanger}`} onClick={onRemove}>
          Remove
        </button>
      </div>
      <button type="button" className={styles.viewerClose} onClick={onClose} aria-label="Close">
        <Icon name="close" />
      </button>
    </div>
  );
}

/** O escolhedor da fonte do retrato: upload, URL ou imagem colada. */
function PortraitSourceModal({ onUpload, onUseUrl, onImage, onClose }) {
  const [url, setUrl] = useState('');
  useBackLayer(true, onClose);
  const submitUrl = (e) => {
    e?.preventDefault();
    const trimmed = url.trim();
    if (trimmed) onUseUrl(trimmed);
  };
  return (
    <div className={styles.sourceOverlay} onClick={onClose}>
      <div className={styles.sourcePanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sourceHead}>
          <h2>Add portrait</h2>
          <button type="button" className={styles.viewerClose} onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <button type="button" className={styles.sourceUploadBtn} onClick={onUpload}>
          Upload from device
        </button>
        <div className={styles.sourceDivider}>
          <span>or</span>
        </div>
        <form className={styles.sourceUrlRow} onSubmit={submitUrl}>
          <ImageUrlField
            className={styles.sourceUrlInput}
            placeholder="Paste an image or URL"
            value={url}
            onChange={setUrl}
            onImage={onImage}
            onSubmit={submitUrl}
            autoFocus
          />
          <button type="submit" className={styles.sourceUrlBtn} disabled={!url.trim()}>
            Use URL
          </button>
        </form>
      </div>
    </div>
  );
}
