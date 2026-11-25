// =============================================================================
// Button: o botão de ação padrão do app
// =============================================================================
// O QUE FAZ
//   Os botões de ação das telas novas, nas variantes que os diálogos (DialogHost)
//   já usavam: `default` (neutro), `primary` (a ação principal: BORDA accent,
//   fundo neutro, nunca preenchido), `danger` e `link` (texto accent sublinhado,
//   para ações secundárias leves como "See all" e "Reset"). Tamanhos `md` (40 px),
//   `sm` (34, as barras densas), `xs` (30, dentro de uma linha de lista) e `lg` (46, o
//   rodapé do guia); `block` ocupa a linha; `icon` é o botão só de ícone, um QUADRADO
//   da altura do tamanho; `onPage` é o botão solto na página, com o fundo da busca e do
//   alternador ao lado (--bg-soft; num card ou numa janela, o padrão é --bg).
//
// FUNÇÕES
//   Button(props): o botão; repassa o resto das props ao <button>.
//
// DECISÕES E ARMADILHAS
//   - Accent PREENCHIDO é de indicador (pontinho, barra de progresso, marca de
//     toggle), não de botão: o "Done" do seletor de tags e o "Export" do PDF eram as
//     exceções e foram trazidos ao padrão (DDL-0129).
//   - `icon` (DDL-0313, P10 do docs/UI-STUDY.md) substitui nove cópias à mão do mesmo
//     quadrado (menu, voltar, ordenar, guia, sair do guia, desfazer, refazer, limpar, o
//     do campo de roleplay): borda, fundo --bg-soft, raio 10 e o glifo de 18 px. As
//     classes saem de buttonClass.js, que quem desenha o próprio <button> também usa.
//   - O tamanho é sempre `size`, nunca uma classe com width e height: o min-height da
//     base vence, e o ordenar do seletor ficou 34 x 40 (DDL-0317).
// -----------------------------------------------------------------------------

import { buttonClass } from './buttonClass';

/**
 * O botão padrão.
 * @param {{ variant?: 'default'|'primary'|'danger'|'link', size?: 'xs'|'sm'|'md'|'lg', block?: boolean, icon?: boolean, onPage?: boolean, className?: string, type?: string }} props
 */
export default function Button({ variant = 'default', size = 'md', block = false, icon = false, onPage = false, className, type = 'button', ...rest }) {
  return <button type={type} className={buttonClass({ variant, size, block, icon, onPage, className })} {...rest} />;
}
