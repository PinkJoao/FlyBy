// =============================================================================
// FeaturesStep: o passo das escolhas de features da classe
// =============================================================================
// O QUE FAZ
//   O outro lado do fatiamento do bag da classe (DDL-0013): o que não é
//   proficiência (sub-features, optional features, maestria, expertise,
//   talentos). Só é montado quando HÁ escolhas. Mostra a descrição só das features
//   EM QUESTÃO, casando o rótulo da escolha com o nome da feature.
//
// FUNÇÕES
//   featureKey(label): o nome da feature a partir do rótulo.
//   FeaturesStep(props): o passo.
//
// DECISÕES E ARMADILHAS
//   - A criação usa a classe original; o fixup e o level-up miram por uid.
//   - `allKinds` (no fixup) inclui as proficiências da classe; `onlyLevel`
//     restringe a um nível; `unfilledOnly` mostra só o que falta, de todos os
//     níveis, com a completude profunda (TC-0013).
// -----------------------------------------------------------------------------

import { resolveClassObj, resolveSubclassObj, ownedFromDb } from '../../../engine/resolve';
import { classFeatureLevels } from '../../../engine/classProgression';
import { totalLevel } from '../../../schema/character';
import FeatureText from '../../common/FeatureText';
import ChoiceList from '../../builder/ChoiceList';
import { buildClassChoices, isFeatureChoice } from '../../builder/classChoices';
import { choiceComplete } from '../createGuideContext';
import styles from './steps.module.css';

/** O nome da feature a partir do rótulo da escolha. */
const featureKey = (label) => label.replace(/^Level\s+\d+\s*-\s*/i, '').trim().toLowerCase();

export default function FeaturesStep({ character, db, onChange, classUid, onlyLevel, unfilledOnly, allKinds }) {
  const owned = ownedFromDb(character, db);
  const cls = (classUid ? character.classes?.find((c) => c.uid === classUid) : character.classes?.[0]) ?? null;
  const classObj = cls?.classId ? resolveClassObj(db, cls.classId, cls.source) : null;
  const subObj =
    cls?.classId && cls.subclassId ? resolveSubclassObj(db, cls.classId, cls.subclassId, cls.subclassSource) : null;
  const choices = cls?.classId
    ? buildClassChoices(db, cls, character)
        .filter((ch) => allKinds || isFeatureChoice(ch))
        .filter((ch) => onlyLevel == null || ch.level === onlyLevel)
        .filter((ch) => !unfilledOnly || !choiceComplete(ch, cls.choices, db, totalLevel(character)))
    : [];

  const featureByName = new Map();
  if (classObj) {
    for (const l of classFeatureLevels(db, cls.classId, classObj, subObj)) {
      if (l.level > cls.level) continue;
      for (const f of l.features) if (!featureByName.has(f.name.toLowerCase())) featureByName.set(f.name.toLowerCase(), f);
    }
  }
  const seen = new Set();
  const describedFeatures = [];
  for (const ch of choices) {
    const f = featureByName.get(featureKey(ch.label));
    if (f && !seen.has(f.name)) {
      seen.add(f.name);
      describedFeatures.push(f);
    }
  }

  const setClassChoices = (next) =>
    onChange({
      ...character,
      classes: character.classes.map((c) => (c.uid === cls.uid ? { ...c, choices: next } : c)),
    });

  return (
    <div className={styles.step}>
      {!cls?.classId && <p className={styles.note}>Choose a class first to see its feature choices.</p>}

      {describedFeatures.map((f) => (
        <div key={f.name} className={styles.featureDesc}>
          <h3 className={styles.featureDescName}>{f.name}</h3>
          <FeatureText entries={f.entries} classObj={classObj} subclass={subObj} level={cls.level} />
        </div>
      ))}

      {choices.length > 0 && (
        <ChoiceList
          choices={choices}
          bag={cls.choices ?? {}}
          onChange={setClassChoices}
          db={db}
          owned={owned}
          character={character}
          guided
        />
      )}
    </div>
  );
}
