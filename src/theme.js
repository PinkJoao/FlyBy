// =============================================================================
// theme: o tema da interface (escuro, claro ou papel) e a escolha "do aparelho"
// =============================================================================
// O QUE FAZ
//   A escolha do usuário mora no settingsStore ('system', 'dark', 'light' ou
//   'paper'). Este módulo a resolve para um tema concreto e o aplica como
//   `data-theme` no <html>, onde o index.css troca a paleta inteira; também
//   acerta a cor da barra do sistema (`<meta name="theme-color">`). Com
//   'system', segue o prefers-color-scheme e acompanha a troca ao vivo.
//
// FUNÇÕES
//   resolveTheme(choice, prefersDark): o tema concreto de uma escolha.
//   prefersDarkNow(): o aparelho está no modo escuro?
//   applyTheme(choice): põe o tema resolvido no documento.
//   watchSystemTheme(getChoice): reaplica quando o modo do aparelho muda e a
//     escolha é 'system'; devolve a função que para de ouvir.
//
// DECISÕES E ARMADILHAS
//   - O index.html aplica o tema num script INLINE no <head>, antes do primeiro
//     pintar: o main.jsx é módulo (adiado) e o usuário do tema escuro veria um
//     clarão branco a cada abertura. Ele repete resolveTheme em poucas linhas;
//     mudar a chave do settingsStore ou os nomes dos temas exige mudar lá também.
//   - O tema é sempre um `data-theme` explícito, nunca a media query no CSS: assim
//     a paleta escura existe UMA vez só no index.css, e o 'system' é decidido aqui.
//   - THEME_BAR é a cor da barra do sistema por tema, igual ao --bg de cada um.
// -----------------------------------------------------------------------------

export const THEME_CHOICES = [
  { value: 'system', label: 'Match the device' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'paper', label: 'Parchment' },
];

const THEMES = new Set(['dark', 'light', 'paper']);

const THEME_BAR = { dark: '#16171d', light: '#ffffff', paper: '#f3e8d0' };

/** O tema concreto de uma escolha; 'system' e o desconhecido seguem o aparelho. */
export function resolveTheme(choice, prefersDark) {
  if (THEMES.has(choice)) return choice;
  return prefersDark ? 'dark' : 'light';
}

/** O aparelho está no modo escuro? */
export function prefersDarkNow() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return true;
  }
}

/** Põe o tema resolvido no documento e na barra do sistema. */
export function applyTheme(choice) {
  if (typeof document === 'undefined') return;
  const theme = resolveTheme(choice, prefersDarkNow());
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BAR[theme]);
}

/** Reaplica quando o modo do aparelho muda e a escolha é 'system'. */
export function watchSystemTheme(getChoice) {
  let media;
  try {
    media = window.matchMedia('(prefers-color-scheme: dark)');
  } catch {
    return () => {};
  }
  const onChange = () => {
    if (getChoice() === 'system') applyTheme('system');
  };
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
