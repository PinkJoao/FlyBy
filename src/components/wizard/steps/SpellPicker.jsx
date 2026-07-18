// =============================================================================
// SpellPicker - seletor enxuto de magias de UM nível para o wizard
// =============================================================================
// As telas de Cantrips e de Magias de nível 1 do wizard usam este seletor
// direto (chips + "+ Add"), no espírito da tela de features: só o essencial.
// Escreve em `ClassEntry.spells` (o MESMO store da SpellbookTab, sem fork) via
// `SelectorPanel` + `makeSpellEntity`. Para o novato, o painel abre com os
// filtros de Class e Level PRÉ-MARCADOS na lista da classe e na faixa certa
// (cantrip = 0, magias = 1) - mas são filtros comuns, desmarcáveis (o mestre
// pode liberar outra lista/círculo); sair do padrão pede confirmação, como no
// fluxo de preparar da SpellbookTab. O `exclude` só esconde o já escolhido.
// -----------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import SelectorPanel from '../../../selector/SelectorPanel';
import { makeSpellEntity } from '../../../selector/entities/spell';
import { classSpellList, schoolName, castingTimeLabel, rangeLabel, spellLevelLabel } from '../../../engine/spells';
import { confirm } from '../../common/dialog';
import styles from './steps.module.css';

/**
 * @param {object} props
 * @param {object} props.origin       origem de classe (derived.spellcasting.origins)
 * @param {object} props.db
 * @param {number} props.level        piso do círculo (0 = cantrips, 1 = nível 1)
 * @param {number} [props.maxLevel]   teto do círculo (default = level). No level-up
 *   as magias vão de 1 até o círculo máximo preparável.
 * @param {number} props.limit        quantas escolher (cantripLimit / prepareLimit)
 * @param {Array}  props.current      magias já escolhidas nessa faixa (resolvidas, com .raw)
 * @param {object} props.classEntry   a entrada de classe (p/ ler/escrever .spells)
 * @param {(uid, spells) => void} props.onChangeSpells
 */
export default function SpellPicker({ origin, db, level, maxLevel, limit, current, classEntry, onChangeSpells }) {
  const [open, setOpen] = useState(false);
  const pickerEntity = useMemo(() => makeSpellEntity(db), [db]);
  const listNames = useMemo(
    () => (origin.spellListClass ? classSpellList(db, origin.spellListClass) : new Set()),
    [db, origin.spellListClass],
  );

  const top = maxLevel ?? level; // teto da faixa (single-level quando ausente)
  const picks = current ?? [];
  const noun = level === 0 ? 'cantrip' : 'spell';

  const setSpells = (spells) => onChangeSpells(origin.uid, spells);

  const add = async (raw) => {
    // Fora do padrão do passo (lista da classe / faixa de círculos): confirma,
    // como no fluxo de preparar da SpellbookTab - liberdade com aviso.
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

  // Só esconde o já escolhido; lista/círculo são filtros pré-marcados abaixo.
  const ownedNames = new Set(picks.map((s) => s.raw.name.toLowerCase()));
  const exclude = (raw) => ownedNames.has(raw.name.toLowerCase());

  // Filtros pré-marcados: a classe do passo + TODA a faixa de círculos dele.
  const levelValues = [];
  for (let l = level; l <= top; l++) levelValues.push(l === 0 ? 'Cantrip' : String(l));
  const initialFilterState = {
    level: Object.fromEntries(levelValues.map((v) => [v, 'include'])),
    class: { [origin.spellListClass]: 'include' },
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
