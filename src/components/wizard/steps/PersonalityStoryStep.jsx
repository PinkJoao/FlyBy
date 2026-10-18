// =============================================================================
// PersonalityStoryStep: o passo de personalidade e história
// =============================================================================
// O QUE FAZ
//   Os quatro traços (listas de entradas com randomizador, RoleplayField) e a
//   HISTÓRIA (texto livre), em `identity`: os mesmos campos da BiographyTab e da
//   BackgroundTab, que mapeiam 1:1 no Foundry. Nada muda números.
//
// FUNÇÕES
//   PersonalityStoryStep(props): o passo.
// -----------------------------------------------------------------------------

import { randomSuggestion } from '../../../engine/suggestedCharacteristics';
import RoleplayField from '../../common/RoleplayField';
import styles from './steps.module.css';

const TRAIT_FIELDS = [
  { key: 'personality', label: 'Personality Traits', placeholder: 'How do they behave? Quirks, habits, the way they carry themselves…' },
  { key: 'ideals', label: 'Ideals', placeholder: 'What do they believe in or strive for?' },
  { key: 'bonds', label: 'Bonds', placeholder: 'Who or what do they care about most?' },
  { key: 'flaws', label: 'Flaws', placeholder: 'A weakness, fear, or vice that could bring them down.' },
];

export default function PersonalityStoryStep({ character, db, onChange }) {
  const identity = character.identity ?? {};
  const setField = (key, val) => onChange({ ...character, identity: { ...identity, [key]: val } });

  return (
    <div className={styles.step}>
      <p className={styles.callout}>
        This is the heart of who your character is, beyond the numbers. None of it changes your
        mechanics, it's for you and your table. Add as many entries as you like, or tap
        <strong> 🎲 </strong> to roll a suggestion drawn from every published background. You can keep
        writing on the sheet later.
      </p>

      {TRAIT_FIELDS.map((f) => (
        <RoleplayField
          key={f.key}
          label={f.label}
          value={identity[f.key] ?? ''}
          placeholder={f.placeholder}
          onRandom={() => randomSuggestion(db, f.key)}
          onChange={(val) => setField(f.key, val)}
        />
      ))}

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Story</span>
        <textarea
          className={styles.textArea}
          rows={6}
          value={identity.backstory ?? ''}
          placeholder="Where did they come from, and how did they end up an adventurer?"
          onChange={(e) => setField('backstory', e.target.value)}
        />
      </label>
    </div>
  );
}
