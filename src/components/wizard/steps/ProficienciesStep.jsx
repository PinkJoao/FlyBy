// =============================================================================
// ProficienciesStep - perícias, ferramentas e idiomas (Fase D2, passo 4)
// =============================================================================
// Unifica numa tela as escolhas de PROFICIÊNCIA de duas fontes:
//  - a CLASSE original - fatiando o choice-bag da classe por `kind` (skill/tool/
//    language) via `buildClassChoices` + `isProficiencyChoice` (o passo de
//    features, mais adiante, fatia o RESTO da MESMA lista - DDL-0013);
//  - a ORIGEM (background) - as `ORIGIN_CHOICES` padrão (2 perícias, 1 ferramenta,
//    1 idioma).
// Cada bloco escreve no seu próprio bag (`classes[0].choices` / `origin.choices`)
// e reusa o ChoiceList - nenhuma regra nova (guard-rail DDL-0013). O dedup entre
// as fontes vem de `ownedFromDb`, recomputado a cada escolha.
// -----------------------------------------------------------------------------

import { ownedFromDb } from '../../../engine/resolve';
import ChoiceList from '../../builder/ChoiceList';
import { buildClassChoices, isProficiencyChoice } from '../../builder/classChoices';
import { ORIGIN_CHOICES } from '../../builder/originChoices';
import styles from './steps.module.css';

export default function ProficienciesStep({ character, db, onChange }) {
  const owned = ownedFromDb(character, db);
  const origin = character.origin;
  const cls = character.classes?.[0] ?? null;
  const classChoices = cls?.classId ? buildClassChoices(db, cls, character).filter(isProficiencyChoice) : [];

  const setClassChoices = (choices) =>
    onChange({ ...character, classes: character.classes.map((c, i) => (i === 0 ? { ...c, choices } : c)) });
  const setOriginChoices = (choices) => onChange({ ...character, origin: { ...origin, choices } });

  return (
    <div className={styles.step}>
      <p className={styles.callout}>
        Your <strong>class</strong> and <strong>background</strong> determine which proficiencies you gain, 
        with each class offering a distinct selection of skills to choose from. 
        You can't select the same proficiency more than once.
      </p>

      {classChoices.length > 0 && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>From your class</span>
          <ChoiceList
            choices={classChoices}
            bag={cls.choices ?? {}}
            onChange={setClassChoices}
            db={db}
            owned={owned}
            character={character}
          />
        </div>
      )}

      <div className={styles.field}>
        <span className={styles.fieldLabel}>From your background</span>
        <ChoiceList
          choices={ORIGIN_CHOICES}
          bag={origin.choices ?? {}}
          onChange={setOriginChoices}
          db={db}
          owned={owned}
          character={character}
        />
      </div>

      {!cls?.classId && <p className={styles.note}>Choose a class first to see its skill and tool choices.</p>}
    </div>
  );
}
