// =============================================================================
// gen-parchment: gera o fundo de pergaminho do tema papel no src/decor.css
// =============================================================================
// O QUE FAZ
//   Desenha as camadas do fundo do tema papel e reescreve a regra
//   `:root[data-theme='paper'] body::before` do decor.css (npm run gen:parchment).
//   As bordas laterais são SVG gerados com uma semente fixa: uma faixa gasta de
//   contorno irregular, um filete mais escuro rente à borda, rasgos em fissura,
//   lascas pequenas e ranhuras finas. No meio, manchas grandes e suaves
//   (feTurbulence de baixa frequência) e o grão fino; a vinheta escurece os lados.
//
// FUNÇÕES
//   rng(seed): gerador pseudoaleatório (mulberry32), para o desenho ser estável.
//   f(n): arredonda a uma casa, para o SVG não carregar ruído de ponto flutuante.
//   edge(seed, mirror, k): o SVG de uma borda (a direita, espelhada), com as
//     opacidades escuras multiplicadas por k.
//   enc(svg): o SVG como `url("data:...")` para o CSS.
//   layers(k, vignette, indent): as camadas do `background`.
//   main(): monta a regra e a variante do celular e as grava no lugar das antigas.
//
// DECISÕES E ARMADILHAS
//   - A borda se repete na vertical (repeat-y): o contorno é soma de senos com
//     ciclos INTEIROS na altura do ladrilho e o último ponto copia o primeiro,
//     então a emenda não aparece. As manchas usam `stitchTiles`.
//   - "Velho mas bem mantido" (o pedido): rasgos poucos e curtos, opacidades
//     baixas. Retocar é mudar os números aqui e rodar de novo, nunca editar o
//     data URI à mão.
//   - No celular (até 640px) as bordas saem com 55% da força e a vinheta cai de
//     .18 para .08 (MOBILE_EDGE, MOBILE_VIGNETTE): na tela estreita as duas
//     laterais tomam uma fatia grande da largura e pesavam demais (pedido de
//     2026-10-23). Os fios de luz dos rasgos não mudam: não escurecem nada.
//   - O fundo é a exceção à regra de cor só por token (decor.css): as cores do
//     pergaminho vêm escritas aqui.
// -----------------------------------------------------------------------------

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS = join(import.meta.dirname, '..', 'src', 'decor.css');
const W = 56;
const H = 520;
const INK = '#3e240b';
const BROWN = '#5a3612';
const LIGHT = '#fff8e6';

/** Gerador pseudoaleatório de semente fixa. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uma casa decimal. */
function f(n) {
  return Math.round(n * 10) / 10;
}

/** O SVG de uma borda lateral. */
function edge(seed, mirror, k = 1) {
  const r = rng(seed);
  const o = (v) => Math.round(v * k * 1000) / 1000;
  const ph1 = r() * 6.28;
  const ph2 = r() * 6.28;
  const band = (base, amp) => {
    const pts = [];
    for (let y = 0; y <= H; y += 8) {
      const t = (y / H) * Math.PI * 2;
      const jitter = y === 0 || y === H ? 0 : (r() - 0.5) * 2.2;
      pts.push([base + amp * Math.sin(3 * t + ph1) + amp * 0.5 * Math.sin(7 * t + ph2) + jitter, y]);
    }
    pts[pts.length - 1][0] = pts[0][0];
    return `M0 0${pts.map(([x, y]) => `L${f(x)} ${y}`).join('')}L0 ${H}Z`;
  };
  let g = '';
  g += `<path d='${band(30, 6)}' fill='url(#g)'/>`;
  g += `<path d='${band(7, 2.5)}' fill='${INK}' opacity='${o(0.11)}'/>`;
  for (let i = 0; i < 3; i++) {
    const y = 60 + i * 160 + r() * 80;
    const d = 10 + r() * 10;
    const w = 2.4 + r() * 2.2;
    const k1 = d * (0.35 + r() * 0.15);
    const k2 = d * (0.7 + r() * 0.1);
    const j1 = (r() - 0.5) * 3;
    const j2 = (r() - 0.5) * 3;
    const tip = y + (r() - 0.5) * 4;
    const top = [[0, y - w / 2], [k1, y - w * 0.3 + j1], [k2, y - w * 0.1 + j2], [d, tip]];
    const bot = [[k2, y + w * 0.15 + j2], [k1, y + w * 0.35 + j1], [0, y + w / 2]];
    const pts = [...top, ...bot].map(([x, yy], n) => `${n ? 'L' : 'M'}${f(x)} ${f(yy)}`).join('');
    g += `<path d='${pts}Z' fill='${INK}' opacity='${o(0.3)}'/>`;
    const hl = bot.slice().reverse().map(([x, yy], n) => `${n ? 'L' : 'M'}${f(x)} ${f(yy + 0.7)}`).join('');
    g += `<path d='${hl}' fill='none' stroke='${LIGHT}' stroke-width='.6' opacity='.45'/>`;
  }
  for (let i = 0; i < 7; i++) {
    const y = r() * (H - 10) + 5;
    const d = 2 + r() * 3;
    g += `<path d='M0 ${f(y - 1)}L${f(d)} ${f(y)}L0 ${f(y + 1)}Z' fill='${INK}' opacity='${o(0.24)}'/>`;
  }
  for (let i = 0; i < 8; i++) {
    const x = 4 + r() * 40;
    const y = r() * (H - 30) + 5;
    const len = 8 + r() * 18;
    const dx = (r() - 0.5) * 8;
    const so = o(0.13 + r() * 0.12);
    g += `<path d='M${f(x)} ${f(y)}l${f(dx)} ${f(len)}' stroke='${BROWN}' stroke-width='.6' stroke-linecap='round' opacity='${so}'/>`;
    if (r() < 0.5) {
      g += `<path d='M${f(x + 0.8)} ${f(y)}l${f(dx)} ${f(len)}' stroke='${LIGHT}' stroke-width='.5' stroke-linecap='round' opacity='.3'/>`;
    }
  }
  const defs = `<defs><linearGradient id='g'><stop offset='0' stop-color='${BROWN}' stop-opacity='${o(0.2)}'/><stop offset='1' stop-color='${BROWN}' stop-opacity='0'/></linearGradient></defs>`;
  const body = mirror ? `<g transform='translate(${W} 0) scale(-1 1)'>${g}</g>` : g;
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'>${defs}${body}</svg>`;
}

/** O SVG como url() de CSS. */
function enc(svg) {
  const data = svg.replace(/%/g, '%25').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23').replace(/"/g, '%22');
  return `url("data:image/svg+xml,${data}")`;
}

const MOTTLE = "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='640'><filter id='m' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.006' numOctaves='4' seed='11' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .38 0 0 0 0 .24 0 0 0 0 .09 .62 0 0 0 -.255'/></filter><rect width='100%' height='100%' filter='url(#m)'/></svg>";
const SELECTOR = ":root[data-theme='paper'] body::before";
const MOBILE = '@media (max-width: 640px)';
const MOBILE_EDGE = 0.55;
const MOBILE_VIGNETTE = 0.08;
const GRAIN = "<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .36 0 0 0 0 .24 0 0 0 0 .1 .2 0 0 0 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>";

/** As camadas do fundo, com a intensidade das bordas e da vinheta. */
function layers(k, vignette, indent) {
  return [
    `${indent}background:`,
    `${indent}  ${enc(edge(41, false, k))} left top / ${W}px ${H}px repeat-y,`,
    `${indent}  ${enc(edge(97, true, k))} right top / ${W}px ${H}px repeat-y,`,
    `${indent}  radial-gradient(ellipse 75% 120% at 50% 50%, transparent 60%, rgba(110, 70, 25, ${vignette}) 100%),`,
    `${indent}  ${enc(MOTTLE)},`,
    `${indent}  ${enc(GRAIN)};`,
  ];
}

/** Monta a regra (e a variante do celular) e a grava no decor.css. */
function main() {
  const block = [
    `${SELECTOR} {`,
    ...layers(1, 0.18, '  '),
    '}',
    '',
    `${MOBILE} {`,
    `  ${SELECTOR} {`,
    ...layers(MOBILE_EDGE, MOBILE_VIGNETTE, '    '),
    '  }',
    '}',
  ];
  let css = readFileSync(CSS, 'utf8');
  const eol = css.includes('\r\n') ? '\r\n' : '\n';
  const start = css.indexOf(`${SELECTOR} {`);
  if (start < 0) throw new Error('regra do tema papel não encontrada no decor.css');
  let end = css.indexOf('}', start) + 1;
  if (css.slice(end).trimStart().startsWith(`${MOBILE} {`)) {
    const inner = css.indexOf(`${eol}  }`, css.indexOf(`${MOBILE} {`, end));
    end = css.indexOf(`${eol}}`, inner + 1) + eol.length + 1;
  }
  css = css.slice(0, start) + block.join(eol) + css.slice(end);
  writeFileSync(CSS, css);
  console.log('decor.css: fundo de pergaminho gravado');
}

main();
