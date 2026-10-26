// =============================================================================
// CloseButton: o botão de fechar padrão do app
// =============================================================================
// O QUE FAZ
//   O X de toda camada que fecha. Duas formas, por contexto (docs/UI-PATTERNS.md):
//   `plain` (padrão) nos diálogos, painéis e folhas de info, sem borda nem fundo,
//   com realce de accent ao passar; `floating` sobre mídia em tela cheia (o
//   visualizador de imagem, do retrato, a tabela ampliada), redondo, com fundo e
//   borda para se ver sobre qualquer imagem.
//
// FUNÇÕES
//   CloseButton(props): o botão.
//
// DECISÕES E ARMADILHAS
//   - O componente NÃO se posiciona: quem o usa decide (no fluxo de um cabeçalho
//     flex, ou `position: absolute` pelo `className`). Antes cada tela tinha o seu
//     X, com cinco tamanhos, dois raios e três realces diferentes (DDL-0129).
// -----------------------------------------------------------------------------

import Icon from './Icon';
import styles from './CloseButton.module.css';

/**
 * O X padrão. `variant`: 'plain' (diálogos e painéis) ou 'floating' (sobre mídia).
 * @param {{ onClick: () => void, variant?: 'plain'|'floating', label?: string, className?: string }} props
 */
export default function CloseButton({ onClick, variant = 'plain', label = 'Close', className }) {
  const cls = [styles.close, variant === 'floating' ? styles.floating : styles.plain, className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={cls} onClick={onClick} aria-label={label} title={label}>
      <Icon name="close" />
    </button>
  );
}
