// =============================================================================
// TabPanel: o conteúdo de uma sub-aba, que entra deslizando na direção da troca
// =============================================================================
// O QUE FAZ
//   Envolve o que fica abaixo de uma TabBar `sub` (as origens do grimório, as
//   classes do multiclasse, os tipos de feature e as origens do jogo) e o remonta
//   a cada troca, entrando da direita (aba seguinte) ou da esquerda (anterior),
//   no mesmo tempo do realce que desliza na barra. É o que as abas da página já
//   fazem (slideClass no Builder e no Play); as sub-abas trocavam o conteúdo de
//   uma vez (DDL-0323).
//
// FUNÇÕES
//   TabPanel(props): `active` (o id da aba), `order` (os ids na ordem da barra),
//     `className`; os filhos.
//   useSlideDir(active, order): a classe de entrada da última troca.
//
// DECISÕES E ARMADILHAS
//   - A direção é derivada NO RENDER (o estado guarda a aba anterior e o React
//     refaz o render na hora), não num efeito: num efeito o conteúdo novo
//     apareceria um quadro sem a classe e depois saltaria.
//   - O painel é flex em coluna com o `gap` do pai (inherit): os filhos ficam com
//     o mesmo espaçamento que tinham soltos na aba.
//   - A primeira montagem não desliza (sem direção), como na ficha.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { directionOf, slideClass } from '../../motion';
import styles from './TabPanel.module.css';

/** A classe de entrada da última troca de aba. */
function useSlideDir(active, order) {
  const [seen, setSeen] = useState({ active, dir: null });
  if (seen.active !== active) {
    const from = order.indexOf(seen.active);
    const to = order.indexOf(active);
    const dir = from < 0 || to < 0 ? null : directionOf(from, to);
    setSeen({ active, dir });
    return slideClass(dir);
  }
  return slideClass(seen.dir);
}

/** O conteúdo de uma sub-aba, remontado e deslizando a cada troca. */
export default function TabPanel({ active, order, className, children }) {
  const slide = useSlideDir(active, order);
  const cls = [styles.panel, slide, className].filter(Boolean).join(' ');
  return (
    <div key={String(active)} className={cls}>
      {children}
    </div>
  );
}
