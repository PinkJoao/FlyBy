// =============================================================================
// d20Canvas: o d20 em 3D desenhado num canvas 2D (sem WebGL)
// =============================================================================
// O QUE FAZ
//   A geometria de um icosaedro de verdade (20 faces, opostas somando 21), girada
//   por quatérnio, projetada em perspectiva e desenhada num canvas 2D com
//   sombreamento por face, arestas e os números nas faces visíveis. `spinTo` encena
//   uma rolagem que TERMINA na face pedida (o engine decide o número; o dado só
//   encena, docs/PLAY-MODE-V2-PLAN.md §2).
//
// FUNÇÕES
//   icosahedron(): os vértices, as faces orientadas para fora e o número de cada face.
//   quatMul(a, b), quatRotate(q, v), quatAxis(axis, angle), quatSlerp(a, b, t),
//     quatFromRows(r, u, n): a álgebra de quatérnio mínima.
//   faceQuat(geo, number): a orientação que mostra a face `number` de frente e em pé.
//   createD20(canvas, colors): o dado num canvas; devolve { draw, spinTo, finish,
//     stop, setTint }: finish pula a rolagem em curso direto para a face final.
//   easeOut(t): a curva de desaceleração da rolagem.
//   sub, add, scale, dot, cross, unit: a álgebra de vetor 3D mínima.
//
// DECISÕES E ARMADILHAS
//   - Canvas 2D e não three.js (medido em DDL-0152): o pedaço do three.js com um
//     d20 só passa de 120 KB comprimido e o WebGL custa memória de GPU e compilar
//     shader na primeira rolagem; 20 triângulos com a conta feita aqui cabem em
//     poucos KB e num quadro de fração de milissegundo. O resultado é 3D de
//     verdade (perspectiva, luz, faces escondidas), só que sem física.
//   - A rolagem soma à interpolação da orientação final umas voltas em torno de um
//     eixo aleatório que se anulam no fim: o dado tomba, desacelera e para EXATO na
//     face sorteada, de pé (o "up" da face é o vértice de cima).
//   - Pintor simples: as faces visíveis são poucas e convexas, ordenar pela
//     profundidade do centro basta. As de costas nem são desenhadas.
//   - O canvas é desenhado na resolução do aparelho (devicePixelRatio), ou o número
//     fica borrado no celular. E o número é escrito em fonte de 38px e encolhido pela
//     escala: escrito direto em fonte de 1px, o espaço entre os dígitos se perde.
//   - O tamanho (0,22 do lado menor) cabe o dado inteiro no canvas, com a
//     perspectiva aumentando o vértice da frente: maior que isso, a borda corta.
// -----------------------------------------------------------------------------

const PHI = (1 + Math.sqrt(5)) / 2;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => scale(a, 1 / Math.hypot(a[0], a[1], a[2]));

/** O icosaedro: vértices, faces para fora (com centro, normal e "up") e os números. */
export function icosahedron() {
  const verts = [];
  for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) verts.push([0, s1, s2 * PHI], [s1, s2 * PHI, 0], [s2 * PHI, 0, s1]);
  const faces = [];
  const near = (a, b) => Math.abs(Math.hypot(...sub(verts[a], verts[b])) - 2) < 1e-6;
  for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) for (let c = b + 1; c < 12; c++) {
    if (!near(a, b) || !near(b, c) || !near(a, c)) continue;
    let tri = [a, b, c];
    const center = scale(add(add(verts[a], verts[b]), verts[c]), 1 / 3);
    if (dot(cross(sub(verts[b], verts[a]), sub(verts[c], verts[a])), center) < 0) tri = [a, c, b];
    const normal = unit(center);
    faces.push({ tri, center, normal, up: unit(sub(verts[tri[0]], center)), number: 0 });
  }
  let next = 1;
  for (const f of faces) {
    if (f.number) continue;
    const opposite = faces.find((g) => g !== f && !g.number && dot(g.normal, f.normal) < -0.999);
    f.number = next;
    if (opposite) opposite.number = 21 - next;
    next += 1;
  }
  return { verts, faces };
}

/** Produto de quatérnios [w, x, y, z]. */
export function quatMul(a, b) {
  return [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
}

/** Gira o vetor v pelo quatérnio q. */
export function quatRotate(q, v) {
  const p = quatMul(quatMul(q, [0, v[0], v[1], v[2]]), [q[0], -q[1], -q[2], -q[3]]);
  return [p[1], p[2], p[3]];
}

/** O quatérnio de um giro de `angle` em torno de `axis`. */
export function quatAxis(axis, angle) {
  const [x, y, z] = unit(axis);
  const s = Math.sin(angle / 2);
  return [Math.cos(angle / 2), x * s, y * s, z * s];
}

/** Interpolação esférica entre dois quatérnios. */
export function quatSlerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (d < 0) {
    d = -d;
    bb = b.map((v) => -v);
  }
  if (d > 0.9995) {
    const r = a.map((v, i) => v + (bb[i] - v) * t);
    const n = Math.hypot(...r);
    return r.map((v) => v / n);
  }
  const th = Math.acos(d);
  const s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s;
  const wb = Math.sin(t * th) / s;
  return a.map((v, i) => v * wa + bb[i] * wb);
}

/** O quatérnio da rotação cujas linhas são r, u, n (leva r ao x, u ao y, n ao z). */
export function quatFromRows(r, u, n) {
  const m = [r, u, n];
  const tr = m[0][0] + m[1][1] + m[2][2];
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [s / 4, (m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s];
  } else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
    const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2;
    q = [(m[2][1] - m[1][2]) / s, s / 4, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s];
  } else if (m[1][1] > m[2][2]) {
    const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2;
    q = [(m[0][2] - m[2][0]) / s, (m[0][1] + m[1][0]) / s, s / 4, (m[1][2] + m[2][1]) / s];
  } else {
    const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2;
    q = [(m[1][0] - m[0][1]) / s, (m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, s / 4];
  }
  const len = Math.hypot(...q);
  return q.map((v) => v / len);
}

/** A orientação que mostra a face `number` de frente para quem olha, e em pé. */
export function faceQuat(geo, number) {
  const f = geo.faces.find((x) => x.number === number) ?? geo.faces[0];
  return quatFromRows(cross(f.up, f.normal), f.up, f.normal);
}

/** A desaceleração da rolagem (rápida no começo, parando devagar). */
export function easeOut(t) {
  return 1 - (1 - t) ** 3;
}

/**
 * O d20 num canvas. `colors`: { face, edge, text, light } em CSS.
 * @returns {{ draw: Function, spinTo: (n: number, ms?: number) => Promise<void>, finish: Function, stop: Function, setTint: Function, geo: object }}
 */
export function createD20(canvas, colors) {
  const geo = icosahedron();
  const ctx = canvas.getContext('2d');
  const light = unit([-0.35, 0.55, 0.75]);
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
    const size = Math.min(w, h) * 0.22;
    const cam = 6;
    const project = (v) => {
      const k = cam / (cam - v[2]);
      return [w / 2 + v[0] * size * k, h / 2 - v[1] * size * k];
    };
    const verts = geo.verts.map((v) => quatRotate(q, v));
    const visible = [];
    for (const f of geo.faces) {
      const n = quatRotate(q, f.normal);
      const c = quatRotate(q, f.center);
      if (dot(n, sub([0, 0, cam], c)) <= 0) continue;
      visible.push({ f, n, c });
    }
    visible.sort((a, b) => a.c[2] - b.c[2]);
    for (const { f, n, c } of visible) {
      const pts = f.tri.map((i) => project(verts[i]));
      const lit = 0.45 + 0.55 * Math.max(0, dot(n, light));
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[2][0], pts[2][1]);
      ctx.closePath();
      ctx.fillStyle = tint ?? colors.face;
      ctx.fill();
      ctx.fillStyle = `rgba(0,0,0,${(1 - lit).toFixed(3)})`;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = colors.edge;
      ctx.stroke();
      if (n[2] < 0.25) continue;
      const up = quatRotate(q, f.up);
      const right = cross(up, n);
      const o = project(c);
      const s = 0.42;
      const px = project(add(c, scale(right, s)));
      const py = project(add(c, scale(up, s)));
      ctx.save();
      ctx.transform(px[0] - o[0], px[1] - o[1], -(py[0] - o[0]), -(py[1] - o[1]), o[0], o[1]);
      ctx.globalAlpha = Math.min(1, (n[2] - 0.25) * 3);
      ctx.fillStyle = colors.text;
      ctx.scale(1 / 40, 1 / 40);
      ctx.font = '700 38px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(f.number), 0, 5);
      if (f.number === 6 || f.number === 9) ctx.fillRect(-11, 20, 22, 3);
      ctx.restore();
    }
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
    const target = faceQuat(geo, number);
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
    geo,
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
