// =============================================================================
// BiographyTab - quem o personagem é (fora das regras)
// =============================================================================
// Campos de texto livre que não afetam derivação alguma: os quatro traços de
// roleplay do 5e (personality / ideals / bonds / flaws), a aparência, e os
// descritores físicos. Todos existem 1:1 no `system.details` do Foundry, então
// o export/import os leva e traz sem tradução.
//
// A HISTÓRIA do personagem NÃO está aqui: mora na aba Background, junto dos
// traços que ela justifica (ver BackgroundTab). Ela alimenta tanto a descrição
// do item de background quanto o `details.biography` do Foundry.
//
// Por ora são `textarea`/`input` comuns - o upgrade (editor rico) vem depois.
// -----------------------------------------------------------------------------

import { randomSuggestion } from '../../engine/suggestedCharacteristics';
import RoleplayField from '../common/RoleplayField';
import styles from './BiographyTab.module.css';

/** Os quatro traços do 5e: lista de entradas + randomizador (RoleplayField). */
const TRAIT_FIELDS = [
  { key: 'personality', label: 'Personality Traits', placeholder: 'How does this character behave?' },
  { key: 'ideals', label: 'Ideals', placeholder: 'What do they believe in?' },
  { key: 'bonds', label: 'Bonds', placeholder: 'Who or what do they care about?' },
  { key: 'flaws', label: 'Flaws', placeholder: 'What could bring them down?' },
];

/** Descritores curtos (uma linha cada). `type` só muda o teclado no mobile. */
const SHORT_FIELDS = [
  { key: 'age', label: 'Age' },
  { key: 'gender', label: 'Gender' },
  { key: 'height', label: 'Height' },
  { key: 'weight', label: 'Weight' },
  { key: 'hair', label: 'Hair' },
  { key: 'skin', label: 'Skin' },
  { key: 'eyes', label: 'Eyes' },
  { key: 'faith', label: 'Faith' },
];

/**
 * @param {object} props
 * @param {import('../../schema/character').Character} props.character
 * @param {object} [props.db]  compêndio (p/ o randomizador dos traços)
 * @param {(patch: object) => void} props.onChange  patch parcial de `identity`
 */
export default function BiographyTab({ character, db, onChange }) {
  const identity = character.identity ?? {};
  const set = (key) => (e) => onChange({ [key]: e.target.value });

  return (
    <div className={styles.tab}>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Traits</h3>
          <span className={styles.sectionHint}>Free text. Add entries or roll 🎲 for a suggestion.</span>
        </div>
        {TRAIT_FIELDS.map((f) => (
          <RoleplayField
            key={f.key}
            label={f.label}
            value={identity[f.key] ?? ''}
            placeholder={f.placeholder}
            onRandom={() => randomSuggestion(db, f.key)}
            onChange={(val) => onChange({ [f.key]: val })}
          />
        ))}
        <label className={styles.field}>
          <span className={styles.label}>Appearance</span>
          <textarea
            className={styles.textarea}
            rows={3}
            value={identity.appearance ?? ''}
            placeholder="What do people notice first?"
            onChange={set('appearance')}
          />
        </label>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Details</h3>
        </div>
        <div className={styles.grid}>
          {SHORT_FIELDS.map((f) => (
            <label key={f.key} className={styles.field}>
              <span className={styles.label}>{f.label}</span>
              <input
                className={styles.input}
                type="text"
                value={identity[f.key] ?? ''}
                onChange={set(f.key)}
              />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
