// =============================================================================
// Toggle: o interruptor animado do app, no lugar da checkbox nativa
// =============================================================================
// O QUE FAZ
//   Um sim ou não com rótulo: a trilha com o botão que desliza (o mesmo realce em
//   accent do seletor de modo), e o rótulo ao lado. A linha inteira é clicável.
//   `size="sm"` é o menor, para listas (os efeitos de uma rolagem, os alvos de um
//   modificador); `hint` põe uma segunda linha esmaecida sob o rótulo.
//
// FUNÇÕES
//   Toggle(props): o interruptor.
//
// DECISÕES E ARMADILHAS
//   - Checkbox nativa evitada no app (DDL-0187, docs/UI-PATTERNS.md): ela muda de
//     cara por navegador e tema e destoa dos controles próprios. Onde o interruptor
//     não couber, o pequeno; checkbox só desenhada pelo app, nunca a nativa.
//   - `role="switch"` com `aria-checked` num <button>: leitor de tela e teclado
//     (Espaço e Enter) funcionam sem nada extra; `type="button"` para não enviar o
//     formulário de um diálogo.
//   - O movimento é transição de CSS: o "reduzir movimento" global do motion.css
//     já a encurta.
// -----------------------------------------------------------------------------

import styles from './Toggle.module.css';

/**
 * O interruptor animado com rótulo.
 * @param {{checked: boolean, onChange: (next: boolean) => void, label?: any, hint?: any, size?: 'md'|'sm', disabled?: boolean, title?: string, className?: string}} props
 */
export default function Toggle({ checked, onChange, label, hint, size = 'md', disabled = false, title, className }) {
  const cls = [styles.toggle, size === 'sm' ? styles.sm : '', checked ? styles.on : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      disabled={disabled}
      title={title}
      className={cls}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.track} aria-hidden="true">
        <span className={styles.knob} />
      </span>
      {(label || hint) && (
        <span className={styles.text}>
          {label && <span className={styles.label}>{label}</span>}
          {hint && <span className={styles.hint}>{hint}</span>}
        </span>
      )}
    </button>
  );
}
