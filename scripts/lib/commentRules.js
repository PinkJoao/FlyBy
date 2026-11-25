// =============================================================================
// commentRules: as regras do modelo de comentários (DDL-0090)
// =============================================================================
// O QUE FAZ
//   A fonte única das regras, usada pelo `npm run check:comments` (a checagem
//   permanente, que falha) e pelo `npm run check:refactor` (que as mostra como
//   aviso ao lado da prova de equivalência).
//
// FUNÇÕES
//   ruleWarnings(src, file): as violações nos comentários de JS e CSS:
//     comentário no corpo fora das exceções, JSDoc longo, emoji, travessão, seta
//     e hífen usado como travessão.
//   pyWarnings(src): o mesmo para o Python (só comentários de linha).
//   headerProblems(src, file): o que falta ou está errado no cabeçalho.
//   missingFunctions(src): as funções de nível superior (declaração, ou const
//     com função) cujo nome não aparece no cabeçalho do JS.
//
// DECISÕES E ARMADILHAS
//   - O cabeçalho tem duas formas válidas: a completa (régua de =, título, régua
//     de =, seções, régua de -) e a só de título (régua de =, título, régua de -).
//     O título começa pelo nome do arquivo: sem a extensão no JS e no Python, com
//     ela no CSS, que é como os 38 CSS foram escritos.
//   - Exceções aceitas no corpo do JS: JSDoc antes de declaração, propriedade ou
//     método; o cast `/** @type {X} */ (expr)`; bloco @typedef/@callback (tipo, não
//     comentário); o comentário único de um bloco vazio (o `no-empty` do ESLint
//     depende dele); diretiva de lint; `// ATENÇÃO:` de uma linha. No CSS, só o
//     `/* ATENÇÃO: */`; no Python, só o `# ATENÇÃO:`.
//   - Só comentário de LINHA antes do primeiro token conta como cabeçalho. Um
//     JSDoc ali (arquivo sem import) segue as regras do corpo; antes, um JSDoc
//     longo na primeira declaração passava (achado pelo teste).
//   - Toda função de nível superior aparece no cabeçalho, exportada ou não (é o
//     FUNÇÕES do modelo). A checagem só exige o NOME em algum lugar dele: medido
//     ao fechar a Fase 1, as 1240 funções do projeto estavam todas lá.
//   - JSDoc no corpo tem no máximo DUAS linhas de descrição (uma frase que
//     quebra). Medido ao fechar a Fase 1: dos 975 JSDocs, nenhum passava de uma.
//   - O BANNED escreve os caracteres proibidos por código, nunca literais: um
//     caractere literal aqui seria o próprio caso proibido.
// -----------------------------------------------------------------------------

import { basename } from 'node:path';
import * as espree from 'espree';

export const PARSE = { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } };
export const POSITION_KEYS = new Set(['loc', 'range', 'start', 'end', 'comments', 'tokens']);
export const BANNED = [
  [/\u2014/, 'travessão'],
  [/\u2013/, 'meia-risca'],
  [/\u2192|\u2190|\u2194|\u21d2|\u21c4/, 'seta (use ->)'],
  [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u, 'emoji'],
  [/\S - (?!\d)/, 'hífen usado como travessão'],
];

export function ruleWarnings(src, file) {
  if (file.endsWith('.css')) {
    const out = [];
    const firstNode = src.replace(/\/\*[\s\S]*?\*\//g, (c) => ' '.repeat(c.length)).search(/\S/);
    for (const m of src.matchAll(/\/\*[\s\S]*?\*\//g)) {
      const line = src.slice(0, m.index).split('\n').length;
      for (const [re, label] of BANNED) if (re.test(m[0])) out.push(`${line}: ${label}`);
      if (m.index > firstNode && !/^\/\* ATENÇÃO: /.test(m[0])) out.push(`${line}: comentário no corpo`);
    }
    return out;
  }
  const ast = espree.parse(src, { ...PARSE, range: true, tokens: true, comment: true, loc: true });
  const firstToken = ast.tokens[0]?.range[0] ?? Infinity;
  const empties = [];
  (function walk(n) {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    if (n.type === 'BlockStatement' && n.body.length === 0) empties.push(n.range);
    for (const [k, v] of Object.entries(n)) if (!POSITION_KEYS.has(k)) walk(v);
  })(ast.body);
  const out = [];
  for (const c of ast.comments) {
    const where = c.loc.start.line;
    for (const [re, label] of BANNED) if (re.test(c.value)) out.push(`${where}: ${label}`);
    if (c.range[0] < firstToken && c.type === 'Line') continue;
    if (/^\s*eslint-/.test(c.value)) continue;
    if (empties.some(([a, b]) => c.range[0] > a && c.range[1] < b)) continue;
    if (c.type === 'Line' && /^ ATENÇÃO: /.test(c.value)) continue;
    if (c.type === 'Block' && c.value.startsWith('*')) {
      if (/@(typedef|callback)\b/.test(c.value)) continue;
      const desc = c.value.split('\n').map((l) => l.replace(/^\s*\*+\s?/, '').trim()).filter(Boolean);
      const tag = desc.findIndex((l) => l.startsWith('@'));
      if ((tag < 0 ? desc.length : tag) > 2) out.push(`${where}: JSDoc com mais de duas linhas de descrição`);
      const i = ast.tokens.findIndex((t) => t.range[0] >= c.range[1]);
      const next = ast.tokens[i];
      const after = ast.tokens[i + 1]?.value;
      if (next && /^(export|function|async|const|let|class)$/.test(next.value)) continue;
      if (next?.type === 'Identifier' && (after === ':' || after === '(')) continue;
      if (next?.value === '(' && /^\*\s*@type\s/.test(c.value)) continue;
      out.push(`${where}: JSDoc que não precede uma declaração`);
      continue;
    }
    out.push(`${where}: comentário no corpo`);
  }
  return out;
}

export function pyWarnings(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const firstCode = lines.findIndex((l) => l.trim() && !l.trim().startsWith('#'));
  const out = [];
  lines.forEach((l, i) => {
    const at = l.indexOf('#');
    if (at < 0) return;
    const text = l.slice(at);
    for (const [re, label] of BANNED) if (re.test(text)) out.push(`${i + 1}: ${label}`);
    if (firstCode >= 0 && i > firstCode && !/^# ATENÇÃO: /.test(text)) out.push(`${i + 1}: comentário no corpo`);
  });
  return out;
}

const RULE = { js: /^\/\/ ={20,}$/, py: /^# ={20,}$/, css: /^ \* ={20,}$/ };
const TOP = { js: RULE.js, py: RULE.py, css: /^\/\* ={20,}$/ };
const CLOSE = { js: /^\/\/ -{20,}$/, py: /^# -{20,}$/, css: /^ \* -{20,} \*\/$/ };
const PREFIX = { js: '// ', py: '# ', css: ' * ' };
const CONT = { js: /^\/\/( |$)/, py: /^#( |$)/, css: /^ \*( |$)/ };

export function headerProblems(src, file) {
  const kind = file.endsWith('.css') ? 'css' : file.endsWith('.py') ? 'py' : 'js';
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const base = basename(file);
  const name = kind === 'css' ? base : base.replace(/\.(jsx?|mjs|py)$/, '');
  if (!TOP[kind].test(lines[0] ?? '')) return ['1: falta o cabeçalho (a régua de = na primeira linha)'];
  const out = [];
  if (!(lines[1] ?? '').startsWith(`${PREFIX[kind]}${name}: `)) out.push(`2: o título deve começar por "${name}: "`);
  const close = lines.findIndex((l) => CLOSE[kind].test(l));
  if (close < 2) return [...out, '1: falta a régua de - que fecha o cabeçalho'];
  if (close > 2 && !RULE[kind].test(lines[2])) out.push('3: falta a régua de = sob o título');
  for (let i = 3; i < close; i++) {
    if (!CONT[kind].test(lines[i])) {
      out.push(`${i + 1}: linha do cabeçalho fora do formato`);
      break;
    }
  }
  return out;
}

export function missingFunctions(src) {
  const ast = espree.parse(src, { ...PARSE, range: true, comment: true });
  const start = ast.body[0]?.range[0] ?? Infinity;
  const head = ast.comments.filter((c) => c.type === 'Line' && c.range[0] < start).map((c) => c.value).join(' ');
  const words = new Set(head.split(/[^A-Za-z0-9_$]+/));
  const names = [];
  for (let n of ast.body) {
    if (n.type.startsWith('Export') && n.declaration) n = n.declaration;
    if (n.type === 'FunctionDeclaration' && n.id) names.push(n.id.name);
    if (n.type === 'VariableDeclaration') {
      for (const d of n.declarations) if (d.id.type === 'Identifier' && /Function/.test(d.init?.type ?? '')) names.push(d.id.name);
    }
  }
  return names.filter((name) => !words.has(name)).map((name) => `1: a função ${name} não aparece no cabeçalho`);
}
