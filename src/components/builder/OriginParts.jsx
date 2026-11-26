// =============================================================================
// OriginParts: as peças da origem, comuns à aba Background e ao guia (DDL-0328)
// =============================================================================
// O QUE FAZ
//   O seletor de background (Custom ou um pronto), os bônus de atributo, o talento de
//   origem com as sub-escolhas, o que o background já concede e as escolhas de
//   proficiência que sobram. Cada peça recebe a ficha e devolve a origem nova por
//   `onChangeOrigin`; a aba e os passos do guia só as arrumam. As contas ficam em
//   originSetup.js.
//
// FUNÇÕES
//   BackgroundPicker(props): o campo do background.
//   BoostPicker(props): os bônus (+2/+1 ou +1/+1/+1) nos atributos aceitos.
//   OriginFeatPicker(props): o campo do talento e as sub-escolhas.
//   OriginGranted(props): o que o background pronto concede (as perícias e a ferramenta).
//   OriginChoices(props): as escolhas de proficiência que sobram.
//
// DECISÕES E ARMADILHAS
//   - O seletor de background nunca fica vazio (resposta B4 do dono); escolher e limpar
//     passam por chooseBackground e clearBackground (originSetup.js), os mesmos do guia.
//   - O texto do background pronto fica nele: o info do campo e o seletor o mostram. O
//     campo de texto da aba é sempre a história do jogador (resposta B6).
//   - O talento de um background pronto vem travado, com o cadeado e a dica (DDL-0330; o
//     info fica); os do Ravenloft dão
//     uma escolha entre o nomeado e os Dark Gifts (`only` na entity). A lista que o
//     background fixa (o Magic Initiate) sai das sub-escolhas.
//   - +1/+1/+1 num background pronto não tem escolha: vira uma linha de texto.
// -----------------------------------------------------------------------------

import { useEffect } from 'react';
import { recommendedBoosts, boostsEmpty } from '../../engine/abilityMethods';
import { allowedBoostAbilities, backgroundFixedTool, backgroundOf, backgroundSkills, originChoicesFor } from '../../engine/backgrounds';
import { ownedFromDb } from '../../engine/resolve';
import { boostMode, chooseBackground, classIdOf, clearBackground, isBoostFixed, originFeatChoices, originFeatSetup } from './originSetup';
import SegmentedControl from '../common/SegmentedControl';
import ChoiceChips from '../common/ChoiceChips';
import PickerField from '../common/PickerField';
import Chip from '../common/Chip';
import ChoiceList from './ChoiceList';
import { ABILITY_FULL, ABILITY_SHORT, SKILL_LABEL } from './labels';
import backgroundEntity, { backgroundIdOf } from '../../selector/entities/background';
import styles from './OriginParts.module.css';

/** O campo do background: Custom ou um pronto, nunca vazio. */
export function BackgroundPicker({ character, db, onChangeOrigin, showInfo = true }) {
  const origin = character.origin ?? {};
  const bg = backgroundOf(character, db);
  const current = bg
    ? { label: bg.name, source: bg.source, id: backgroundIdOf(origin) }
    : { label: 'Custom Background', id: 'custom' };
  const pick = async (raw) => {
    const next = await chooseBackground(character, db, raw);
    if (next) onChangeOrigin(next);
  };
  const clear = async () => {
    const next = await clearBackground(character);
    if (next) onChangeOrigin(next);
  };

  return (
    <PickerField
      entity={backgroundEntity}
      db={db}
      current={current}
      placeholder="Choose a background…"
      showInfo={showInfo && !!bg}
      onSelect={pick}
      onClear={clear}
    />
  );
}

/** Os bônus de atributo nos atributos que a origem aceita. */
export function BoostPicker({ character, db, onChangeOrigin, modeClassName }) {
  const origin = character.origin ?? {};
  const boosts = origin.abilityBoosts ?? [];
  const mode = boostMode(boosts) ?? '2-1';
  const allowed = allowedBoostAbilities(origin, db);
  const ready = !!origin.background;
  const classId = classIdOf(character);

  const setMode = (m) => {
    let next = recommendedBoosts(classId, m, ready ? allowed : null) ?? [];
    if (!next.length && m === '2-1') next = [{ ability: '', amount: 2 }, { ability: '', amount: 1 }];
    else if (!next.length) next = [{ ability: '', amount: 1 }, { ability: '', amount: 1 }, { ability: '', amount: 1 }];
    onChangeOrigin({ ...origin, abilityBoosts: next });
  };
  useEffect(() => {
    if (boosts.length === 0 || (classId && boostsEmpty(boosts))) setMode(boosts.length ? mode : '2-1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setBoostAbility = (index, ability) =>
    onChangeOrigin({ ...origin, abilityBoosts: boosts.map((b, i) => (i === index ? { ...b, ability } : b)) });
  const used = new Set(boosts.map((b) => b.ability).filter(Boolean));

  return (
    <>
      <SegmentedControl
        block
        className={modeClassName}
        ariaLabel="How the boosts split"
        value={mode}
        options={[
          ['2-1', '+2 | +1'],
          ['1-1-1', '+1 | +1 | +1'],
        ]}
        onChange={setMode}
      />
      {isBoostFixed(origin, db) ? (
        <p className={styles.fixedBoosts}>{allowed.map((a) => `+1 ${ABILITY_FULL[a]}`).join(', ')}</p>
      ) : (
        <div className={styles.boostRows}>
          {boosts.map((b, i) => (
            <div className={styles.boostRow} key={i}>
              <span className={styles.boostAmount}>+{b.amount}</span>
              <ChoiceChips
                clearable={false}
                ariaLabel={`Ability for +${b.amount}`}
                value={b.ability}
                onChange={(v) => setBoostAbility(i, v)}
                options={allowed.map((x) => ({ value: x, label: ABILITY_SHORT[x], title: ABILITY_FULL[x], disabled: used.has(x) && x !== b.ability }))}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** O campo do talento de origem e as sub-escolhas. */
export function OriginFeatPicker({ character, db, onChangeOrigin, showInfo = true, guided = false, preview = null }) {
  const origin = character.origin ?? {};
  const originFeat = origin.originFeat ?? null;
  const owned = ownedFromDb(character, db);
  const setup = originFeatSetup(character, db);
  const choices = originFeatChoices(character, db);
  const id = originFeat ? `${originFeat.id}|${originFeat.source}` : null;

  const setFeat = (raw) => onChangeOrigin({ ...origin, originFeat: { id: raw.name, source: raw.source, subtype: 'origin', choices: {} } });
  const setChoices = (bag) => onChangeOrigin({ ...origin, originFeat: { ...originFeat, choices: bag } });

  return (
    <>
      <PickerField
        entity={setup.entity}
        db={db}
        current={originFeat ? { label: originFeat.id, source: originFeat.source, id } : null}
        placeholder="Choose an origin feat…"
        showInfo={showInfo}
        locked={setup.locked}
        lockedHint={`The ${backgroundOf(character, db)?.name ?? 'chosen'} background gives this feat. To pick another, switch to the Custom Background.`}
        initialFilterState={guided ? { prereq: { ok: 'include' }, ...setup.filters } : setup.filters}
        onSelect={setFeat}
        onClear={() => onChangeOrigin({ ...origin, originFeat: null })}
        exclude={(raw) => {
          const rid = `${raw.name}|${raw.source}`;
          if (raw.repeatable || rid === id) return false;
          return owned.feats.has(rid);
        }}
      />
      {preview}
      {choices.length > 0 && (
        <div className={styles.featChoices}>
          <ChoiceList choices={choices} bag={originFeat.choices} onChange={setChoices} db={db} owned={owned} character={character} />
        </div>
      )}
    </>
  );
}

/** O que o background pronto concede: as perícias e a ferramenta fixa. */
export function OriginGranted({ character, db }) {
  const bg = backgroundOf(character, db);
  if (!bg) return null;
  const tool = backgroundFixedTool(db, bg);
  return (
    <div className={styles.granted}>
      <span className={styles.grantedLabel}>From {bg.name}</span>
      <div className={styles.grantedChips}>
        {backgroundSkills(bg).map((s) => (
          <Chip key={s} size="sm">{SKILL_LABEL[s] ?? s}</Chip>
        ))}
        {tool && <Chip size="sm">{tool}</Chip>}
      </div>
    </div>
  );
}

/** As escolhas de proficiência que sobram (todas, na origem custom). */
export function OriginChoices({ character, db, onChangeOrigin }) {
  const origin = character.origin ?? {};
  return (
    <ChoiceList
      choices={originChoicesFor(origin, db)}
      bag={origin.choices ?? {}}
      onChange={(choices) => onChangeOrigin({ ...origin, choices })}
      db={db}
      owned={ownedFromDb(character, db)}
      character={character}
    />
  );
}
