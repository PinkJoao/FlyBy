// =============================================================================
// FeaturesStep - escolhas de FEATURES da classe (Fase D2, passo de features)
// =============================================================================
// O OUTRO lado do fatiamento do choice-bag da classe (DDL-0013): o que NÃO é
// proficiência - featureoption (Divine/Primal Order…), optionalfeature (invocações,
// metamagic, maneuvers…), weapon mastery, expertise, feat/ASI de nível. Usa
// `buildClassChoices` + `isFeatureChoice`, escrevendo no MESMO `classes[0].choices`.
// O passo só é montado quando HÁ escolhas (o `when` do catálogo, via ctx do
// WizardPage), então não aparece vazio (ex: Artificer 1).
//
// Para o jogador saber o que está escolhendo, mostramos APENAS a descrição das
// features EM QUESTÃO (as que têm escolha), casando o rótulo da escolha com o nome
// da feature de classe - não a progressão inteira.
// -----------------------------------------------------------------------------

import { resolveClassObj, resolveSubclassObj, ownedFromDb } from '../../../engine/resolve';
import { classFeatureLevels } from '../../../engine/classProgression';
import { totalLevel } from '../../../schema/character';
import FeatureText from '../../common/FeatureText';
import ChoiceList from '../../builder/ChoiceList';
import { buildClassChoices, isFeatureChoice } from '../../builder/classChoices';
import { choiceComplete } from '../createGuideContext';
import styles from './steps.module.css';

/** Rótulo da escolha → nome da feature: tira o prefixo "Level N - " e normaliza. */
const featureKey = (label) => label.replace(/^Level\s+\d+\s*-\s*/i, '').trim().toLowerCase();

export default function FeaturesStep({ character, db, onChange, classUid, onlyLevel, unfilledOnly, allKinds }) {
  const owned = ownedFromDb(character, db);
  // Create usa a classe original (índice 0); level-up/fixup miram a classe por uid.
  const cls = (classUid ? character.classes?.find((c) => c.uid === classUid) : character.classes?.[0]) ?? null;
  const classObj = cls?.classId ? resolveClassObj(db, cls.classId, cls.source) : null;
  const subObj =
    cls?.classId && cls.subclassId ? resolveSubclassObj(db, cls.classId, cls.subclassId, cls.subclassSource) : null;
  // `allKinds`: no fixup, inclui também as proficiências da classe (perícias
  // resetadas ao trocar de classe, Primal Knowledge…), não só isFeatureChoice.
  // `onlyLevel`: restringe a um nível. `unfilledOnly`: só as que ainda faltam -
  // de TODOS os níveis (feat + weapon mastery cujo count cresceu, invocação…),
  // com completude PROFUNDA (um feat picked com sub-bag vazio ainda aparece,
  // TC-0013) - o mesmo `choiceComplete` do guia de criação e do fixup.
  const choices = cls?.classId
    ? buildClassChoices(db, cls, character)
        .filter((ch) => allKinds || isFeatureChoice(ch))
        .filter((ch) => onlyLevel == null || ch.level === onlyLevel)
        .filter((ch) => !unfilledOnly || !choiceComplete(ch, cls.choices, db, totalLevel(character)))
    : [];

  // Índice nome→feature (só níveis desbloqueados) para casar com cada escolha.
  const featureByName = new Map();
  if (classObj) {
    for (const l of classFeatureLevels(db, cls.classId, classObj, subObj)) {
      if (l.level > cls.level) continue;
      for (const f of l.features) if (!featureByName.has(f.name.toLowerCase())) featureByName.set(f.name.toLowerCase(), f);
    }
  }
  // As features EM QUESTÃO (uma por escolha, deduplicadas), na ordem das escolhas.
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

      {/* Descrição da(s) feature(s) que o jogador vai escolher. Quando o texto
          menciona a tabela (invocations, weapon mastery…), FeatureText a anexa. */}
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
