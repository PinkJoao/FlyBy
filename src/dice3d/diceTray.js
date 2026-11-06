// =============================================================================
// diceTray: a bandeja de dados (todos os dados de uma rolagem), em canvas 2D
// =============================================================================
// O QUE FAZ
//   A fase D2 dos dados (docs/PLAY-MODE-V2-PLAN.md §2, DDL-0153): os dados entram
//   pela borda de baixo da tela, quicam no ar, batem nas bordas e uns nos outros,
//   rolam conforme deslizam e assentam cada um na face do valor que o engine já
//   sorteou. Desenhados com geometry.js (o mesmo dos d20 em destaque).
//
// FUNÇÕES
//   traySize(count, w, h): o raio de cada dado na tela, pelo número de dados.
//   createTray(canvas, dice, colors): a bandeja; devolve { start, finish, stop }.
//   drawToken(ctx, body, colors): o dado sem sólido (d2, d3, d100 inteiro) como ficha.
//
// DECISÕES E ARMADILHAS
//   - Física SIMPLES no plano da mesa (posição, velocidade, atrito, quique nas
//     bordas, choque entre dados de massa igual), e o giro do dado vem do rolar
//     (eixo perpendicular ao movimento) mais um tombo inicial que some. Não é motor
//     de corpo rígido: no fim, cada dado interpola até a face sorteada, girando em z
//     só o necessário (twistToward), então ele não rodopia ao parar.
//   - O quique é uma altura fingida (o dado cresce e a sombra se afasta), que decai
//     rápido: dá a queda sem simular o eixo vertical.
//   - Tempo pelo RELÓGIO, em passos de 1/120 s (STEP_S): o quadro lento faz mais
//     passos, então a bandeja dura o mesmo em qualquer aparelho e o dado não
//     atravessa a borda. Limitar o dt por quadro (a primeira versão) deixava a
//     bandeja em câmera lenta quando o navegador espaçava os quadros (medido: 2 s
//     entre quadros no painel do app). E LIMIT_MS fecha a conta pelo relógio de
//     verdade: passou dele, todo dado vai direto à face final.
//   - Pular (finish) ADIANTA a simulação (até FAST_STEPS passos, instantâneo) antes
//     de fixar as faces: fixar na hora deixava os dados que ainda não tinham entrado
//     empilhados na borda de baixo.
//   - O dado descartado (manter maior ou menor) esmaece depois de assentar.
// -----------------------------------------------------------------------------

import { dieQuat, drawDie, makeDie, quatAxis, quatMul, quatSlerp, twistToward } from './geometry';
import { easeOut } from './d20Canvas';

const SETTLE_S = 0.35;
const MAX_S = 2.2;
const STEP_S = 1 / 120;
const LIMIT_MS = 2600;
const FAST_STEPS = 480;

/** O raio de cada dado na tela: menor quando são muitos. */
export function traySize(count, w, h) {
  const base = Math.min(46, Math.max(24, Math.min(w, h) / 8));
  return Math.max(16, count > 6 ? base * Math.sqrt(6 / count) : base);
}

/** O dado sem sólido como uma ficha redonda com o número. */
function drawToken(ctx, body, colors) {
  ctx.save();
  ctx.globalAlpha = body.alpha;
  ctx.beginPath();
  ctx.arc(body.x, body.y, body.r * 0.8, 0, Math.PI * 2);
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
export function createTray(canvas, dice, colors) {
  const ctx = canvas.getContext('2d');
  const dpr = globalThis.devicePixelRatio || 1;
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const r = traySize(dice.length, w, h);
  const rand = Math.random;
  const bodies = dice.map((d, i) => {
    const die = d.token ? null : makeDie(d.sides, d.mode);
    return {
      ...d,
      die,
      r,
      x: w * (0.25 + 0.5 * rand()),
      y: h + r * (1 + i * 0.5),
      vx: (rand() - 0.5) * w * 1.2,
      vy: -(h * (1.25 + rand() * 0.45)),
      q: quatAxis([rand() - 0.5, rand() - 0.5, rand() - 0.5], rand() * Math.PI * 2),
      tumble: [rand() - 0.5, rand() - 0.5, rand() - 0.5],
      phase: rand() * Math.PI,
      entered: false,
      settling: null,
      done: false,
      alpha: 1,
      hop: 0,
    };
  });
  let frame = 0;
  let resolve = null;
  let last = 0;
  let began = 0;
  let t = 0;

  const settle = (b) => {
    if (b.settling || !b.die) return;
    b.settling = { from: b.q, to: dieQuat(b.die, b.value, twistToward(b.die, b.value, b.q)), s: 0 };
  };

  const step = (dt) => {
    t += dt;
    for (const b of bodies) {
      if (b.done) continue;
      const friction = Math.exp(-(b.settling ? 9 : 1.9) * dt);
      b.vx *= friction;
      b.vy *= friction;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < h - b.r) b.entered = true;
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.6; }
      if (b.x > w - b.r) { b.x = w - b.r; b.vx = -Math.abs(b.vx) * 0.6; }
      if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * 0.6; }
      if (b.entered && b.y > h - b.r) { b.y = h - b.r; b.vy = -Math.abs(b.vy) * 0.6; }
      b.hop = Math.max(0, 1.1 * Math.exp(-t / 0.32) * Math.abs(Math.cos(t * 11 + b.phase)));
      const speed = Math.hypot(b.vx, b.vy);
      if (b.settling) {
        b.settling.s = Math.min(1, b.settling.s + dt / SETTLE_S);
        b.q = quatSlerp(b.settling.from, b.settling.to, easeOut(b.settling.s));
        if (b.settling.s >= 1) {
          b.done = true;
          if (!b.kept) b.alpha = 0.35;
        }
      } else if (b.die) {
        b.q = quatMul(quatAxis([b.vy, b.vx, 0], (speed / b.r) * dt), b.q);
        const spin = 14 * Math.exp(-t / 0.4) * dt;
        if (spin > 1e-4) b.q = quatMul(quatAxis(b.tumble, spin), b.q);
        if ((t > 0.55 && speed < 70) || t > MAX_S) settle(b);
      } else if ((t > 0.55 && speed < 70) || t > MAX_S) {
        b.done = true;
        if (!b.kept) b.alpha = 0.35;
      }
    }
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = a.r + b.r;
      if (!dist || dist >= min) continue;
      const nx = dx / dist;
      const ny = dy / dist;
      const push = (min - dist) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (rel <= 0) continue;
      const k = rel * 0.9;
      a.vx -= k * nx;
      a.vy -= k * ny;
      b.vx += k * nx;
      b.vy += k * ny;
    }
  };

  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const b of bodies) {
      const off = b.hop * b.r * 0.5;
      ctx.beginPath();
      ctx.ellipse(b.x + off * 0.6, b.y + off, b.r * 0.85, b.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${(0.28 * b.alpha * (1 - b.hop * 0.4)).toFixed(3)})`;
      ctx.fill();
    }
    for (const b of [...bodies].sort((p, q) => p.y - q.y)) {
      if (!b.die) {
        drawToken(ctx, b, colors);
        continue;
      }
      drawDie(ctx, b.die, b.q, { cx: b.x, cy: b.y - b.hop * b.r * 0.3, size: b.r * (1 + b.hop * 0.18), colors, alpha: b.alpha });
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
    for (let i = 0; i < FAST_STEPS && !bodies.every((b) => b.done); i++) step(STEP_S);
    for (const b of bodies) {
      if (b.die) b.q = dieQuat(b.die, b.value, twistToward(b.die, b.value, b.q));
      b.hop = 0;
      b.done = true;
      b.y = Math.min(b.y, h - b.r);
      b.alpha = b.kept ? 1 : 0.35;
    }
    end();
  };

  const tick = (now) => {
    if (!began) began = now;
    if (now - began > LIMIT_MS) {
      finish();
      return;
    }
    const elapsed = last ? Math.min(0.5, (now - last) / 1000) : 1 / 60;
    last = now;
    const steps = Math.max(1, Math.ceil(elapsed / STEP_S));
    for (let i = 0; i < steps; i++) step(elapsed / steps);
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
