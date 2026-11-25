// =============================================================================
// CompactBar: o topo compacto da página do personagem
// =============================================================================
// O QUE FAZ
//   Quando o topo da página (voltar, Build | Play, menu) e a identidade saem da
//   tela ao rolar, uma barra fina desce do alto com os MESMOS controles do topo:
//   voltar à esquerda, o alternador Build | Play no centro e o menu à direita
//   (DDL-0306). Com espaço, à esquerda entram também o retrato pequeno e os números
//   do modo (na ficha o nível, os PV e a CA; no jogo os PV atuais e a CA); no
//   celular estreito eles não cabem e somem. As abas grudam logo abaixo dela
//   (TabBar `stick`). Vale no celular e no desktop: no desktop costuma não
//   aparecer, porque a página cabe na tela.
//
// FUNÇÕES
//   CompactBar(props): a barra; `character`, `watch` (o elemento que, fora da
//     tela, faz a barra aparecer: a identidade), `slotRef` (onde cada modo põe os
//     números, por portal), `back`, `center`, `end` (os controles, os mesmos do
//     topo da página).
//   CompactStat(props): um número da barra, com o rótulo pequeno (`label`, `value`).
//
// DECISÕES E ARMADILHAS
//   - A barra mora num ÂNCORA de altura zero, sticky no topo do rolador (.main do
//     App): ela fica sempre no alto sem ocupar espaço e sem medir nada; o
//     IntersectionObserver só liga e desliga a classe.
//   - O nome saiu (pedido do dono, DDL-0306): os controles são o que a barra precisa
//     dar à mão; o retrato e os números são o extra, por consulta de contêiner na
//     própria barra (`cbar`), não pela largura da tela.
//   - Os números entram por portal (`compactSlot` da pages/Character): cada modo sabe
//     os seus (o jogo tem os PV atuais, a ficha não).
//   - Escondida, a barra fica `inert`: os controles copiados não recebem foco nem
//     cliques, e o tutorial não os confunde com os do topo.
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import Icon from '../common/Icon';
import styles from './CompactBar.module.css';

/** A barra fina que aparece ao rolar: voltar, Build | Play e menu, e o retrato com os números quando cabem. */
export default function CompactBar({ character, watch, slotRef, back, center, end }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!watch || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setShown(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(watch);
    return () => io.disconnect();
  }, [watch]);
  const toTop = () => watch?.closest('main')?.scrollTo({ top: 0, behavior: 'smooth' });
  return (
    <div className={styles.anchor}>
      <div className={shown ? `${styles.bar} ${styles.on}` : styles.bar} aria-hidden={!shown} inert={!shown}>
        <div className={styles.start}>
          {back}
          <button type="button" className={styles.who} onClick={toTop} title="Back to the top">
            <span className={styles.portrait}>
              {character.meta.portrait ? <img src={character.meta.portrait} alt="" /> : <Icon name="portrait" />}
            </span>
          </button>
          <div ref={slotRef} className={styles.stats} />
        </div>
        <div className={styles.center}>{center}</div>
        <div className={styles.end}>{end}</div>
      </div>
    </div>
  );
}

/** Um número da barra compacta. */
export function CompactStat({ label, value }) {
  return (
    <span className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </span>
  );
}
