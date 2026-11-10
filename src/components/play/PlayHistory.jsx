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
//   DieShape(props): um dado na silhueta colorida da forma dele, com o valor;
//     DIE_SHAPES guarda o contorno, a face e a faceta de cada tipo.
//   DiceList(props): os dados de um grupo.
//   RollCard(props): o cartão de um evento.
//   PlayHistory(props): a lista, com os separadores de dia.
//
// DECISÕES E ARMADILHAS
//   - Cada dado aparece na SILHUETA da forma dele (DieShape, DDL-0158): com 2d4 e
//     2d8 na mesma parte, dá para ver qual é qual. Desde o DDL-0160, no estilo do
//     rolador do Google que o dono mandou: cada tipo com a cor dele (tokens
//     --die-d4 a --die-d20, mais sóbrios no tema papel), a face da frente mais clara e
//     a faceta de baixo mais escura. O d100 usa o d10; um dado sem forma, o círculo. O que o piso mudou (Reliable Talent) leva o
//     contorno tracejado e o valor que conta; o título diz o que caiu.
//   - O cartão de uma feature que rolou só o ataque (`payload.only`, DDL-0156) tem o
//     "Roll damage" (ou "Roll healing"), que rola sem gastar de novo.
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
import Button from '../common/Button';

const KIND_LABEL = {
  check: 'Check',
  attack: 'Attack',
  damageRoll: 'Damage',
  damage: 'Hurt',
  heal: 'Healing',
  tempHp: 'Temp HP',
  maxHp: 'Max HP',
  hitDice: 'Hit dice',
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
      if (p.maxCut) lines.push(`Hit point maximum -${p.maxCut} (now ${p.maxTo})`);
      for (const n of p.notes ?? []) lines.push(n);
      break;
    case 'heal':
      total = p.healed;
      lines.push(`${p.from} to ${p.to} hit points`);
      break;
    case 'maxHp':
      total = p.amount;
      lines.push(`Maximum ${p.from} to ${p.to}`);
      break;
    case 'hitDice':
      total = p.restored != null ? p.restored : p.healed;
      lines.push(Object.entries(p.dice ?? {}).map(([f, k]) => `${k}d${f}`).join(' + ') || 'No hit dice');
      if (p.restored != null) lines.push('Recovered');
      else if (p.spent) lines.push(`${p.from} to ${p.to} hit points`);
      if (p.asked > (p.spent ?? 0)) lines.push(`Only ${p.spent} left to spend`);
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
      if (p.after?.length) lines.push(`Your summons act: ${p.after.join(', ')}`);
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
/**
 * A silhueta de cada dado, no estilo do rolador do Google (DDL-0160): o contorno, a
 * face da frente (mais clara) e a faceta de baixo (mais escura).
 */
const DIE_SHAPES = {
  4: {
    base: '16,1.5 31,29.5 1,29.5',
    face: null,
    shade: null,
    y: 21.5
  },
  6: {
    base: '3,3 29,3 29,29 3,29',
    face: null,
    shade: null,
    y: 16.5
  },
  8: {
    base: '16,1 30,9 30,23 16,31 2,23 2,9',
    face: '16,1 30,23 2,23',
    shade: '2,23 30,23 16,31',
    y: 17
  },
  10: {
    base: '16,1 30,12 30,19 16,31 2,19 2,12',
    face: '16,1 26,16 16,25 6,16',
    shade: '2,19 6,16 16,25 26,16 30,19 16,31',
    y: 16
  },
  12: {
    base: '16.0,1.0 24.8,3.9 30.3,11.4 30.3,20.6 24.8,28.1 16.0,31.0 7.2,28.1 1.7,20.6 1.7,11.4 7.2,3.9',
    face: '16.0,7.5 24.1,13.4 21.0,22.9 11.0,22.9 7.9,13.4',
    shade: null,
    y: 16.5
  },
  20: {
    base: '16,1 29.5,8.5 29.5,23.5 16,31 2.5,23.5 2.5,8.5',
    face: '16,6 26,23 6,23',
    shade: '2.5,23.5 6,23 26,23 29.5,23.5 16,31',
    y: 17.5
  }
};

/** Um dado na silhueta colorida da forma dele (d4 triângulo verde, d20 hexágono laranja...), com o valor dentro. */
function DieShape({ faces, value, className, title }) {
  const shape = DIE_SHAPES[faces === 100 ? 10 : faces];
  const text = String(value);
  const kind = shape ? `d${faces === 100 ? 10 : faces}` : 'other';
  return (
    <svg className={`${className} ${styles[kind]}`} viewBox="0 0 32 32" role="img" aria-label={`d${faces}: ${text}`}>
      {title && <title>{title}</title>}
      {shape ? <polygon className={styles.base} points={shape.base} /> : <circle className={styles.base} cx="16" cy="16" r="14.5" />}
      {shape?.face && <polygon className={styles.face} points={shape.face} />}
      {shape?.shade && <polygon className={styles.shade} points={shape.shade} />}
      <text x="16" y={shape?.y ?? 16.5} fontSize={text.length > 2 ? 9 : text.length > 1 ? 11 : 13}>{text}</text>
    </svg>
  );
}

/** Os dados de um grupo, cada um na silhueta do dado. */
function DiceList({ group }) {
  return (
    <span className={styles.dice}>
      {group.results.map((r, i) => (
        <DieShape
          key={i}
          faces={group.faces}
          value={r.value}
          className={[styles.die, !r.kept && styles.dropped, r.raw != null && styles.adjusted, group.faces === 20 && r.kept && (r.raw ?? r.value) === 20 && styles.nat20, group.faces === 20 && r.kept && (r.raw ?? r.value) === 1 && styles.nat1].filter(Boolean).join(' ')}
          title={r.raw != null ? `Rolled ${r.raw}, counts as ${r.value}` : `d${group.faces}`}
        />
      ))}
    </span>
  );
}

/** O cartão de um evento. */
function RollCard({ event, undone, onDamage, onConcentration, concentrating, onSpell, onFeatureEffect }) {
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
        <Button size="sm" variant="primary" className={styles.action} onClick={() => onDamage(event.payload?.attackKey, { critical: !!critical })}>
          Roll damage{critical ? ' (critical)' : ''}
        </Button>
      )}
      {event.kind === 'use' && event.payload?.only === 'attack' && !undone && onFeatureEffect && (
        <Button size="sm" variant="primary" className={styles.action} onClick={() => onFeatureEffect(event)}>
          {(event.payload?.types ?? []).length ? 'Roll damage' : 'Roll healing'}{event.payload?.attack?.critical ? ' (critical)' : ''}
        </Button>
      )}
      {event.kind === 'cast' && !undone && onSpell && (
        <span className={styles.actionRow}>
          {event.payload?.attack != null && (
            <Button size="sm" variant="primary" className={styles.action} onClick={() => onSpell(event.payload.spellKey, event.payload.level, 'attack')}>Attack</Button>
          )}
          {event.payload?.damage && (
            <Button size="sm" variant="primary" className={styles.action} onClick={() => onSpell(event.payload.spellKey, event.payload.level, 'damage')}>Damage</Button>
          )}
          {event.payload?.heal && (
            <Button size="sm" variant="primary" className={styles.action} onClick={() => onSpell(event.payload.spellKey, event.payload.level, 'heal')}>Healing</Button>
          )}
        </span>
      )}
      {dc && !undone && concentrating && onConcentration && (
        <Button size="sm" variant="primary" className={styles.action} onClick={() => onConcentration(dc)}>
          Concentration save (DC {dc})
        </Button>
      )}
    </li>
  );
}

/**
 * O histórico: do mais novo para o mais velho, separado por dia.
 * @param {{ doc: object|null, onDamage?: Function, onConcentration?: Function, concentrating?: boolean, onSpell?: Function, onFeatureEffect?: Function }} props
 */
export default function PlayHistory({ doc, onDamage, onConcentration, concentrating = false, onSpell, onFeatureEffect }) {
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
        onFeatureEffect={onFeatureEffect}
      />,
    );
  }
  return <ul className={styles.list}>{items}</ul>;
}
