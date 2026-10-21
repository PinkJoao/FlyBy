// =============================================================================
// useNumberMotion: a animação de rolo de um número que mudou
// =============================================================================
// O QUE FAZ
//   Devolve `{ key, className }` para um elemento que mostra um número: a `key`
//   muda com o valor (remonta o elemento) e a classe diz a direção da entrada
//   (motion.css: .motion-num-up quando aumentou, .motion-num-down quando
//   diminuiu). AnimatedNumber.jsx a usa num <span>; o Stepper, no campo editável.
//
// FUNÇÕES
//   useNumberMotion(value): a key e a classe.
//
// DECISÕES E ARMADILHAS
//   - A direção compara o valor NUMÉRICO com o anterior; texto que não é número
//     (o "-" de um nível vazio) troca sem animar, e a primeira montagem também
//     não anima: a ficha não "rola" ao abrir.
// -----------------------------------------------------------------------------

import { useState } from 'react';

/** `{ key, className }` para animar um elemento quando `value` muda. */
export function useNumberMotion(value) {
  const [prev, setPrev] = useState(value);
  const [dir, setDir] = useState(null);
  if (value !== prev) {
    const a = Number(prev);
    const b = Number(value);
    setPrev(value);
    setDir(Number.isFinite(a) && Number.isFinite(b) && a !== b ? (b > a ? 'up' : 'down') : null);
  }
  return { key: String(value), className: dir ? `motion-num-${dir}` : '' };
}
