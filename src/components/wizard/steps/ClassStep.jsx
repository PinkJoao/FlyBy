// =============================================================================
// ClassStep - a tela de CLASSE do wizard (Fase D2, template de referência)
// =============================================================================
// Nível 1, classe única: escolhe a classe original. Reusa o mesmo `classEntity`
// + `SelectorPanel` (via PickerField) das abas, e semeia o ouro inicial como o
// Builder faz - nenhuma regra nova, só a apresentação guiada (guard-rail DDL-0013).
//
// Depois de escolher, mostra o MESMO preview do seletor (arte + cards de meta +
// lore), via DetailView, escondendo por ora os cards de Hit Die / Saves / Skills.
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

// Cards de meta escondidos POR ORA (pedido do usuário) - o resto (categoria de
// conjurador, atributo principal, armadura, armas) segue no preview.
const HIDDEN_META = new Set(['Hit Die', 'Saves', 'Skills']);

export default function ClassStep({ character, db, onChange }) {
  // No wizard de criação (nível 1) mexemos SEMPRE na classe original (índice 0).
  const cls = character.classes?.[0] ?? createClassEntry(true);

  // Entity de preview = a de classe, sem os cards ainda ocultos.
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
    // Mesma regra do Builder: soma o ouro inicial da classe (só se ainda padrão).
    const currency = seedStartingGold(next, db);
    if (currency) next = { ...next, currency };
    // Semeia os scores recomendados da classe (tabela PHB) - só sobre o padrão
    // intocado ou um spread já auto-semeado de outra classe, nunca sobre um
    // spread digitado à mão. Vale p/ todos os métodos (é permutação do array).
    const rec = recommendedScores(classId);
    if (rec && (isDefaultScores(next.scores, ABILITIES) || matchesAnyRecommendation(next.scores, ABILITIES))) {
      next = { ...next, scores: rec };
    }
    onChange(next);
  };

  // Remover a classe reseta TUDO que veio dela (nível/subclasse/escolhas/magias/
  // HP) - mesma regra da aba Class: clicar × é remoção, não troca (só a troca
  // direta preserva o nível).
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
