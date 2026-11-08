// =============================================================================
// DiceTrayOverlay: a bandeja com todos os dados de uma rolagem, por cima da tela
// =============================================================================
// O QUE FAZ
//   A fase D2 (docs/PLAY-MODE-V2-PLAN.md §2, DDL-0153): com Settings > Dice
//   animation > All dice, a rolagem sem d20 (dano, cura, dados de vida) joga os dados
//   numa bandeja sobre a tela (diceTray), cada dado girando no lugar até o valor;
//   quando todos param, aparecem o rótulo, o total e o selo do crítico, e a camada
//   fecha sozinha. Tocar pula; tocar de novo fecha; o voltar do celular fecha.
//
// FUNÇÕES
//   DiceTrayOverlay(props): a camada.
//
// DECISÕES E ARMADILHAS
//   - Só encena: o evento já foi gravado (rollShow); fechar antes não muda nada.
//   - As cores e o rótulo são os do d20 em destaque (o mesmo CSS e o tokenColors de
//     colors.js), para as duas animações parecerem uma só.
//   - A rolagem roda uma vez por `show`: o fechar entra por useEffectEvent.
//   - Depois que os dados param, as partes entram uma a uma como no d20 (DDL-0158):
//     "+5 Longsword", "+4 Modifier", o total subindo e um tique por parte. Com uma
//     parte só, sem pílula: o total já diz tudo.
//   - Sons (sounds.js, DDL-0157): o chocalho ao começar, um toque por dado parado
//     (no máximo um a cada 45 ms, ou vinte dados viram um ruído só) e o fecho no total.
// -----------------------------------------------------------------------------

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useBackLayer } from '../hooks/useBack';
import { createTray } from './diceTray';
import { tokenColors } from './colors';
import { BonusChip } from './BonusChips';
import { playLand, playRattle, playTick, playTotal } from './sounds';
import overlay from './D20Overlay.module.css';
import styles from './DiceTrayOverlay.module.css';

const HOLD_MS = 1300;
const FIRST_PART_MS = 300;
const PART_MS = 340;

/**
 * A bandeja. `show` vem de trayShow; `onDone` fecha.
 * @param {{ show: object, onDone: Function }} props
 */
export default function DiceTrayOverlay({ show, onDone }) {
  const canvas = useRef(null);
  const tray = useRef(null);
  const timers = useRef([]);
  const [landed, setLanded] = useState(false);
  const [shown, setShown] = useState(0);
  const [finished, setFinished] = useState(false);
  useBackLayer(true, onDone);
  const done = useEffectEvent(() => onDone());
  const parts = show.parts ?? [];

  useEffect(() => {
    let lastLand = 0;
    const made = createTray(canvas.current, show.dice, tokenColors(), {
      onLand: () => {
        const now = performance.now();
        if (now - lastLand < 45) return;
        lastLand = now;
        playLand(0.55);
      },
    });
    tray.current = made;
    let closed = false;
    const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
    playRattle(1100, show.dice.length);
    made.start().then(() => {
      if (closed) return;
      setLanded(true);
      const list = show.parts ?? [];
      let t = FIRST_PART_MS;
      list.forEach((_, k) => {
        later(() => {
          setShown(k + 1);
          playTick(k);
        }, t);
        t += PART_MS;
      });
      later(() => {
        setFinished(true);
        playTotal();
      }, t);
      later(done, t + HOLD_MS);
    });
    return () => {
      closed = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      made.stop();
    };
  }, [show]);

  const tap = () => {
    if (finished) {
      onDone();
      return;
    }
    tray.current?.finish();
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLanded(true);
    setShown(parts.length);
    setFinished(true);
    timers.current.push(setTimeout(onDone, HOLD_MS));
  };

  const running = parts.slice(0, shown).reduce((s, p) => s + p.total, 0);
  return (
    <div className={`${overlay.overlay} ${styles.tray} motion-page`} onClick={tap} role="presentation">
      <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
      <div className={landed ? `${overlay.result} ${overlay.resultOn} ${styles.result}` : `${overlay.result} ${styles.result}`} aria-live="polite">
        <span className={overlay.label}>{show.label}</span>
        {parts.length > 1 && (
          <span className={overlay.chips}>
            {parts.slice(0, shown).map((p, i) => (
              <BonusChip key={i} bonus={p} fast />
            ))}
          </span>
        )}
        <span key={shown} className={landed ? `${overlay.total} ${overlay.totalPop}` : overlay.total}>
          {finished ? show.total : shown ? running : ''}
        </span>
        {finished && show.more > 0 && <span className={overlay.label}>+{show.more} more dice</span>}
        {finished && show.tag && <span className={overlay.tag}>{show.tag}</span>}
      </div>
    </div>
  );
}
