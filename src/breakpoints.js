// =============================================================================
// breakpoints: as larguras em que o app muda de layout
// =============================================================================
// O QUE FAZ
//   Os números de corte que o JS consulta (useMediaQuery) e que o CSS repete à
//   mão, porque var() não vale dentro de @media (DDL-0303, fase U1).
//
// FUNÇÕES
//   NARROW: até 560 px, o celular estreito (a identidade empilhada e centrada, as
//     grades de 2 colunas, o respiro menor).
//   PHONE: até 760 px, o celular (gavetas, linha única do seletor, painéis em tela
//     cheia, os cards do topo da ficha em 2 por linha); o CSS usa `min-width: 761px`
//     para o lado de cima.
//   DESKTOP: a partir de 1024 px (o corpo do texto sobe de 16 para 18 px; o CSS usa
//     `max-width: 1023px` para o lado de baixo).
//   WIDE: a partir de 1140 px (o histórico vira coluna ao lado).
//   HISTORY: a partir de 1560 px (a coluna do histórico deixa de deslocar a página).
//   NARROW_QUERY, PHONE_QUERY, WIDE_QUERY: as media queries prontas.
//
// DECISÕES E ARMADILHAS
//   - O CSS usa SÓ estes cortes (DDL-0313): os intermediários (540, 620, 640, 699,
//     700) foram para o mais próximo do mesmo papel (540 para 560; os outros para
//     760). Um corte novo entra aqui antes de entrar num CSS.
// -----------------------------------------------------------------------------

export const NARROW = 560;
export const PHONE = 760;
export const DESKTOP = 1024;
export const WIDE = 1140;
export const HISTORY = 1560;
export const NARROW_QUERY = `(max-width: ${NARROW}px)`;
export const PHONE_QUERY = `(max-width: ${PHONE}px)`;
export const WIDE_QUERY = `(min-width: ${WIDE}px)`;
