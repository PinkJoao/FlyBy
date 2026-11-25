// =============================================================================
// geometry: os dados poliédricos (d4 a d20) e como desenhá-los num canvas 2D
// =============================================================================
// O QUE FAZ
//   A álgebra mínima (vetor e quatérnio), os seis sólidos dos dados de RPG com as
//   faces numeradas como num dado de verdade (opostas somando lados + 1), a
//   orientação que deixa um valor virado para cima (para a câmera) e o desenho de um
//   dado girado: perspectiva, luz por face, faces de costas escondidas e os números.
//   Usado pelo d20 em destaque (d20Canvas, DDL-0152) e pela bandeja (diceTray,
//   DDL-0153).
//
// FUNÇÕES
//   sub, add, scale, dot, cross, unit: vetor 3D.
//   quatMul(a, b), quatRotate(q, v), quatAxis(axis, angle), quatSlerp(a, b, t),
//     quatFromRows(r, u, n): quatérnio [w, x, y, z].
//   makeFace(verts, poly, normal, upOf): uma face com os vértices em ordem, centro,
//     normal e "up" (no plano da face).
//   hullFaces(verts, upOf): as faces do fecho convexo dos vértices.
//   numberOpposites(faces): numera as faces em pares opostos (somando lados mais um).
//   trapezohedron(): os vértices do d10 (dez pipas).
//   normalize(verts, faces): raio 1.
//   toVertex, toEdge, toApex: para onde aponta o alto do número na face.
//   makeDie(sides, mode): um dado: 4, 6, 8, 10, 12 ou 20 lados; `mode` 'tens' ou
//     'ones' para o par do d100.
//   dieQuat(die, value, twist): a orientação que mostra `value` para cima.
//   twistToward(die, value, q): o giro em torno do eixo da câmera mais perto de q.
//   drawLabel(ctx, text, at, up, n, s, project): um número na face, em perspectiva.
//   drawDie(ctx, die, q, opts): o dado girado num ponto do canvas.
//   DIE_SIDES: os lados que têm sólido.
//
// DECISÕES E ARMADILHAS
//   - Todo sólido é normalizado para raio 1 (o vértice mais longe), então o tamanho
//     na tela é um número só para qualquer dado.
//   - As faces saem do FECHO CONVEXO dos vértices (todo plano por três vértices com o
//     resto do mesmo lado): um caminho só para os seis sólidos, inclusive o d10, sem
//     depender do alinhamento do dual (tentado e errado no d12 e no d20).
//   - O d4 se lê pelo VÉRTICE de cima: cada face leva o número de cada um dos seus
//     três vértices perto dele, e o valor sorteado aponta para a câmera.
//     As faces dele ficam a 70 graus da câmera mesmo em repouso (normal com z de 1/3),
//     então o número aparece já a partir de z 0,05: com o limiar dos outros dados
//     (0,25) os números do d4 saíam quase transparentes.
//   - O d10 é um trapezoedro de pipas planas: com o anel em z = ±c, o ápice fica em
//     h = c vezes (1 + cos 36) sobre (1 menos cos 36).
//   - O número é escrito em fonte de 38px e encolhido pela escala: em fonte de 1px o
//     espaço entre os dígitos se perde (DDL-0152). O 6 e o 9 levam um traço embaixo.
// -----------------------------------------------------------------------------

const PHI = (1 + Math.sqrt(5)) / 2;

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const unit = (a) => scale(a, 1 / Math.hypot(a[0], a[1], a[2]));

export const DIE_SIDES = [4, 6, 8, 10, 12, 20];

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
  const len = Math.hypot(axis[0], axis[1], axis[2]);
  if (!len) return [1, 0, 0, 0];
  const s = Math.sin(angle / 2) / len;
  return [Math.cos(angle / 2), axis[0] * s, axis[1] * s, axis[2] * s];
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

/** Uma face: os vértices em ordem em volta da normal, com centro, normal e "up". */
function makeFace(verts, poly, normal, upOf) {
  const center = scale(poly.reduce((acc, i) => add(acc, verts[i]), [0, 0, 0]), 1 / poly.length);
  const e1 = unit(sub(verts[poly[0]], center));
  const e2 = cross(normal, e1);
  const ordered = [...poly].sort((a, b) => {
    const pa = sub(verts[a], center);
    const pb = sub(verts[b], center);
    return Math.atan2(dot(pa, e2), dot(pa, e1)) - Math.atan2(dot(pb, e2), dot(pb, e1));
  });
  const raw = upOf(verts, ordered, center, normal);
  const up = unit(sub(raw, scale(normal, dot(raw, normal))));
  return { poly: ordered, center, normal, up, number: 0 };
}

/** As faces do fecho convexo: cada plano por três vértices com todos do mesmo lado. */
export function hullFaces(verts, upOf) {
  const seen = [];
  for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) for (let k = j + 1; k < verts.length; k++) {
    let n = cross(sub(verts[j], verts[i]), sub(verts[k], verts[i]));
    const len = Math.hypot(n[0], n[1], n[2]);
    if (len < 1e-9) continue;
    n = scale(n, 1 / len);
    let d = dot(n, verts[i]);
    const ds = verts.map((v) => dot(n, v));
    if (ds.every((x) => x >= d - 1e-6)) {
      n = scale(n, -1);
      d = -d;
    } else if (!ds.every((x) => x <= d + 1e-6)) continue;
    if (seen.some((s) => dot(s.normal, n) > 1 - 1e-6)) continue;
    const poly = verts.map((v, idx) => [idx, dot(n, v)]).filter(([, x]) => Math.abs(x - d) < 1e-6).map(([idx]) => idx);
    seen.push(makeFace(verts, poly, n, upOf));
  }
  return seen;
}

/** Numera as faces em pares opostos, que somam lados mais um. */
export function numberOpposites(faces) {
  let next = 1;
  for (const f of faces) {
    if (f.number) continue;
    const opposite = faces.find((g) => g !== f && !g.number && dot(g.normal, f.normal) < -0.999);
    f.number = next;
    if (opposite) opposite.number = faces.length + 1 - next;
    next += 1;
  }
  return faces;
}

/**
 * Os vértices do d10: ápices em ±h e o anel de dez em z = ±c, alternados; a pipa
 * plana fixa h pelo c (a conta está no cabeçalho).
 */
export function trapezohedron() {
  const c = 0.105;
  const cos36 = Math.cos(Math.PI / 5);
  const h = (c * (1 + cos36)) / (1 - cos36);
  const ring = Array.from({ length: 10 }, (_, k) => [Math.cos((k * Math.PI) / 5), Math.sin((k * Math.PI) / 5), k % 2 ? -c : c]);
  return [[0, 0, h], [0, 0, -h], ...ring];
}

/** Normaliza o raio (o vértice mais longe) para 1. */
function normalize(verts, faces) {
  const r = Math.max(...verts.map((v) => Math.hypot(v[0], v[1], v[2])));
  return {
    verts: verts.map((v) => scale(v, 1 / r)),
    faces: faces.map((f) => ({ ...f, center: scale(f.center, 1 / r) })),
  };
}

const toVertex = (verts, p, c) => sub(verts[p[0]], c);
const toEdge = (verts, p, c) => sub(scale(add(verts[p[0]], verts[p[1]]), 0.5), c);
const toApex = (verts, p, c) => sub(verts[p.reduce((best, i) => (Math.abs(verts[i][2]) > Math.abs(verts[best][2]) ? i : best), p[0])], c);

/**
 * Um dado de `sides` lados (4, 6, 8, 10, 12, 20). `mode` 'tens' ou 'ones' rotula o
 * par do d100 (00-90 e 0-9).
 * @returns {{ sides: number, verts: number[][], faces: object[], labelSize: number, label: (n: number) => string, vertexNumbers?: number[] }}
 */
export function makeDie(sides, mode = null) {
  const cube = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) cube.push([x, y, z]);
  const axes = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const ico = [];
  for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) ico.push([0, s1, s2 * PHI], [s1, s2 * PHI, 0], [s2 * PHI, 0, s1]);
  const dodeca = [...cube];
  for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) dodeca.push([0, s1 / PHI, s2 * PHI], [s1 / PHI, s2 * PHI, 0], [s2 * PHI, 0, s1 / PHI]);
  const shapes = {
    4: [[[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], toVertex, 0.32],
    6: [cube, toEdge, 0.42],
    8: [axes, toVertex, 0.3],
    10: [trapezohedron(), toApex, 0.27],
    12: [dodeca, toVertex, 0.33],
    20: [ico, toVertex, 0.22],
  };
  const [raw, upOf, labelSize] = shapes[sides] ?? shapes[20];
  const built = hullFaces(raw, upOf);
  if (sides !== 4) numberOpposites(built);
  const { verts, faces } = normalize(raw, built);
  const label = mode === 'tens' ? (n) => String((n - 1) * 10).padStart(2, '0') : mode === 'ones' ? (n) => String(n - 1) : (n) => String(n);
  const die = { sides: shapes[sides] ? sides : 20, verts, faces, labelSize, label };
  if (sides === 4) die.vertexNumbers = [1, 2, 3, 4];
  return die;
}

/** A orientação que mostra `value` virado para a câmera (+z), girada `twist` em z. */
export function dieQuat(die, value, twist = 0) {
  let base;
  if (die.vertexNumbers) {
    const i = Math.max(0, die.vertexNumbers.indexOf(value));
    const n = unit(die.verts[i]);
    const other = die.verts[(i + 1) % die.verts.length];
    const u = unit(sub(other, scale(n, dot(other, n))));
    base = quatFromRows(cross(u, n), u, n);
  } else {
    const f = die.faces.find((x) => x.number === value) ?? die.faces[0];
    base = quatFromRows(cross(f.up, f.normal), f.up, f.normal);
  }
  return twist ? quatMul(quatAxis([0, 0, 1], twist), base) : base;
}

/** O giro em z que deixa a face final mais perto de como o dado já está (sem rodopio no fim). */
export function twistToward(die, value, q) {
  const base = dieQuat(die, value);
  const ref = die.vertexNumbers ? die.verts[(Math.max(0, die.vertexNumbers.indexOf(value)) + 1) % 4] : (die.faces.find((x) => x.number === value) ?? die.faces[0]).up;
  const now = quatRotate(q, ref);
  const then = quatRotate(base, ref);
  return Math.atan2(now[1], now[0]) - Math.atan2(then[1], then[0]);
}

/** Um número na face, em perspectiva: `at` é o centro, `up` o alto do número, `s` o tamanho. */
export function drawLabel(ctx, text, at, up, n, s, project) {
  const right = cross(up, n);
  const o = project(at);
  const px = project(add(at, scale(right, s)));
  const py = project(add(at, scale(up, s)));
  ctx.save();
  ctx.transform(px[0] - o[0], px[1] - o[1], -(py[0] - o[0]), -(py[1] - o[1]), o[0], o[1]);
  ctx.scale(1 / 40, 1 / 40);
  ctx.font = `700 ${text.length > 1 ? 34 : 38}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 5);
  if (text === '6' || text === '9') ctx.fillRect(-11, 20, 22, 3);
  ctx.restore();
}

const LIGHT = unit([-0.35, 0.55, 0.75]);

/**
 * O dado girado por q, centrado em (cx, cy), com `size` pixels por unidade de raio.
 * `colors`: { face, edge, text }; `tint` troca a cor da face; `alpha` esmaece.
 */
export function drawDie(ctx, die, q, { cx, cy, size, colors, tint = null, alpha = 1, cam = 6 }) {
  const project = (v) => {
    const k = cam / (cam - v[2]);
    return [cx + v[0] * size * k, cy - v[1] * size * k];
  };
  const verts = die.verts.map((v) => quatRotate(q, v));
  const visible = [];
  for (const f of die.faces) {
    const n = quatRotate(q, f.normal);
    const c = quatRotate(q, f.center);
    if (dot(n, sub([0, 0, cam], c)) <= 0) continue;
    visible.push({ f, n, c });
  }
  visible.sort((a, b) => a.c[2] - b.c[2]);
  ctx.save();
  ctx.globalAlpha = alpha;
  for (const { f, n, c } of visible) {
    const pts = f.poly.map((i) => project(verts[i]));
    const lit = 0.45 + 0.55 * Math.max(0, dot(n, LIGHT));
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fillStyle = tint ?? colors.face;
    ctx.fill();
    ctx.fillStyle = `rgba(0,0,0,${(1 - lit).toFixed(3)})`;
    ctx.fill();
    ctx.lineWidth = Math.max(1, size / 60);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = colors.edge;
    ctx.stroke();
    const from = die.vertexNumbers ? 0.05 : 0.25;
    if (n[2] < from) continue;
    ctx.globalAlpha = alpha * Math.min(1, (n[2] - from) * (die.vertexNumbers ? 5 : 3));
    ctx.fillStyle = colors.text;
    if (die.vertexNumbers) {
      for (const vi of f.poly) {
        const corner = add(c, scale(sub(verts[vi], c), 0.58));
        drawLabel(ctx, die.label(die.vertexNumbers[vi]), corner, unit(sub(verts[vi], c)), n, die.labelSize, project);
      }
    } else {
      drawLabel(ctx, die.label(f.number), c, quatRotate(q, f.up), n, die.labelSize, project);
    }
    ctx.globalAlpha = alpha;
  }
  ctx.restore();
}
