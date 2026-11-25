// =============================================================================
// SubclassStep: o passo da subclasse (Fase D3, level-up)
// =============================================================================
// O QUE FAZ
//   Aparece quando a classe alcança o nível de subclasse sem ter uma. Reusa a
//   entity da aba Class num carrossel no próprio passo (InlineSelector, DDL-0286):
//   grava `subclassId` (shortName) e `subclassSource`, e descarta os grants `sub:`
//   da antiga.
//
// FUNÇÕES
//   cap(s), article(word): texto ("a" ou "an").
//   dropSubclassGrants(bag): tira os picks `sub:`.
//   SubclassStep(props): o passo.
//
// DECISÕES E ARMADILHAS
//   - Duas páginas no guia (useGuidePage, DDL-0289): a primeira só o texto que explica a
//     etapa, no estilo da abertura do guia (ícone e texto centrado, DDL-0291), a segunda a
//     escolha.
// -----------------------------------------------------------------------------

import { useMemo } from 'react';
import InlineSelector from '../../../selector/InlineSelector';
import { makeSubclassEntity } from '../../../selector/entities/subclass';
import { resolveClassObj, resolveSubclassObj } from '../../../engine/resolve';
import { parseClass } from '../../../engine/classData';
import styles from './steps.module.css';
import { useGuideNav, useGuidePage } from '../guidePages';
import Icon from '../../common/Icon';
import { classIcon } from '../../../selector/entities/class';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** "a" ou "an" conforme a inicial. */
const article = (word) => (/^[aeiou]/i.test(word ?? '') ? 'an' : 'a');

/** Descarta os picks da subclasse antiga. */
const dropSubclassGrants = (bag) =>
  Object.fromEntries(Object.entries(bag ?? {}).filter(([id]) => !id.startsWith('sub:')));

export default function SubclassStep({ character, db, onChange, classUid }) {
  const page = useGuidePage(2);
  const nav = useGuideNav();
  const cls = character.classes?.find((c) => c.uid === classUid) ?? null;
  const classObj = cls?.classId ? resolveClassObj(db, cls.classId, cls.source) : null;
  const parsed = classObj ? parseClass(classObj) : null;
  const title = parsed?.subclassTitle || 'Subclass';
  const entity = useMemo(() => makeSubclassEntity(cls?.classId, title), [cls?.classId, title]);

  const subObj =
    cls?.subclassId ? resolveSubclassObj(db, cls.classId, cls.subclassId, cls.subclassSource) : null;

  const setCls = (patch) =>
    onChange({ ...character, classes: character.classes.map((c) => (c.uid === classUid ? { ...c, ...patch } : c)) });

  const pick = (raw) =>
    setCls({ subclassId: raw.shortName, subclassSource: raw.source, choices: dropSubclassGrants(cls.choices) });
  const clear = () =>
    setCls({ subclassId: null, subclassSource: null, choices: dropSubclassGrants(cls.choices) });

  if (!cls?.classId) return <p className={styles.note}>No class to choose a subclass for.</p>;

  if (page === 0) {
    return (
      <div className={styles.step}>
        <div className={styles.introBlock}>
          <span className={styles.introEmoji}><Icon name={classIcon(cls.classId)} /></span>
          <p className={styles.introText}>
            This is where your <strong>{cap(cls.classId)}</strong> chooses {article(title)}{' '}
            <strong>{title}</strong> - a specialization that shapes many of the features you'll gain from
            here on. Pick the one that fits the character you have in mind.
          </p>
          <p className={styles.introText}>Hit Next to see the options, then swipe through them.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.step}>
      <InlineSelector
        entity={entity}
        db={db}
        currentId={subObj ? entity.idOf(subObj) : null}
        onSelect={pick}
        onClear={clear}
        onChoose={(raw) => {
          pick(raw);
          nav?.next({ force: true });
        }}
      />
    </div>
  );
}
