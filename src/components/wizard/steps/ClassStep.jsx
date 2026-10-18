// =============================================================================
// ClassStep: o passo de classe (o template de referência dos passos)
// =============================================================================
// O QUE FAZ
//   Escolhe a classe original (índice 0) com a mesma entity e o mesmo seletor das
//   abas, e mostra o mesmo preview (DetailView), por ora sem os cards de Hit Die,
//   Saves e Skills (pedido do usuário). Nenhuma regra nova (DDL-0013).
//
// FUNÇÕES
//   cap(s): texto.
//   ClassStep(props): o passo.
//
// DECISÕES E ARMADILHAS
//   - Como o Builder: soma o ouro inicial da classe (só com a carteira padrão) e
//     semeia os scores recomendados (só sobre o padrão ou um spread já
//     auto-semeado, nunca sobre um digitado).
//   - Remover a classe reseta tudo dela (a regra da aba Class).
// -----------------------------------------------------------------------------

import { useMemo } from 'react';
import PickerField from '../../common/PickerField';
import DetailView from '../../common/DetailView';
import classEntity from '../../../selector/entities/class';
import { resolveClassObj } from '../../../engine/resolve';
import { seedStartingGold } from '../../../engine/startingGold';
import { recommendedScores, isDefaultScores, matchesAnyRecommendation } from '../../../engine/abilityMethods';
import { createClassEntry, ABILITIES } from '../../../schema/character';
import styles from './steps.module.css';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const HIDDEN_META = new Set(['Hit Die', 'Saves', 'Skills']);

export default function ClassStep({ character, db, onChange }) {
  const cls = character.classes?.[0] ?? createClassEntry(true);

  const previewEntity = useMemo(
    () => ({ ...classEntity, meta: (c, d) => classEntity.meta(c, d).filter((m) => !HIDDEN_META.has(m.label)) }),
    [],
  );
  const classObj = cls.classId ? resolveClassObj(db, cls.classId, cls.source) : null;

  const setClass = (raw) => {
    const classId = raw.name.toLowerCase();
    const nextClasses = character.classes.map((c, i) =>
      i === 0 ? { ...c, classId, source: raw.source, subclassId: null, subclassSource: null, choices: {} } : c,
    );
    let next = { ...character, classes: nextClasses };
    const currency = seedStartingGold(next, db);
    if (currency) next = { ...next, currency };
    const rec = recommendedScores(classId);
    if (rec && (isDefaultScores(next.scores, ABILITIES) || matchesAnyRecommendation(next.scores, ABILITIES))) {
      next = { ...next, scores: rec };
    }
    onChange(next);
  };

  const clearClass = () => {
    const nextClasses = character.classes.map((c, i) =>
      i === 0
        ? {
            ...c,
            classId: '',
            source: '',
            level: 1,
            subclassId: null,
            subclassSource: null,
            hitPoints: {},
            choices: {},
            spells: [],
          }
        : c,
    );
    onChange({ ...character, classes: nextClasses });
  };

  return (
    <div className={styles.step}>
      <p className={styles.callout}>
        Your class defines what your character does best. 
        It determines your main abilities, combat style, and role within the party, 
        whether that's a fearless warrior, a clever rogue, a powerful spellcaster, or a supportive leader.
      </p>

      <PickerField
        entity={classEntity}
        db={db}
        current={cls.classId ? { label: classObj?.name ?? cap(cls.classId), source: cls.source, id: `${cap(cls.classId)}|${cls.source}` } : null}
        placeholder="Choose a class…"
        showInfo={false}
        onSelect={setClass}
        onClear={clearClass}
      />

      {classObj && (
        <div className={styles.preview}>
          <DetailView entity={previewEntity} raw={classObj} db={db} capImage />
        </div>
      )}
    </div>
  );
}
