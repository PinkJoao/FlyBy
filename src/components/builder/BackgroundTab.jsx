// =============================================================================
// BackgroundTab - origem custom (Fase 5b)
// =============================================================================
// Sem backgrounds prontos: o jogador monta a origem peça por peça. Grava em
// character.origin e reflete AO VIVO no header (atributos) e no ProficienciesCard.
//   - Ability boosts (2024: +2/+1 ou +1/+1/+1)  → origin.abilityBoosts
//   - Origin feat (SelectorPanel + sub-escolhas) → origin.originFeat
//   - Proficiências + idioma (via ChoiceList,     → origin.choices
//     padronizado: 2 skills, 1 tool, 1 language)
// -----------------------------------------------------------------------------

import { useEffect } from 'react';
import { ABILITIES, totalLevel } from '../../schema/character';
import { parseChoices } from '../../engine/choices';
import { resolveFeat, ownedFromDb } from '../../engine/resolve';
import { prereqContext } from '../../engine/prereq';
import { ABILITY_FULL } from './labels';
import ClearableSelect from '../common/ClearableSelect';
import PickerField from '../common/PickerField';
import ChoiceList from './ChoiceList';
import { makeFeatEntity } from '../../selector/entities/feat';
import { ORIGIN_CHOICES } from './originChoices';
import { namedRuleEntry } from './choiceRules';
import { showRulePopup } from '../common/RulePopup';
import styles from './BackgroundTab.module.css';

/** Deriva o modo de boost a partir do array salvo. */
function boostMode(boosts) {
  if (!boosts || boosts.length === 0) return null;
  if (boosts.some((b) => b.amount === 2)) return '2-1';
  return '1-1-1';
}

export default function BackgroundTab({ character, db, onChangeOrigin, onChangeIdentity }) {
  const origin = character.origin;
  const boosts = origin.abilityBoosts ?? [];
  const mode = boostMode(boosts);
  const originFeat = origin.originFeat ?? null;

  // Tudo que a ficha já tem (dedup): não deixar escolher a mesma coisa 2×.
  const owned = ownedFromDb(character, db);

  // Entity de talento de origem ciente do personagem (colore pré-requisitos).
  const originFeatEntity = makeFeatEntity(['O'], 'Origin Feat', prereqContext(character, { db }));

  // Regra do glossário atrás do título "Ability Score Boosts" (lookup é um Map
  // hit memoizado por db; null → título fica texto puro).
  const boostsRule = namedRuleEntry(db, 'Ability Score and Modifier|XPHB');

  // --- Ability boosts ---
  const setMode = (m) => {
    let next = [];
    if (m === '2-1') next = [{ ability: '', amount: 2 }, { ability: '', amount: 1 }];
    else if (m === '1-1-1') next = [{ ability: '', amount: 1 }, { ability: '', amount: 1 }, { ability: '', amount: 1 }];
    onChangeOrigin({ ...origin, abilityBoosts: next });
  };
  // Padrão: +2/+1 já vem selecionado (inicializa se ainda não há boosts).
  useEffect(() => {
    if (!origin.abilityBoosts || origin.abilityBoosts.length === 0) setMode('2-1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setBoostAbility = (index, ability) =>
    onChangeOrigin({ ...origin, abilityBoosts: boosts.map((b, i) => (i === index ? { ...b, ability } : b)) });
  const usedAbilities = new Set(boosts.map((b) => b.ability).filter(Boolean));

  // --- Origin feat (com SUB-ESCOLHAS recursivas via ChoiceList) ---
  const setOriginFeat = (raw) =>
    onChangeOrigin({ ...origin, originFeat: { id: raw.name, source: raw.source, subtype: 'origin', choices: {} } });
  const clearOriginFeat = () => onChangeOrigin({ ...origin, originFeat: null });
  const setFeatChoices = (choices) => onChangeOrigin({ ...origin, originFeat: { ...originFeat, choices } });
  const originFeatData = originFeat ? resolveFeat(db, `${originFeat.id}|${originFeat.source}`) : null;
  // Nível + bag alimentam as escolhas de MAGIA do talento (TC-0011: Magic
  // Initiate escolhe a lista + 2 cantrips + magia de nível 1 aqui mesmo).
  const featChoices = originFeatData
    ? parseChoices(originFeatData, { level: totalLevel(character), bag: originFeat?.choices })
    : [];

  // --- Proficiências + idioma (choice-bag) ---
  const setOriginChoices = (choices) => onChangeOrigin({ ...origin, choices });

  return (
    <div className={styles.tab}>
      {/* Ability Score Boosts - título linka a regra "Ability Score and
          Modifier" (XPHB) no popup do glossário (DDL-0032). */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>
            {boostsRule ? (
              <button type="button" className={styles.titleLink} onClick={() => showRulePopup(boostsRule)}>
                Ability Score Boosts
              </button>
            ) : (
              'Ability Score Boosts'
            )}
          </h3>
        </div>
        <div className={styles.modeRow}>
          <button
            type="button"
            className={mode === '2-1' ? `${styles.modeBtn} ${styles.modeActive}` : styles.modeBtn}
            onClick={() => setMode('2-1')}
          >
            +2 | +1
          </button>
          <button
            type="button"
            className={mode === '1-1-1' ? `${styles.modeBtn} ${styles.modeActive}` : styles.modeBtn}
            onClick={() => setMode('1-1-1')}
          >
            +1 | +1 | +1
          </button>
        </div>
        {mode && (
          <div className={styles.boostRows}>
            {boosts.map((b, i) => (
              <div className={styles.boostRow} key={i}>
                <span className={styles.boostAmount}>+{b.amount}</span>
                <ClearableSelect value={b.ability} onChange={(v) => setBoostAbility(i, v)} placeholder="Choose ability…">
                  {ABILITIES.filter((a) => !usedAbilities.has(a) || a === b.ability).map((a) => (
                    <option key={a} value={a}>
                      {ABILITY_FULL[a]}
                    </option>
                  ))}
                </ClearableSelect>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Origin Feat */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Origin Feat</h3>
        </div>
        <PickerField
          entity={originFeatEntity}
          db={db}
          current={
            originFeat
              ? { label: originFeat.id, source: originFeat.source, id: `${originFeat.id}|${originFeat.source}` }
              : null
          }
          placeholder="Choose origin feat…"
          onSelect={setOriginFeat}
          onClear={clearOriginFeat}
          exclude={(raw) => {
            const id = `${raw.name}|${raw.source}`;
            if (raw.repeatable || (originFeat && id === `${originFeat.id}|${originFeat.source}`)) return false;
            return owned.feats.has(id);
          }}
        />
        {featChoices.length > 0 && (
          <div className={styles.featChoices}>
            <ChoiceList choices={featChoices} bag={originFeat.choices} onChange={setFeatChoices} db={db} owned={owned} character={character} />
          </div>
        )}
      </section>

      {/* Proficiências & Idioma (padronizado via ChoiceList) */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Proficiencies &amp; Language</h3>
        </div>
        <ChoiceList
          choices={ORIGIN_CHOICES}
          bag={origin.choices ?? {}}
          onChange={setOriginChoices}
          db={db}
          owned={owned}
          character={character}
        />
      </section>

      {/* A HISTÓRIA fica aqui, e não na Biography: é o texto que justifica as
          escolhas de origem acima. No Foundry vai para os DOIS lugares - a
          descrição do item de background e `details.biography`. */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Background</h3>
          <span className={styles.sectionHint}>Where they came from, and how it shaped the choices above.</span>
        </div>
        <textarea
          className={styles.story}
          rows={6}
          value={character.identity?.backstory ?? ''}
          placeholder="Write this character's story…"
          onChange={(e) => onChangeIdentity({ backstory: e.target.value })}
        />
      </section>
    </div>
  );
}
