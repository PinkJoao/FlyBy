// =============================================================================
// EquipmentStep: o passo do equipamento inicial
// =============================================================================
// O QUE FAZ
//   A classe oferece opções A, B, C (itens e um pouco de ouro, ou só ouro).
//   Escolher uma grava o inventário e a carteira e marca `meta.startingKit`; a
//   carteira vira 50 GP mais o ouro da opção. Reusa engine/startingEquipment.
//   Kits com item a escolher (o instrumento do Bardo, TC-0024) ganham um seletor;
//   os picks vivem em `meta.startingKitPicks`, e trocar de kit os descarta.
//
// FUNÇÕES
//   itemLabel(it): "Javelin x8".
//   KitChoose(props): um item a escolher do kit.
//   EquipmentStep(props): o passo.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { resolveClassObj } from '../../../engine/resolve';
import {
  parseStartingEquipment,
  isGoldOnlyOption,
  optionGoldGp,
  startingKitInventory,
  startingKitCurrency,
  kitChooseLabel,
  kitChooseAllows,
} from '../../../engine/startingEquipment';
import SelectorPanel from '../../../selector/SelectorPanel';
import itemEntity from '../../../selector/entities/item';
import choiceStyles from '../../builder/ChoiceList.module.css';
import styles from './steps.module.css';

/** O rótulo de um item do kit. */
const itemLabel = (it) => (it.quantity > 1 ? `${it.name} ×${it.quantity}` : it.name);

/** Um item a escolher do kit. */
function KitChoose({ choose, index, picks, db, onPicks }) {
  const [open, setOpen] = useState(false);
  const mine = picks?.[index] ?? [];

  const add = (raw) => {
    const id = `${raw.name}|${raw.source}`;
    const next = { ...picks, [index]: [...mine, id] };
    onPicks(next);
    if (mine.length + 1 >= choose.quantity) setOpen(false);
  };
  const remove = (id) => onPicks({ ...picks, [index]: mine.filter((x) => x !== id) });

  return (
    <div className={choiceStyles.choice}>
      <div className={choiceStyles.head}>
        <span className={choiceStyles.label}>{kitChooseLabel(choose)}</span>
        <span className={choiceStyles.counter}>
          {mine.length}/{choose.quantity}
        </span>
      </div>
      <div className={choiceStyles.tags}>
        {mine.map((id) => (
          <span key={id} className={choiceStyles.tagChip}>
            <span className={choiceStyles.tagLabel}>{id.split('|')[0]}</span>
            <button type="button" className={choiceStyles.tagRemove} aria-label={`Remove ${id.split('|')[0]}`} onClick={() => remove(id)}>
              ×
            </button>
          </span>
        ))}
        {mine.length < choose.quantity && (
          <button type="button" className={choiceStyles.addBtn} onClick={() => setOpen(true)}>
            + Add item
          </button>
        )}
      </div>
      {open && (
        <SelectorPanel
          entity={itemEntity}
          db={db}
          currentId={null}
          exclude={(raw) => !kitChooseAllows(choose, raw) || mine.includes(`${raw.name}|${raw.source}`)}
          onSelect={add}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

export default function EquipmentStep({ character, db, onChange }) {
  const cls = character.classes?.[0] ?? null;
  const classObj = cls?.classId ? resolveClassObj(db, cls.classId, cls.source) : null;
  const options = classObj ? parseStartingEquipment(db, classObj) : [];
  const selected = character.meta?.startingKit ?? null;
  const selectedOpt = options.find((o) => o.key === selected) ?? null;
  const kitPicks = character.meta?.startingKitPicks ?? {};

  const selectKit = (opt) =>
    onChange({
      ...character,
      inventory: startingKitInventory(opt, db),
      currency: startingKitCurrency(opt),
      meta: { ...character.meta, startingKit: opt.key, startingKitPicks: {} },
    });

  const setPicks = (picks) =>
    onChange({
      ...character,
      inventory: startingKitInventory(selectedOpt, db, picks),
      meta: { ...character.meta, startingKitPicks: picks },
    });

  return (
    <div className={styles.step}>
      <p className={styles.callout}>
        Every class starts you with a kit of gear, or a purse of gold to buy your own. Pick the
        package that fits how you picture this character. You can always fine-tune it later in the
        Inventory, and buy more with whatever gold you keep.
      </p>

      {!cls?.classId && <p className={styles.note}>Choose a class first to see its starting equipment.</p>}
      {cls?.classId && options.length === 0 && (
        <p className={styles.note}>This class has no listed starting-equipment options, so you keep your starting gold.</p>
      )}

      <div className={styles.kitList}>
        {options.map((opt) => {
          const goldOnly = isGoldOnlyOption(opt);
          const gp = optionGoldGp(opt);
          return (
            <button
              key={opt.key}
              type="button"
              className={selected === opt.key ? `${styles.kitCard} ${styles.kitCardActive}` : styles.kitCard}
              onClick={() => selectKit(opt)}
            >
              <div className={styles.kitHead}>
                <span className={styles.kitKey}>Option {opt.key}</span>
                {selected === opt.key && <span className={styles.kitChosen}>Chosen</span>}
              </div>
              {goldOnly ? (
                <p className={styles.kitGold}>Take the gold instead: <strong>{gp} Gold Pieces</strong> to spend.</p>
              ) : (
                <>
                  <ul className={styles.kitItems}>
                    {opt.items.map((it, i) => (
                      <li key={i}>{itemLabel(it)}</li>
                    ))}
                    {(opt.chooses ?? []).map((ch, i) => (
                      <li key={`c${i}`}>{kitChooseLabel(ch)}</li>
                    ))}
                    {opt.special.map((sp, i) => (
                      <li key={`s${i}`}>{sp}</li>
                    ))}
                  </ul>
                  {gp > 0 && <p className={styles.kitGold}>plus <strong>{gp} GP</strong></p>}
                </>
              )}
            </button>
          );
        })}
      </div>

      {selectedOpt && (selectedOpt.chooses?.length ?? 0) > 0 && (
        <div>
          {selectedOpt.chooses.map((ch, i) => (
            <KitChoose key={i} choose={ch} index={i} picks={kitPicks} db={db} onPicks={setPicks} />
          ))}
        </div>
      )}

      {selected && (
        <p className={styles.note}>
          You'll start with {character.inventory?.length ?? 0} item{(character.inventory?.length ?? 0) === 1 ? '' : 's'} and{' '}
          {character.currency?.gp ?? 0} GP.
        </p>
      )}
    </div>
  );
}
