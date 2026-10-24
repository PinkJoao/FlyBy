// =============================================================================
// CastPanel: o diálogo antes de lançar uma magia no play mode
// =============================================================================
// O QUE FAZ
//   Lista as formas de lançar a magia agora (engine/playCast): cada slot de círculo
//   igual ou maior, o pacto, o uso grátis de uma magia concedida, o ritual, o "à
//   vontade". Cada forma mostra o que sobra; a primeira com algo sobrando vem
//   marcada. Fecha com { way, onSelf }, ou null. Quem o abre é o playDialogs.jsx.
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

/**
 * O conteúdo do diálogo de lançar.
 * @param {{ catalog: object, state: object, origin: object, spell: object }} props
 */
export default function CastPanel({ catalog, state, origin, spell }) {
  const close = useDialogClose();
  const ways = castWays(catalog, state, spell);
  const first = ways.find((w) => w.left == null || w.left > 0) ?? ways[0];
  const [pick, setPick] = useState(first?.id ?? null);
  const effect = spellModifier(spell);
  const [onSelf, setOnSelf] = useState(false);
  const btnRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => btnRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  /** Fecha com a forma escolhida. */
  const submit = (e) => {
    e.preventDefault();
    const way = ways.find((w) => w.id === pick);
    if (way) close({ way, onSelf });
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
        <label className={styles.check}>
          <input type="checkbox" checked={onSelf} onChange={(e) => setOnSelf(e.target.checked)} />
          <span>It includes me ({effect.modifier.label} applies to my rolls)</span>
        </label>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.btn} onClick={() => close(null)}>Cancel</button>
        <button ref={btnRef} type="submit" className={`${styles.btn} ${styles.primary}`} disabled={!pick}>Cast</button>
      </div>
    </form>
  );
}
