// =============================================================================
// CastPanel: o diálogo antes de lançar uma magia no play mode
// =============================================================================
// O QUE FAZ
//   Lista as formas de lançar a magia agora (engine/playCast): cada slot de círculo
//   igual ou maior, o pacto, o uso grátis de uma magia concedida, o ritual, o "à
//   vontade". Cada forma mostra o que sobra; a primeira com algo sobrando vem
//   marcada. Fecha com { way, onSelf, summon } (`summon.light` na instância leve), ou null. Quem o abre é o playDialogs.jsx.
//   A magia que invoca (`creatures`, os blocos do bestiário) ganha o bloco "Summon
//   now" (ligado por padrão, U4 do plano de summons, DDL-0192): a criatura, a forma
//   quando o bloco tem variantes (Air, Land, Water) e quantas. A magia sem bloco que
//   fica em campo (`light`, Spiritual Weapon, Mage Hand; S4, DDL-0194) ganha "Track
//   it in Summons", também ligado por padrão.
//   `onSelf` existe para a magia com efeito curado que pode ou não incluir quem
//   lança (Bless, Shield of Faith): a caixa "It includes me" liga o efeito.
//
// FUNÇÕES
//   CastPanel(props): o conteúdo do diálogo.
//     submit(e): fecha com a forma escolhida.
//
// DECISÕES E ARMADILHAS
//   - Uma forma sem nada sobrando continua escolhível (liberdade com aviso, §6.4);
//     a tela pergunta antes de gravar.
//   - Lançar uma magia de concentração com outra ativa avisa aqui que a anterior
//     termina.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { castWays } from '../../engine/playCast';
import { spellModifier } from '../../engine/playEffects';
import { useDialogClose } from '../common/dialogContext';
import styles from './PlayPanels.module.css';
import Button from '../common/Button';
import Toggle from '../common/Toggle';
import SegmentedControl from '../common/SegmentedControl';
import AmountStepper from './AmountStepper';
import { creatureStats } from '../../engine/creature';

/**
 * O conteúdo do diálogo de lançar.
 * @param {{ catalog: object, state: object, origin: object, spell: object, creatures?: object[] }} props
 */
export default function CastPanel({ catalog, state, origin, spell, creatures = [], light = false }) {
  const close = useDialogClose();
  const ways = castWays(catalog, state, spell);
  const first = ways.find((w) => w.left == null || w.left > 0) ?? ways[0];
  const [pick, setPick] = useState(first?.id ?? null);
  const effect = spellModifier(spell);
  const [onSelf, setOnSelf] = useState(false);
  const [summonOn, setSummonOn] = useState(creatures.length > 0 || light);
  const [creatureIdx, setCreatureIdx] = useState(0);
  const creature = creatures[creatureIdx] ?? null;
  const variants = creature ? creatureStats(creature, { spellLevel: spell.level }).variants : [];
  const [variant, setVariant] = useState(null);
  const chosenVariant = variants.includes(variant) ? variant : variants[0] ?? null;
  const [count, setCount] = useState('1');
  const btnRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => btnRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  /** Fecha com a forma escolhida. */
  const submit = (e) => {
    e.preventDefault();
    const way = ways.find((w) => w.id === pick);
    const summon = summonOn && creature ? { creature, variant: chosenVariant, count: Math.max(1, Number(count) || 1) } : summonOn && light ? { light: true } : null;
    if (way) close({ way, onSelf, summon });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <p className={styles.note}>
        {origin.label}
        {origin.saveDc != null ? ` · DC ${origin.saveDc}` : ''}
        {origin.attackBonus != null ? ` · attack ${origin.attackBonus >= 0 ? '+' : ''}${origin.attackBonus}` : ''}
      </p>
      {spell.concentration && state.concentration && (
        <p className={styles.warn}>Casting it ends your concentration on {state.concentration.name}.</p>
      )}
      <div className={styles.options} role="radiogroup" aria-label="How to cast">
        {ways.map((w) => (
          <label key={w.id} className={pick === w.id ? `${styles.option} ${styles.optionOn}` : styles.option}>
            <input type="radio" name="way" checked={pick === w.id} onChange={() => setPick(w.id)} />
            <span className={styles.optionText}>{w.label}</span>
            {w.left != null && <span className={w.left > 0 ? styles.left : `${styles.left} ${styles.short}`}>{w.left} left</span>}
          </label>
        ))}
      </div>
      {effect && !effect.self && (
        <Toggle checked={onSelf} onChange={setOnSelf} label={`It includes me (${effect.modifier.label} applies to my rolls)`} />
      )}
      {creatures.length > 0 && (
        <div className={styles.summon}>
          <Toggle checked={summonOn} onChange={setSummonOn} label="Summon now" hint="The creature appears in the Summons tab" />
          {summonOn && creatures.length > 1 && creatures.length <= 4 && (
            <SegmentedControl block ariaLabel="Creature" value={creatureIdx} onChange={setCreatureIdx} options={creatures.map((c, i) => [i, c.name])} />
          )}
          {summonOn && creatures.length > 4 && (
            <select className={styles.input} aria-label="Creature" value={creatureIdx} onChange={(e) => setCreatureIdx(Number(e.target.value))}>
              {creatures.map((c, i) => <option key={`${c.name}|${c.source}`} value={i}>{c.name}</option>)}
            </select>
          )}
          {summonOn && variants.length > 0 && (
            <SegmentedControl block size="sm" ariaLabel="Form" value={chosenVariant} onChange={setVariant} options={variants.map((v) => [v, v])} />
          )}
          {summonOn && <span className={styles.label}>How many</span>}
          {summonOn && <AmountStepper value={count} onChange={setCount} min={1} label="How many" autoFocus={false} />}
        </div>
      )}
      {light && (
        <div className={styles.summon}>
          <Toggle checked={summonOn} onChange={setSummonOn} label="Track it in Summons" hint="A card to move it, repeat it and see when it ends" />
        </div>
      )}
      <div className={styles.actions}>
        <Button onClick={() => close(null)}>Cancel</Button>
        <Button ref={btnRef} type="submit" variant="primary" disabled={!pick}>Cast</Button>
      </div>
    </form>
  );
}
