// =============================================================================
// ConditionsCard: o painel expansível das condições no play mode
// =============================================================================
// O QUE FAZ
//   Um card no estilo do de proficiências (o mesmo CSS), logo abaixo dele: o
//   cabeçalho conta as condições ativas; aberto, lista cada uma com o que ela faz
//   (lido do registro CONDITIONS, engine/playEffects), o nível da exaustão com os botões de menos e
//   mais, o botão de tirar, e "Add condition".
//
// FUNÇÕES
//   ConditionsCard(props): o card.
//   effectLines(condition, level): as linhas do que a condição faz.
//
// DECISÕES E ARMADILHAS
//   - O texto do que a condição faz sai dos MESMOS campos que as rolagens usam
//     (attack, check, speedZero, autoFail...): o card promete o que o engine aplica.
//   - A exaustão 6 mata: o aviso fica no card, aberto ou não, porque é o fim do
//     personagem e não um detalhe.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { CONDITIONS } from '../../engine/playEffects';
import Icon from '../common/Icon';
import Collapse from '../common/Collapse';
import card from '../builder/ProficienciesCard.module.css';
import styles from './PlayCards.module.css';

const MODE = { adv: 'Advantage', dis: 'Disadvantage' };
const ABILITY_SHORT = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' };

/** As linhas do que uma condição faz, dos campos que o engine aplica. */
function effectLines(c, level) {
  if (!c) return [];
  const lines = [];
  if (c.levels) lines.push(`-${2 * level} to d20 tests, -${5 * level} ft speed`);
  if (c.attack) lines.push(`${MODE[c.attack]} on attack rolls`);
  if (c.check) lines.push(`${MODE[c.check]} on ability checks`);
  if (c.initiative) lines.push(`${MODE[c.initiative]} on Initiative`);
  if (c.speedZero) lines.push('Speed 0');
  if (c.autoFail) lines.push(`Fails ${c.autoFail.map((a) => ABILITY_SHORT[a]).join(' and ')} saves`);
  if (c.resistAll) lines.push('Resistance to all damage');
  if (c.conditional) lines.push(`(${c.conditional})`);
  return [...lines, ...(c.notes ?? [])];
}

/**
 * O card das condições.
 * @param {{ conditions: object, onAdd: Function, onSet: Function }} props
 */
export default function ConditionsCard({ conditions, onAdd, onSet }) {
  const [open, setOpen] = useState(false);
  const active = Object.entries(conditions ?? {}).filter(([, level]) => level > 0);
  const dead = (conditions?.exhaustion ?? 0) >= 6;

  return (
    <div className={open ? `${card.card} ${card.open}` : card.card} data-flip="conditions">
      <button type="button" className={card.head} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={card.icon}><Icon name="condition" /></span>
        <span className={card.title}>Conditions</span>
        <span className={card.bonusWrap}>
          <span className={card.bonusLabel}>{active.length ? 'Active' : 'None'}</span>
          {active.length > 0 && <span className={card.bonus}>{active.length}</span>}
        </span>
        <span className={card.chevron}><Icon name="chevron" /></span>
      </button>
      {!open && active.length > 0 && (
        <p className={styles.summary}>{active.map(([id, level]) => `${CONDITIONS[id]?.name ?? id}${CONDITIONS[id]?.levels ? ` ${level}` : ''}`).join(', ')}</p>
      )}
      {dead && <p className={styles.warn}>Exhaustion 6: the character dies.</p>}

      <Collapse open={open}>
        <div className={card.body}>
          {active.length === 0 && <p className={card.empty}>No conditions. Add one when an effect, a spell or the DM gives it to you.</p>}
          <ul className={styles.list}>
            {active.map(([id, level]) => {
              const c = CONDITIONS[id];
              return (
                <li key={id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <span className={styles.rowName}>{c?.name ?? id}</span>
                    {effectLines(c, level).map((l) => <span key={l} className={styles.rowNote}>{l}</span>)}
                  </div>
                  <div className={styles.rowCtrl}>
                    {c?.levels ? (
                      <>
                        <button type="button" className={styles.ctrlBtn} onClick={() => onSet(id, level - 1)} aria-label="One level less">-</button>
                        <span className={styles.level}>{level}</span>
                        <button type="button" className={styles.ctrlBtn} onClick={() => onSet(id, Math.min(c.levels, level + 1))} disabled={level >= c.levels} aria-label="One level more">+</button>
                      </>
                    ) : (
                      <button type="button" className={styles.ctrlBtn} onClick={() => onSet(id, 0)} aria-label={`End ${c?.name ?? id}`} title="End it">
                        <Icon name="close" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <button type="button" className={styles.add} onClick={onAdd}>+ Add condition</button>
        </div>
      </Collapse>
    </div>
  );
}
