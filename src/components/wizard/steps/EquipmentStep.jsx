// =============================================================================
// EquipmentStep - equipamento inicial da classe (Fase D2, passo 6)
// =============================================================================
// A classe 2024 oferece opções A/B/C: pacotes de itens (+ um pouco de ouro) ou só
// ouro. Escolher uma opção grava o inventário + a carteira resultantes e marca
// `meta.startingKit`. É equipamento OU ouro - a carteira vira 50 GP (background) +
// o ouro da opção. Reusa o parser puro `engine/startingEquipment` (guard-rail
// DDL-0013: sem regras novas na UI).
// -----------------------------------------------------------------------------

import { resolveClassObj } from '../../../engine/resolve';
import {
  parseStartingEquipment,
  isGoldOnlyOption,
  optionGoldGp,
  startingKitInventory,
  startingKitCurrency,
} from '../../../engine/startingEquipment';
import styles from './steps.module.css';

/** "Chain Mail", "Javelin ×8"… */
const itemLabel = (it) => (it.quantity > 1 ? `${it.name} ×${it.quantity}` : it.name);

export default function EquipmentStep({ character, db, onChange }) {
  const cls = character.classes?.[0] ?? null;
  const classObj = cls?.classId ? resolveClassObj(db, cls.classId, cls.source) : null;
  const options = classObj ? parseStartingEquipment(db, classObj) : [];
  const selected = character.meta?.startingKit ?? null;

  const selectKit = (opt) =>
    onChange({
      ...character,
      inventory: startingKitInventory(opt, db),
      currency: startingKitCurrency(opt),
      meta: { ...character.meta, startingKit: opt.key },
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

      {selected && (
        <p className={styles.note}>
          You'll start with {character.inventory?.length ?? 0} item{(character.inventory?.length ?? 0) === 1 ? '' : 's'} and{' '}
          {character.currency?.gp ?? 0} GP.
        </p>
      )}
    </div>
  );
}
