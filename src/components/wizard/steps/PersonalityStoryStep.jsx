// =============================================================================
// PersonalityStoryStep - personalidade + história (Fase D2, passo 8b)
// =============================================================================
// Texto livre de roleplay: os quatro traços do 5e (personality/ideals/bonds/
// flaws) e a HISTÓRIA (backstory). Grava em `character.identity` - os mesmos
// campos da BiographyTab/BackgroundTab, que mapeiam 1:1 em `details` no Foundry.
// Nada aqui muda números (guard-rail DDL-0013).
//
// Os quatro traços viram LISTAS de entradas (RoleplayField): o jogador adiciona
// quantas quiser, randomiza cada uma a partir das "Suggested Characteristics" de
// todos os backgrounds (engine/suggestedCharacteristics), edita e exclui à parte.
// O backstory segue como texto livre.
// -----------------------------------------------------------------------------

import { randomSuggestion } from '../../../engine/suggestedCharacteristics';
import RoleplayField from '../../common/RoleplayField';
import styles from './steps.module.css';

// Os quatro traços (viram listas de entradas + randomizador).
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
