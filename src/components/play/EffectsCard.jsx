// =============================================================================
// EffectsCard: o painel expansível dos efeitos no play mode
// =============================================================================
// O QUE FAZ
//   Um card no estilo do de proficiências (o mesmo CSS), logo abaixo do das
//   condições: o cabeçalho conta os efeitos ligados (Rage, Bless, o do mestre);
//   aberto, lista cada um com o que ele muda, quanto tempo falta e o botão de
//   tirar, e dois botões (DDL-0121): "Add effect" abre o painel seletor para
//   achar o CAUSADOR (a magia, a feature que outro jogador usou em você) e
//   "Add custom effect" o efeito livre (o bônus do mestre, ModifierPanel).
//
// FUNÇÕES
//   EffectsCard(props): o card.
//   targetName(target): o nome de um alvo ("attack rolls", a perícia).
//   effectLines(modifier, combat): as linhas do que o efeito muda e da duração.
//
// DECISÕES E ARMADILHAS
//   - As rodadas que faltam só aparecem em combate (a duração em rodadas nasce
//     nele, engine/playCombat); fora dele vale a duração escrita.
//   - O que o próprio personagem lança ou usa (Bless, Rage) entra SOZINHO ao
//     lançar ou usar; o Add effect é para o que vem de fora.
//   - As linhas dizem também a condição do efeito (`when`, a opção na rolagem), as resistências, as imunidades
//     e os deslocamentos novos (`speeds`) do modificador: o Shadowform dizia "+1d6 on damage rolls" e o Rage
//     of the Gods não mostrava as resistências (DDL-0252).
//   - Os alvos por atributo dizem o nome ("Dexterity saving throws", não "save:dex"), e os campos dos autobuffs têm
//     linha própria: o piso da CA (Barkskin), o dobro do deslocamento (Haste), o máximo de PV (Aid) e a cura no
//     máximo (Beacon of Hope) (DDL-0260).
//   - O efeito ligado por concentração diz que acaba com ela: tirar a concentração
//     o tira junto (engine/playEffects).
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { SKILL_LABEL } from '../builder/labels';
import Icon from '../common/Icon';
import Collapse from '../common/Collapse';
import Chip from '../common/Chip';
import card from '../builder/ProficienciesCard.module.css';
import styles from './PlayCards.module.css';

const TARGET = { attack: 'attack rolls', save: 'saving throws', check: 'ability checks', damage: 'damage rolls', initiative: 'Initiative', deathSave: 'Death Saving Throws' };
const ABILITY = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const KIND_OF = { save: 'saving throws', check: 'checks' };
const MODE = { adv: 'Advantage', dis: 'Disadvantage', advantage: 'Advantage', disadvantage: 'Disadvantage' };
const WHEN = { strAttack: 'Strength attacks', weaponAttack: 'weapon attacks', spell: 'spells', slotSpell: 'spells cast with a slot' };
const DURATION = { shortRest: 'Until a Short or Long Rest', longRest: 'Until a Long Rest' };

/** O nome de um alvo ("attack rolls", "Stealth"). */
const targetName = (t) => {
  const [kind, ab] = String(t).split(':');
  if (kind === 'skill') return SKILL_LABEL[ab] ?? ab;
  if (ab && ABILITY[ab] && KIND_OF[kind]) return `${ABILITY[ab]} ${KIND_OF[kind]}`;
  return TARGET[t] ?? t;
};

/** As linhas do que um efeito muda e da duração. */
function effectLines(m, combat) {
  const lines = [];
  for (const e of m.effects ?? []) {
    const what = e.formula ? (/^[+-]/.test(String(e.formula)) ? e.formula : `+${e.formula}`) : MODE[e.mode] ?? e.mode;
    if (!what || !(e.targets ?? []).length) continue;
    const scope = [WHEN[e.when], e.types?.length ? `${e.types.join(' or ')} damage` : null].filter(Boolean).join(', ');
    lines.push(e.optional && e.label
      ? `${what} ${e.label}${scope ? `: ${scope}` : ''}, an option in the roll`
      : `${what} on ${e.targets.map(targetName).join(', ')}${scope ? ` (${scope})` : ''}${e.optional ? ', an option in the roll' : ''}`);
  }
  if (Number(m.ac)) lines.push(`${m.ac > 0 ? '+' : ''}${m.ac} AC`);
  if (Number(m.acMin)) lines.push(`AC at least ${m.acMin}`);
  if (Number(m.speedTimes) > 1) lines.push(m.speedTimes === 2 ? 'Speed doubled' : `Speed x${m.speedTimes}`);
  if (Number(m.hpMax)) lines.push(`+${m.hpMax} Hit Point maximum`);
  if (m.healMax) lines.push('Healing you receive is the maximum');
  if (Number(m.speed)) lines.push(`${m.speed > 0 ? '+' : ''}${m.speed} ft speed`);
  if ((m.resist ?? []).length) lines.push(`Resistance to ${m.resist.join(', ')}`);
  if ((m.immune ?? []).length) lines.push(`Immunity to ${m.immune.join(', ')}`);
  for (const [mode, v] of Object.entries(m.speeds ?? {})) lines.push(`${mode[0].toUpperCase()}${mode.slice(1)} Speed ${v === 'walk' ? 'equal to your Speed' : `${v} feet`}`);
  if (combat && m.rounds && m.startRound != null) {
    const left = m.startRound + m.rounds - combat.round;
    lines.push(`${left} round${left === 1 ? '' : 's'} left`);
  } else if (DURATION[m.duration]) {
    lines.push(DURATION[m.duration]);
  }
  if (m.concentration) lines.push('Ends with your concentration');
  for (const n of m.notes ?? []) lines.push(n);
  return lines;
}

/**
 * O card dos efeitos.
 * @param {{ modifiers: object[], combat: object|null, onAdd: Function, onAddCustom: Function, onRemove: Function }} props
 */
export default function EffectsCard({ modifiers, combat, onAdd, onAddCustom, onRemove }) {
  const [open, setOpen] = useState(false);
  const list = modifiers ?? [];

  return (
    <div className={open ? `${card.card} ${card.open}` : card.card} data-flip="effects" data-flip-scale="" data-flip-after="">
      <button type="button" className={card.head} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={card.icon}><Icon name="effect" /></span>
        <span className={card.title}>Effects</span>
        <span className={card.bonusWrap}>
          <span className={card.bonusLabel}>{list.length ? 'Active' : 'None'}</span>
          {list.length > 0 && <span className={card.bonus}>{list.length}</span>}
        </span>
        <span className={card.chevron}><Icon name="chevron" /></span>
      </button>
      {!open && list.length > 0 && <p className={styles.summary}>{list.map((m) => m.label).join(', ')}</p>}

      <Collapse open={open}>
        <div className={card.body}>
          {list.length === 0 && <p className={card.empty}>No effects. Can't find one in Add effect? Create a custom effect.</p>}
          <ul className={styles.list}>
            {list.map((m) => (
              <li key={m.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.rowName}>{m.label}</span>
                  {effectLines(m, combat).map((l) => <span key={l} className={styles.rowNote}>{l}</span>)}
                </div>
                <div className={styles.rowCtrl}>
                  <button type="button" className={styles.ctrlBtn} onClick={() => onRemove(m.id)} aria-label={`End ${m.label}`} title="End it">
                    <Icon name="close" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className={styles.adds}>
            <Chip add onCard onClick={onAdd} title="Find the spell or feature that caused it">Add effect</Chip>
            <Chip add onCard onClick={onAddCustom} title="A bonus or penalty of your own, like one from the DM">Add custom effect</Chip>
          </div>
        </div>
      </Collapse>
    </div>
  );
}
