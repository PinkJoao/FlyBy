// =============================================================================
// theme: os dois visuais da ficha PDF (branco e pergaminho)
// =============================================================================
// O QUE FAZ
//   As cores e as famílias de fonte da ficha. Os dois visuais diferem SÓ no
//   fundo e nos tons que acompanham o papel: a tipografia (Cinzel nos títulos,
//   Alegreya no texto) e o vermelho dos destaques são os mesmos (DDL-0105).
//
// FUNÇÕES
//   themeFor(id): o tema pelo id, com o branco como reserva.
//
// DECISÕES E ARMADILHAS
//   - O vermelho é um tom nosso, escuro, que imprime bem nos dois fundos; nada
//     de logo, arte ou marca (DDL-0003).
//   - `edge` é a cor da borda envelhecida do pergaminho; no branco ela é a do
//     papel e a borda some.
// -----------------------------------------------------------------------------

export const FONTS = { title: 'Cinzel', body: 'Alegreya' };

export const THEMES = {
  white: {
    id: 'white',
    page: '#ffffff',
    edge: '#ffffff',
    ink: '#1f1a16',
    muted: '#6d6259',
    red: '#8e1b1b',
    redSoft: '#f4e4e1',
    rule: '#cdb7ab',
    panel: '#faf5f0',
    stripe: '#f6eee8',
    box: '#ffffff',
  },
  parchment: {
    id: 'parchment',
    page: '#f5ead0',
    edge: '#d6b47c',
    ink: '#2a1c10',
    muted: '#6f5a40',
    red: '#7d1a17',
    redSoft: '#ead2b4',
    rule: '#b8955e',
    panel: '#eedcb6',
    stripe: '#ead7ae',
    box: '#f8eed6',
  },
};

/** O tema pelo id, com o branco como reserva. */
export function themeFor(id) {
  return THEMES[id] ?? THEMES.white;
}
