// =============================================================================
// PanelFoot: o rodapé dos painéis abertos numa janela
// =============================================================================
// O QUE FAZ
//   Os botões de um painel (Hurt, Heal, Cast, Use, Roll, o descanso curto, o PDF)
//   na receita comum do rodapé (DDL-0303, fase U2 do docs/UI-STUDY.md): presos ao
//   pé da janela mesmo com o corpo rolando, dividindo a largura, o principal por
//   último à direita, com a divisória em cima. É o mesmo desenho do rodapé da
//   moldura de preview (PreviewShell), para um painel que traz os próprios botões
//   dentro do <form> (o Enter envia).
//
// FUNÇÕES
//   PanelFoot(props): o rodapé; `children` são os Button.
//
// DECISÕES E ARMADILHAS
//   - Fica DENTRO do corpo que rola, com position: sticky no pé e margens
//     negativas iguais ao respiro do corpo (PreviewShell.module.css .body): assim
//     o <form> do painel continua um só e o submit segue funcionando.
// -----------------------------------------------------------------------------

import styles from './PanelFoot.module.css';

/** O rodapé fixo de um painel: botões dividindo a largura. */
export default function PanelFoot({ children }) {
  return <div className={styles.foot}>{children}</div>;
}
