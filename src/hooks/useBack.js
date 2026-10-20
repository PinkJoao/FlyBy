// =============================================================================
// useBack: as hooks que ligam uma camada ou um passo ao voltar do celular
// =============================================================================
// O QUE FAZ
//   A ponte entre os componentes e a pilha do voltar (src/backStack.js).
//   useBackLayer serve a uma camada que abre e fecha (diálogo, seletor, gaveta);
//   useBackDepth, a uma sequência de passos (o guia), com uma entrada por passo.
//
// FUNÇÕES
//   useBackLayer(open, onClose): enquanto `open`, o voltar chama onClose.
//   useBackDepth(depth, onBack): mantém `depth` entradas; cada voltar chama
//     onBack uma vez (no guia, `depth` é o índice do passo e onBack volta um).
//   useLeaveTo(): a função que sai da página atual para `to` desempilhando
//     (backStack.popRoute); se a anterior não for `to`, empilha `to` por cima
//     dela. Sem página anterior (link aberto direto), substitui a atual.
//
// DECISÕES E ARMADILHAS
//   - Se onClose NÃO fechar a camada (um "sair do guia?" que o usuário cancela),
//     a camada continua aberta e precisa de uma entrada nova: o contador `gen`
//     refaz o efeito, que empilha de novo enquanto `open` seguir verdadeiro.
//     Quando onClose devolve uma Promise (ele abriu uma pergunta), a entrada nova
//     espera ela terminar: empilhada antes, ficaria ACIMA do diálogo da pergunta,
//     e o voltar seguinte reabriria a pergunta em vez de fechá-la.
//   - onClose e onBack entram por useEffectEvent: mudam a cada render, e trocá-los
//     não pode empilhar nem soltar uma camada.
//   - No StrictMode (dev) o efeito roda duas vezes e deixa uma entrada gasta a
//     mais; a pilha pula entradas gastas, então não há efeito visível.
// -----------------------------------------------------------------------------

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { backStack } from '../backStack';

/** Enquanto `open`, o voltar do aparelho chama onClose. */
export function useBackLayer(open, onClose) {
  const [gen, setGen] = useState(0);
  const onBack = useEffectEvent(() => {
    const result = onClose?.();
    if (typeof result?.then === 'function') result.finally(() => setGen((g) => g + 1));
    else setGen((g) => g + 1);
  });

  useEffect(() => {
    if (!open || !backStack) return undefined;
    const id = backStack.push(onBack);
    return () => backStack.release(id);
  }, [open, gen]);
}

/** Mantém `depth` entradas; cada voltar chama onBack uma vez. */
export function useBackDepth(depth, onBack) {
  const ids = useRef([]);
  const back = useEffectEvent(() => onBack?.());

  useEffect(() => {
    if (!backStack) return;
    const stack = ids.current;
    while (stack.length < depth) {
      const id = backStack.push(() => {
        const at = stack.indexOf(id);
        if (at !== -1) stack.splice(at, 1);
        back();
      });
      stack.push(id);
    }
    while (stack.length > depth) backStack.release(stack.pop());
  }, [depth]);

  useEffect(() => {
    const stack = ids.current;
    return () => {
      while (stack.length) backStack?.release(stack.pop());
    };
  }, []);
}

/** Sai da página atual para `to` desempilhando, em vez de empilhar `to`. */
export function useLeaveTo() {
  const navigate = useNavigate();
  return (to) => {
    const idx = window.history.state?.idx;
    if (!backStack || !idx) {
      navigate(to, { replace: true });
      return;
    }
    backStack.popRoute(() => {
      if (window.location.pathname !== to) navigate(to);
    });
  };
}
