// =============================================================================
// AutoHeight: um contêiner que anima a própria altura quando o conteúdo muda
// =============================================================================
// O QUE FAZ
//   Envolve um conteúdo que cresce ou encolhe sem montar nem desmontar (a tabela
//   de progressão indo de uma linha para a tabela inteira) e faz a altura
//   deslizar até o tamanho novo, em vez de pular.
//
// FUNÇÕES
//   AutoHeight({ children }): o contêiner.
//
// DECISÕES E ARMADILHAS
//   - Um ResizeObserver no conteúdo dá a altura nova; o contêiner a recebe em
//     `height` com transição. A primeira medida entra sem animar.
//   - Corta só na VERTICAL (`overflow-y: clip`, com o X visível): uma tabela
//     larga dentro segue rolando de lado no TableViewer. `hidden` no X a cortaria.
//   - Com "reduzir movimento" a regra global do motion.css zera a transição.
// -----------------------------------------------------------------------------

import { useLayoutEffect, useRef } from 'react';
import styles from './AutoHeight.module.css';

/** O contêiner de altura animada. */
export default function AutoHeight({ children }) {
  const outer = useRef(null);
  const inner = useRef(null);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return undefined;
    let first = true;
    const fit = () => {
      if (first) {
        o.style.transition = 'none';
        o.style.height = `${i.offsetHeight}px`;
        o.getBoundingClientRect();
        o.style.transition = '';
        first = false;
        return;
      }
      o.style.height = `${i.offsetHeight}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(i);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outer} className={styles.outer}>
      <div ref={inner}>{children}</div>
    </div>
  );
}
