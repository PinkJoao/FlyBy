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
//   - O efeito ligado por concentração diz que acaba com ela: tirar a concentração
//     o tira junto (engine/playEffects).
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { SKILL_LABEL } from '../builder/labels';
import Icon from '../common/Icon';
import Collapse from '../common/Collapse';
import card from '../builder/ProficienciesCard.module.css';
import styles from './PlayCards.module.css';

const TARGET = { attack: 'attack rolls', save: 'saving throws', check: 'ability checks', damage: 'damage rolls', initiative: 'Initiative' };
const MODE = { adv: 'Advantage', dis: 'Disadvantage', advantage: 'Advantage', disadvantage: 'Disadvantage' };
const DURATION = { shortRest: 'Until a Short or Long Rest', longRest: 'Until a Long Rest' };

/** O nome de um alvo ("attack rolls", "Stealth"). */
const targetName = (t) => (String(t).startsWith('skill:') ? SKILL_LABEL[t.slice(6)] ?? t.slice(6) : TARGET[t] ?? t);

/** As linhas do que um efeito muda e da duração. */
function effectLines(m, combat) {
  const lines = [];
  for (const e of m.effects ?? []) {
    const what = e.formula ? (/^[+-]/.test(String(e.formula)) ? e.formula : `+${e.formula}`) : MODE[e.mode] ?? e.mode;
    if (what && (e.targets ?? []).length) lines.push(`${what} on ${e.targets.map(targetName).join(', ')}`);
  }
  if (Number(m.ac)) lines.push(`${m.ac > 0 ? '+' : ''}${m.ac} AC`);
  if (Number(m.speed)) lines.push(`${m.speed > 0 ? '+' : ''}${m.speed} ft speed`);
  if (combat && m.rounds && m.startRound != null) {
    const left = m.startRound + m.rounds - combat.round;
    lines.push(`${left} round${left === 1 ? '' : 's'} left`);
  } else if (DURATION[m.duration]) {
    lines.push(DURATION[m.duration]);
  }
  if (m.concentration) lines.push('Ends with your concentration');
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
    <div className={open ? `${card.card} ${card.open}` : card.card} data-flip="effects">
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
            <button type="button" className={styles.add} onClick={onAdd} title="Find the spell or feature that caused it">+ Add effect</button>
            <button type="button" className={styles.add} onClick={onAddCustom} title="A bonus or penalty of your own, like one from the DM">+ Add custom effect</button>
          </div>
        </div>
      </Collapse>
    </div>
  );
}
