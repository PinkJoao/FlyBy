// =============================================================================
// useSwipeNav: arrastar para o lado troca de aba (celular)
// =============================================================================
// O QUE FAZ
//   Liga gestos de toque a um elemento (o contêiner das abas da ficha): um
//   arrasto horizontal puxa o conteúdo junto com o dedo e, solto além do limiar,
//   chama onPrev ou onNext; curto, ou sem aba para aquele lado, volta ao lugar.
//
// FUNÇÕES
//   startsInScroller(target, root): o toque começou num campo, numa fileira que
//     rola de lado ou num elemento com gesto próprio (`data-own-swipe`)?
//   useSwipeNav(ref, { onPrev, onNext, canPrev, canNext }): liga os gestos.
//
// DECISÕES E ARMADILHAS
//   - O eixo trava no primeiro movimento claro: vertical é rolagem e o gesto
//     desiste; horizontal assume e impede a rolagem (por isso os ouvintes são
//     nativos, com `passive: false`: os do React são passivos e o
//     preventDefault não valeria).
//   - Toque que começa num campo de texto, numa fileira que rola de lado (os
//     chips de filtro, a barra de abas) ou num elemento que tem o próprio gesto
//     horizontal (`data-own-swipe`: o carrossel de imagens) é deles, não da troca
//     de aba. Quem tem gesto próprio sempre ganha.
//   - O arrasto mexe no `style` direto, sem render a cada quadro. Na ponta sem
//     aba seguinte, o conteúdo resiste (fração do arrasto) e volta.
//   - Só toque: mouse e caneta não trocam de aba (no desktop há a barra).
//   - O transform existe só durante o arrasto e é limpo ao soltar: preso, ele
//     seria o bloco de contenção dos painéis `fixed` da aba.
// -----------------------------------------------------------------------------

import { useEffect, useEffectEvent } from 'react';

const LOCK_PX = 10;
const SWITCH_PX = 70;
const FOLLOW = 0.4;
const EDGE_FOLLOW = 0.12;

/** O toque começou num campo ou numa fileira que rola de lado? */
function startsInScroller(target, root) {
  for (let el = target; el && el !== root; el = el.parentElement) {
    if (el.matches?.('input, textarea, select, [contenteditable="true"], [data-own-swipe]')) return true;
    const style = getComputedStyle(el);
    if (/(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 2) return true;
  }
  return false;
}

/** Liga os gestos de troca de aba ao elemento de `ref`. */
export function useSwipeNav(ref, { onPrev, onNext, canPrev, canNext }) {
  const prev = useEffectEvent(() => onPrev?.());
  const next = useEffectEvent(() => onNext?.());
  const allowed = useEffectEvent((dir) => (dir < 0 ? canNext : canPrev));

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let start = null;
    let axis = null;
    let dx = 0;

    const reset = (animate) => {
      el.style.transition = animate ? 'transform 0.2s ease' : '';
      el.style.transform = '';
      if (animate) setTimeout(() => (el.style.transition = ''), 220);
    };

    const onStart = (e) => {
      if (e.touches.length !== 1 || startsInScroller(e.target, el)) {
        start = null;
        return;
      }
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      axis = null;
      dx = 0;
    };

    const onMove = (e) => {
      if (!start) return;
      const mx = e.touches[0].clientX - start.x;
      const my = e.touches[0].clientY - start.y;
      if (!axis) {
        if (Math.abs(mx) < LOCK_PX && Math.abs(my) < LOCK_PX) return;
        axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      }
      if (axis !== 'x') return;
      e.preventDefault();
      dx = mx;
      const factor = allowed(dx) ? FOLLOW : EDGE_FOLLOW;
      el.style.transition = '';
      el.style.transform = `translateX(${dx * factor}px)`;
    };

    const onEnd = () => {
      if (!start || axis !== 'x') {
        start = null;
        return;
      }
      start = null;
      if (Math.abs(dx) >= SWITCH_PX && allowed(dx)) {
        reset(false);
        if (dx < 0) next();
        else prev();
      } else {
        reset(true);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [ref]);
}
