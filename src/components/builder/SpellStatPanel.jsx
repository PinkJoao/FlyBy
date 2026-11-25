// =============================================================================
// SpellStatPanel: o que um número do grimório é, para quem está começando
// =============================================================================
// O QUE FAZ
//   O corpo das janelas abertas pela faixa do grimório e pela do jogo (DDL-0321): o
//   número grande com uma frase narrativa, a regra em duas linhas com o número do
//   personagem, de que ele é feito e o link para a regra inteira.
//
// FUNÇÕES
//   SpellStatPanel(props): um número ou contador (`stat`, de engine/spellStats).
//   SlotsPanel(props): os espaços por círculo, o pacto, o arcanum e o que não gasta.
//
// DECISÕES E ARMADILHAS
//   - Os textos curtos são nossos (ajuda da interface, como o tutorial); a REGRA é
//     sempre a do dado, aberta pelo link (a regra do glossário, ou a feature de
//     conjuração da classe).
//   - Sem exemplo de mesa: o dono achou que a explicação e a regra bastam (DDL-0321).
// -----------------------------------------------------------------------------

import Button from '../common/Button';
import Pips from '../common/Pips';
import Tag from '../common/Tag';
import { formatBonus } from '../../engine/math';
import { slotSummary, spellTimes } from '../../engine/spellStats';
import { spellLevelLabel } from '../../engine/spells';
import { ABILITY_FULL } from './labels';
import PartsRow from './PartsRow';
import styles from './StripWindows.module.css';

const TEXT = {
  dc: {
    flavor: 'How hard it is to shrug off your magic.',
    rule: (v) => `When your spell forces a saving throw, the target rolls a d20 and adds its own bonus. It needs ${v} or more to resist.`,
    result: 'Save DC',
  },
  atk: {
    flavor: 'How well you aim your magic.',
    rule: (v) => `Some spells have to hit, like an arrow. Roll a d20 and add ${v}: you hit when you reach the Armor Class of the target.`,
    result: 'Attack',
  },
  cantrips: {
    flavor: 'The magic you know by heart.',
    rule: () => 'Cast them as often as you like: they never use a spell slot, and the ones that deal damage grow with your level.',
    result: 'Cantrips',
  },
  prepared: {
    flavor: 'The spells on your mind today.',
    rule: () => 'You can only cast spells of level 1 and up that are prepared. Preparing is free; casting is what uses a slot. Spells that are always prepared do not count here.',
    result: 'Prepared',
  },
  known: {
    flavor: 'Every spell written in your book.',
    rule: () => 'You prepare from what is written here. The number is a minimum: scrolls and other books can add more.',
    result: 'Written',
  },
  arcana: {
    flavor: 'Secrets your patron trusts you with.',
    rule: () => 'One spell of each of these levels, cast once without a slot. Each comes back on a Long Rest.',
    result: 'Arcanum',
  },
};

const PART_LABEL = { base: 'Base', prof: 'Proficiency' };

/** Um número ou contador do grimório, explicado. */
export default function SpellStatPanel({ stat, classLevel, className, onRule }) {
  const text = TEXT[stat.key];
  const isLimit = stat.max != null;
  const value = isLimit ? `${stat.have}/${stat.max}` : stat.key === 'atk' ? formatBonus(stat.value) : String(stat.value);
  const parts = isLimit
    ? classLevel
      ? [{ key: 'level', value: classLevel, label: `${className} level` }]
      : []
    : stat.parts.map((p) => ({
        key: p.key,
        value: p.key === 'base' ? p.value : formatBonus(p.value),
        label: p.key === 'items' ? (p.sources?.length ? 'Items' : 'Other') : PART_LABEL[p.key] ?? ABILITY_FULL[p.key] ?? p.key,
        title: p.sources?.join(', ') || undefined,
      }));
  return (
    <div className={styles.body}>
      <div className={styles.hero}>
        <span className={styles.heroValue}>{value}</span>
        <p className={styles.flavor}>{text.flavor}</p>
      </div>
      <p className={styles.note}>{text.rule(stat.value)}</p>
      {parts.length > 0 && <PartsRow parts={parts} result={{ value: isLimit ? stat.max : value, label: text.result }} />}
      {onRule && <p className={styles.note}><Button variant="link" onClick={onRule}>Read the rule</Button></p>}
    </div>
  );
}

/** Os espaços de magia de uma origem. */
export function SlotsPanel({ origin, onRule }) {
  const { levels, total, pact, arcana } = slotSummary(origin);
  const times = spellTimes(origin);
  return (
    <div className={styles.body}>
      <div className={styles.hero}>
        <span className={styles.heroValue}>{pact ? pact.count : total}</span>
        <p className={styles.flavor}>The fuel of your magic.</p>
      </div>
      <p className={styles.note}>
        {pact
          ? `A spell of level 1 or higher burns one slot, and every slot of your pact is of level ${pact.level}: the spell is cast at that level. They all come back on a Short or Long Rest.`
          : 'A spell of level 1 or higher burns one slot of its level or above; a higher slot often makes it stronger. They all come back on a Long Rest.'}
      </p>
      <ul className={styles.rows}>
        {levels.map((l) => (
          <li key={l.level} className={styles.row}>
            <span className={styles.rowText}><span className={styles.rowName}>{spellLevelLabel(l.level)}</span></span>
            <Pips left={l.count} max={l.count} shape="gem" label={l.count === 1 ? '1 slot' : `${l.count} slots`} />
          </li>
        ))}
        {pact && (
          <li className={styles.row}>
            <span className={styles.rowText}><span className={styles.rowName}>Pact, {spellLevelLabel(pact.level)}</span></span>
            <Pips left={pact.count} max={pact.count} shape="gem" label={`${pact.count} pact slots`} />
          </li>
        )}
      </ul>
      {(arcana.length > 0 || times.length > 0) && (
        <section className={styles.panel}>
          <h3 className={styles.panelHead}>Without a slot</h3>
          <ul className={styles.rows}>
            {arcana.map((a) => (
              <li key={`arc-${a.level}`} className={styles.item}>
                <span className={styles.rowText}>
                  <span className={styles.rowName}>{a.spell?.raw?.name ?? 'No spell chosen yet'}</span>
                  <span className={styles.rowNote}>Mystic Arcanum, {spellLevelLabel(a.level)}</span>
                </span>
                <Tag>1/Long Rest</Tag>
              </li>
            ))}
            {times.map((u) => (
              <li key={u.name} className={styles.item}>
                <span className={styles.rowText}>
                  <span className={styles.rowName}>{u.name}</span>
                  {u.note && <span className={styles.rowNote}>{u.note}</span>}
                </span>
                <Tag>{u.label}</Tag>
              </li>
            ))}
          </ul>
        </section>
      )}
      {onRule && <p className={styles.note}><Button variant="link" onClick={onRule}>Read the rule</Button></p>}
    </div>
  );
}
