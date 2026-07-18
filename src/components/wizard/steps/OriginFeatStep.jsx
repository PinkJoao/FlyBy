// =============================================================================
// OriginFeatStep - a tela de TALENTO DE ORIGEM do wizard (Fase D2)
// =============================================================================
// Nível 1: escolhe o talento de origem (`origin.originFeat`) e suas sub-escolhas
// recursivas. Reusa os mesmos átomos da BackgroundTab (feat entity com pré-req +
// PickerField + ChoiceList) e escreve o MESMO `origin.originFeat` - nenhuma regra
// nova (guard-rail DDL-0013). O passo é OPCIONAL (status 'optional'), então o
// rodapé mostra Skip. Um card de guia instrui, no lugar da frase abaixo do título.
// -----------------------------------------------------------------------------

import { parseChoices } from '../../../engine/choices';
import { resolveFeat, ownedFromDb } from '../../../engine/resolve';
import { totalLevel } from '../../../schema/character';
import { prereqContext } from '../../../engine/prereq';
import PickerField from '../../common/PickerField';
import DetailView from '../../common/DetailView';
import ChoiceList from '../../builder/ChoiceList';
import { makeFeatEntity } from '../../../selector/entities/feat';
import styles from './steps.module.css';

export default function OriginFeatStep({ character, db, onChange }) {
  const origin = character.origin;
  const originFeat = origin?.originFeat ?? null;
  const owned = ownedFromDb(character, db);

  // Entity de talento de origem ciente do personagem (colore pré-requisitos).
  const featEntity = makeFeatEntity(['O'], 'Origin Feat', prereqContext(character, { db }));

  const originFeatData = originFeat ? resolveFeat(db, `${originFeat.id}|${originFeat.source}`) : null;
  // Nível + bag alimentam as escolhas de MAGIA do talento (TC-0011).
  const featChoices = originFeatData
    ? parseChoices(originFeatData, { level: totalLevel(character), bag: originFeat?.choices })
    : [];

  const setOriginFeat = (raw) =>
    onChange({ ...character, origin: { ...origin, originFeat: { id: raw.name, source: raw.source, subtype: 'origin', choices: {} } } });
  const clearOriginFeat = () => onChange({ ...character, origin: { ...origin, originFeat: null } });
  const setFeatChoices = (choices) =>
    onChange({ ...character, origin: { ...origin, originFeat: { ...originFeat, choices } } });

  return (
    <div className={styles.step}>
      <p className={styles.callout}>
        Your origin reflects the life you lived before becoming an adventurer. 
        It grants an <strong>"Origin Feat"</strong>, a small but defining talent such as Alert, Skilled, or Tough. 
        Some Origin Feats also include additional choices, such as selecting a skill, tool, or spell.
      </p>

      {/* Sem o botão ⓘ aqui: a descrição do talento escolhido já aparece embaixo. */}
      <PickerField
        entity={featEntity}
        db={db}
        current={originFeat ? { label: originFeat.id, source: originFeat.source, id: `${originFeat.id}|${originFeat.source}` } : null}
        placeholder="Choose an origin feat…"
        showInfo={false}
        initialFilterState={{ prereq: { ok: 'include' } }}
        onSelect={setOriginFeat}
        onClear={clearOriginFeat}
        exclude={(raw) => {
          const id = `${raw.name}|${raw.source}`;
          if (raw.repeatable || (originFeat && id === `${originFeat.id}|${originFeat.source}`)) return false;
          return owned.feats.has(id);
        }}
      />

      {originFeatData && (
        <div className={styles.preview}>
          <DetailView entity={featEntity} raw={originFeatData} db={db} />
        </div>
      )}

      {featChoices.length > 0 && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Feat choices</span>
          <ChoiceList choices={featChoices} bag={originFeat.choices} onChange={setFeatChoices} db={db} owned={owned} character={character} />
        </div>
      )}
    </div>
  );
}
