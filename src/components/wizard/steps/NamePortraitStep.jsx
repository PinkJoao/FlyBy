// =============================================================================
// NamePortraitStep - nome + retrato (Fase D2, passo 8a)
// =============================================================================
// Separado da história para dar espaço a cada um. Grava `meta.name` e
// `meta.portrait` (data-URL do upload, redimensionado por `fileToPortrait`, ou uma
// URL da web colada, como o seletor do Foundry). Sem regras - só apresentação.
// -----------------------------------------------------------------------------

import { useRef, useState } from 'react';
import { fileToPortrait } from '../../common/imageFile';
import styles from './steps.module.css';

export default function NamePortraitStep({ character, onChange }) {
  const meta = character.meta ?? {};
  const fileRef = useRef(null);
  const [url, setUrl] = useState('');

  const setName = (name) => onChange({ ...character, meta: { ...meta, name } });
  const setPortrait = (portrait) => onChange({ ...character, meta: { ...meta, portrait } });

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPortrait(await fileToPortrait(file));
    } catch {
      /* arquivo ilegível: mantém o retrato atual */
    }
  };
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
            {meta.portrait ? <img src={meta.portrait} alt="Portrait" /> : <span className={styles.portraitPlaceholder}>👤</span>}
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
              <input
                className={styles.textInput}
                type="url"
                value={url}
                placeholder="…or paste an URL"
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyUrl()}
              />
              <button type="button" className={styles.smallBtn} onClick={applyUrl} disabled={!url.trim()}>
                Use
              </button>
            </div>
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
  );
}
