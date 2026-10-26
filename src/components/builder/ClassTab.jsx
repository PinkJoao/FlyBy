// =============================================================================
// ClassTab: a aba de classe: classes, nível, subclasse e escolhas (Fase 5c)
// =============================================================================
// O QUE FAZ
//   Multiclasse em SUB-ABAS (uma classe por vez). A 1ª entrada é a ORIGINAL (define
//   os saves). Deriva ao vivo; as escolhas usam o ChoiceList e gravam em
//   `cls.choices`. Os descritores vêm de buildClassChoices, o mesmo builder que o
//   wizard fatia por kind (DDL-0013). A progressão fica ABAIXO dos seletores.
//
// FUNÇÕES
//   capitalize(s): o rótulo da classe (o id é minúsculo, TC-0016).
//   ClassTab(props): a aba.
//
// DECISÕES E ARMADILHAS
//   - Multiclasse exige os atributos da classe nova e das que já tem: avisa e
//     confirma, como nos talentos. A classe do próprio slot é ignorada (trocar não
//     é multiclasse). Declinar num slot novo vazio o descarta.
//   - REMOVER a classe (o x no slot original) zera tudo dela; só uma TROCA direta
//     mantém o nível. Senão a próxima classe herdaria o que veio da excluída.
//   - O nível só muda aqui; a LIMPEZA do level-down é central, no
//     Builder.setClasses. Trocar ou remover a subclasse descarta os picks `sub:`.
//   - Cancelar o seletor de um slot multiclasse novo descarta a aba; o x da
//     multiclasse remove a aba.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { createClassEntry } from '../../schema/character';
import { resolveClassObj, resolveSubclassObj, ownedFromDb } from '../../engine/resolve';
import { parseClass } from '../../engine/classData';
import { unmetMulticlassReqs } from '../../engine/multiclass';
import { buildClassChoices } from './classChoices';
import PickerField from '../common/PickerField';
import Stepper from '../common/Stepper';
import ChoiceList from './ChoiceList';
import ClassProgression from './ClassProgression';
import classEntity from '../../selector/entities/class';
import { makeSubclassEntity } from '../../selector/entities/subclass';
import { confirm } from '../common/dialog';
import { TUT } from '../../tutorial/anchors';
import styles from './ClassTab.module.css';

const MAX_TOTAL = 20;

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default function ClassTab({ character, db, onChange }) {
  const classes = character.classes ?? [];
  const [activeIdx, setActiveIdx] = useState(0);
  const [autoOpenUid, setAutoOpenUid] = useState(null);
  const idx = Math.min(activeIdx, classes.length - 1);

  const subclassLevel = character.rulesConfig?.subclassLevel ?? 3;
  const total = classes.reduce((sum, c) => sum + (c.level || 0), 0);
  const takenClassIds = new Set(classes.map((c) => c.classId).filter(Boolean));
  const owned = ownedFromDb(character, db);

  const updateClass = (i, patch) => onChange(classes.map((c, x) => (x === i ? { ...c, ...patch } : c)));
  const doPickClass = (i, raw) =>
    updateClass(i, {
      classId: raw.name.toLowerCase(),
      source: raw.source,
      subclassId: null,
      subclassSource: null,
      choices: {},
    });
  const pickClass = async (i, raw) => {
    const newId = raw.name.toLowerCase();
    const unmet = unmetMulticlassReqs(db, character, newId, i);
    if (unmet.length > 0) {
      const lines = unmet.map((u) => `• ${capitalize(u.classId)}: ${u.text}`).join('\n');
      const ok = await confirm({
        title: 'Multiclass requirements',
        message: `This character does not meet the multiclass requirements:\n${lines}\n\nAdd it anyway?`,
        confirmLabel: 'Add anyway',
      });
      if (!ok) {
        if (!classes[i].classId && i > 0) removeClass(i);
        return;
      }
    }
    doPickClass(i, raw);
  };
  const clearClass = (i) =>
    updateClass(i, {
      classId: '',
      source: '',
      level: 1,
      subclassId: null,
      subclassSource: null,
      hitPoints: {},
      choices: {},
      spells: [],
    });
  const setLevel = (i, level) => updateClass(i, { level });
  const dropSubclassGrants = (bag) =>
    Object.fromEntries(Object.entries(bag ?? {}).filter(([id]) => !id.startsWith('sub:')));
  const pickSubclass = (i, raw) =>
    updateClass(i, { subclassId: raw.shortName, subclassSource: raw.source, choices: dropSubclassGrants(classes[i].choices) });
  const clearSubclass = (i) =>
    updateClass(i, { subclassId: null, subclassSource: null, choices: dropSubclassGrants(classes[i].choices) });
  const setClassChoices = (i, choices) => updateClass(i, { choices });

  const addClass = () => {
    const entry = createClassEntry(false);
    onChange([...classes, entry]);
    setActiveIdx(classes.length);
    setAutoOpenUid(entry.uid);
  };
  const removeClass = (i) => {
    onChange(classes.filter((_, x) => x !== i));
    setActiveIdx(Math.max(0, i - 1));
  };

  const c = classes[idx];
  const classObj = c.classId ? resolveClassObj(db, c.classId, c.source) : null;
  const parsed = classObj ? parseClass(classObj) : null;
  const maxForThis = MAX_TOTAL - (total - (c.level || 0));

  const choices = buildClassChoices(db, c, character);

  return (
    <div className={styles.tab}>
      <nav className={styles.subTabs} data-wheel-x="" data-tour={TUT.TAB_CLASS_TABS}>
        {classes.map((cl, i) => (
          <button
            key={cl.uid}
            type="button"
            className={i === idx ? `${styles.subTab} ${styles.subTabActive}` : styles.subTab}
            onClick={() => setActiveIdx(i)}
          >
            {cl.classId ? `${capitalize(cl.classId)} ${cl.level}` : 'New class'}
          </button>
        ))}
        {total < MAX_TOTAL && (
          <button type="button" className={styles.addTab} onClick={addClass} aria-label="Add class">
            +
          </button>
        )}
      </nav>

      <div className={styles.classCard} data-tour={TUT.TAB_CLASS_CARD}>
        <div className={styles.classTop}>
          <span className={styles.multiBadge}>{c.isOriginalClass ? 'Original' : 'Multiclass'}</span>
          {c.classId && (
            <div className={styles.levelControl}>
              <span className={styles.levelLabel}>Level</span>
              <Stepper
                value={c.level}
                min={1}
                max={maxForThis}
                maxDigits={2}
                onChange={(n) => setLevel(idx, n)}
                ariaLabel="Level"
                bg= 'var(--bg-soft)'
                buttonSize={30}
                fontSize={16}
                numberWidth="2.5ch"
              />
            </div>
          )}
        </div>

        <PickerField
          // ATENÇÃO: a key por slot dá a cada classe o PRÓPRIO PickerField; sem ela o autoOpen trava.
          key={c.uid}
          entity={classEntity}
          db={db}
          current={
            c.classId ? { label: capitalize(c.classId), source: c.source, id: `${capitalize(c.classId)}|${c.source}` } : null
          }
          placeholder="Choose class…"
          showInfo={false}
          autoOpen={!c.classId && c.uid === autoOpenUid}
          onSelect={(raw) => pickClass(idx, raw)}
          onClear={() => (idx > 0 ? removeClass(idx) : clearClass(idx))}
          onClose={() => {
            if (!c.classId && idx > 0) removeClass(idx);
          }}
          exclude={(raw) => {
            const id = raw.name.toLowerCase();
            return id !== c.classId && takenClassIds.has(id);
          }}
        />

        {c.classId && c.level >= subclassLevel && (
          <div>
            <span className={styles.subLabel}>{parsed?.subclassTitle || 'Subclass'}</span>
            <PickerField
              entity={makeSubclassEntity(c.classId, parsed?.subclassTitle || 'Subclass')}
              db={db}
              current={
                c.subclassId ? { label: c.subclassId, source: c.subclassSource, id: `${c.subclassId}|${c.subclassSource}` } : null
              }
              placeholder="Choose subclass…"
              showInfo={false}
              onSelect={(raw) => pickSubclass(idx, raw)}
              onClear={() => clearSubclass(idx)}
            />
          </div>
        )}

        {choices.length > 0 && (
          <div className={styles.choices}>
            <ChoiceList
              choices={choices}
              bag={c.choices ?? {}}
              onChange={(ch) => setClassChoices(idx, ch)}
              db={db}
              owned={owned}
              character={character}
            />
          </div>
        )}
      </div>

      {c.classId && classObj && (
        <ClassProgression
          db={db}
          classId={c.classId}
          classObj={classObj}
          subclass={c.subclassId ? resolveSubclassObj(db, c.classId, c.subclassId, c.subclassSource) : null}
          level={c.level}
        />
      )}

      <p className={styles.summary}>
        Total level: {total} / {MAX_TOTAL}
      </p>
    </div>
  );
}
