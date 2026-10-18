// =============================================================================
// SpeciesStep: o passo de espécie
// =============================================================================
// O QUE FAZ
//   Espécie, LINHAGEM e sub-escolhas, com os mesmos átomos da SpeciesTab e a
//   mesma lista (speciesChoices). A raça base dá as linhagens; a efetiva, as
//   sub-escolhas e a descrição. Trocar a linhagem reseta as escolhas de espécie. A
//   fonte exibida é a da linhagem.
//
// FUNÇÕES
//   cap(s): texto.
//   SpeciesStep(props): o passo.
// -----------------------------------------------------------------------------

import { resolveRaceObj, ownedFromDb } from '../../../engine/resolve';
import { totalLevel } from '../../../schema/character';
import { raceLineages, lineageLabel, lineageSelectorLabel, speciesChoices } from '../../../engine/speciesData';
import PickerField from '../../common/PickerField';
import DetailView from '../../common/DetailView';
import raceEntity from '../../../selector/entities/race';
import { makeLineageEntity } from '../../../selector/entities/lineage';
import ChoiceList from '../../builder/ChoiceList';
import styles from './steps.module.css';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function SpeciesStep({ character, db, onChange }) {
  const species = character.species;
  const baseRace = species ? resolveRaceObj(db, species.id, species.source) : null;
  const hasLineages = baseRace ? raceLineages(db, baseRace).length > 0 : false;
  const raceObj = species ? resolveRaceObj(db, species.id, species.source, species.lineage) : null;
  const choices = speciesChoices({
    db,
    baseRace,
    raceObj,
    lineage: species?.lineage,
    level: totalLevel(character),
    bag: species?.choices,
  });

  const pickSpecies = (race) =>
    onChange({ ...character, species: { id: race.name.toLowerCase(), source: race.source, choices: {}, lineage: null } });
  const clearSpecies = () => onChange({ ...character, species: null });
  const setChoices = (next) => onChange({ ...character, species: { ...character.species, choices: next } });
  const setLineage = (lineage) => onChange({ ...character, species: { ...character.species, lineage, choices: {} } });

  return (
    <div className={styles.step}>
      <p className={styles.callout}>
        Your species represents your character's ancestry and physical heritage. 
        Whether human, elf, dwarf, or another species, 
        it determines your size, speed, senses (such as darkvision), and other innate traits. 
        Some species also include distinct lineages, each with its own unique abilities and flavor.
      </p>

      <PickerField
        entity={raceEntity}
        db={db}
        current={species ? { label: baseRace?.name ?? cap(species.id), source: species.source, id: `${cap(species.id)}|${species.source}` } : null}
        placeholder="Choose a species…"
        showInfo={false}
        onSelect={pickSpecies}
        onClear={clearSpecies}
      />

      {hasLineages && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{lineageSelectorLabel(baseRace)}</span>
          <PickerField
            entity={makeLineageEntity(baseRace, db)}
            db={db}
            current={species.lineage ? { label: lineageLabel(species.lineage), source: raceObj?.source ?? baseRace.source, id: species.lineage } : null}
            placeholder={`Choose a ${lineageSelectorLabel(baseRace).toLowerCase()}…`}
            showInfo={false}
            onSelect={(v) => setLineage(v.name)}
            onClear={() => setLineage(null)}
          />
        </div>
      )}

      {choices.length > 0 && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Species choices</span>
          <ChoiceList
            choices={choices}
            bag={species.choices}
            onChange={setChoices}
            db={db}
            owned={ownedFromDb(character, db)}
            character={character}
          />
        </div>
      )}

      {raceObj && (
        <div className={styles.preview}>
          <DetailView entity={raceEntity} raw={raceObj} db={db} />
        </div>
      )}
    </div>
  );
}
