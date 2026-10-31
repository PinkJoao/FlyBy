// =============================================================================
// PortraitSearchLinks: "Search more on" embaixo das sugestões de retrato
// =============================================================================
// O QUE FAZ
//   A busca guiada (DDL-0137, fase 0): uma linha discreta com os sites de arte, cada
//   um já aberto na busca montada pela ficha (espécie, classe, gênero). No
//   computador abre numa janela ao lado, para arrastar a imagem de volta para o
//   campo de URL; no celular abre numa aba, e o jogador cola a imagem ou o link do
//   post do Reddit (o app acha a imagem e o autor).
//
// FUNÇÕES
//   openSearch(url): abre a busca numa janela ao lado ou numa aba.
//   PortraitSearchLinks(props): a linha com os sites.
//
// DECISÕES E ARMADILHAS
//   - Botões `link` pequenos, sem caixa: a faixa e a galeria continuam com o visual
//     de antes, a linha só aparece embaixo delas.
//   - Janela ao lado só com ponteiro fino e tela larga (900px ou mais); `noopener`
//     sempre, o site aberto não alcança o app.
// -----------------------------------------------------------------------------

import { PORTRAIT_SEARCH_SITES } from '../../engine/portraitSearch';
import Button from './Button';
import Icon from './Icon';
import styles from './PortraitSearchLinks.module.css';

/** Abre a busca: janela na metade direita no computador, aba no celular. */
function openSearch(url) {
  const wide = window.matchMedia?.('(pointer: fine)').matches && window.screen.availWidth >= 900;
  if (!wide) {
    window.open(url, '_blank', 'noopener');
    return;
  }
  const w = Math.round(window.screen.availWidth / 2);
  const h = window.screen.availHeight;
  window.open(url, 'flyby-art-search', `popup,noopener,width=${w},height=${h},left=${w},top=0`);
}

/**
 * A linha de busca guiada.
 * @param {{ tags: string[] }} props as tags da ficha (as mesmas das sugestões)
 */
export default function PortraitSearchLinks({ tags }) {
  return (
    <div className={styles.links}>
      <span className={styles.label}>
        <Icon name="search" />
        Search more on
      </span>
      {PORTRAIT_SEARCH_SITES.map((site) => (
        <Button key={site.id} variant="link" size="sm" onClick={() => openSearch(site.urlFor(tags))}>
          {site.label}
        </Button>
      ))}
    </div>
  );
}
