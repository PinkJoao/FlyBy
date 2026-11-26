// =============================================================================
// TabPanel: o conteúdo de uma sub-aba, que anima só o que mudou na troca
// =============================================================================
// O QUE FAZ
//   Envolve o que fica abaixo de uma TabBar `sub` (as origens do grimório, as
//   classes do multiclasse, os tipos de feature e as origens do jogo) e o remonta
//   a cada troca. Cada peça é comparada com a da aba anterior: igual e no mesmo
//   lugar, não se mexe; igual em outra altura, desliza até o lugar novo; diferente,
//   entra pela direita (aba seguinte) ou pela esquerda (anterior), no tempo do
//   realce da barra (DDL-0323, DDL-0325).
//
// FUNÇÕES
//   TabPanel(props): `active` (o id da aba), `order` (os ids na ordem da barra),
//     `className`; os filhos.
//   topIn(el, panel): a altura de um elemento dentro do painel.
//   snapshotOf(el, panel, depth): a árvore de assinaturas e alturas, até `depth` níveis.
//   animateChanges(parent, before, now, dir): anima o que mudou ou se moveu; devolve quantas peças animou.
//
// DECISÕES E ARMADILHAS
//   - Regra do dono (DDL-0325): numa transição, o que já estava na tela e fica no
//     mesmo lugar NÃO anima. Deslizar o painel inteiro mexia na busca e nos filtros,
//     que eram os mesmos.
//   - Uma peça diferente que ocupa o MESMO lugar com o mesmo elemento (a mesma tag e
//     classe: a linha da busca, o card dos números, o cabeçalho de um círculo) não
//     desliza inteira: a comparação desce nela (até DEPTH níveis) e só anima o que
//     mudou lá dentro (o botão que surgiu, o número novo). Só desliza inteira quando o
//     texto PRÓPRIO dela mudou (o `own`, fora dos filhos) ou ela não tem filhos.
//   - A assinatura é a tag, a classe, o número de filhos e o texto: barato de ler a
//     cada render (o texto é nativo). Uma peça igual se acha pela assinatura, não
//     pela posição na lista (a nota de carga do grimório aparece só numa origem).
//   - A altura soma `offsetTop` até o painel (`position: relative`), que ignora os
//     transforms: uma troca no meio de outra lê o lugar de verdade.
//   - Animação pela Web Animations API, por peça; com "reduzir movimento", nada.
//   - A primeira montagem não anima (não há o antes), como na ficha.
// -----------------------------------------------------------------------------

import { useLayoutEffect, useRef } from 'react';
import { reducedMotion } from '../../motion';
import styles from './TabPanel.module.css';

const DURATION = 240;
const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
const SLIDE_PX = 28;
const DEPTH = 4;

/** A altura de um elemento dentro do painel (sem transforms). */
function topIn(el, panel) {
  let top = 0;
  for (let e = el; e && e !== panel; e = e.offsetParent) top += e.offsetTop;
  return top;
}

/** A árvore de assinaturas e alturas dos filhos de `el`, até `depth` níveis. */
function snapshotOf(el, panel, depth) {
  return [...el.children].map((c) => {
    const key = `${c.tagName}.${typeof c.className === 'string' ? c.className : ''}`;
    return {
      key,
      sig: `${key}|${c.childElementCount}|${c.textContent}`,
      own: [...c.childNodes].filter((t) => t.nodeType === 3).map((t) => t.data).join(''),
      top: topIn(c, panel),
      kids: depth > 1 ? snapshotOf(c, panel, depth - 1) : null,
    };
  });
}

/** Anima os filhos de `parent`: o igual fica, o movido desliza, o novo entra de lado. */
function animateChanges(parent, before, now, dir) {
  const used = new Set();
  let count = 0;
  const free = (test) => before.findIndex((b, k) => !used.has(k) && test(b));
  now.forEach((n, i) => {
    const el = parent.children[i];
    if (!el) return;
    const same = free((b) => b.sig === n.sig);
    if (same >= 0) {
      used.add(same);
      const dy = before[same].top - n.top;
      if (Math.abs(dy) >= 1) {
        el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: DURATION, easing: EASE });
        count += 1;
      }
      return;
    }
    const spot = n.kids?.length ? free((b) => b.key === n.key && b.kids && b.own === n.own && Math.abs(b.top - n.top) < 1) : -1;
    if (spot >= 0) {
      used.add(spot);
      count += animateChanges(el, before[spot].kids, n.kids, dir);
      return;
    }
    el.animate(
      [
        { opacity: 0, transform: `translateX(${dir * SLIDE_PX}px)` },
        { opacity: 1, transform: 'none' },
      ],
      { duration: DURATION, easing: EASE, fill: 'backwards' },
    );
    count += 1;
  });
  return count;
}

/** O conteúdo de uma sub-aba, remontado a cada troca, animando só o que mudou. */
export default function TabPanel({ active, order, className, children }) {
  const ref = useRef(null);
  const last = useRef({ active, snap: null });
  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const prev = last.current;
    const snap = snapshotOf(panel, panel, DEPTH);
    if (prev.active !== active && prev.snap && !reducedMotion() && typeof panel.animate === 'function') {
      const from = order.indexOf(prev.active);
      const to = order.indexOf(active);
      animateChanges(panel, prev.snap, snap, from >= 0 && to >= 0 && to < from ? -1 : 1);
    }
    last.current = { active, snap };
  });
  const cls = [styles.panel, className].filter(Boolean).join(' ');
  return (
    <div key={String(active)} ref={ref} className={cls}>
      {children}
    </div>
  );
}
