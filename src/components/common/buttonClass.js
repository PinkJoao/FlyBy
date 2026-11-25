// =============================================================================
// buttonClass: as classes do botão padrão, para quem desenha o próprio <button>
// =============================================================================
// O QUE FAZ
//   Monta as classes do Button (Button.module.css) a partir das mesmas opções do
//   componente. O Button usa; o MenuButton recebe o resultado em `buttonClassName`
//   (o menu do topo, o menu da lista, o ordenar), e quem precisa de um <a> ou de um
//   <button> com ref própria (o voltar) também.
//
// FUNÇÕES
//   buttonClass(opts): `variant`, `size`, `block`, `icon` e `className`.
//
// DECISÕES E ARMADILHAS
//   - Mora fora do Button.jsx: o arquivo de um componente só exporta componentes,
//     senão o fast refresh do Vite recarrega a página inteira.
// -----------------------------------------------------------------------------

import styles from './Button.module.css';

/**
 * As classes de um botão.
 * @param {{ variant?: 'default'|'primary'|'danger'|'link', size?: 'sm'|'md', block?: boolean, icon?: boolean, className?: string }} [opts]
 */
export function buttonClass({ variant = 'default', size = 'md', block = false, icon = false, className } = {}) {
  return [styles.btn, styles[variant], size === 'sm' ? styles.sm : null, icon ? styles.icon : null, block ? styles.block : null, className]
    .filter(Boolean)
    .join(' ');
}
