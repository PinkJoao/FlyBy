// =============================================================================
// SpeciesTab - escolha de espécie + LINHAGEM (sub-raça) + traços + sub-escolhas
// =============================================================================
// Seletor de espécie (PickerField, com a arte da raça base) e, quando a espécie
// tem linhagens (`_versions`, ex: Elf → Drow/High/Wood), um SELETOR DE LINHAGEM
// separado (cards). A raça EFETIVA (base + linhagem escolhida) alimenta as
// sub-escolhas (ChoiceList) e a descrição (DetailView). Manter a linhagem num
// seletor à parte preserva a arte/lore da raça base no picker.
// -----------------------------------------------------------------------------

import { parseChoices } from '../../engine/choices';
import { resolveRaceObj, ownedFromDb } from '../../engine/resolve';
import { totalLevel } from '../../schema/character';
import { raceLineages, lineageLabel, speciesSizeChoice } from '../../engine/speciesData';
import PickerField from '../common/PickerField';
import DetailView from '../common/DetailView';
import raceEntity from '../../selector/entities/race';
import { makeLineageEntity } from '../../selector/entities/lineage';
import ChoiceList from './ChoiceList';
import styles from './SpeciesTab.module.css';

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default function SpeciesTab({ character, db, onPick, onClear, onChangeChoices, onChangeLineage }) {
  const species = character.species;
  // Raça base (sem linhagem) → fonte das opções de linhagem; raça efetiva (com a
  // linhagem escolhida) → sub-escolhas + descrição.
  const baseRace = species ? resolveRaceObj(db, species.id, species.source) : null;
  // Linhagens = `_versions` + sub-raças fundidas do db (Genasi, Stensia…).
  const hasLineages = baseRace ? raceLineages(db, baseRace).length > 0 : false;
  const raceObj = species ? resolveRaceObj(db, species.id, species.source, species.lineage) : null;
  // Tamanho primeiro (quando a raça deixa Small/Medium ao jogador), depois as
  // demais sub-escolhas - tudo no MESMO choice-bag da espécie.
  const sizeChoice = speciesSizeChoice(raceObj);
  // Nível + bag alimentam as escolhas de MAGIA da raça (TC-0011: gate por nível
  // e grupo ativo de um additionalSpells com várias listas).
  const choices = raceObj
    ? [...(sizeChoice ? [sizeChoice] : []), ...parseChoices(raceObj, { level: totalLevel(character), bag: species?.choices })]
    : [];

  return (
    <div className={styles.tab}>
      <section className={styles.section}>
        <PickerField
          entity={raceEntity}
          db={db}
          current={
            species
              // Nome REAL da raça resolvida no label (o id é minúsculo - mesmo
              // caso do TC-0016 nos pickers do guia); fallback: id capitalizado.
              ? { label: baseRace?.name ?? capitalize(species.id), source: species.source, id: `${capitalize(species.id)}|${species.source}` }
              : null
          }
          placeholder="Choose species…"
          onSelect={onPick}
          onClear={onClear}
          showInfo={false}
        />
      </section>

      {/* Seletor de LINHAGEM (só quando a espécie tem `_versions`) - mesmo
          SelectorPanel do resto (busca + cards + detalhe). */}
      {hasLineages && (
        <section className={styles.section}>
          <span className={styles.label}>Lineage</span>
          <PickerField
            entity={makeLineageEntity(baseRace, db)}
            db={db}
            // A fonte é a da LINHAGEM (`raceObj` já é a variante resolvida), não a
            // da base: uma sub-raça pode vir de outro livro (Zariel MTF num
            // Tiefling XPHB, Air MPMM num Genasi MPMM).
            current={species.lineage ? { label: lineageLabel(species.lineage), source: raceObj?.source ?? baseRace.source, id: species.lineage } : null}
            placeholder="Choose lineage…"
            onSelect={(v) => onChangeLineage(v.name)}
            onClear={() => onChangeLineage(null)}
            showInfo={false}
          />
        </section>
      )}

      {/* Seletores/escolhas SEMPRE acima da descrição (facilita o uso). */}
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
