// =============================================================================
// ClassStep: o passo de classe (o template de referência dos passos)
// =============================================================================
// O QUE FAZ
//   Escolhe a classe original (índice 0) com a mesma entity das abas, num carrossel
//   no próprio passo (InlineSelector, DDL-0286): a arte, o resumo e as chips de cada
//   classe à vista, deslizar e "Choose"; "Search and filter" abre o painel completo.
//   Nenhuma regra nova (DDL-0013).
//
// FUNÇÕES
//   ClassStep(props): o passo.
//
// DECISÕES E ARMADILHAS
//   - Como o Builder: soma o ouro inicial da classe (só com a carteira padrão) e
//     semeia os scores recomendados (só sobre o padrão ou um spread já
//     auto-semeado, nunca sobre um digitado).
//   - Remover a classe reseta tudo dela (a regra da aba Class).
//   - Duas páginas no guia (useGuidePage, DDL-0289): a primeira só o texto que explica a
//     etapa, no estilo da abertura do guia (ícone e texto centrado, DDL-0291), a segunda a
//     escolha.
// -----------------------------------------------------------------------------

import InlineSelector from '../../../selector/InlineSelector';
import classEntity from '../../../selector/entities/class';
import { resolveClassObj } from '../../../engine/resolve';
import { seedStartingGold } from '../../../engine/startingGold';
import { recommendedScores, isDefaultScores, matchesAnyRecommendation } from '../../../engine/abilityMethods';
import { createClassEntry, ABILITIES } from '../../../schema/character';
import styles from './steps.module.css';
import { useGuideNav, useGuidePage } from '../guidePages';
import Icon from '../../common/Icon';

export default function ClassStep({ character, db, onChange }) {
  const page = useGuidePage(2);
  const nav = useGuideNav();
  const cls = character.classes?.[0] ?? createClassEntry(true);

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

  if (page === 0) {
    return (
      <div className={styles.step}>
        <div className={styles.introBlock}>
          <span className={styles.introEmoji}><Icon name={'originClass'} /></span>
          <p className={styles.introText}>
            Your class defines what your character does best. 
            It determines your main abilities, combat style, and role within the party, 
            whether that's a fearless warrior, a clever rogue, a powerful spellcaster, or a supportive leader.
          </p>
          <p className={styles.introText}>Hit Next to see the options, then swipe through them.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.step}>
      <InlineSelector
        entity={classEntity}
        db={db}
        currentId={classObj ? classEntity.idOf(classObj) : null}
        onSelect={setClass}
        onClear={clearClass}
        onChoose={(raw) => {
          setClass(raw);
          nav?.next({ force: true });
        }}
      />
    </div>
  );
}
