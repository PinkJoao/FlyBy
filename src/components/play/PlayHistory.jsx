// =============================================================================
// PlayHistory: o histórico de ações do play mode, como o chat do Foundry
// =============================================================================
// O QUE FAZ
//   Desenha o log de eventos do documento de jogo (engine/playState) do mais novo
//   para o mais velho, separado por dia. O cartão de uma ROLAGEM mostra o total,
//   cada dado (o descartado riscado, o mudado por piso com o valor sorteado), o
//   modo e o crítico. O de um evento de VIDA (dano, cura, temporário, morte,
//   concentração, descanso) mostra o número que importa e o resumo que o evento
//   gravou. Item, dinheiro e combate (C6) mostram o que saiu ou entrou e a rodada.
//   Os eventos DESFEITOS (depois do cursor) ficam esmaecidos, marcados,
//   até o refazer ou uma ação nova os descartar.
//
// FUNÇÕES
//   dayLabel(iso), timeLabel(iso): a data e a hora do evento.
//   detailOf(event): o número, as marcas e as linhas de um evento.
//   DiceList(props): os dados de um grupo.
//   RollCard(props): o cartão de um evento.
//   PlayHistory(props): a lista, com os separadores de dia.
//
// DECISÕES E ARMADILHAS
//   - O cartão do ATAQUE tem o botão "Roll damage" (como o do chat do Foundry),
//     com o crítico pré-marcado quando o acerto foi crítico; o do DANO SOFRIDO,
//     o "Concentration save" com a CD, enquanto houver concentração; o da MAGIA
//     lançada, o ataque, o dano e a cura no círculo em que ela saiu. Num evento
//     desfeito os botões somem.
//   - "Critical" só no ATAQUE e no dano dele (CRIT_KINDS): no XPHB só o ataque
//     tem crítico; o 20 natural de um teste ou save sai como "Natural 20".
//   - Dados e partes usam o ÍNDICE como key: dois dados podem ter o mesmo valor e
//     duas partes o mesmo rótulo, e a lista de um evento gravado nunca muda.
//   - O cartão só LÊ o evento: nenhuma conta é refeita aqui. O que aparece é o que
//     foi gravado, então o refazer mostra o mesmo cartão (DDL-0108).
// -----------------------------------------------------------------------------

import { ABILITY_FULL } from '../builder/labels';
import styles from './PlayHistory.module.css';

const KIND_LABEL = {
  check: 'Check',
  attack: 'Attack',
  damageRoll: 'Damage',
  damage: 'Hurt',
  heal: 'Healing',
  tempHp: 'Temp HP',
  deathSave: 'Death save',
  concentration: 'Concentration',
  concentrationCheck: 'Concentration',
  shortRest: 'Rest',
  longRest: 'Rest',
  use: 'Feature',
  cast: 'Spell',
  healRoll: 'Healing',
  resource: 'Resource',
  condition: 'Condition',
  modifier: 'Effect',
  item: 'Item',
  currency: 'Money',
  combat: 'Combat',
};

const CRIT_KINDS = new Set(['attack', 'damageRoll', 'use']);

const TRAIT_WORD = { immune: 'immune', resist: 'resisted', vulnerable: 'vulnerable', 'resist+vulnerable': 'resisted, vulnerable' };

/** A data do evento, por extenso curto ("Fri, Oct 24"). */
const dayLabel = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

/** A hora do evento ("20:41"). */
const timeLabel = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/** O número principal, as marcas e as linhas de resumo de um evento. */
function detailOf(event) {
  const p = event.payload ?? {};
  const rolls = event.rolls ?? {};
  const tags = [];
  const lines = [];
  let total = rolls.total ?? null;
  switch (event.kind) {
    case 'damage':
      total = p.taken;
      if (p.type) tags.push({ text: p.type });
      if (p.trait) tags.push({ text: TRAIT_WORD[p.trait] ?? p.trait });
      if (p.critical) tags.push({ text: 'Critical', tone: 'crit' });
      if (p.toTemp) lines.push(`${p.toTemp} from temporary hit points`);
      for (const n of p.notes ?? []) lines.push(n);
      break;
    case 'heal':
      total = p.healed;
      lines.push(`${p.from} to ${p.to} hit points`);
      break;
    case 'tempHp':
      total = p.to;
      if (p.kept) lines.push(`Kept the ${p.from} you had (more than ${p.amount})`);
      break;
    case 'deathSave':
      if (p.result) tags.push({ text: p.result, tone: /Dies|failure|Failure/.test(p.result) ? 'fumble' : 'crit' });
      break;
    case 'concentrationCheck':
      tags.push({ text: `DC ${p.dc}` });
      tags.push(p.kept ? { text: 'Kept', tone: 'crit' } : { text: 'Lost', tone: 'fumble' });
      break;
    case 'shortRest':
    case 'longRest':
      total = event.kind === 'shortRest' && rolls.total ? rolls.total : null;
      for (const l of p.lines ?? []) lines.push(`${l.name}: ${l.detail}`);
      if (!(p.lines ?? []).length) lines.push('Nothing to recover');
      break;
    case 'check':
    case 'attack':
    case 'damageRoll':
      for (const t of p.effects ?? []) tags.push({ text: t });
      if (p.autoFail) tags.push({ text: 'Automatic failure', tone: 'fumble' });
      if (p.ammo) lines.push(`${p.ammo}: ${p.ammoLeft} left`);
      if (p.ammoMissing) tags.push({ text: 'No ammunition', tone: 'fumble' });
      break;
    case 'item':
      if (p.used) lines.push(p.left ? `${p.left} left` : 'That was the last one');
      else if (p.delta) lines.push(`${p.delta > 0 ? '+' : ''}${p.delta}, ${p.left} now`);
      if (p.healed) lines.push(`${p.healed.from} to ${p.healed.to} hit points`);
      else if (rolls.total != null && p.used) lines.push('Healing for someone else');
      break;
    case 'currency':
      lines.push(Object.entries(p.delta ?? {}).map(([c, v]) => `${v > 0 ? '+' : ''}${v} ${c}`).join(', ') || 'Nothing');
      break;
    case 'combat':
      total = rolls.total ?? p.round ?? null;
      if (p.started) lines.push('Initiative');
      if (p.moved != null || p.dash) lines.push(`${p.left} ft left this turn`);
      if (p.rounds) lines.push(`${p.rounds} round${p.rounds === 1 ? '' : 's'}`);
      for (const n of p.ended ?? []) lines.push(`${n} ended`);
      for (const t of p.effects ?? []) tags.push({ text: t });
      break;
    case 'use':
      total = p.attack ? p.attack.total : rolls.total ?? null;
      if (p.attack?.critical) tags.push({ text: 'Critical', tone: 'crit' });
      if (p.save?.dc) tags.push({ text: `DC ${p.save.dc} ${(p.save.abilities ?? []).join('/')}` });
      if ((p.types ?? []).length) tags.push({ text: [...new Set(p.types)].join(' / ') });
      if (p.attack && rolls.damage != null) lines.push(`${rolls.damage} damage`);
      for (const c of p.costs ?? []) lines.push(c.amount >= 0 ? `${c.name}: ${c.amount} spent` : `${c.name}: ${-c.amount} regained`);
      for (const l of p.lines ?? []) lines.push(l);
      if (p.healed) lines.push(`${p.healed.from} to ${p.healed.to} hit points`);
      if ((p.short ?? []).length) lines.push(`Not enough: ${p.short.join(', ')}`);
      if (p.over) lines.push('Over the recovery limit');
      if (p.noSpentSlot) lines.push('No spent slot to refill');
      if (p.effect) tags.push({ text: `${p.effect} on`, tone: 'crit' });
      break;
    case 'cast':
      tags.push({ text: p.way });
      if (p.concentration) tags.push({ text: 'Concentration' });
      if (p.save?.dc) tags.push({ text: `DC ${p.save.dc} ${ABILITY_FULL[p.save.ability] ?? p.save.ability} save` });
      if (p.ended) lines.push(`Concentration on ${p.ended} ended`);
      if (p.short) lines.push('Nothing was left to spend');
      if (p.effect) tags.push({ text: `${p.effect} on`, tone: 'crit' });
      break;
    case 'healRoll':
      if (p.healed) lines.push(`${p.healed.from} to ${p.healed.to} hit points`);
      break;
    case 'resource':
      total = Math.abs(p.delta);
      lines.push(p.delta >= 0 ? 'Spent by hand' : 'Regained by hand');
      break;
    default:
      break;
  }
  return { total, tags, lines };
}

/** Os dados de um grupo: o mantido em destaque, o descartado riscado. */
function DiceList({ group }) {
  return (
    <span className={styles.dice}>
      {group.results.map((r, i) => (
        <span
          key={i}
          className={[styles.die, !r.kept && styles.dropped, group.faces === 20 && r.kept && (r.raw ?? r.value) === 20 && styles.nat20, group.faces === 20 && r.kept && (r.raw ?? r.value) === 1 && styles.nat1].filter(Boolean).join(' ')}
          title={r.raw != null ? `Rolled ${r.raw}, counts as ${r.value}` : undefined}
        >
          {r.raw != null ? `${r.raw}>${r.value}` : r.value}
        </span>
      ))}
    </span>
  );
}

/** O cartão de um evento. */
function RollCard({ event, undone, onDamage, onConcentration, concentrating, onSpell }) {
  const rolls = event.rolls ?? {};
  const critical = event.kind === 'damageRoll' ? event.payload?.critical : rolls.isCritical;
  const save = event.kind === 'damageRoll' ? event.payload?.save : null;
  const detail = detailOf(event);
  const dc = event.kind === 'damage' ? event.payload?.concentrationDc : null;
  return (
    <li className={undone ? `${styles.card} ${styles.undone}` : styles.card}>
      <div className={styles.head}>
        <span className={styles.kind}>{KIND_LABEL[event.kind] ?? event.kind}</span>
        <span className={styles.title}>{event.label}</span>
        <span className={styles.time}>{undone ? 'Undone' : timeLabel(event.at)}</span>
      </div>
      <div className={styles.body}>
        {detail.total != null && <span className={styles.total}>{detail.total}</span>}
        <span className={styles.tags}>
          {rolls.mode && rolls.mode !== 'normal' && (
            <span className={styles.tag}>{rolls.mode === 'advantage' ? 'Advantage' : 'Disadvantage'}</span>
          )}
          {critical && <span className={`${styles.tag} ${styles.crit}`}>{CRIT_KINDS.has(event.kind) ? 'Critical' : 'Natural 20'}</span>}
          {rolls.isFumble && <span className={`${styles.tag} ${styles.fumble}`}>Natural 1</span>}
          {event.kind === 'damageRoll' && (event.payload?.types ?? []).length > 0 && (
            <span className={styles.tag}>{event.payload.types.join(' / ')}</span>
          )}
          {save && <span className={styles.tag}>DC {save.dc} {ABILITY_FULL[save.ability] ?? save.ability} save</span>}
          {detail.tags.map((t) => (
            <span key={t.text} className={t.tone ? `${styles.tag} ${styles[t.tone]}` : styles.tag}>{t.text}</span>
          ))}
        </span>
      </div>
      {detail.lines.length > 0 && (
        <ul className={styles.lines}>
          {detail.lines.map((l) => <li key={l}>{l}</li>)}
        </ul>
      )}
      {(rolls.parts ?? []).length > 0 && (
        <ul className={styles.parts}>
          {rolls.parts.map((p, i) => (
            <li key={i} className={styles.part}>
              <span className={styles.partLabel}>{p.label}</span>
              <span className={styles.partFormula}>{p.formula}</span>
              {p.groups.map((g, j) => <DiceList key={j} group={g} />)}
              <span className={styles.partTotal}>{p.total}</span>
            </li>
          ))}
        </ul>
      )}
      {event.kind === 'attack' && !undone && onDamage && (
        <button type="button" className={styles.action} onClick={() => onDamage(event.payload?.attackKey, { critical: !!critical })}>
          Roll damage{critical ? ' (critical)' : ''}
        </button>
      )}
      {event.kind === 'cast' && !undone && onSpell && (
        <span className={styles.actionRow}>
          {event.payload?.attack != null && (
            <button type="button" className={styles.action} onClick={() => onSpell(event.payload.spellKey, event.payload.level, 'attack')}>Attack</button>
          )}
          {event.payload?.damage && (
            <button type="button" className={styles.action} onClick={() => onSpell(event.payload.spellKey, event.payload.level, 'damage')}>Damage</button>
          )}
          {event.payload?.heal && (
            <button type="button" className={styles.action} onClick={() => onSpell(event.payload.spellKey, event.payload.level, 'heal')}>Healing</button>
          )}
        </span>
      )}
      {dc && !undone && concentrating && onConcentration && (
        <button type="button" className={styles.action} onClick={() => onConcentration(dc)}>
          Concentration save (DC {dc})
        </button>
      )}
    </li>
  );
}

/**
 * O histórico: do mais novo para o mais velho, separado por dia.
 * @param {{ doc: object|null, onDamage?: Function, onConcentration?: Function, concentrating?: boolean, onSpell?: Function }} props
 */
export default function PlayHistory({ doc, onDamage, onConcentration, concentrating = false, onSpell }) {
  const events = doc?.events ?? [];
  if (!events.length) {
    return <p className={styles.empty}>Nothing rolled yet. Your rolls and actions show up here, and you can undo them.</p>;
  }
  const items = [];
  let lastDay = null;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    const day = dayLabel(e.at);
    if (day !== lastDay) {
      items.push(<li key={`day-${day}`} className={styles.day}>{day}</li>);
      lastDay = day;
    }
    items.push(
      <RollCard
        key={e.id}
        event={e}
        undone={i >= doc.cursor}
        onDamage={onDamage}
        onConcentration={onConcentration}
        concentrating={concentrating}
        onSpell={onSpell}
      />,
    );
  }
  return <ul className={styles.list}>{items}</ul>;
}
