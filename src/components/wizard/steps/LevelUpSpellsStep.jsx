// =============================================================================
// LevelUpSpellsStep - novas magias ao subir de nível (Fase D3)
// =============================================================================
// Diferente das telas de criação (que travam em nível 1), aqui as magias vão de
// 1 até o círculo máximo preparável da origem (`maxPrepareLevel`), e os cantrips
// entram se o limite cresceu. Reusa o mesmo `SpellPicker` (agora com faixa de
// níveis) e escreve no MESMO `ClassEntry.spells`.
// -----------------------------------------------------------------------------

import SpellPicker from './SpellPicker';
import styles from './steps.module.css';

export default function LevelUpSpellsStep({ character, db, derived, onChange }) {
  const origins = (derived.spellcasting?.origins ?? []).filter((o) => o.kind === 'class');

  const setClassSpells = (uid, spells) =>
    onChange({ ...character, classes: character.classes.map((c) => (c.uid === uid ? { ...c, spells } : c)) });

  return (
    <div className={styles.step}>
      <p className={styles.callout}>
        Leveling up widens your magic: you can prepare more spells, and sometimes reach a higher circle.
        Add what your new level grants below - anything already prepared stays.
      </p>

      {origins.length === 0 && <p className={styles.note}>Nothing new to choose here.</p>}

      {origins.map((origin) => {
        const cls = character.classes.find((c) => c.uid === origin.uid);
        const leveled = origin.prepared.filter((s) => s.raw?.level >= 1);
        return (
          <div key={origin.key} className={styles.spellOrigin}>
            {origins.length > 1 && <h3 className={styles.spellOriginName}>{origin.label}</h3>}

            {origin.cantripLimit > 0 && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Cantrips</span>
                <SpellPicker
                  origin={origin}
                  origins={derived.spellcasting?.origins}
                  db={db}
                  level={0}
                  limit={origin.cantripLimit}
                  current={origin.cantrips}
                  classEntry={cls}
                  onChangeSpells={setClassSpells}
                />
              </div>
            )}

            {origin.prepareLimit > 0 && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Prepared spells (up to circle {origin.maxPrepareLevel})</span>
                <SpellPicker
                  origin={origin}
                  origins={derived.spellcasting?.origins}
                  db={db}
                  level={1}
                  maxLevel={origin.maxPrepareLevel}
                  limit={origin.prepareLimit}
                  current={leveled}
                  classEntry={cls}
                  onChangeSpells={setClassSpells}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
