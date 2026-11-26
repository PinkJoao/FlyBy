// =============================================================================
// SpeciesStep: o passo de espécie
// =============================================================================
// O QUE FAZ
//   Espécie, LINHAGEM e sub-escolhas, com os mesmos átomos da SpeciesTab e a
//   mesma lista (speciesChoices). A raça base dá as linhagens; a efetiva, as
//   sub-escolhas e a descrição. Trocar a linhagem reseta as escolhas de espécie. A
//   fonte exibida é a da linhagem. A espécie se escolhe num carrossel no próprio
//   passo (InlineSelector, DDL-0286); as escolhas dela vêm numa página só, cada uma
//   com o texto que a explica (DDL-0290).
//
// FUNÇÕES
//   TraitText(props): o texto inteiro do traço que pede a escolha.
//   SpeciesStep(props): o passo.
//
// DECISÕES E ARMADILHAS
//   - Páginas no guia (useGuidePage, DDL-0289): o texto que explica a etapa (no estilo da
//     abertura do guia, DDL-0291), o carrossel
//     e, quando a espécie tem linhagem ou escolhas, uma terceira com elas. "Choose X" no
//     rodapé escolhe e vai à terceira página, ou à próxima etapa quando não há o que
//     escolher (needsMore, calculado sobre a espécie nova, porque o personagem ainda é o
//     de antes nesse clique).
//   - A página das escolhas (DDL-0290) reúne a linhagem, o tamanho, o atributo de
//     conjuração, as perícias e o talento, com os seletores de sempre; acima de cada um,
//     o texto do traço que o pede (speciesChoiceGroups: Keen Senses, Versatile, Elven
//     Lineage), INTEIRO (DDL-0307: cortado no primeiro parágrafo, o Wind Caller da Aarakocra
//     escondia a frase que diz o que se escolhe), ou, para o tamanho de 2024 (um campo, sem
//     traço), um texto curto.
// -----------------------------------------------------------------------------

import { resolveRaceObj, ownedFromDb } from '../../../engine/resolve';
import { totalLevel } from '../../../schema/character';
import { raceLineages, lineageLabel, lineageSelectorLabel, speciesChoices } from '../../../engine/speciesData';
import { withArticle } from '../../../engine/choices';
import PickerField from '../../common/PickerField';
import EntryContent from '../../common/EntryContent';
import { lineageTrait, speciesChoiceGroups } from '../speciesChoiceGroups';
import raceEntity from '../../../selector/entities/race';
import InlineSelector from '../../../selector/InlineSelector';
import { makeLineageEntity } from '../../../selector/entities/lineage';
import ChoiceList from '../../builder/ChoiceList';
import styles from './steps.module.css';
import { useGuideNav, useGuidePage } from '../guidePages';
import Icon from '../../common/Icon';

/** O texto inteiro do traço que pede a escolha. */
function TraitText({ entry }) {
  if (!entry) return null;
  return (
    <div className={styles.traitText}>
      <EntryContent entries={entry.entries} />
    </div>
  );
}

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
  const page = useGuidePage(hasLineages || choices.length > 0 ? 3 : 2);
  const nav = useGuideNav();
  const lineageName = hasLineages ? lineageSelectorLabel(baseRace) : null;
  const groups = speciesChoiceGroups(raceObj, choices, lineageName);
  const lineageGroups = groups.filter((g) => g.lineage);
  // ATENÇÃO: o compilador do React lê `species?.choices` fora da função para memoizá-la; sem o `?.` a página quebra.
  const choiceList = (list) => (
    <ChoiceList
      choices={list}
      bag={species?.choices}
      onChange={setChoices}
      db={db}
      owned={ownedFromDb(character, db)}
      character={character}
    />
  );
  const needsMore = (race) =>
    raceLineages(db, race).length > 0 ||
    speciesChoices({ db, baseRace: race, raceObj: race, lineage: null, level: totalLevel(character), bag: {} }).length > 0;

  const pickSpecies = (race) =>
    onChange({ ...character, species: { id: race.name.toLowerCase(), source: race.source, choices: {}, lineage: null } });
  const clearSpecies = () => onChange({ ...character, species: null });
  const setChoices = (next) => onChange({ ...character, species: { ...character.species, choices: next } });
  const setLineage = (lineage) => onChange({ ...character, species: { ...character.species, lineage, choices: {} } });

  if (page === 0) {
    return (
      <div className={styles.step}>
        <div className={styles.introBlock}>
          <span className={styles.introEmoji}><Icon name={'originSpecies'} /></span>
          <p className={styles.introText}>
            Your species represents your character's ancestry and physical heritage. 
            Whether human, elf, dwarf, or another species, 
            it determines your size, speed, senses (such as darkvision), and other innate traits. 
            Some species also include distinct lineages, each with its own unique abilities and flavor.
          </p>
          <p className={styles.introText}>Hit Next to see the options, then swipe through them.</p>
        </div>
      </div>
    );
  }

  if (page === 1) {
    return (
      <div className={styles.step}>
        <InlineSelector
          entity={raceEntity}
          db={db}
          currentId={baseRace ? raceEntity.idOf(baseRace) : null}
          onSelect={pickSpecies}
          onClear={clearSpecies}
          onChoose={(race) => {
            pickSpecies(race);
            if (needsMore(race)) nav?.page(2);
            else nav?.next({ force: true });
          }}
        />
      </div>
    );
  }

  return (
    <div className={styles.step}>
      {baseRace && <h3 className={styles.chosenName}>{baseRace.name}</h3>}

      {hasLineages && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{lineageSelectorLabel(baseRace)}</span>
          <TraitText entry={lineageTrait(raceObj, lineageName) ?? lineageTrait(baseRace, lineageName)} />
          <PickerField
            entity={makeLineageEntity(baseRace, db)}
            db={db}
            current={species?.lineage ? { label: lineageLabel(species.lineage), source: raceObj?.source ?? baseRace?.source, id: species.lineage } : null}
            placeholder={`Choose ${withArticle(lineageSelectorLabel(baseRace).toLowerCase())}…`}
            showInfo={false}
            onSelect={(v) => setLineage(v.name)}
            onClear={() => setLineage(null)}
          />
          {lineageGroups.length > 0 && choiceList(lineageGroups.flatMap((g) => g.choices))}
        </div>
      )}

      {groups.filter((g) => !g.lineage || !hasLineages).map((g) => (
        <div key={g.key} className={styles.field}>
          <span className={styles.fieldLabel}>{g.entry?.name ?? (g.key === 'size' ? 'Size' : 'Species choices')}</span>
          {g.entry ? (
            <TraitText entry={g.entry} />
          ) : g.key === 'size' ? (
            <p className={styles.note}>
              {baseRace?.name} can be {(g.choices[0]?.pool?.options ?? []).map((o) => o.label).join(' or ')}. Pick the size that
              fits your character.
            </p>
          ) : null}
          {choiceList(g.choices)}
        </div>
      ))}
    </div>
  );
}
