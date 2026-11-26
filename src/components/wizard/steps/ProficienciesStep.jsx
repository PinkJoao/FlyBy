// =============================================================================
// ProficienciesStep: o passo de perícias, ferramentas e idiomas
// =============================================================================
// O QUE FAZ
//   Junta as escolhas de proficiência da CLASSE original (o bag da classe fatiado
//   por isProficiencyChoice) e da ORIGEM (as peças da aba, OriginParts: o que um
//   background pronto concede e o que sobra, DDL-0328). Cada bloco escreve no
//   próprio bag, com o ChoiceList; o dedup entre os dois vem de ownedFromDb.
//
// FUNÇÕES
//   ProficienciesStep(props): o passo.
// -----------------------------------------------------------------------------

import StepExplain from './StepExplain';
import { ownedFromDb } from '../../../engine/resolve';
import ChoiceList from '../../builder/ChoiceList';
import { buildClassChoices, isProficiencyChoice } from '../../builder/classChoices';
import { OriginChoices, OriginGranted } from '../../builder/OriginParts';
import styles from './steps.module.css';

export default function ProficienciesStep({ character, db, onChange }) {
  const owned = ownedFromDb(character, db);
  const cls = character.classes?.[0] ?? null;
  const classChoices = cls?.classId ? buildClassChoices(db, cls, character).filter(isProficiencyChoice) : [];

  const setClassChoices = (choices) =>
    onChange({ ...character, classes: character.classes.map((c, i) => (i === 0 ? { ...c, choices } : c)) });

  return (
    <div className={styles.step}>
      <StepExplain>
        Your <strong>class</strong> and <strong>background</strong> determine which proficiencies you gain, 
        with each class offering a distinct selection of skills to choose from. 
        You can't select the same proficiency more than once.
      </StepExplain>

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
        <OriginGranted character={character} db={db} />
        <OriginChoices character={character} db={db} onChangeOrigin={(o) => onChange({ ...character, origin: o })} />
      </div>

      {!cls?.classId && <p className={styles.note}>Choose a class first to see its skill and tool choices.</p>}
    </div>
  );
}
