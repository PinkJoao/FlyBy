// =============================================================================
// CantripsStep - escolha das cantrips (Fase D, tela de magias 1/2)
// =============================================================================
// Só aparece p/ conjuradores COM cantrips (Ranger/Paladin não têm - o `when` do
// catálogo já esconde). No espírito da tela de features: um card explicando o
// que são cantrips (o texto da PRÓPRIA classe, autoritativo, + a tabela quando
// ele a cita) e os seletores, direto. Uma seção por classe conjuradora com
// cantrips (no nível 1 costuma ser uma só).
// -----------------------------------------------------------------------------

import { resolveClassObj, resolveSubclassObj } from '../../../engine/resolve';
import { spellcastingFeature, cantripEntries } from '../../../engine/spellcastingText';
import FeatureText from '../../common/FeatureText';
import SpellPicker from './SpellPicker';
import styles from './steps.module.css';

export default function CantripsStep({ character, db, derived, onChange }) {
  const origins = (derived.spellcasting?.origins ?? []).filter((o) => o.kind === 'class' && o.cantripLimit > 0);

  const setClassSpells = (uid, spells) =>
    onChange({ ...character, classes: character.classes.map((c) => (c.uid === uid ? { ...c, spells } : c)) });

  return (
    <div className={styles.step}>
      <p className={styles.callout}>
        <strong>Cantrips</strong> are the simplest magic your character knows. You can cast them as often as you
        like, no spell slots required, and they're always ready.
      </p>

      {origins.map((origin) => {
        const cls = character.classes.find((c) => c.uid === origin.uid);
        const classObj = cls?.classId ? resolveClassObj(db, cls.classId, cls.source) : null;
        const subObj =
          cls?.classId && cls.subclassId
            ? resolveSubclassObj(db, cls.classId, cls.subclassId, cls.subclassSource)
            : null;
        const feature = spellcastingFeature(db, cls.classId, classObj, subObj);
        const blocks = cantripEntries(feature);

        return (
          <div key={origin.key} className={styles.spellOrigin}>
            {origins.length > 1 && <h3 className={styles.spellOriginName}>{origin.label} cantrips</h3>}
            {blocks.length > 0 && (
              <div className={styles.featureDesc}>
                <FeatureText entries={blocks} classObj={classObj} subclass={subObj} level={cls.level} />
              </div>
            )}
            <SpellPicker
              origin={origin}
              db={db}
              level={0}
              limit={origin.cantripLimit}
              current={origin.cantrips}
              classEntry={cls}
              onChangeSpells={setClassSpells}
            />
          </div>
        );
      })}
    </div>
  );
}
