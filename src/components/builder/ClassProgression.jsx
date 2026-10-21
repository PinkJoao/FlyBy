// =============================================================================
// ClassProgression: as features de classe e subclasse por nível, com a tabela
// =============================================================================
// O QUE FAZ
//   A visão da página de classe do 5e.tools, dentro da aba Class. Três modos pelos
//   botões Current e Full (nenhum marcado é o padrão): o padrão mostra o
//   DESBLOQUEADO (níveis até o atual); Current só o nível atual; Full de 1 a 20
//   (futuros esmaecidos). Tocar num botão ativo volta ao padrão. Cada nível
//   colapsa; feature de SUBCLASSE tem borda accent e tag; listas LONGAS começam
//   fechadas; a tabela mostra a linha atual e expande.
//
// FUNÇÕES
//   ClassProgression(props): a progressão.
//   FeatureCard(props): uma feature colapsável.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { classFeatureLevels, isLongFeature } from '../../engine/classProgression';
import EntryContent from '../common/EntryContent';
import ClassTableView from '../common/ClassTableView';
import styles from './ClassProgression.module.css';
import Icon from '../common/Icon';
import Collapse from '../common/Collapse';

export default function ClassProgression({ db, classId, classObj, subclass, level }) {
  const [mode, setMode] = useState('default');
  const [collapsed, setCollapsed] = useState(() => new Set());

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
        : levels.filter((l) => l.level <= level);

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
                <span className={isCollapsed ? `${styles.levelChevron} ${styles.levelChevronClosed}` : styles.levelChevron}>
                  <Icon name="chevron" />
                </span>
                Level {l.level}
                {l.level > level && <span className={styles.futureTag}>Locked</span>}
              </button>
              <Collapse open={!isCollapsed}>
                <div className={styles.levelFeatures}>
                  {l.features.map((f) => (
                    <FeatureCard key={f.key} feature={f} subclassName={subclass?.shortName} />
                  ))}
                </div>
              </Collapse>
            </div>
          );
        })
      )}
    </section>
  );
}

/** Card colapsável de uma feature. */
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
        <span className={open ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron}><Icon name="chevron" /></span>
      </button>
      <Collapse open={open}>
        <div className={styles.featureBody}>
          <EntryContent entries={feature.entries} />
        </div>
      </Collapse>
    </div>
  );
}
