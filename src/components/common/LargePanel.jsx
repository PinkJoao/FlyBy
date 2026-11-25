// =============================================================================
// LargePanel: a moldura do painel grande (galeria, guia de level-up)
// =============================================================================
// O QUE FAZ
//   O véu e o painel grande do app, no desenho do SelectorPanel (docs/UI-PATTERNS.md,
//   "Large panel"): fundo --bg, raio 16, altura até 90svh, largura máxima por uso, e
//   TELA CHEIA a 760 px ou menos. Vai por portal ao document.body. Quem usa desenha o
//   conteúdo (cabeçalho, corpo, rodapé) e cuida do voltar do celular (useBackLayer).
//
// FUNÇÕES
//   LargePanel(props): `onDismiss` (toque fora, se `backdropCloses`, e Esc), `closing`
//     (anima a saída), `maxWidth`, `maxHeight`, `z`, `label` (o aria-label), `children`.
//
// DECISÕES E ARMADILHAS
//   - Saiu de duas cópias (DDL-0313, P10 do docs/UI-STUDY.md): a galeria de retratos e
//     o guia de level-up tinham véu, painel e animação próprios, com medidas diferentes
//     (o guia virava tela cheia a 720 px, a galeria nunca).
//   - O guia de level-up não fecha com toque fora (`backdropCloses={false}`): sair dele
//     pergunta se desfaz o nível, então só o X e o voltar levam a essa pergunta.
//   - O portal é necessário: um ancestral com transform prenderia o `position: fixed`.
// -----------------------------------------------------------------------------

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './LargePanel.module.css';

/** O véu e o painel grande. */
export default function LargePanel({ onDismiss, closing = false, backdropCloses = true, maxWidth = 900, maxHeight = 800, z = 150, label, children }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return createPortal(
    <div
      className={closing ? `${styles.overlay} ${styles.closing}` : styles.overlay}
      style={{ zIndex: z }}
      onMouseDown={(e) => {
        if (backdropCloses && e.target === e.currentTarget) onDismiss?.();
      }}
    >
      <div
        ref={ref}
        className={`${styles.panel} motion-pop`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        style={{ '--panel-max-w': `${maxWidth}px`, '--panel-max-h': `${maxHeight}px` }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onDismiss?.();
          }
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
