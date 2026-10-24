// =============================================================================
// AbilityCards: os seis atributos do play mode, em mini cards expansíveis
// =============================================================================
// O QUE FAZ
//   A mesma grade de atributos da ficha (nome, valor e modificador; 6 por linha no
//   desktop, 3 no celular), mas o card aberto traz dois botões em vez dos números
//   da ficha: Check (abre o seletor de perícia, que leva à rolagem) e Save (abre a
//   rolagem do save; no desktop, Shift rola direto).
//
// FUNÇÕES
//   AbilityCards(props): a grade.
//   AbilityCard(props): um atributo.
//
// DECISÕES E ARMADILHAS
//   - O visual vem do PRÓPRIO CSS da ficha (StatsHeader.module.css), para os dois
//     modos serem o mesmo card; só os botões têm CSS daqui.
//   - O Check não rola direto nem com Shift: antes vem a escolha da perícia (ou o
//     teste puro), que é o que muda o bônus.
//   - O Save do atributo com proficiência leva a cor de destaque, como o ponto de
//     proficiência das perícias.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { formatBonus } from '../../engine/math';
import { ABILITY_FULL } from '../builder/labels';
import Icon from '../common/Icon';
import Collapse from '../common/Collapse';
import RollButton from './RollButton';
import sheet from '../builder/StatsHeader.module.css';
import styles from './AbilityCards.module.css';

/** Um atributo: fechado mostra valor e modificador; aberto, Check e Save. */
function AbilityCard({ ability, onCheck, onSave }) {
  const [open, setOpen] = useState(false);
  const name = ABILITY_FULL[ability.ability];
  return (
    <div className={open ? `${sheet.ability} ${sheet.open}` : sheet.ability}>
      <button type="button" className={sheet.abilityHead} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={sheet.chevron}><Icon name="chevron" /></span>
        <span className={sheet.name}>{name}</span>
        <span className={sheet.total}>{ability.score}</span>
        <span className={sheet.mod}>{formatBonus(ability.mod)}</span>
      </button>
      <Collapse open={open}>
        <div className={`${sheet.detail} ${styles.actions}`}>
          <button type="button" className={styles.act} onClick={() => onCheck(ability.ability)} title={`${name} check: choose a skill`}>
            <span className={styles.actLabel}>Check</span>
            <span className={styles.actValue}>{formatBonus(ability.mod)}</span>
          </button>
          <RollButton
            className={ability.saveProf ? `${styles.act} ${styles.prof}` : styles.act}
            title={`${name} saving throw`}
            onRoll={(quick) => onSave(ability.ability, quick)}
          >
            <span className={styles.actLabel}>Save</span>
            <span className={styles.actValue}>{formatBonus(ability.save)}</span>
          </RollButton>
        </div>
      </Collapse>
    </div>
  );
}

/**
 * A grade dos seis atributos.
 * @param {{ abilities: object[], onCheck: Function, onSave: Function, dataTour?: string }} props
 */
export default function AbilityCards({ abilities, onCheck, onSave, dataTour }) {
  return (
    <div className={`${sheet.abilities} ${styles.grid}`} data-tour={dataTour}>
      {abilities.map((a) => <AbilityCard key={a.ability} ability={a} onCheck={onCheck} onSave={onSave} />)}
    </div>
  );
}
