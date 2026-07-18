// =============================================================================
// ClassProgression - features de classe/subclasse por nível + tabela (Fase 6+)
// =============================================================================
// Visão estilo página de classe do 5e.tools, dentro da aba Class:
//  - TRÊS modos, via os botões Current/Full (nenhum marcado = padrão):
//      • padrão (nada marcado): tudo DESBLOQUEADO (níveis ≤ atual);
//      • Current: só as features do NÍVEL ATUAL da classe;
//      • Full: 1..20 (níveis futuros esmaecidos).
//  - Cada NÍVEL colapsa (toque no cabeçalho "Level N").
//  - Feature de SUBCLASSE se diferencia por borda accent + tag.
//  - Listas LONGAS (invocations, maneuvers, metamagic…) começam FECHADAS.
//  - Tabela de progressão: mostra a LINHA do nível atual; botão expande a
//    tabela completa (linha atual destacada).
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { classFeatureLevels, isLongFeature } from '../../engine/classProgression';
import EntryContent from '../common/EntryContent';
import ClassTableView from '../common/ClassTableView';
import styles from './ClassProgression.module.css';

export default function ClassProgression({ db, classId, classObj, subclass, level }) {
  const [mode, setMode] = useState('default'); // 'default' | 'current' | 'full'
  const [collapsed, setCollapsed] = useState(() => new Set()); // níveis colapsados

  // Toque num botão marca o modo, ou DESMARCA (volta ao padrão) se já ativo.
  const toggleMode = (m) => setMode((cur) => (cur === m ? 'default' : m));
  const toggleLevel = (lvl) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(lvl)) next.delete(lvl);
      else next.add(lvl);
      return next;
    });

  const levels = classFeatureLevels(db, classId, classObj, subclass);
  const shown =
    mode === 'full'
      ? levels
      : mode === 'current'
        ? levels.filter((l) => l.level === level)
        : levels.filter((l) => l.level <= level); // padrão: desbloqueado

  return (
    <section className={styles.progression}>
      <div className={styles.head}>
        <h3 className={styles.title}>Features</h3>
        <div className={styles.modes}>
          <button
            type="button"
            className={mode === 'current' ? `${styles.modeBtn} ${styles.modeActive}` : styles.modeBtn}
            onClick={() => toggleMode('current')}
          >
            Current
          </button>
          <button
            type="button"
            className={mode === 'full' ? `${styles.modeBtn} ${styles.modeActive}` : styles.modeBtn}
            onClick={() => toggleMode('full')}
          >
            Full
          </button>
        </div>
      </div>

      <ClassTableView classObj={classObj} subclass={subclass} level={level} />

      {shown.length === 0 ? (
        <p className={styles.empty}>No features yet.</p>
      ) : (
        shown.map((l) => {
          const isCollapsed = collapsed.has(l.level);
          return (
            <div key={l.level} className={l.level > level ? `${styles.levelBlock} ${styles.future}` : styles.levelBlock}>
              <button
                type="button"
                className={styles.levelHead}
                onClick={() => toggleLevel(l.level)}
                aria-expanded={!isCollapsed}
              >
                <span className={styles.levelChevron}>{isCollapsed ? '▸' : '▾'}</span>
                Level {l.level}
                {l.level > level && <span className={styles.futureTag}>Locked</span>}
              </button>
              {!isCollapsed &&
                l.features.map((f) => (
                  <FeatureCard key={f.key} feature={f} subclassName={subclass?.shortName} />
                ))}
            </div>
          );
        })
      )}
    </section>
  );
}

/** Card colapsável de uma feature; listas longas começam fechadas. */
function FeatureCard({ feature, subclassName }) {
  const long = isLongFeature(feature.entries);
  const [open, setOpen] = useState(!long);
  const sub = feature.from === 'subclass';

  return (
    <div className={sub ? `${styles.feature} ${styles.featureSub}` : styles.feature}>
      <button type="button" className={styles.featureHead} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={styles.featureName}>{feature.name}</span>
        {sub && <span className={styles.subTag}>{subclassName ?? 'Subclass'}</span>}
        {!open && long && <span className={styles.longHint}>Options</span>}
        <span className={styles.chevron}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className={styles.featureBody}>
          <EntryContent entries={feature.entries} />
        </div>
      )}
    </div>
  );
}
