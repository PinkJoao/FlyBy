// =============================================================================
// SpeciesTab: a aba de espécie: espécie, linhagem, traços e sub-escolhas
// =============================================================================
// O QUE FAZ
//   O seletor de espécie (com a arte da base) e, quando há linhagens, um seletor de
//   LINHAGEM à parte, com o rótulo vindo do dado ("Variable Trait", "Giant
//   Ancestry"). A raça BASE dá as opções de linhagem; a EFETIVA (com a linhagem)
//   alimenta as sub-escolhas e a descrição. Tamanho e sub-escolhas ficam no MESMO
//   choice-bag da espécie; nível e bag alimentam as escolhas de magia (TC-0011).
//   Seletores e escolhas ficam SEMPRE acima da descrição.
//
// FUNÇÕES
//   capitalize(s): o rótulo (o nome real da raça resolvida, TC-0016).
//   SpeciesTab(props): a aba.
//
// DECISÕES E ARMADILHAS
//   - A fonte exibida é a da LINHAGEM: uma sub-raça pode vir de outro livro (Zariel
//     MTF num Tiefling XPHB).
// -----------------------------------------------------------------------------

import { resolveRaceObj, ownedFromDb } from '../../engine/resolve';
import { totalLevel } from '../../schema/character';
import { raceLineages, lineageLabel, lineageSelectorLabel, speciesChoices } from '../../engine/speciesData';
import PickerField from '../common/PickerField';
import DetailView from '../common/DetailView';
import { TUT } from '../../tutorial/anchors';
import raceEntity from '../../selector/entities/race';
import { makeLineageEntity } from '../../selector/entities/lineage';
import ChoiceList from './ChoiceList';
import styles from './SpeciesTab.module.css';

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default function SpeciesTab({ character, db, onPick, onClear, onChangeChoices, onChangeLineage }) {
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

  return (
    <div className={styles.tab}>
      <section className={styles.section} data-tour={TUT.TAB_SPECIES_PICKER}>
        <PickerField
          entity={raceEntity}
          db={db}
          current={
            species
              ? { label: baseRace?.name ?? capitalize(species.id), source: species.source, id: `${capitalize(species.id)}|${species.source}` }
              : null
          }
          placeholder="Choose species…"
          onSelect={onPick}
          onClear={onClear}
          showInfo={false}
        />
      </section>

      {hasLineages && (
        <section className={styles.section}>
          <span className={styles.label}>{lineageSelectorLabel(baseRace)}</span>
          <PickerField
            entity={makeLineageEntity(baseRace, db)}
            db={db}
            current={species.lineage ? { label: lineageLabel(species.lineage), source: raceObj?.source ?? baseRace.source, id: species.lineage } : null}
            placeholder={`Choose ${lineageSelectorLabel(baseRace).toLowerCase()}…`}
            onSelect={(v) => onChangeLineage(v.name)}
            onClear={() => onChangeLineage(null)}
            showInfo={false}
          />
        </section>
      )}

      {choices.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Species Choices</h3>
          <ChoiceList
            choices={choices}
            bag={species.choices}
            onChange={onChangeChoices}
            db={db}
            owned={ownedFromDb(character, db)}
            character={character}
          />
        </section>
      )}

      {raceObj && (
        <section className={styles.section}>
          <div className={styles.about}>
            <DetailView entity={raceEntity} raw={raceObj} db={db} />
          </div>
        </section>
      )}

      {!species && <p className={styles.hint}>Choose a species to see its traits and choices.</p>}
    </div>
  );
}
