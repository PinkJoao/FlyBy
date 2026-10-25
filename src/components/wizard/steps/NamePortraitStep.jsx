// =============================================================================
// NamePortraitStep: o passo de nome e retrato
// =============================================================================
// O QUE FAZ
//   Grava `meta.name` e `meta.portrait` (o upload redimensionado por
//   fileToPortrait, uma URL, ou uma imagem colada). Arquivo ilegível mantém o
//   retrato atual.
//
// FUNÇÕES
//   NamePortraitStep(props): o passo.
//
// DECISÕES E ARMADILHAS
//   - Imagem colada como no retrato da página (CharacterIdentity): o Ctrl+V de uma
//     imagem em qualquer lugar do passo (colar texto no nome segue normal) e, no
//     celular, o campo de URL editável que recebe a imagem do teclado.
//   - Sugestões de retrato: a faixa (PortraitSuggestionStrip) sob o retrato, com
//     "See all" para a galeria (PortraitSuggestionsModal); só com `experimental`
//     ligado em settingsStore (DDL-0111, DDL-0124, DDL-0127).
// -----------------------------------------------------------------------------

import { useRef, useState } from 'react';
import useSettingsStore from '../../../store/settingsStore';
import { fileToPortrait } from '../../common/imageFile';
import { useImagePaste } from '../../common/imagePaste';
import ImageUrlField from '../../common/ImageUrlField';
import PortraitSuggestionsModal from '../../common/PortraitSuggestionsModal';
import PortraitSuggestionStrip from '../../common/PortraitSuggestionStrip';
import styles from './steps.module.css';
import Icon from '../../common/Icon';

export default function NamePortraitStep({ character, onChange }) {
  const meta = character.meta ?? {};
  const fileRef = useRef(null);
  const [url, setUrl] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const experimental = useSettingsStore((s) => s.experimental);

  const setName = (name) => onChange({ ...character, meta: { ...meta, name } });
  const setPortrait = (portrait) => onChange({ ...character, meta: { ...meta, portrait } });

  const applyFile = async (file) => {
    try {
      setPortrait(await fileToPortrait(file));
    } catch {
      /* arquivo ilegível: mantém o retrato atual */
    }
  };
  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) applyFile(file);
  };
  useImagePaste(applyFile);
  const applyUrl = () => {
    const u = url.trim();
    if (u) setPortrait(u);
    setUrl('');
  };

  return (
    <div className={styles.step}>
      <p className={styles.callout}>
        Give your character a name and, if you like, a face. The portrait is stored with the
        character, so it works offline and travels with your export. You can always change it later.
      </p>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Name</span>
        <input
          className={styles.textInput}
          type="text"
          value={meta.name === 'New Character' ? '' : (meta.name ?? '')}
          placeholder="Name your character…"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Portrait</span>
        <div className={styles.portraitRow}>
          <button
            type="button"
            className={styles.portraitBox}
            onClick={() => fileRef.current?.click()}
            title={meta.portrait ? 'Change portrait' : 'Add a portrait'}
          >
            {meta.portrait ? <img src={meta.portrait} alt="Portrait" /> : <span className={styles.portraitPlaceholder}><Icon name="portrait" /></span>}
          </button>
          <div className={styles.portraitControls}>
            <button type="button" className={styles.smallBtn} onClick={() => fileRef.current?.click()}>
              Upload image
            </button>
            {meta.portrait && (
              <button type="button" className={styles.smallBtn} onClick={() => setPortrait(null)}>
                Remove
              </button>
            )}
            <div className={styles.urlRow}>
              <ImageUrlField
                className={styles.textInput}
                value={url}
                placeholder="…or paste an image or URL"
                onChange={setUrl}
                onImage={applyFile}
                onSubmit={applyUrl}
              />
              <button type="button" className={styles.smallBtn} onClick={applyUrl} disabled={!url.trim()}>
                Use
              </button>
            </div>
          </div>
        </div>
        {experimental && (
          <PortraitSuggestionStrip
            character={character}
            onSelect={setPortrait}
            onSeeAll={() => setSuggestionsOpen(true)}
          />
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />

      {suggestionsOpen && experimental && (
        <PortraitSuggestionsModal
          character={character}
          onSelect={(selectedUrl) => {
            setPortrait(selectedUrl);
            setSuggestionsOpen(false);
          }}
          onClose={() => setSuggestionsOpen(false)}
        />
      )}
    </div>
  );
}
