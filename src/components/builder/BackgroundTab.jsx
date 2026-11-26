// =============================================================================
// BackgroundTab: a aba de origem (Fase 5b; backgrounds prontos no DDL-0328)
// =============================================================================
// O QUE FAZ
//   A origem reflete AO VIVO no cabeçalho e no ProficienciesCard. Em cima, o
//   background: o Custom (padrão, montado peça por peça) ou um pronto de 2024 em
//   diante, que preenche e trava o que ele decide.
//     Boosts de atributo (2024: +2/+1 ou +1/+1/+1): origin.abilityBoosts, só nos três
//       atributos de um background pronto.
//     Talento de origem, com as sub-escolhas recursivas: origin.originFeat. Nível
//       e bag alimentam as escolhas de magia do talento (o Magic Initiate, TC-0011).
//     Proficiências e idiomas (no Custom 2 perícias, 1 ferramenta, 2 idiomas; num
//       pronto, as concedidas à vista e só o que sobra), pelo ChoiceList: origin.choices.
//     A HISTÓRIA, que fica aqui e não na Biography: justifica as escolhas de
//       origem, e no Foundry vai para a descrição do item de background e para
//       `details.biography`.
//
// FUNÇÕES
//   BackgroundTab(props): a aba.
//
// DECISÕES E ARMADILHAS
//   - As peças vêm de OriginParts (as mesmas do guia): o seletor de background, os bônus,
//     o talento e as proficiências.
//   - O que a ficha já tem não pode ser escolhido de novo (dedup). A entity de
//     talento é ciente do personagem (colore os pré-requisitos).
//   - O talento de origem aceita também os Dragonmark (DDL-0172) e os Dark Gift
//     (DDL-0328). Filtro de Categoria com Origin pré-marcado.
//   - O texto do campo da história é sempre do jogador; o do background pronto abre pelo
//     info do campo de background (resposta B6 do dono).
//   - O título "Ability Score Boosts" é link para a regra do glossário (DDL-0032).
// -----------------------------------------------------------------------------

import { namedRuleEntry } from './choiceRules';
import { showRulePopup } from '../common/RulePopup';
import { TUT } from '../../tutorial/anchors';
import { BackgroundPicker, BoostPicker, OriginChoices, OriginFeatPicker, OriginGranted } from './OriginParts';
import styles from './BackgroundTab.module.css';

export default function BackgroundTab({ character, db, onChangeOrigin, onChangeIdentity }) {
  const boostsRule = namedRuleEntry(db, 'Ability Score and Modifier|XPHB');
  const ready = !!character.origin?.background;

  return (
    <div className={styles.tab}>
      <section className={styles.section} data-tour={TUT.TAB_BG_PICK}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Background</h3>
          <span className={styles.sectionHint}>{ready ? 'A ready-made origin from the books.' : 'Build it piece by piece, or pick one from the books.'}</span>
        </div>
        <BackgroundPicker character={character} db={db} onChangeOrigin={onChangeOrigin} />
      </section>

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
        <BoostPicker character={character} db={db} onChangeOrigin={onChangeOrigin} modeClassName={styles.modeRow} />
      </section>

      <section className={styles.section} data-tour={TUT.TAB_BG_FEAT}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Origin Feat</h3>
        </div>
        <OriginFeatPicker character={character} db={db} onChangeOrigin={onChangeOrigin} />
      </section>

      <section className={styles.section} data-tour={TUT.TAB_BG_PROFS}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Proficiencies &amp; Languages</h3>
        </div>
        <OriginGranted character={character} db={db} />
        <OriginChoices character={character} db={db} onChangeOrigin={onChangeOrigin} />
      </section>

      <section className={styles.section} data-tour={TUT.TAB_BG_STORY}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Story</h3>
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
