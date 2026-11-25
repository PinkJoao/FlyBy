// =============================================================================
// diceTray: a bandeja de dados (todos os dados de uma rolagem), em canvas 2D
// =============================================================================
// O QUE FAZ
//   A fase D2 dos dados (docs/PLAY-MODE-V2-PLAN.md §2, DDL-0153, refeita no
//   DDL-0157): os dados caem numa grade no centro da tela e cada um gira no lugar,
//   desacelera e para EXATO na face do valor que o engine já sorteou, como o d20 em
//   destaque. Desenhados com geometry.js.
//
// FUNÇÕES
//   traySize(count, w, h): o raio de cada dado na tela, pela grade.
//   gridOf(count, w, h): as colunas, as linhas e o lado da célula.
//   createTray(canvas, dice, colors, hooks): a bandeja; devolve { start, finish,
//     stop }. `hooks.onLand(i)` avisa quando o dado i para (o som do toque).
//   drawToken(ctx, body, colors): o dado sem sólido (d2, d3) como ficha.
//
// DECISÕES E ARMADILHAS
//   - Giro no lugar, não física (pedido do dono, 2026-11-07): na versão com física o
//     dado deslizava, parava e então girava até a face sorteada, e esse ajuste final
//     parecia o app trocando o resultado. Agora a orientação final faz parte do
//     próprio giro (a mesma conta do d20Canvas: voltas em torno de um eixo aleatório
//     que se anulam enquanto a interpolação chega à face), então o dado nunca
//     "corrige" nada.
//   - Cada dado entra caindo (cresce de cima e assenta com um quique curto) e para num
//     tempo próprio, escalonado, para não pararem todos juntos. O último para em até
//     uns 2 s.
//   - O número para em pé (sem giro em z no fim), legível como no d20.
//   - Tempo pelo relógio (performance.now): o quadro lento só pula etapas; a bandeja
//     dura o mesmo em qualquer aparelho (o painel do app chegou a dar 1 quadro a cada
//     2 s, DDL-0153).
//   - O dado descartado (manter maior ou menor) esmaece quando para.
// -----------------------------------------------------------------------------

import { dieQuat, drawDie, makeDie, quatAxis, quatMul, quatSlerp } from './geometry';
import { easeOut } from './d20Canvas';

const DROP_MS = 260;

/** A grade: colunas e linhas pelo formato da área, e o lado da célula. */
export function gridOf(count, w, h) {
  const cols = Math.max(1, Math.min(count, Math.round(Math.sqrt((count * w) / Math.max(1, h))) || 1));
  const rows = Math.ceil(count / cols);
  return { cols, rows, cell: Math.min(w / cols, h / rows) };
}

/** O raio de cada dado na tela: o que cabe na célula, com teto. */
export function traySize(count, w, h) {
  return Math.max(14, Math.min(60, gridOf(count, w, h).cell * 0.36));
}

/** O dado sem sólido como uma ficha redonda com o número. */
function drawToken(ctx, body, colors) {
  ctx.save();
  ctx.globalAlpha = body.alpha;
  ctx.beginPath();
  ctx.arc(body.x, body.y, body.r * 0.8 * body.scale, 0, Math.PI * 2);
  ctx.fillStyle = colors.face;
  ctx.fill();
  ctx.strokeStyle = colors.edge;
  ctx.stroke();
  ctx.fillStyle = colors.text;
  ctx.font = `700 ${Math.round(body.r * 0.7)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(body.value), body.x, body.y + 1);
  ctx.restore();
}

/**
 * A bandeja. `dice`: [{ sides, value, kept, mode?, token? }]; `colors`: { face, edge, text }.
 * @returns {{ start: () => Promise<void>, finish: Function, stop: Function }}
 */
export function createTray(canvas, dice, colors, hooks = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = globalThis.devicePixelRatio || 1;
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const { cols, rows, cell } = gridOf(dice.length, w, h);
  const r = traySize(dice.length, w, h);
  const rand = Math.random;
  const stagger = dice.length > 1 ? Math.min(110, 700 / (dice.length - 1)) : 0;
  const bodies = dice.map((d, i) => {
    const die = d.token ? null : makeDie(d.sides, d.mode);
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? dice.length - row * cols : cols;
    const col = i - row * cols;
    return {
      ...d,
      die,
      r,
      x: w / 2 + (col - (inRow - 1) / 2) * cell,
      y: h / 2 + (row - (rows - 1) / 2) * cell,
      delay: i * stagger,
      ms: 1000 + rand() * 250,
      from: quatAxis([rand() - 0.5, rand() - 0.5, rand() - 0.5], rand() * Math.PI * 2),
      to: die ? dieQuat(die, d.value) : null,
      axis: [rand() - 0.5, rand() - 0.5, rand() - 0.5],
      turns: (2.5 + rand() * 1.5) * Math.PI * 2,
      q: null,
      scale: 0,
      lift: 0,
      alpha: 1,
      done: false,
    };
  });
  let frame = 0;
  let resolve = null;
  let began = 0;

  const land = (b, i) => {
    if (b.done) return;
    b.done = true;
    b.q = b.to;
    b.scale = 1;
    b.lift = 0;
    if (!b.kept) b.alpha = 0.35;
    hooks.onLand?.(i);
  };

  const pose = (b, i, now) => {
    if (b.done) return;
    const t = now - began - b.delay;
    if (t < 0) {
      b.scale = 0;
      return;
    }
    const drop = Math.min(1, t / DROP_MS);
    b.scale = drop < 1 ? 1.35 - 0.35 * easeOut(drop) : 1;
    b.lift = (1 - easeOut(drop)) * 1.2 + 0.25 * Math.exp(-t / 260) * Math.abs(Math.sin(t / 70));
    const s = Math.min(1, t / b.ms);
    const e = easeOut(s);
    if (b.die) b.q = quatMul(quatAxis(b.axis, (1 - e) * b.turns), quatSlerp(b.from, b.to, e));
    if (s >= 1) land(b, i);
  };

  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const b of bodies) {
      if (!b.scale) continue;
      const off = b.lift * b.r * 0.45;
      ctx.beginPath();
      ctx.ellipse(b.x + off * 0.5, b.y + b.r * 0.15 + off, b.r * 0.85, b.r * 0.62, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${(0.26 * b.alpha * Math.min(1, b.scale)).toFixed(3)})`;
      ctx.fill();
    }
    for (const b of bodies) {
      if (!b.scale) continue;
      if (!b.die) {
        drawToken(ctx, b, colors);
        continue;
      }
      drawDie(ctx, b.die, b.q ?? b.from, { cx: b.x, cy: b.y - b.lift * b.r * 0.3, size: b.r * b.scale, colors, alpha: b.alpha });
    }
  };

  const stop = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };

  const end = () => {
    stop();
    draw();
    const done = resolve;
    resolve = null;
    done?.();
  };

  const finish = () => {
    bodies.forEach((b, i) => land(b, i));
    end();
  };

  const tick = (now) => {
    if (!began) began = now;
    bodies.forEach((b, i) => pose(b, i, now));
    draw();
    if (bodies.every((b) => b.done)) end();
    else frame = requestAnimationFrame(tick);
  };

  const start = () =>
    new Promise((res) => {
      resolve = res;
      frame = requestAnimationFrame(tick);
    });

  return { start, finish, stop };
}
