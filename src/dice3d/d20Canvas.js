// =============================================================================
// d20Canvas: o d20 em destaque, em 3D desenhado num canvas 2D (sem WebGL)
// =============================================================================
// O QUE FAZ
//   O d20 grande da fase D1 (DDL-0152): o sólido e o desenho vêm de geometry.js;
//   aqui fica a rolagem sem física, que tomba o dado e o faz parar exato na face
//   pedida (o engine decide o número; o dado só encena, docs/PLAY-MODE-V2-PLAN.md §2).
//
// FUNÇÕES
//   createD20(canvas, colors): o dado num canvas; devolve { draw, spinTo, finish,
//     stop, setTint, die }: finish pula a rolagem em curso direto para a face final.
//   easeOut(t): a curva de desaceleração da rolagem.
//
// DECISÕES E ARMADILHAS
//   - Canvas 2D e não three.js (medido em DDL-0152): o pedaço do three.js com um
//     d20 só passa de 120 KB comprimido e o WebGL custa memória de GPU e compilar
//     shader na primeira rolagem; 20 triângulos com a conta feita aqui cabem em
//     poucos KB e num quadro de fração de milissegundo.
//   - A rolagem soma à interpolação da orientação final umas voltas em torno de um
//     eixo aleatório que se anulam no fim: o dado tomba, desacelera e para EXATO na
//     face sorteada, de pé.
//   - O canvas é desenhado na resolução do aparelho (devicePixelRatio), ou o número
//     fica borrado no celular. O tamanho (0,42 do lado menor, em raios) cabe o dado
//     inteiro com a perspectiva aumentando o vértice da frente.
// -----------------------------------------------------------------------------

import { drawDie, dieQuat, makeDie, quatAxis, quatMul, quatSlerp } from './geometry';

/** A desaceleração da rolagem (rápida no começo, parando devagar). */
export function easeOut(t) {
  return 1 - (1 - t) ** 3;
}

/**
 * O d20 num canvas. `colors`: { face, edge, text } em CSS.
 * @returns {{ draw: Function, spinTo: (n: number, ms?: number) => Promise<void>, finish: Function, stop: Function, setTint: Function, die: object }}
 */
export function createD20(canvas, colors) {
  const die = makeDie(20);
  const ctx = canvas.getContext('2d');
  let q = quatAxis([1, 1, 0], 0.6);
  let frame = 0;
  let tint = null;
  let pending = null;

  const draw = () => {
    const dpr = globalThis.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
    if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawDie(ctx, die, q, { cx: w / 2, cy: h / 2, size: Math.min(w, h) * 0.42, colors, tint });
  };

  const stop = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };

  const finish = () => {
    if (!pending) return;
    stop();
    q = pending.target;
    draw();
    const done = pending.resolve;
    pending = null;
    done();
  };

  const spinTo = (number, ms = 1400) => {
    finish();
    const start = q;
    const target = dieQuat(die, number);
    const axis = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5];
    const turns = (3 + Math.random() * 2) * Math.PI * 2;
    const t0 = performance.now();
    return new Promise((resolve) => {
      pending = { target, resolve };
      const tick = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        const e = easeOut(t);
        q = quatMul(quatAxis(axis, (1 - e) * turns), quatSlerp(start, target, e));
        draw();
        if (t < 1) frame = requestAnimationFrame(tick);
        else {
          frame = 0;
          pending = null;
          resolve();
        }
      };
      frame = requestAnimationFrame(tick);
    });
  };

  return {
    die,
    draw,
    spinTo,
    finish,
    stop,
    setTint: (c) => {
      tint = c;
      draw();
    },
  };
}
