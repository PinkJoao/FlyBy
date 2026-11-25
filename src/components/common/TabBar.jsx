// =============================================================================
// TabBar: a barra de abas única do app
// =============================================================================
// O QUE FAZ
//   Uma faixa de abas que rola de lado, com a aba ativa sempre à vista
//   (useActiveInView) e um realce que DESLIZA até a aba escolhida, como o do
//   SegmentedControl. Duas aparências: `main` (a das páginas: a ficha e o jogo,
//   sublinhado sob a aba) e `sub` (as sub-abas dentro de uma aba: classes,
//   grupos do inventário, origens das magias, tipos de feature; pílula em volta).
//   Substitui as oito barras feitas à mão (DDL-0303, fase U1 do docs/UI-STUDY.md).
//
// FUNÇÕES
//   TabBar(props): `items` ([{ id, label, icon?, tour? }]), `active` (o id),
//     `onChange(id)`, `variant` ('main' | 'sub'), `fill` (as abas crescem para
//     ocupar a linha quando cabem), `stick` (a barra gruda no alto ao rolar, na
//     altura de --tabbar-top; DDL-0304, no desktop também desde o DDL-0306), `dock` (com `stick`: a
//     mesma barra também gruda no PÉ da tela enquanto o lugar dela está abaixo, DDL-0311), `trailing` (um
//     nó depois das abas: o "+" da classe), `ariaLabel`, `className`; o resto vai para o <nav> (data-tour
//     e os data-flip da troca de modo).
//   useIndicator(navRef, active, deps): a posição e a largura do realce.
//   useDocked(markRef, navRef, on): se a barra está presa ao pé da tela; publica a altura em --dock-h.
//   scrollParent(el): o ancestral que rola, a raiz do IntersectionObserver.
//
// DECISÕES E ARMADILHAS
//   - O realce é UM elemento posicionado pela aba ativa (offsetLeft e
//     offsetWidth, relativos ao próprio <nav>, que é position: relative), dentro
//     da faixa que rola: ele acompanha a rolagem sem conta nenhuma. Remede quando
//     a faixa muda de tamanho (ResizeObserver), porque a fonte do tema papel
//     chega depois e muda a largura das abas.
//   - Na primeira medida o realce aparece no lugar, sem deslizar (`ready`): senão
//     ele viria da esquerda toda vez que a aba monta.
//   - O texto de cada aba fica em cima do realce (z-index): a pílula da `sub` tem
//     fundo.
//   - `dock` é a MESMA barra com `position: sticky` em cima (top) e embaixo (bottom: 0), não uma cópia
//     (DDL-0311): a cópia no rodapé (o TabDock do DDL-0306) aparecia de repente, junto com a de verdade
//     subindo da borda. Com o sticky dos dois lados, a barra fica no pé enquanto o lugar dela está abaixo,
//     entra no lugar só com a rolagem, e gruda no alto depois, sem animação nem troca.
//   - Um marcador de altura zero DEPOIS da barra fica no fundo do lugar dela no fluxo: fora da tela e
//     abaixo, a barra está presa ao pé. O IntersectionObserver só liga `data-docked` (a borda de cima)
//     e --dock-h no <html> (o que o jogo prende ao pé da tela sobe junto); nada se mede na rolagem. A área
//     observada se estende muito para CIMA (rootMargin): acima conta como visto, então "fora" é só abaixo,
//     e um salto direto do fim para o topo (que nunca cruza a tela) ainda troca o estado. A raiz é o
//     ANCESTRAL QUE ROLA (scrollParent): com a janela como raiz, o recorte do .main escondia o marcador
//     acima e abaixo igualmente, e a margem não valia.
// -----------------------------------------------------------------------------

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import useActiveInView from '../../hooks/useActiveInView';
import Icon from './Icon';
import styles from './TabBar.module.css';

/** A posição do realce sob a aba ativa; remede com a faixa. */
function useIndicator(navRef, active, deps) {
  const [box, setBox] = useState(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const measure = () => {
      const tab = nav.querySelector('[data-active="true"]');
      setBox((prev) => {
        if (!tab) return null;
        const next = { left: tab.offsetLeft, width: tab.offsetWidth, ready: prev != null };
        return prev && prev.left === next.left && prev.width === next.width ? prev : next;
      });
    };
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(nav);
    for (const el of nav.children) ro?.observe(el);
    return () => ro?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navRef, active, ...deps]);
  return box;
}

/** O ancestral que rola (o .main do app), ou null para a janela. */
function scrollParent(el) {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p;
  }
  return null;
}

/** Se a barra (com `dock`) está presa ao pé da tela: o lugar dela, marcado por `markRef`, está abaixo. */
function useDocked(markRef, navRef, on) {
  const [docked, setDocked] = useState(false);
  useEffect(() => {
    const mark = markRef.current;
    if (!on || !mark || typeof IntersectionObserver === 'undefined') return undefined;
    const root = scrollParent(mark);
    const io = new IntersectionObserver(([e]) => setDocked(!e.isIntersecting), { root, rootMargin: '100000px 0px 0px 0px' });
    io.observe(mark);
    return () => io.disconnect();
  }, [markRef, on]);
  useEffect(() => {
    const root = document.documentElement;
    if (docked) root.style.setProperty('--dock-h', `${navRef.current?.offsetHeight ?? 0}px`);
    else root.style.removeProperty('--dock-h');
    return () => root.style.removeProperty('--dock-h');
  }, [docked, navRef]);
  return docked;
}

/** A barra de abas: `main` (página) ou `sub` (dentro de uma aba). */
export default function TabBar({ items, active, onChange, variant = 'main', fill = false, stick = false, dock = false, trailing, ariaLabel, className, ...rest }) {
  const navRef = useRef(null);
  const markRef = useRef(null);
  const docked = useDocked(markRef, navRef, stick && dock);
  useActiveInView(navRef, active);
  const box = useIndicator(navRef, active, [items.length, items.map((i) => i.label).join('|')]);
  const cls = [styles.bar, variant === 'sub' ? styles.sub : styles.main, fill ? styles.fill : null, stick ? styles.stick : null, stick && dock ? styles.dock : null, className]
    .filter(Boolean)
    .join(' ');
  return (
    <>
      <nav ref={navRef} className={cls} role="tablist" aria-label={ariaLabel} data-wheel-x="" data-docked={docked ? 'true' : undefined} {...rest}>
        {box && (
          <span
            className={box.ready ? styles.indicator : `${styles.indicator} ${styles.still}`}
            style={{ transform: `translateX(${box.left}px)`, width: box.width }}
            aria-hidden="true"
          />
        )}
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={it.id === active}
            className={it.id === active ? `${styles.tab} ${styles.on}` : styles.tab}
            data-active={it.id === active ? 'true' : undefined}
            data-tour={it.tour}
            onClick={() => onChange(it.id)}
          >
            {it.icon && <Icon name={it.icon} className={styles.icon} />}
            {it.label}
          </button>
        ))}
        {trailing}
      </nav>
      {stick && dock && <div ref={markRef} className={styles.mark} aria-hidden="true" />}
    </>
  );
}
