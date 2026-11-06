// =============================================================================
// D20Overlay: o d20 em destaque no centro da tela, depois de uma rolagem
// =============================================================================
// O QUE FAZ
//   A fase D1 dos dados (docs/PLAY-MODE-V2-PLAN.md §2, DDL-0152): sobre a tela do
//   jogo, um d20 grande (ou dois, com vantagem e desvantagem) tomba e para na face
//   que o engine já sorteou. No 20 natural (ou no crítico do limiar) o dado fica
//   dourado, brilha e solta faíscas; no 1 natural fica vermelho, treme e racha. O
//   descartado esmaece. Depois mostra o rótulo, o total e o selo, e fecha sozinho.
//   Tocar pula a rolagem; tocar de novo fecha. O voltar do celular fecha.
//
// FUNÇÕES
//   Sparks(): as faíscas do crítico.
//   D20Overlay(props): a camada.
//
// DECISÕES E ARMADILHAS
//   - Só encena: o evento já foi gravado antes de a camada abrir, e o número vem
//     dele (rollShow). Fechar antes do fim não muda nada no histórico.
//   - As cores saem dos tokens (--accent, --warning, --danger) lidos na montagem, então
//     o dado segue o tema escuro, claro e papel (DDL-0097).
//   - Os dois dados têm durações um pouco diferentes, para não pararem juntos como um
//     só; o total aparece quando o último para.
//   - A rolagem roda uma vez por `show`: o fechar entra por useEffectEvent, então a
//     tela do jogo re-renderizar (o evento acabou de ser gravado) não a recomeça.
// -----------------------------------------------------------------------------

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useBackLayer } from '../hooks/useBack';
import { createD20 } from './d20Canvas';
import { tokenColors } from './colors';
import styles from './D20Overlay.module.css';

const SPIN_MS = 1300;
const HOLD_MS = 1100;
const HOLD_SPECIAL_MS = 1700;

/** As faíscas do crítico, em volta do dado. */
function Sparks() {
  return (
    <span className={styles.sparks} aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} className={styles.spark} style={{ '--a': `${(360 / 14) * i}deg`, '--d': `${(i % 3) * 60}ms` }} />
      ))}
    </span>
  );
}

/**
 * A camada do d20. `show` vem de d20Show; `onDone` fecha.
 * @param {{ show: object, onDone: Function }} props
 */
export default function D20Overlay({ show, onDone }) {
  const refs = useRef([]);
  const dice = useRef([]);
  const [landed, setLanded] = useState(false);
  useBackLayer(true, onDone);
  const done = useEffectEvent(() => onDone());

  useEffect(() => {
    const colors = tokenColors();
    const made = show.dice.map((_, i) => createD20(refs.current[i], colors));
    dice.current = made;
    let closed = false;
    let timer = 0;
    Promise.all(show.dice.map((d, i) => made[i].spinTo(d.value, SPIN_MS + i * 180))).then(() => {
      if (closed) return;
      show.dice.forEach((d, i) => {
        if (!d.kept) return;
        if (show.crit) made[i].setTint(colors.gold);
        else if (show.fumble) made[i].setTint(colors.red);
      });
      setLanded(true);
      timer = setTimeout(done, show.crit || show.fumble ? HOLD_SPECIAL_MS : HOLD_MS);
    });
    return () => {
      closed = true;
      clearTimeout(timer);
      made.forEach((d) => d.stop());
    };
  }, [show]);

  const tap = () => {
    if (landed) onDone();
    else dice.current.forEach((d) => d.finish());
  };

  const mood = landed ? (show.crit ? styles.crit : show.fumble ? styles.fumble : '') : '';
  return (
    <div className={`${styles.overlay} motion-page`} onClick={tap} role="presentation">
      <div className={`${styles.stage} ${mood}`}>
        <div className={styles.dice}>
          {show.dice.map((d, i) => (
            <span key={i} className={landed && !d.kept ? `${styles.die} ${styles.dropped}` : styles.die}>
              <canvas ref={(el) => { refs.current[i] = el; }} className={show.dice.length > 1 ? `${styles.canvas} ${styles.canvasPair}` : styles.canvas} aria-hidden="true" />
              {landed && d.kept && show.crit && <Sparks />}
              {landed && d.kept && show.fumble && (
                <svg className={styles.crack} viewBox="0 0 100 100" aria-hidden="true">
                  <polyline points="38,22 47,38 41,48 54,60 49,72 58,84" />
                  <polyline points="47,38 58,36" />
                </svg>
              )}
            </span>
          ))}
        </div>
        <div className={landed ? `${styles.result} ${styles.resultOn}` : styles.result} aria-live="polite">
          <span className={styles.label}>{show.label}</span>
          <span className={styles.total}>{landed ? show.total : ''}</span>
          {landed && show.tag && <span className={styles.tag}>{show.tag}</span>}
        </div>
      </div>
    </div>
  );
}
