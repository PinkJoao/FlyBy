// =============================================================================
// Button: o botão de ação padrão do app
// =============================================================================
// O QUE FAZ
//   Os botões de ação das telas novas, nas variantes que os diálogos (DialogHost)
//   já usavam: `default` (neutro), `primary` (a ação principal: BORDA accent,
//   fundo neutro, nunca preenchido), `danger` e `link` (texto accent sublinhado,
//   para ações secundárias leves como "See all" e "Reset"). Tamanhos `md` e `sm`;
//   `block` ocupa a linha.
//
// FUNÇÕES
//   Button(props): o botão; repassa o resto das props ao <button>.
//
// DECISÕES E ARMADILHAS
//   - Accent PREENCHIDO é de indicador (pontinho, barra de progresso, marca de
//     toggle), não de botão: o "Done" do seletor de tags e o "Export" do PDF eram as
//     exceções e foram trazidos ao padrão (DDL-0129).
// -----------------------------------------------------------------------------

import styles from './Button.module.css';

/**
 * O botão padrão.
 * @param {{ variant?: 'default'|'primary'|'danger'|'link', size?: 'sm'|'md', block?: boolean, className?: string, type?: string }} props
 */
export default function Button({ variant = 'default', size = 'md', block = false, className, type = 'button', ...rest }) {
  const cls = [styles.btn, styles[variant], size === 'sm' ? styles.sm : null, block ? styles.block : null, className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={cls} {...rest} />;
}
