// =============================================================================
// SpellsStep - escolha das magias de nível 1 (Fase D, tela de magias 2/2)
// =============================================================================
// A segunda tela de magias: explica a diferença entre cantrips e magias de
// círculo e, com o texto AUTORITATIVO da própria classe (+ a tabela quando ele a
// cita), COMO/QUANDO recuperar slots (o Warlock difere sozinho: Short OR Long
// Rest) e COMO/QUANDO preparar magias. Depois, os seletores de magias de nível 1
// - direto, no espírito da tela de features. Escreve no MESMO `ClassEntry.spells`.
// -----------------------------------------------------------------------------

import { resolveClassObj, resolveSubclassObj } from '../../../engine/resolve';
import { spellcastingFeature, spellSlotEntries } from '../../../engine/spellcastingText';
import FeatureText from '../../common/FeatureText';
import SpellPicker from './SpellPicker';
import styles from './steps.module.css';

export default function SpellsStep({ character, db, derived, onChange }) {
  const origins = (derived.spellcasting?.origins ?? []).filter((o) => o.kind === 'class');

  const setClassSpells = (uid, spells) =>
    onChange({ ...character, classes: character.classes.map((c) => (c.uid === uid ? { ...c, spells } : c)) });

  return (
    <div className={styles.step}>
      <p className={styles.callout}>
        Unlike cantrips, <strong>leveled spells</strong> have bigger effects. Casting one spends a{' '}
        <strong>spell slot</strong>, and you can only cast them if you have slots of the required level.
      </p>

      {origins.length === 0 && (
        <p className={styles.note}>Your spells come from your species or a feat - nothing to choose here.</p>
      )}

      {origins.map((origin) => {
        const cls = character.classes.find((c) => c.uid === origin.uid);
        const classObj = cls?.classId ? resolveClassObj(db, cls.classId, cls.source) : null;
        const subObj =
          cls?.classId && cls.subclassId
            ? resolveSubclassObj(db, cls.classId, cls.subclassId, cls.subclassSource)
            : null;
        const feature = spellcastingFeature(db, cls.classId, classObj, subObj);
        const blocks = spellSlotEntries(feature);

        return (
          <div key={origin.key} className={styles.spellOrigin}>
            {origins.length > 1 && <h3 className={styles.spellOriginName}>{origin.label} spells</h3>}
            {blocks.length > 0 && (
              <div className={styles.featureDesc}>
                <FeatureText entries={blocks} classObj={classObj} subclass={subObj} level={cls.level} />
              </div>
            )}
            {origin.prepareLimit > 0 ? (
              <SpellPicker
                origin={origin}
                db={db}
                level={1}
                limit={origin.prepareLimit}
                current={origin.prepared.filter((s) => s.raw?.level === 1)}
                classEntry={cls}
                onChangeSpells={setClassSpells}
              />
            ) : (
              <p className={styles.note}>This class doesn't prepare leveled spells at level 1 yet.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
