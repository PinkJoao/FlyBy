// =============================================================================
// Collapse: o corpo de um card expansível, que abre E fecha animado
// =============================================================================
// O QUE FAZ
//   Envolve o corpo de um card e anima a altura nos dois sentidos. Fechado, o
//   conteúdo nem existe (como o `{open && ...}` de antes); ao abrir, monta e
//   cresce; ao fechar, encolhe e só então desmonta.
//
// FUNÇÕES
//   Collapse({ open, children }): o corpo animado.
//
// DECISÕES E ARMADILHAS
//   - A altura anima por `grid-template-rows` de 0fr a 1fr, que dispensa medir a
//     altura em JS e funciona com conteúdo que muda de tamanho.
//   - As fases (closed, opening, open, shown, closing) andam pelo render: mudar
//     `open` vira 'opening' ou 'closing' na hora, e os efeitos só agendam o passo
//     seguinte (dois quadros para o navegador pintar o 0fr antes do 1fr; o fim
//     da animação para 'shown' ou para desmontar). Em 'shown' o conteúdo deixa
//     de ser cortado: sombras e anéis de foco de dentro do card não são aparados.
//   - Com "reduzir movimento", abre e fecha na hora.
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { reducedMotion } from '../../motion';
import styles from './Collapse.module.css';

const MS = 220;

/**
 * O corpo animado de um card expansível.
 * @param {{ open: boolean, children: import('react').ReactNode }} props
 */
export default function Collapse({ open, children }) {
  const [phase, setPhase] = useState(open ? 'shown' : 'closed');
  const [prev, setPrev] = useState(open);
  if (open !== prev) {
    setPrev(open);
    setPhase(reducedMotion() ? (open ? 'shown' : 'closed') : open ? 'opening' : 'closing');
  }

  useEffect(() => {
    if (phase === 'opening') {
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setPhase('open'));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    if (phase === 'open') {
      const t = setTimeout(() => setPhase('shown'), MS);
      return () => clearTimeout(t);
    }
    if (phase === 'closing') {
      const t = setTimeout(() => setPhase('closed'), MS);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [phase]);

  if (phase === 'closed') return null;
  const cls = [styles.collapse, (phase === 'open' || phase === 'shown') && styles.expanded, phase === 'shown' && styles.shown]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls}>
      <div className={styles.inner}>{children}</div>
    </div>
  );
}
