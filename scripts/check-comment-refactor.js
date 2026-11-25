// =============================================================================
// check-comment-refactor: `npm run check:refactor`
// =============================================================================
// O QUE FAZ
//   Prova que uma refatoração de comentários não mudou código (DDL-0090). Para
//   cada arquivo, compara a versão de uma revisão base (padrão `main`) com a do
//   disco, as duas sem comentários. Sai com código 1 se algum arquivo divergir.
//
//   Uso: `npm run check:refactor -- [--base=REV] [arquivos...]`. Sem arquivos,
//   confere todo JS/JSX/CSS que difere da base.
//
//   JS/JSX passa por DUAS comparações, e as duas têm de bater:
//   1. AST: a árvore do espree sem posições. Pega qualquer mudança de semântica,
//      inclusive de inserção automática de ponto e vírgula.
//   2. Tokens: tipo e valor de cada token. Pega o que a AST esconde, como um
//      parêntese a mais ou a menos.
//   CSS: a árvore do postcss sem comentários e sem os `raws` (espaçamento).
//
//   Também lista, como AVISO (não falha), o que fere o modelo novo nos
//   comentários do arquivo do disco: as regras do scripts/lib/commentRules.js,
//   as mesmas que o check:comments cobra.
//
// FUNÇÕES
//   cleanJsxText(text): o texto JSX como o React o enxerga (regra do Babel).
//   normalizeAst(node): a AST sem posições, sem `{/* */}` e com o texto JSX limpo.
//   jsxEmptyRanges(ast): os trechos `{/* */}`, cujos tokens não contam.
//   comparableTokens(src): a AST normalizada e a lista de tokens de um fonte JS.
//   cssTree(src): a árvore de um CSS sem comentários nem espaçamento.
//   firstDiff(a, b): o primeiro ponto em que duas listas divergem.
//   compareFile(file, base): o veredito de um arquivo.
//
// DECISÕES E ARMADILHAS
//   - Um `{/* comentário */}` de JSX vira um JSXExpressionContainer VAZIO na AST
//     e deixa um par de tokens `{` `}`. Removê-lo não muda nada no React, então
//     os dois lados o descartam. Pelo mesmo motivo o texto JSX é comparado já
//     limpo: as quebras de linha que sobram ao tirar o comentário não renderizam.
//   - As exceções aceitas no corpo estão no cabeçalho do commentRules.js.
//   - O disco pode estar em CRLF e o git guarda LF: os dois lados são lidos em LF.
//     No CSS, todo espaço em seletor e valor é colapsado num só.
//   - espree e postcss vêm do ESLint e do Vite; não são dependências diretas.
// -----------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import * as espree from 'espree';
import postcss from 'postcss';
import { PARSE, POSITION_KEYS, ruleWarnings } from './lib/commentRules.js';

function cleanJsxText(text) {
  const lines = text.split(/\r\n|\n|\r/);
  let out = '';
  lines.forEach((line, i) => {
    let t = line.replace(/\t/g, ' ');
    if (i !== 0) t = t.replace(/^ +/, '');
    if (i !== lines.length - 1) t = t.replace(/ +$/, '');
    if (t) out += (out ? ' ' : '') + t;
  });
  return out;
}

function normalizeAst(node) {
  if (Array.isArray(node)) {
    return node
      .filter((n) => !(n?.type === 'JSXExpressionContainer' && n.expression?.type === 'JSXEmptyExpression'))
      .filter((n) => !(n?.type === 'JSXText' && cleanJsxText(n.value) === ''))
      .map(normalizeAst);
  }
  if (!node || typeof node !== 'object') return node;
  if (node.type === 'JSXText') return { type: 'JSXText', value: cleanJsxText(node.value) };
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (!POSITION_KEYS.has(k)) out[k] = normalizeAst(v);
  }
  return out;
}

function jsxEmptyRanges(ast) {
  const ranges = [];
  (function walk(n) {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    if (n.type === 'JSXExpressionContainer' && n.expression?.type === 'JSXEmptyExpression') ranges.push(n.range);
    for (const [k, v] of Object.entries(n)) if (!POSITION_KEYS.has(k)) walk(v);
  })(ast);
  return ranges;
}

function comparableTokens(src) {
  const ast = espree.parse(src, { ...PARSE, range: true, tokens: true });
  const skip = jsxEmptyRanges(ast);
  const tokens = ast.tokens
    .filter((t) => !skip.some(([a, b]) => t.range[0] >= a && t.range[1] <= b))
    .map((t) => (t.type === 'JSXText' ? `JSXText ${cleanJsxText(t.value)}` : `${t.type} ${t.value}`))
    .filter((t) => t !== 'JSXText ');
  return { ast: JSON.stringify(normalizeAst(ast)), tokens };
}

function cssTree(src) {
  const root = postcss.parse(src);
  root.walkComments((c) => c.remove());
  const flat = (v) => v?.replace(/\s+/g, ' ').trim();
  const shape = (n) => ({
    type: n.type,
    selector: flat(n.selector),
    prop: n.prop,
    value: flat(n.value),
    name: n.name,
    params: flat(n.params),
    important: n.important,
    nodes: n.nodes?.map(shape),
  });
  return [JSON.stringify(shape(root))];
}

function firstDiff(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return { index: i, base: a[i], disk: b[i] };
  }
  return null;
}

function compareFile(file, base) {
  let before;
  try {
    before = execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return { ok: true, note: 'arquivo novo, sem base para comparar' };
  }
  const after = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  before = before.replace(/\r\n/g, '\n');
  if (file.endsWith('.css')) {
    const d = firstDiff(cssTree(before), cssTree(after));
    return d ? { ok: false, note: 'a árvore CSS mudou' } : { ok: true };
  }
  const a = comparableTokens(before);
  const b = comparableTokens(after);
  if (a.ast !== b.ast) return { ok: false, note: 'a AST mudou' };
  const d = firstDiff(a.tokens, b.tokens);
  if (d) return { ok: false, note: `token #${d.index}: base "${d.base}" x disco "${d.disk}"` };
  return { ok: true };
}

const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('--base='))?.slice(7) ?? 'main';
let files = args.filter((a) => !a.startsWith('--'));
if (!files.length) {
  files = execFileSync('git', ['diff', '--name-only', base, '--', '*.js', '*.jsx', '*.mjs', '*.css'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

let failed = 0;
for (const file of files) {
  const { ok, note } = compareFile(file, base);
  if (!ok) failed++;
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${file}${note ? `  (${note})` : ''}`);
  const warnings = ruleWarnings(readFileSync(file, 'utf8'), file);
  for (const w of warnings) console.log(`      aviso, linha ${w}`);
}
console.log(`\n${files.length} arquivo(s), ${failed} com código alterado.`);
process.exit(failed ? 1 : 0);
