// =============================================================================
// SpellPicker: o seletor enxuto de magias do guia
// =============================================================================
// O QUE FAZ
//   Chips e "+ Add" sobre o SelectorPanel, escrevendo em `ClassEntry.spells` (o
//   mesmo da SpellbookTab). O painel abre com Class e Level PRÉ-MARCADOS (a lista
//   da classe e a faixa do passo), filtros comuns e desmarcáveis; sair do padrão
//   pede confirmação, como no fluxo de preparar.
//
// FUNÇÕES
//   SpellPicker(props): o seletor (`level` e `maxLevel` dão a faixa).
//
// DECISÕES E ARMADILHAS
//   - A lista inclui o que a feature ALARGA (TC-0043).
//   - TC-0031: o que vem de outra origem ganha badge, filtro pré-marcado e aviso.
//   - Esconde o escolhido E o que a origem SEMPRE concede (DDL-0046): preparar a
//     cópia desperdiça um slot e vira linha órfã se a subclasse mudar.
// -----------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import SelectorPanel from '../../../selector/SelectorPanel';
import { makeSpellEntity } from '../../../selector/entities/spell';
import { classSpellList, schoolName, castingTimeLabel, rangeLabel, spellLevelLabel } from '../../../engine/spells';
import { preparedElsewhere } from '../../../engine/spellcasting';
import { confirm } from '../../common/dialog';
import styles from './steps.module.css';

/**
 * O seletor de magias de uma faixa de círculos para o guia.
 * @param {object} props
 * @param {object} props.origin
 * @param {Array} [props.origins]
 * @param {object} props.db
 * @param {number} props.level
 * @param {number} [props.maxLevel]
 * @param {number} props.limit
 * @param {Array} props.current
 * @param {object} props.classEntry
 * @param {(uid, spells) => void} props.onChangeSpells
 */
export default function SpellPicker({ origin, origins, db, level, maxLevel, limit, current, classEntry, onChangeSpells }) {
  const [open, setOpen] = useState(false);
  const elsewhere = useMemo(() => preparedElsewhere(origins, origin.key), [origins, origin.key]);
  const pickerEntity = useMemo(
    () =>
      makeSpellEntity(db, {
        preparedElsewhere: elsewhere,
        addedToList: origin.expandedFrom ?? null,
        addedListClass: origin.spellListClass ?? null,
      }),
    [db, elsewhere, origin.expandedFrom, origin.spellListClass],
  );
  const listNames = useMemo(() => {
    const base = origin.spellListClass ? classSpellList(db, origin.spellListClass) : new Set();
    if (!origin.expandedSpells?.size) return base;
    return new Set([...base, ...origin.expandedSpells]);
  }, [db, origin.spellListClass, origin.expandedSpells]);

  const top = maxLevel ?? level;
  const picks = current ?? [];
  const noun = level === 0 ? 'cantrip' : 'spell';

  const setSpells = (spells) => onChangeSpells(origin.uid, spells);

  const add = async (raw) => {
    const warnings = [];
    if (!listNames.has(raw.name.toLowerCase())) {
      warnings.push(`${raw.name} is not on the ${origin.spellListClass} spell list.`);
    }
    if (raw.level < level || raw.level > top) {
      const range =
        level === top
          ? level === 0 ? 'cantrips' : `${spellLevelLabel(level).toLowerCase()} spells`
          : `spells of the ${spellLevelLabel(level).toLowerCase()} to ${spellLevelLabel(top).toLowerCase()}`;
      warnings.push(`This step picks ${range}; ${raw.name} is ${raw.level === 0 ? 'a cantrip' : `a ${spellLevelLabel(raw.level).toLowerCase()} spell`}.`);
    }
    const from = elsewhere.get(raw.name.toLowerCase());
    if (from) {
      warnings.push(`You already have ${raw.name} from ${from}.`);
    }
    if (warnings.length > 0) {
      const ok = await confirm({
        title: 'Add this spell?',
        message: `${warnings.join(' ')} Add it anyway?`,
        confirmLabel: 'Add anyway',
      });
      if (!ok) return;
    }
    setSpells([...(classEntry.spells ?? []), { id: raw.name, source: raw.source }]);
    setOpen(false);
  };
  const remove = (entry) => {
    const name = entry.raw.name.toLowerCase();
    setSpells((classEntry.spells ?? []).filter((s) => String(s.id ?? s.name).toLowerCase() !== name));
  };

  const ownedNames = new Set([
    ...picks.map((s) => s.raw.name.toLowerCase()),
    ...(origin.alwaysPrepared ?? []).map((s) => s.raw?.name?.toLowerCase()).filter(Boolean),
  ]);
  const exclude = (raw) => ownedNames.has(raw.name.toLowerCase());

  const levelValues = [];
  for (let l = level; l <= top; l++) levelValues.push(l === 0 ? 'Cantrip' : String(l));
  const initialFilterState = {
    level: Object.fromEntries(levelValues.map((v) => [v, 'include'])),
    class: { [origin.spellListClass]: 'include' },
    ...(elsewhere.size > 0 ? { owned: { yes: 'exclude' } } : {}),
  };

  return (
    <div className={styles.spellPick}>
      <div className={styles.spellHead}>
        <span className={styles.spellCount}>
          {picks.length} / {limit} chosen
        </span>
      </div>

      {picks.length > 0 && (
        <ul className={styles.spellList}>
          {picks.map((entry) => (
            <li key={entry.raw.name} className={styles.spellRow}>
              <span className={styles.spellName}>{entry.raw.name}</span>
              <span className={styles.spellMeta}>
                {[schoolName(entry.raw.school), castingTimeLabel(entry.raw), rangeLabel(entry.raw)]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <button
                type="button"
                className={styles.spellRemove}
                onClick={() => remove(entry)}
                aria-label={`Remove ${entry.raw.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {picks.length < limit ? (
        <button type="button" className={styles.spellAdd} onClick={() => setOpen(true)}>
          + Choose a {noun}
        </button>
      ) : (
        <p className={styles.spellDone}>You've chosen all your {noun}s. Remove one to swap it.</p>
      )}

      {open && (
        <SelectorPanel
          entity={pickerEntity}
          db={db}
          currentId={null}
          exclude={exclude}
          initialFilterState={initialFilterState}
          onSelect={add}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
