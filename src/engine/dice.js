// =============================================================================
// dice: o motor de dados do play mode (fórmula, rolagem, teste de d20)
// =============================================================================
// O QUE FAZ
//   Lê uma fórmula de dados ("1d10 + @classes.fighter.levels", "2d20kh + 5"),
//   rola e devolve o total com cada dado guardado, num objeto serializável que o
//   evento do play mode grava inteiro (o refazer reaplica o MESMO resultado,
//   docs/PLAY-MODE-PLAN.md 3.1 e 3.5). Puro: o sorteio vem de um `rng` injetável.
//
//   A sintaxe é a de roll data do Foundry, a mesma das fórmulas de pool e
//   activity que o catálogo lê: números, `NdM` (`d%` é d100), as quatro
//   operações, parênteses, `kh`/`kl`/`k` (manter os maiores ou menores), `minN`/`maxN`
//   (piso e teto de cada dado), `floor`/`ceil`/`round`/`abs`/`min`/`max`, e
//   referências `@caminho` resolvidas por um objeto de dados (plano ou aninhado).
//
// FUNÇÕES
//   DiceError: o erro de fórmula (com a posição, quando há).
//   cryptoRng(faces): um dado justo por crypto.getRandomValues.
//   sequenceRng(values, fallback): usa os valores dados em ordem (dado físico,
//     testes) e depois o fallback; valor fora do dado é erro.
//   lookup(data, path): o valor de um caminho no objeto de dados.
//   resolveRefs(text, data): troca cada `@ref` pelo valor; sem valor é erro.
//   tokenize(text): os tokens da fórmula.
//   parseFormula(text): a árvore da fórmula (sem refs).
//   hasDice(node), formatNode(node): inspeção e texto normalizado da árvore.
//   evaluate(node, ctx): o valor de um nó, rolando os dados no ctx.
//   rollDice(node, ctx): um termo de dados, com manter, piso, teto e crítico.
//   rollFormula(text, opts): rola uma fórmula.
//   validateFormula(text, data): null se a fórmula é válida, senão a mensagem.
//   rollParts(parts, opts): rola partes rotuladas (atributo, PB, Bless...) com o
//     mesmo rng e o mesmo crítico, e soma.
//   resolveMode(advantage, disadvantage): vantagem e desvantagem se anulam.
//   d20Test(opts): um teste de d20 com modo, natural, crítico e falha crítica.
//
// DECISÕES E ARMADILHAS
//   - Refs ANTES do parse: `@x` vira o número ou `(fórmula)` (uma ScaleValue de
//     dado como "3d6" entra como subexpressão). Identificador do Foundry pode ter
//     hífen (`@scale.rogue.sneak-attack`), o que colide com a subtração
//     (`@prof-1`): resolveRefs tenta o caminho inteiro e vai cortando do último
//     hífen até achar um valor.
//   - A contagem de um termo pode ser uma expressão sem dados (`(@prof)d4`).
//   - Número colado numa ref de DADO (`3@scale.monk.die`, com a escala "1d8")
//     vira `3d8`: o overlay escreve assim, e o sentido é "3 dados daquela face".
//   - Crítico (regra 2024): DOBRA a quantidade de dados de cada termo, nunca os
//     modificadores.
//   - O total é arredondado PARA BAIXO (`Math.floor`) quando a conta não é
//     inteira: o 5e arredonda para baixo (metade do dano).
//   - `minN` e `maxN` mudam o VALOR do dado e guardam o sorteado em `raw`: o teste
//     de d20 julga o natural pelo `raw` (Reliable Talent não apaga um 20).
//   - Limites contra travar a tela: até 1000 dados por termo e 10000 faces.
//   - Identificador é lido guloso (`[a-z]+`) e então classificado; `d` sozinho é
//     o operador de dado. Um nome desconhecido é erro, nunca ignorado.
// -----------------------------------------------------------------------------

const MAX_COUNT = 1000;
const MAX_FACES = 10000;
const FUNCTIONS = new Set(['floor', 'ceil', 'round', 'abs', 'min', 'max']);
const KEEP = new Set(['kh', 'kl', 'k']);
const CLAMP = new Set(['min', 'max']);

export class DiceError extends Error {
  constructor(message, position = null) {
    super(message);
    this.name = 'DiceError';
    this.position = position;
  }
}

/** Um dado justo de `faces` lados (1 a faces), por crypto.getRandomValues. */
export function cryptoRng(faces) {
  const c = globalThis.crypto;
  if (!c?.getRandomValues) return 1 + Math.floor(Math.random() * faces);
  const limit = Math.floor(0x100000000 / faces) * faces;
  const buf = new Uint32Array(1);
  do {
    c.getRandomValues(buf);
  } while (buf[0] >= limit);
  return 1 + (buf[0] % faces);
}

/**
 * Um rng que devolve os valores dados em ordem e depois cai no fallback.
 * @param {number[]} values
 * @param {(faces: number) => number} [fallback]
 */
export function sequenceRng(values, fallback = cryptoRng) {
  const queue = [...values];
  return (faces) => {
    if (!queue.length) return fallback(faces);
    const v = queue.shift();
    if (!Number.isInteger(v) || v < 1 || v > faces) throw new DiceError(`${v} is not a valid result for a d${faces}.`);
    return v;
  };
}

/** O valor de um caminho ("abilities.str.mod") num objeto plano ou aninhado. */
export function lookup(data, path) {
  if (data == null) return undefined;
  if (Object.prototype.hasOwnProperty.call(data, path)) return data[path];
  let cur = data;
  for (const key of path.split('.')) {
    if (cur == null || typeof cur !== 'object' || !(key in cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

/** Troca cada `@ref` pelo valor do objeto de dados; ref sem valor é erro. */
export function resolveRefs(text, data = {}) {
  const missing = [];
  const out = String(text ?? '').replace(/@([A-Za-z_][\w.-]*)/g, (match, path, offset, whole) => {
    let candidate = path;
    let rest = '';
    const counted = /\d/.test(whole[offset - 1] ?? '');
    for (;;) {
      const value = lookup(data, candidate);
      if (typeof value === 'number' && Number.isFinite(value)) return `${value < 0 ? `(${value})` : value}${rest}`;
      if (typeof value === 'string' && counted && /^\s*\d*d\d+\s*$/.test(value)) return `d${value.split('d')[1].trim()}${rest}`;
      if (typeof value === 'string' && value.trim()) return `(${value})${rest}`;
      const cut = candidate.lastIndexOf('-');
      if (cut <= 0) break;
      rest = candidate.slice(cut) + rest;
      candidate = candidate.slice(0, cut);
    }
    missing.push(`@${path}`);
    return match;
  });
  if (missing.length) throw new DiceError(`Unknown reference: ${missing.join(', ')}.`);
  return out;
}

/** Os tokens de uma fórmula já sem refs. */
export function tokenize(text) {
  const tokens = [];
  const src = String(text ?? '');
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (/[0-9.]/.test(ch)) {
      const m = src.slice(i).match(/^\d*\.?\d+|^\d+/);
      if (!m) throw new DiceError('Invalid number.', i);
      tokens.push({ type: 'num', value: Number(m[0]), pos: i });
      i += m[0].length;
    } else if (/[a-z]/i.test(ch)) {
      const word = src.slice(i).match(/^[a-z]+/i)[0].toLowerCase();
      if (word !== 'd' && !FUNCTIONS.has(word) && !KEEP.has(word)) throw new DiceError(`Unknown word "${word}".`, i);
      tokens.push({ type: word === 'd' ? 'd' : 'word', value: word, pos: i });
      i += word.length;
    } else if ('+-*/(),%'.includes(ch)) {
      tokens.push({ type: ch, pos: i });
      i++;
    } else {
      throw new DiceError(`Unexpected character "${ch}".`, i);
    }
  }
  return tokens;
}

/**
 * A árvore de uma fórmula (as refs já resolvidas).
 * @param {string} text
 */
export function parseFormula(text) {
  const tokens = tokenize(text);
  let p = 0;
  const peek = () => tokens[p];
  const next = () => tokens[p++];
  const expect = (type) => {
    const t = next();
    if (!t || t.type !== type) throw new DiceError(`Expected "${type}".`, t?.pos ?? null);
    return t;
  };

  const dice = (count) => {
    next();
    let faces;
    const t = peek();
    if (t?.type === '%') {
      next();
      faces = { t: 'num', v: 100 };
    } else if (t?.type === 'num') {
      faces = { t: 'num', v: next().value };
    } else if (t?.type === '(') {
      next();
      faces = { t: 'group', a: expr() };
      expect(')');
    } else {
      throw new DiceError('A die needs a number of faces.', t?.pos ?? null);
    }
    const mods = [];
    for (;;) {
      const m = peek();
      if (m?.type !== 'word') break;
      if (KEEP.has(m.value)) {
        next();
        const n = peek()?.type === 'num' ? next().value : 1;
        mods.push({ m: m.value === 'k' ? 'kh' : m.value, n });
      } else if (CLAMP.has(m.value) && tokens[p + 1]?.type === 'num') {
        next();
        mods.push({ m: m.value, n: next().value });
      } else {
        break;
      }
    }
    return { t: 'dice', count, faces, mods };
  };

  const primary = () => {
    const t = peek();
    if (!t) throw new DiceError('The formula ends too early.');
    let node;
    if (t.type === 'num') {
      next();
      node = { t: 'num', v: t.value };
    } else if (t.type === '(') {
      next();
      node = { t: 'group', a: expr() };
      expect(')');
    } else if (t.type === 'd') {
      return dice({ t: 'num', v: 1 });
    } else if (t.type === 'word' && FUNCTIONS.has(t.value)) {
      next();
      expect('(');
      const args = [expr()];
      while (peek()?.type === ',') {
        next();
        args.push(expr());
      }
      expect(')');
      node = { t: 'fn', name: t.value, args };
    } else {
      throw new DiceError(`Unexpected "${t.value ?? t.type}".`, t.pos);
    }
    return peek()?.type === 'd' ? dice(node) : node;
  };

  const unary = () => {
    const t = peek();
    if (t?.type === '-') {
      next();
      return { t: 'neg', a: unary() };
    }
    if (t?.type === '+') {
      next();
      return unary();
    }
    return primary();
  };

  const term = () => {
    let node = unary();
    while (peek()?.type === '*' || peek()?.type === '/') {
      const op = next().type;
      node = { t: 'bin', op, a: node, b: unary() };
    }
    return node;
  };

  function expr() {
    let node = term();
    while (peek()?.type === '+' || peek()?.type === '-') {
      const op = next().type;
      node = { t: 'bin', op, a: node, b: term() };
    }
    return node;
  }

  if (!tokens.length) throw new DiceError('The formula is empty.');
  const tree = expr();
  if (p < tokens.length) throw new DiceError(`Unexpected "${tokens[p].value ?? tokens[p].type}".`, tokens[p].pos);
  return tree;
}

/** A árvore tem algum termo de dados? */
export function hasDice(node) {
  switch (node.t) {
    case 'dice': return true;
    case 'num': return false;
    case 'group': case 'neg': return hasDice(node.a);
    case 'bin': return hasDice(node.a) || hasDice(node.b);
    case 'fn': return node.args.some(hasDice);
    default: return false;
  }
}

/** O texto normalizado de uma árvore ("2d20kh + 5"). */
export function formatNode(node) {
  switch (node.t) {
    case 'num': return String(node.v);
    case 'group': return `(${formatNode(node.a)})`;
    case 'neg': return `-${formatNode(node.a)}`;
    case 'bin': return `${formatNode(node.a)} ${node.op} ${formatNode(node.b)}`;
    case 'fn': return `${node.name}(${node.args.map(formatNode).join(', ')})`;
    case 'dice': {
      const count = node.count.t === 'num' ? String(node.count.v) : formatNode(node.count);
      const faces = node.faces.t === 'num' ? String(node.faces.v) : formatNode(node.faces);
      const mods = node.mods.map((m) => `${m.m}${KEEP.has(m.m) && m.n === 1 ? '' : m.n}`).join('');
      return `${count}d${faces}${mods}`;
    }
    default: return '';
  }
}

/** Um termo de dados: sorteia, aplica piso e teto, marca os mantidos e soma. */
function rollDice(node, ctx) {
  if (hasDice(node.count) || hasDice(node.faces)) throw new DiceError('The number of dice and faces cannot contain dice.');
  let count = evaluate(node.count, ctx);
  const faces = evaluate(node.faces, ctx);
  if (!Number.isInteger(count) || count < 0) throw new DiceError(`Invalid number of dice: ${count}.`);
  if (!Number.isInteger(faces) || faces < 1) throw new DiceError(`Invalid number of faces: ${faces}.`);
  if (ctx.critical) count *= 2;
  if (count > MAX_COUNT || faces > MAX_FACES) throw new DiceError('Too many dice.');

  const floorTo = node.mods.find((m) => m.m === 'min')?.n;
  const ceilTo = node.mods.find((m) => m.m === 'max')?.n;
  const results = [];
  for (let i = 0; i < count; i++) {
    const raw = ctx.rng(faces);
    let value = raw;
    if (floorTo != null) value = Math.max(value, Math.min(floorTo, faces));
    if (ceilTo != null) value = Math.min(value, Math.max(ceilTo, 1));
    results.push(value === raw ? { value, kept: true } : { value, raw, kept: true });
  }

  const keep = node.mods.find((m) => m.m === 'kh' || m.m === 'kl');
  if (keep) {
    const order = results.map((r, i) => i).sort((a, b) => (keep.m === 'kh'
      ? results[b].value - results[a].value
      : results[a].value - results[b].value) || a - b);
    const kept = new Set(order.slice(0, Math.min(keep.n, count)));
    results.forEach((r, i) => { r.kept = kept.has(i); });
  }

  const total = results.reduce((s, r) => s + (r.kept ? r.value : 0), 0);
  ctx.groups.push({ formula: formatNode({ ...node, count: { t: 'num', v: count } }), faces, results, total });
  return total;
}

/** O valor de um nó; os dados rolados vão para `ctx.groups`. */
function evaluate(node, ctx) {
  switch (node.t) {
    case 'num': return node.v;
    case 'group': return evaluate(node.a, ctx);
    case 'neg': return -evaluate(node.a, ctx);
    case 'dice': return rollDice(node, ctx);
    case 'bin': {
      const a = evaluate(node.a, ctx);
      const b = evaluate(node.b, ctx);
      if (node.op === '+') return a + b;
      if (node.op === '-') return a - b;
      if (node.op === '*') return a * b;
      if (b === 0) throw new DiceError('Division by zero.');
      return a / b;
    }
    case 'fn': {
      const args = node.args.map((n) => evaluate(n, ctx));
      if (node.name === 'min') return Math.min(...args);
      if (node.name === 'max') return Math.max(...args);
      if (args.length !== 1) throw new DiceError(`${node.name}() takes one value.`);
      return Math[node.name](args[0]);
    }
    default: throw new DiceError('Invalid formula.');
  }
}

/**
 * Rola uma fórmula.
 * @param {string} text
 * @param {{ data?: object, rng?: (faces: number) => number, critical?: boolean }} [opts]
 * @returns {{ formula: string, total: number, groups: object[], critical: boolean }}
 */
export function rollFormula(text, { data = {}, rng = cryptoRng, critical = false } = {}) {
  const tree = parseFormula(resolveRefs(text, data));
  const ctx = { rng, critical, groups: [] };
  const value = evaluate(tree, ctx);
  return { formula: formatNode(tree), total: Number.isInteger(value) ? value : Math.floor(value), groups: ctx.groups, critical };
}

/** null se a fórmula é válida com esses dados, senão a mensagem do erro. */
export function validateFormula(text, data = {}) {
  try {
    parseFormula(resolveRefs(text, data));
    return null;
  } catch (e) {
    return e instanceof DiceError ? e.message : String(e?.message ?? e);
  }
}

/**
 * Rola partes rotuladas com o mesmo rng e o mesmo crítico, e soma.
 * @param {{ label: string, formula: string|number }[]} parts
 * @param {{ data?: object, rng?: (faces: number) => number, critical?: boolean }} [opts]
 */
export function rollParts(parts, { data = {}, rng = cryptoRng, critical = false } = {}) {
  const rolled = [];
  for (const part of parts ?? []) {
    const formula = String(part?.formula ?? '').trim();
    if (!formula) continue;
    const r = rollFormula(formula, { data, rng, critical });
    rolled.push({ label: part.label ?? '', formula: r.formula, total: r.total, groups: r.groups });
  }
  return { total: rolled.reduce((s, r) => s + r.total, 0), parts: rolled, critical };
}

/** O modo de um teste: qualquer vantagem com qualquer desvantagem dá normal. */
export function resolveMode(advantage, disadvantage) {
  const adv = Number(advantage) > 0 || advantage === true;
  const dis = Number(disadvantage) > 0 || disadvantage === true;
  if (adv && !dis) return 'advantage';
  if (dis && !adv) return 'disadvantage';
  return 'normal';
}

/**
 * Um teste de d20: o d20 do modo e as partes, com natural, crítico e falha crítica.
 * @param {{ parts?: { label: string, formula: string|number }[], advantage?: number|boolean, disadvantage?: number|boolean, critThreshold?: number, d20Min?: number, data?: object, rng?: (faces: number) => number }} opts
 */
export function d20Test({ parts = [], advantage = 0, disadvantage = 0, critThreshold = 20, d20Min = null, data = {}, rng = cryptoRng } = {}) {
  const mode = resolveMode(advantage, disadvantage);
  const base = mode === 'advantage' ? '2d20kh' : mode === 'disadvantage' ? '2d20kl' : '1d20';
  const die = d20Min ? `${base}min${d20Min}` : base;
  const rolled = rollParts([{ label: 'd20', formula: die }, ...parts], { data, rng });
  const kept = rolled.parts[0].groups[0].results.find((r) => r.kept);
  const natural = kept.raw ?? kept.value;
  return {
    mode,
    natural,
    isCritical: natural >= critThreshold,
    isFumble: natural === 1,
    total: rolled.total,
    parts: rolled.parts,
  };
}
