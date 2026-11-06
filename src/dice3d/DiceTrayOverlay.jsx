// =============================================================================
// DiceTrayOverlay: a bandeja com todos os dados de uma rolagem, por cima da tela
// =============================================================================
// O QUE FAZ
//   A fase D2 (docs/PLAY-MODE-V2-PLAN.md §2, DDL-0153): com Settings > Dice
//   animation > All dice, a rolagem sem d20 (dano, cura, dados de vida) joga os dados
//   numa bandeja sobre a tela (diceTray); quando todos assentam, aparecem o rótulo, o
//   total e o selo do crítico, e a camada fecha sozinha. Tocar pula; tocar de novo
//   fecha; o voltar do celular fecha.
//
// FUNÇÕES
//   DiceTrayOverlay(props): a camada.
//
// DECISÕES E ARMADILHAS
//   - Só encena: o evento já foi gravado (rollShow); fechar antes não muda nada.
//   - As cores e o rótulo são os do d20 em destaque (o mesmo CSS e o tokenColors de
//     colors.js), para as duas animações parecerem uma só.
//   - A rolagem roda uma vez por `show`: o fechar entra por useEffectEvent.
// -----------------------------------------------------------------------------

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useBackLayer } from '../hooks/useBack';
import { createTray } from './diceTray';
import { tokenColors } from './colors';
import overlay from './D20Overlay.module.css';
import styles from './DiceTrayOverlay.module.css';

const HOLD_MS = 1300;

/**
 * A bandeja. `show` vem de trayShow; `onDone` fecha.
 * @param {{ show: object, onDone: Function }} props
 */
export default function DiceTrayOverlay({ show, onDone }) {
  const canvas = useRef(null);
  const tray = useRef(null);
  const [landed, setLanded] = useState(false);
  useBackLayer(true, onDone);
  const done = useEffectEvent(() => onDone());

  useEffect(() => {
    const made = createTray(canvas.current, show.dice, tokenColors());
    tray.current = made;
    let closed = false;
    let timer = 0;
    made.start().then(() => {
      if (closed) return;
      setLanded(true);
      timer = setTimeout(done, HOLD_MS);
    });
    return () => {
      closed = true;
      clearTimeout(timer);
      made.stop();
    };
  }, [show]);

  const tap = () => {
    if (landed) onDone();
    else tray.current?.finish();
  };

  return (
    <div className={`${overlay.overlay} ${styles.tray} motion-page`} onClick={tap} role="presentation">
      <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
      <div className={landed ? `${overlay.result} ${overlay.resultOn} ${styles.result}` : `${overlay.result} ${styles.result}`} aria-live="polite">
        <span className={overlay.label}>{show.label}</span>
        <span className={overlay.total}>{landed ? show.total : ''}</span>
        {landed && show.more > 0 && <span className={overlay.label}>+{show.more} more dice</span>}
        {landed && show.tag && <span className={overlay.tag}>{show.tag}</span>}
      </div>
    </div>
  );
}
