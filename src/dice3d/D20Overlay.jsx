// =============================================================================
// D20Overlay: o d20 em destaque no centro da tela, depois de uma rolagem
// =============================================================================
// O QUE FAZ
//   A fase D1 dos dados (docs/PLAY-MODE-V2-PLAN.md §2, DDL-0152): sobre a tela do
//   jogo, um d20 grande (ou dois, com vantagem e desvantagem) tomba e para na face
//   que o engine já sorteou. No 20 natural (ou no crítico do limiar) o dado fica
//   dourado, brilha e solta faíscas; no 1 natural fica vermelho, treme e racha. O
//   descartado esmaece. Depois os BÔNUS entram um a um (DDL-0157, como no Baldur's
//   Gate 3): cada um vira uma pílula ("+4 Dexterity"), o rolado gira o próprio dado
//   pequeno (o d4 do Bless), e o total sobe a cada um, com um tique. Fecha sozinho.
//   Tocar pula tudo até o fim; tocar de novo fecha. O voltar do celular fecha.
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
//   - O total começa no valor do d20 (`base`, já com o piso do Reliable Talent) e
//     soma bônus a bônus; o último bate com o total gravado.
//   - Sons (sounds.js): chocalho no giro, toque ao parar, o acorde ou o tom que cai no
//     20 e no 1 (na hora em que o dado para, como no BG3), um tique por bônus que sobe
//     de tom, e o fecho no total. Pular corta os tiques.
//   - Os timers moram num ref para o toque de pular poder limpá-los; o pular vive
//     num ref (lido pela rolagem em curso) e num estado (lido pelo desenho).
// -----------------------------------------------------------------------------

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useBackLayer } from '../hooks/useBack';
import { createD20 } from './d20Canvas';
import { BonusChip } from './BonusChips';
import { tokenColors } from './colors';
import { playCrit, playFumble, playLand, playRattle, playTick, playTotal } from './sounds';
import styles from './D20Overlay.module.css';

const SPIN_MS = 1300;
const HOLD_MS = 1100;
const HOLD_SPECIAL_MS = 1600;
const FIRST_BONUS_MS = 380;
const BONUS_MS = 360;
const ROLLED_BONUS_MS = 720;

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
  const timers = useRef([]);
  const fast = useRef(false);
  const [landed, setLanded] = useState(false);
  const [shown, setShown] = useState(0);
  const [finished, setFinished] = useState(false);
  const [skipped, setSkipped] = useState(false);
  useBackLayer(true, onDone);
  const done = useEffectEvent(() => onDone());
  const bonuses = show.bonuses ?? [];

  const holdMs = show.crit || show.fumble ? HOLD_SPECIAL_MS : HOLD_MS;
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    const colors = tokenColors();
    const made = show.dice.map((_, i) => createD20(refs.current[i], colors));
    dice.current = made;
    let closed = false;
    playRattle(SPIN_MS, show.dice.length);
    Promise.all(show.dice.map((d, i) => made[i].spinTo(d.value, SPIN_MS + i * 180))).then(() => {
      if (closed) return;
      show.dice.forEach((d, i) => {
        if (!d.kept) return;
        if (show.crit) made[i].setTint(colors.gold);
        else if (show.fumble) made[i].setTint(colors.red);
      });
      setLanded(true);
      playLand();
      if (show.crit) playCrit();
      else if (show.fumble) playFumble();
      const count = (show.bonuses ?? []).length;
      if (fast.current || !count) {
        setShown(count);
        setFinished(true);
        timers.current.push(setTimeout(done, holdMs));
        return;
      }
      let t = FIRST_BONUS_MS;
      show.bonuses.forEach((b, k) => {
        timers.current.push(setTimeout(() => {
          setShown(k + 1);
          playTick(k);
        }, t));
        t += b.dice.length ? ROLLED_BONUS_MS : BONUS_MS;
      });
      timers.current.push(setTimeout(() => {
        setFinished(true);
        playTotal();
      }, t));
      timers.current.push(setTimeout(done, t + holdMs));
    });
    return () => {
      closed = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      made.forEach((d) => d.stop());
    };
  }, [show, holdMs]);

  const tap = () => {
    if (finished) {
      onDone();
      return;
    }
    fast.current = true;
    setSkipped(true);
    if (!landed) {
      dice.current.forEach((d) => d.finish());
      return;
    }
    clearTimers();
    setShown(bonuses.length);
    setFinished(true);
    later(onDone, holdMs);
  };

  const running = show.base + bonuses.slice(0, shown).reduce((s, b) => s + b.total, 0);
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
          {bonuses.length > 0 && (
            <span className={styles.chips}>
              {bonuses.slice(0, shown).map((b, i) => (
                <BonusChip key={i} bonus={b} fast={skipped} />
              ))}
            </span>
          )}
          <span key={shown} className={landed ? `${styles.total} ${styles.totalPop}` : styles.total}>{landed ? (finished ? show.total : running) : ''}</span>
          {finished && show.tag && <span className={styles.tag}>{show.tag}</span>}
        </div>
      </div>
    </div>
  );
}
