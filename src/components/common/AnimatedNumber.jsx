// =============================================================================
// AnimatedNumber: um número que rola ao mudar (sobe ao aumentar, desce ao diminuir)
// =============================================================================
// O QUE FAZ
//   Mostra um valor e, quando ele muda, o novo entra como num contador de rolo:
//   vindo de baixo se aumentou, de cima se diminuiu (motion.css,
//   .motion-num-up e .motion-num-down). Usado nos +/- do Stepper e nos números
//   derivados da ficha (nível, HP, CA, atributos e modificadores).
//
// FUNÇÕES
//   AnimatedNumber({ value, children, className }): o número num <span>; o texto
//     mostrado é `children` quando dado (um "+3" formatado), senão o valor.
//
// DECISÕES E ARMADILHAS
//   - A direção vem de useNumberMotion (hooks/), que o Stepper usa direto no
//     campo editável.
//   - A animação é por remontagem (`key` = valor), então só a ENTRADA anima; o
//     valor antigo some na hora, o que lê como um rolo rápido.
// -----------------------------------------------------------------------------

import { useNumberMotion } from '../../hooks/useNumberMotion';

/**
 * Um número que rola ao mudar.
 * @param {{ value: number|string, children?: import('react').ReactNode, className?: string }} props
 */
export default function AnimatedNumber({ value, children, className }) {
  const motion = useNumberMotion(value);
  const cls = [className, motion.className].filter(Boolean).join(' ');
  return (
    <span key={motion.key} className={cls || undefined}>
      {children ?? value}
    </span>
  );
}
