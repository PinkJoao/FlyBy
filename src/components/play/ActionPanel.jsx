// =============================================================================
// ActionPanel: como o personagem vai usar uma ação básica
// =============================================================================
// O QUE FAZ
//   O painel que abre ao tocar num card da aba Actions (docs/PLAY-MODE-V2-PLAN.md
//   §4): o custo (quando há mais de um, como o Dash do ladino), o aviso se ele já foi
//   gasto no turno, e o MEIO: o ataque (Attack, Opportunity Attack, Two-Weapon
//   Fighting), a magia ou o item mágico (Magic), o consumível (Utilize), a perícia
//   (Influence, Study, Search, Hide, Escape a Grapple), o gatilho (Ready). As ações
//   sem meio (Disengage, Dodge, Help...) têm um botão só. O texto da regra fica
//   num "Rules" recolhido. Fecha com { cost, kind, ... } e a tela executa.
//
// FUNÇÕES
//   costText(c): o rótulo de um custo, com a feature e a ação junto (o Focus).
//   Pick(props): uma linha tocável (nome, detalhe, valor à direita).
//   ActionPanel(props): o painel.
//
// DECISÕES E ARMADILHAS
//   - O painel só ESCOLHE; quem grava é a tela (pages/Play, takeAction), que já
//     sabe rolar, lançar e usar. Assim cada ação reaproveita o fluxo que existe.
//   - O custo começa no primeiro LIVRE; gasto continua escolhível, com aviso.
//   - Two-Weapon Fighting lista só as armas leves equipadas; o Opportunity Attack,
//     só as de corpo a corpo (actionContext).
//   - Magic lista as magias PREPARADAS (o resto do grimório é da ficha), cada uma
//     com o tempo de lançar, mais os itens com carga e os pergaminhos.
//   - Hide é Stealth com CD 15 (XPHB); o painel diz a CD, a mesa decide o resto.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { ACTION_MEANS, ACTION_SKILLS } from '../../engine/playBasicActions';
import { testBreakdown } from '../../engine/playChecks';
import { remainingOf } from '../../engine/playState';
import { formatBonus } from '../../engine/math';
import { SKILL_LABEL } from '../builder/labels';
import { useDialogClose } from '../common/dialogContext';
import Button from '../common/Button';
import Chip from '../common/Chip';
import Collapse from '../common/Collapse';
import EntryContent from '../common/EntryContent';
import styles from './ActionPanel.module.css';

const TIME = { action: 'Action', bonus: 'Bonus Action', reaction: 'Reaction', minute: '1 minute', hour: '1 hour' };
const ECON_NAME = { action: 'action', bonus: 'bonus action', reaction: 'reaction' };

/** O rótulo de um custo, com a feature e a ação que vem junto. */
function costText(c) {
  const extra = c.with?.length ? `, also ${c.with.join(' and ')}` : '';
  return c.source && c.source !== 'a spell' ? `${c.label} (${c.source}${extra})` : c.label;
}

/** Uma linha tocável. */
function Pick({ name, detail, value, onPick }) {
  return (
    <li>
      <button type="button" className={styles.pick} onClick={onPick}>
        <span className={styles.pickMain}>
          <span className={styles.pickName}>{name}</span>
          {detail && <span className={styles.pickDetail}>{detail}</span>}
        </span>
        {value != null && <span className={styles.pickValue}>{value}</span>}
      </button>
    </li>
  );
}

/**
 * O painel de uma ação.
 * @param {{ item: object, ctx: object, catalog: object, state: object, rule: object|null }} props
 */
export default function ActionPanel({ item, ctx, catalog, state, rule }) {
  const close = useDialogClose();
  const firstFree = item.costs.findIndex((c) => c.available);
  const [costIdx, setCostIdx] = useState(firstFree >= 0 ? firstFree : 0);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [trigger, setTrigger] = useState('');
  const cost = item.costs[costIdx];
  const done = (rest) => close({ cost, ...rest });
  const means = ACTION_MEANS[item.name] ?? 'mark';
  const readied = state.combat?.used?.readied ?? null;

  const attacks = item.name === 'Opportunity Attack' ? ctx.melee : item.name === 'Two-Weapon Fighting' ? ctx.light : ctx.attacks;
  const attackDetail = (a) => [a.toHit ? `${formatBonus(a.toHit.total)} to hit` : null, a.damage ? `${a.damage.dice}${a.damage.bonus ? formatBonus(a.damage.bonus) : ''} ${a.damage.types?.[0] ?? ''}`.trim() : null].filter(Boolean).join(', ');

  return (
    <div className={styles.panel}>
      {item.costs.length > 1 && (
        <div className={styles.costs} role="radiogroup" aria-label="Cost">
          {item.costs.map((c, i) => (
            <Chip key={`${c.cost}-${c.source}-${i}`} active={i === costIdx} onClick={() => setCostIdx(i)} className={state.combat && !c.available ? styles.used : undefined}>
              {costText(c)}
            </Chip>
          ))}
        </div>
      )}
      {state.combat && cost && !cost.available && ECON_NAME[cost.cost] && <p className={styles.warn}>Your {ECON_NAME[cost.cost]} is already used this turn.</p>}
      {cost?.note && <p className={styles.note}>{cost.source}: {cost.note}.</p>}

      {means === 'attack' && (
        <ul className={styles.list}>
          {attacks.map((a) => (
            <Pick key={a.key} name={a.name} detail={attackDetail(a)} onPick={() => done({ kind: 'attack', attack: a })} />
          ))}
        </ul>
      )}

      {means === 'magic' && (
        <>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((lv) => {
            const here = ctx.spells.filter(({ spell }) => spell.level === lv);
            if (!here.length) return null;
            return (
              <div key={lv} className={styles.group}>
                <h3 className={styles.heading}>{lv === 0 ? 'Cantrips' : `Level ${lv}`}</h3>
                <ul className={styles.list}>
                  {here.map(({ origin, spell }) => (
                    <Pick key={spell.key} name={spell.name} detail={[TIME[spell.time] ?? spell.time, origin.label].filter(Boolean).join(' · ')} onPick={() => done({ kind: 'spell', origin, spell })} />
                  ))}
                </ul>
              </div>
            );
          })}
          {(ctx.charged.length > 0 || ctx.scrolls.length > 0) && (
            <div className={styles.group}>
              <h3 className={styles.heading}>Magic items</h3>
              <ul className={styles.list}>
                {ctx.charged.map((r) => (
                  <Pick key={r.key} name={r.item ?? r.name} detail="Uses a charge" value={`${remainingOf(state, r.key, r.max)}/${r.max}`} onPick={() => done({ kind: 'charge', resource: r })} />
                ))}
                {ctx.scrolls.map((e) => (
                  <Pick key={e.uid ?? e.raw.name} name={e.raw.name} detail="Read the scroll" value={`x${e.quantity ?? 1}`} onPick={() => done({ kind: 'item', entry: e })} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {means === 'item' && (
        <ul className={styles.list}>
          {ctx.usable.map((e) => (
            <Pick key={e.uid ?? e.raw.name} name={e.raw.name} value={`x${e.quantity ?? 1}`} onPick={() => done({ kind: 'item', entry: e })} />
          ))}
        </ul>
      )}

      {means === 'skill' && (
        <ul className={styles.list}>
          {(ACTION_SKILLS[item.name] ?? []).map((skill) => (
            <Pick
              key={skill}
              name={SKILL_LABEL[skill] ?? skill}
              detail={item.name === 'Hide' ? 'DC 15' : null}
              value={formatBonus(testBreakdown(catalog, state, { type: 'skill', id: skill }).total)}
              onPick={() => done({ kind: 'skill', skill, name: `${item.name}: ${SKILL_LABEL[skill] ?? skill}` })}
            />
          ))}
        </ul>
      )}

      {means === 'dash' && (
        <Button variant="primary" block onClick={() => done({ kind: 'dash' })}>
          Dash
        </Button>
      )}

      {means === 'ready' &&
        (readied ? (
          <>
            <p className={styles.note}>Readied: {readied}</p>
            <Button variant="primary" block onClick={() => done({ kind: 'readiedReaction' })}>
              The trigger happened: use your reaction
            </Button>
          </>
        ) : (
          <>
            <label className={styles.field}>
              <span>What are you waiting for?</span>
              <input className={styles.input} value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="When the door opens, I attack" />
            </label>
            <Button variant="primary" block onClick={() => done({ kind: 'ready', trigger })}>
              Ready
            </Button>
          </>
        ))}

      {means === 'endConcentration' && (
        <Button variant="danger" block onClick={() => done({ kind: 'endConcentration' })}>
          End concentration{state.concentration?.name ? ` on ${state.concentration.name}` : ''}
        </Button>
      )}

      {means === 'mark' && (
        <Button variant="primary" block onClick={() => done({ kind: 'mark' })}>
          Take the {item.name} action
        </Button>
      )}

      {rule?.entries?.length > 0 && (
        <>
          <button type="button" className={styles.rulesHead} onClick={() => setRulesOpen((v) => !v)} aria-expanded={rulesOpen}>
            {rulesOpen ? 'Hide the rules' : 'Rules'}
          </button>
          <Collapse open={rulesOpen}>
            <div className={styles.rules}>
              <EntryContent entries={rule.entries} />
            </div>
          </Collapse>
        </>
      )}
    </div>
  );
}
