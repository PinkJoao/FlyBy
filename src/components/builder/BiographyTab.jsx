// =============================================================================
// BiographyTab: quem o personagem é, fora das regras
// =============================================================================
// O QUE FAZ
//   Texto livre que não afeta derivação nenhuma: os quatro traços de roleplay
//   (personality, ideals, bonds, flaws, com o randomizador do RoleplayField), a
//   aparência e os descritores físicos. Tudo existe 1:1 no `system.details` do
//   Foundry. A HISTÓRIA mora na aba Background. Por ora são textarea e input
//   comuns; o editor rico vem depois.
//
// FUNÇÕES
//   BiographyTab(props): a aba (`onChange` recebe um patch de `identity`).
// -----------------------------------------------------------------------------

import { randomSuggestion } from '../../engine/suggestedCharacteristics';
import RoleplayField from '../common/RoleplayField';
import { TUT } from '../../tutorial/anchors';
import styles from './BiographyTab.module.css';

const TRAIT_FIELDS = [
  { key: 'personality', label: 'Personality Traits', placeholder: 'How does this character behave?' },
  { key: 'ideals', label: 'Ideals', placeholder: 'What do they believe in?' },
  { key: 'bonds', label: 'Bonds', placeholder: 'Who or what do they care about?' },
  { key: 'flaws', label: 'Flaws', placeholder: 'What could bring them down?' },
];

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
 * A aba de biografia.
 * @param {object} props
 * @param {import('../../schema/character').Character} props.character
 * @param {object} [props.db]
 * @param {(patch: object) => void} props.onChange
 */
export default function BiographyTab({ character, db, onChange }) {
  const identity = character.identity ?? {};
  const set = (key) => (e) => onChange({ [key]: e.target.value });

  return (
    <div className={styles.tab}>
      <section className={styles.section} data-tour={TUT.TAB_BIO_TRAITS}>
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

      <section className={styles.section} data-tour={TUT.TAB_BIO_DETAILS}>
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
