// =============================================================================
// ItemSpells: a magia de um item no detalhe do inventário (Enspelled, guardar magia)
// =============================================================================
// O QUE FAZ
//   A seção do detalhe do item do inventário para os itens que levam magia (DDL-0258):
//   - Enspelled ("Bound into this staff is a level 2 spell"): o jogador escolhe a magia, no
//     painel seletor de magias com o círculo e as escolas do texto pré-marcados.
//   - Os que guardam magias lançadas neles (Ring of Spell Storing, Spell Bottle, Spell Gem):
//     o que o item guarda, cada uma com o círculo, a CD e o ataque de quem lançou, e "Add"
//     para pôr outra (achado com magias, um aliado que lançou nele).
//
// FUNÇÕES
//   ItemSpells(props): a seção.
//
// DECISÕES E ARMADILHAS
//   - A escolha mora na entrada do inventário (`boundSpell: 'Name|Source'`, `stored: [...]`),
//     uma decisão do jogador como a quantidade; o jogo e o export a leem dali.
//   - O círculo e as escolas são FILTROS pré-marcados, removíveis (liberdade com aviso, §6.4);
//     a magia fora deles aparece no chip com o aviso.
//   - O guardado à mão pergunta o círculo (de o da magia até o que cabe), a CD e o ataque de
//     quem lançou; o padrão é o maior do personagem. No jogo, guardar é lançar com "Store it in".
// -----------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import SelectorPanel from '../../selector/SelectorPanel';
import { makeSpellEntity, default as spellEntity } from '../../selector/entities/spell';
import { resolveSpellObj, schoolName, spellLevelLabel } from '../../engine/spells';
import { boundSpellRule, storeRuleOf, storedLevels } from '../../engine/itemEffects';
import { showDetailPopup } from '../common/detailPopup';
import { ask } from '../common/dialog';
import Chip from '../common/Chip';
import styles from './InventoryTab.module.css';

const SCHOOL_CODES = { A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment', V: 'Evocation', I: 'Illusion', N: 'Necromancy', T: 'Transmutation' };

/**
 * A seção da magia do item, ou nada quando o item não leva magia.
 * @param {{ entry: object, db: object, derived: object, onUpdate: (patch: object) => void }} props
 */
export default function ItemSpells({ entry, db, derived, onUpdate }) {
  const [picking, setPicking] = useState(false);
  const bound = boundSpellRule(entry.raw);
  const store = bound ? null : storeRuleOf(entry.raw);
  const pickerEntity = useMemo(() => makeSpellEntity(db), [db]);
  if (!bound && !store) return null;

  const levelValue = (n) => (n === 0 ? 'Cantrip' : String(n));
  const room = store ? (store.one ? ((entry.stored ?? []).length ? 0 : store.maxLevel) : Math.max(0, store.cap - storedLevels(entry))) : 0;
  const maxLevel = store ? Math.min(store.maxLevel, room) : 0;
  const filterState = bound
    ? { level: { [levelValue(bound.level)]: 'include' }, ...(bound.schools ? { school: Object.fromEntries(bound.schools.map((c) => [SCHOOL_CODES[c] ?? c, 'include'])) } : {}) }
    : { level: Object.fromEntries(Array.from({ length: maxLevel }, (_, i) => [levelValue(i + 1), 'include'])) };
  const boundRaw = entry.boundSpell ? resolveSpellObj(db, ...String(entry.boundSpell).split('|')) : null;
  const offRule = bound && boundRaw && (boundRaw.level !== bound.level || (bound.schools && !bound.schools.includes(boundRaw.school)));
  const casters = (derived?.spellcasting?.origins ?? []).filter((o) => o.saveDc != null);
  const best = casters.reduce((a, o) => (!a || o.saveDc > a.saveDc ? o : a), null);
  const open = (raw) => raw && showDetailPopup({ entity: spellEntity, raw, db });

  const choose = async (raw) => {
    setPicking(false);
    if (bound) {
      onUpdate({ boundSpell: `${raw.name}|${raw.source}` });
      return;
    }
    if (raw.level < 1 || raw.level > maxLevel) return;
    const levels = Array.from({ length: maxLevel - raw.level + 1 }, (_, i) => raw.level + i);
    const r = await ask({
      title: `Store ${raw.name}`,
      message: 'The slot level used, and the save DC and attack bonus of the creature that cast it into the item.',
      fields: [
        { type: 'select', name: 'level', label: 'Slot level', default: String(raw.level), options: levels.map((n) => ({ label: spellLevelLabel(n), value: String(n) })) },
        { name: 'dc', label: 'Spell save DC', default: String(best?.saveDc ?? 13) },
        { name: 'attack', label: 'Spell attack bonus', default: String(best?.attackBonus ?? 5) },
      ],
      actions: [{ label: 'Cancel', value: null }, { label: 'Store', value: 'ok', tone: 'primary' }],
    });
    if (r?.action !== 'ok') return;
    const spell = { name: raw.name, source: raw.source, level: Number(r.values.level) || raw.level, dc: Number(r.values.dc) || null, attack: Number(r.values.attack) || 0 };
    onUpdate({ stored: [...(entry.stored ?? []), spell] });
  };

  return (
    <section className={styles.contents}>
      <div className={styles.contentsHead}>
        <h4 className={styles.contentsTitle}>{bound ? 'Bound spell' : 'Stored spells'}</h4>
        <span className={styles.contentsWeight}>
          {bound
            ? `${bound.level === 0 ? 'Cantrip' : `Level ${bound.level}`}${bound.schools ? `, ${bound.schools.map((c) => SCHOOL_CODES[c] ?? c).join(' or ')}` : ''}`
            : store.one ? `One spell, up to level ${store.maxLevel}` : `${storedLevels(entry)} / ${store.cap} levels`}
        </span>
      </div>
      <div className={styles.contentsActions}>
        {bound && boundRaw && (
          <Chip onClick={() => open(boundRaw)} onRemove={() => onUpdate({ boundSpell: null })} removeLabel={`Remove ${boundRaw.name}`} tone={offRule ? 'warning' : undefined} title={offRule ? 'Outside the level or schools the item names' : undefined}>
            {boundRaw.name}
          </Chip>
        )}
        {bound && !boundRaw && <Chip add onClick={() => setPicking(true)}>Choose the spell</Chip>}
        {store && (entry.stored ?? []).map((s, i) => (
          <Chip
            key={`${s.name}-${i}`}
            onClick={() => open(resolveSpellObj(db, s.name, s.source))}
            onRemove={() => onUpdate({ stored: entry.stored.filter((_, j) => j !== i) })}
            removeLabel={`Remove ${s.name}`}
            title={`Level ${s.level}, DC ${s.dc ?? '-'}, attack +${s.attack ?? 0}`}
          >
            {`${s.name} (${s.level})`}
          </Chip>
        ))}
        {store && room > 0 && <Chip add onClick={() => setPicking(true)}>Add a spell</Chip>}
      </div>
      {bound && offRule && <p className={styles.contentsEmpty}>{`The item names ${bound.level === 0 ? 'a cantrip' : `a level ${bound.level} spell`}${bound.schools ? ` of ${bound.schools.map((c) => schoolName(c)).join(', ')}` : ''}.`}</p>}
      {picking && (
        <SelectorPanel
          entity={pickerEntity}
          db={db}
          currentId={null}
          initialFilterState={filterState}
          heading={bound ? `Spell bound into ${entry.raw.name}` : `Store a spell in ${entry.raw.name}`}
          onSelect={choose}
          onClose={() => setPicking(false)}
        />
      )}
    </section>
  );
}
