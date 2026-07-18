// =============================================================================
// ClassTab - classe(s), nível, subclasse, escolhas de classe (Fase 5c)
// =============================================================================
// Multiclasse em SUB-ABAS (uma classe por vez) - evita clutter e não confunde as
// classes entre si. A 1ª entrada é a ORIGINAL (define os saves proficientes).
// Deriva ao vivo (Level/HP/saves). As escolhas de classe (perícias no nv1, e mais
// tarde ASI/talento/fighting style…) usam o ChoiceList e gravam em cls.choices.
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
import styles from './ClassTab.module.css';

const MAX_TOTAL = 20;

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default function ClassTab({ character, db, onChange }) {
  const classes = character.classes ?? [];
  const [activeIdx, setActiveIdx] = useState(0);
  const [autoOpenUid, setAutoOpenUid] = useState(null); // slot recém-criado → abre o seletor
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
  // Multiclasse exige atributos mínimos (da classe nova E das que já tem). Se não
  // cumpre, avisa e pede confirmação - como nos talentos.
  const pickClass = async (i, raw) => {
    const newId = raw.name.toLowerCase();
    // Ignora a classe do próprio slot (trocar/iniciar não é multiclasse).
    const unmet = unmetMulticlassReqs(db, character, newId, i);
    if (unmet.length > 0) {
      const lines = unmet.map((u) => `• ${capitalize(u.classId)}: ${u.text}`).join('\n');
      const ok = await confirm({
        title: 'Multiclass requirements',
        message: `This character does not meet the multiclass requirements:\n${lines}\n\nAdd it anyway?`,
        confirmLabel: 'Add anyway',
      });
      if (!ok) {
        // Declinou: se era um slot multiclasse recém-criado (vazio), descarta.
        if (!classes[i].classId && i > 0) removeClass(i);
        return;
      }
    }
    doPickClass(i, raw);
  };
  // REMOVER a classe (× no slot original) reseta TUDO que veio dela: nível,
  // subclasse, escolhas, magias e HP rolado voltam ao estado inicial. O nível só
  // se mantém numa TROCA DIRETA (pickClass sobre uma classe já escolhida) - aqui,
  // clicar × é uma remoção, não uma troca, então nada da classe antiga persiste
  // (senão a próxima classe herdaria o nível/decisões da excluída).
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
  // Só ajusta o nível; a LIMPEZA do level-down (poda de escolhas, reversão de
  // subclasse, aparo de Weapon Mastery/optional features) é centralizada no
  // Builder.setClasses, então vale para QUALQUER origem (topo ou aqui).
  const setLevel = (i, level) => updateClass(i, { level });
  // Trocar/remover subclasse descarta os picks concedidos por ELA (ids `sub:`),
  // senão perícias/ferramentas da subclasse antiga vazariam para a nova.
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
    setAutoOpenUid(entry.uid); // abre o seletor de classe direto
  };
  const removeClass = (i) => {
    onChange(classes.filter((_, x) => x !== i));
    setActiveIdx(Math.max(0, i - 1));
  };

  const c = classes[idx];
  const classObj = c.classId ? resolveClassObj(db, c.classId, c.source) : null;
  const parsed = classObj ? parseClass(classObj) : null;
  const maxForThis = MAX_TOTAL - (total - (c.level || 0));

  // Todos os descritores de escolha da classe (perícias, ferramentas, por nível,
  // subclasse, optional features…), montados pelo builder compartilhado com o
  // wizard - que fatia ESTA mesma lista por `kind` nos passos 4/8 (DDL-0013).
  const choices = buildClassChoices(db, c, character);

  return (
    <div className={styles.tab}>
      {/* Sub-abas: uma por classe (multiclasse) + adicionar. */}
      <nav className={styles.subTabs}>
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

      <div className={styles.classCard}>
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
          // Keyed por slot: cada classe ganha sua PRÓPRIA PickerField. Sem isto a
          // instância é reusada entre as sub-abas e o guard interno de "abrir 1×"
          // (didAuto) fica preso após o 1º add - a 3ª+ multiclasse, um add após
          // remover, ou um add após cancelar não reabririam o seletor.
          key={c.uid}
          entity={classEntity}
          db={db}
          current={
            // Label capitalizado (o id é minúsculo - mesmo caso do TC-0016).
            c.classId ? { label: capitalize(c.classId), source: c.source, id: `${capitalize(c.classId)}|${c.source}` } : null
          }
          placeholder="Choose class…"
          showInfo={false}
          autoOpen={!c.classId && c.uid === autoOpenUid}
          onSelect={(raw) => pickClass(idx, raw)}
          // Reaproveita o × do seletor: na original, limpa; na multiclasse, remove a aba.
          onClear={() => (idx > 0 ? removeClass(idx) : clearClass(idx))}
          // Cancelar o seletor de um slot multiclasse recém-criado (ainda vazio) descarta a aba.
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

      {/* Progressão de features (classe + subclasse) - descritivo, fica ABAIXO
          dos seletores/escolhas. */}
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
