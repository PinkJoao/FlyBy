// =============================================================================
// CompactBar: o topo compacto da página do personagem
// =============================================================================
// O QUE FAZ
//   Quando o topo da página (voltar, Build | Play, guia, menu) sai da tela ao rolar,
//   uma barra fina desce do alto com os MESMOS controles: voltar à esquerda, o
//   alternador Build | Play no centro, o guia (quando ativo) e o menu à direita
//   (DDL-0306, DDL-0331). Quando a identidade também sai, à esquerda entram o retrato
//   pequeno e os números do modo (na ficha o nível, os PV e a CA; no jogo os PV atuais
//   e a CA), se couberem; no celular estreito eles não cabem e somem. As abas grudam logo abaixo dela
//   (TabBar `stick`). Vale no celular e no desktop: no desktop costuma não
//   aparecer, porque a página cabe na tela.
//
// FUNÇÕES
//   CompactBar(props): a barra; `character`, `watch` (o topo da página: fora da
//     tela, a barra está toda à vista e clicável), `detail` (a identidade: fora da
//     tela, o retrato e os números aparecem), `slotRef` (onde cada modo põe os
//     números, por portal), `back`, `center`, `end` (os controles, os mesmos do
//     topo da página).
//   useGone(el): se o elemento já saiu da tela por cima (IntersectionObserver).
//   CompactStat(props): um número da barra, com o rótulo pequeno (`label`, `value`).
//
// DECISÕES E ARMADILHAS
//   - A barra mora num ÂNCORA de altura zero, sticky no topo do rolador (.main do
//     App): ela fica sempre no alto sem ocupar espaço e sem medir nada.
//   - A ENTRADA segue a rolagem (DDL-0331): a barra desce na mesma medida em que o topo
//     da página sai (a linha do tempo `--flyby-top`, um view-timeline que a
//     pages/Character põe no topo), sem o vão de antes, quando ela só vinha depois da
//     identidade inteira sair. O IntersectionObserver só decide o `inert` e os cliques
//     (a barra inteira à vista) e o retrato com os números (a identidade fora). Sem
//     linha do tempo de rolagem (Firefox) ou com "reduzir movimento", a classe .on
//     liga a barra com a transição de antes.
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
export default function CompactBar({ character, watch, detail, slotRef, back, center, end }) {
  const shown = useGone(watch);
  const full = useGone(detail);
  const toTop = () => watch?.closest('main')?.scrollTo({ top: 0, behavior: 'smooth' });
  return (
    <div className={styles.anchor}>
      <div className={[styles.bar, shown && styles.on, full && styles.full].filter(Boolean).join(' ')} aria-hidden={!shown} inert={!shown}>
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

/** Se o elemento já saiu da tela por cima. */
function useGone(el) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setGone(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  return gone;
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
