// =============================================================================
// BackgroundTab: a aba de origem custom (Fase 5b)
// =============================================================================
// O QUE FAZ
//   Sem backgrounds prontos: a origem é montada peça por peça e reflete AO VIVO no
//   cabeçalho e no ProficienciesCard.
//     Boosts de atributo (2024: +2/+1 ou +1/+1/+1): origin.abilityBoosts. O +2/+1
//       vem marcado quando ainda não há boosts.
//     Talento de origem, com as sub-escolhas recursivas: origin.originFeat. Nível
//       e bag alimentam as escolhas de magia do talento (o Magic Initiate, TC-0011).
//     Proficiências e idioma (2 perícias, 1 ferramenta, 1 idioma, pelo
//       ChoiceList): origin.choices.
//     A HISTÓRIA, que fica aqui e não na Biography: justifica as escolhas de
//       origem, e no Foundry vai para a descrição do item de background e para
//       `details.biography`.
//
// FUNÇÕES
//   boostMode(boosts): o modo de boost pelo array salvo.
//   BackgroundTab(props): a aba.
//
// DECISÕES E ARMADILHAS
//   - O que a ficha já tem não pode ser escolhido de novo (dedup). A entity de
//     talento é ciente do personagem (colore os pré-requisitos).
//   - O título "Ability Score Boosts" é link para a regra do glossário (DDL-0032).
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
import { TUT } from '../../tutorial/anchors';
import styles from './BackgroundTab.module.css';

/** O modo de boost derivado do array salvo. */
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

  const owned = ownedFromDb(character, db);

  const originFeatEntity = makeFeatEntity(['O'], 'Origin Feat', prereqContext(character, { db }));

  const boostsRule = namedRuleEntry(db, 'Ability Score and Modifier|XPHB');

  const setMode = (m) => {
    let next = [];
    if (m === '2-1') next = [{ ability: '', amount: 2 }, { ability: '', amount: 1 }];
    else if (m === '1-1-1') next = [{ ability: '', amount: 1 }, { ability: '', amount: 1 }, { ability: '', amount: 1 }];
    onChangeOrigin({ ...origin, abilityBoosts: next });
  };
  useEffect(() => {
    if (!origin.abilityBoosts || origin.abilityBoosts.length === 0) setMode('2-1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setBoostAbility = (index, ability) =>
    onChangeOrigin({ ...origin, abilityBoosts: boosts.map((b, i) => (i === index ? { ...b, ability } : b)) });
  const usedAbilities = new Set(boosts.map((b) => b.ability).filter(Boolean));

  const setOriginFeat = (raw) =>
    onChangeOrigin({ ...origin, originFeat: { id: raw.name, source: raw.source, subtype: 'origin', choices: {} } });
  const clearOriginFeat = () => onChangeOrigin({ ...origin, originFeat: null });
  const setFeatChoices = (choices) => onChangeOrigin({ ...origin, originFeat: { ...originFeat, choices } });
  const originFeatData = originFeat ? resolveFeat(db, `${originFeat.id}|${originFeat.source}`) : null;
  const featChoices = originFeatData
    ? parseChoices(originFeatData, { level: totalLevel(character), bag: originFeat?.choices })
    : [];

  const setOriginChoices = (choices) => onChangeOrigin({ ...origin, choices });

  return (
    <div className={styles.tab}>
      <section className={styles.section} data-tour={TUT.TAB_BG_BOOSTS}>
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

      <section className={styles.section} data-tour={TUT.TAB_BG_FEAT}>
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

      <section className={styles.section} data-tour={TUT.TAB_BG_PROFS}>
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

      <section className={styles.section} data-tour={TUT.TAB_BG_STORY}>
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
