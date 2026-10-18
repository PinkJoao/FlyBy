// =============================================================================
// refactor-comments: a ferramenta da migração para o modelo de comentários novo
// =============================================================================
// O QUE FAZ
//   Separa o trabalho mecânico (tirar comentários do corpo) do trabalho autoral
//   (escrever o cabeçalho e resumir o JSDoc), que fica numa spec escrita à mão
//   por arquivo. DDL-0090, docs/MIGRATION-PLAN.md.
//
//   `node scripts/refactor-comments.js dump <arquivo>`
//     Imprime as funções de nível superior e todos os comentários, com a linha,
//     o tipo e a declaração em que estão. É a leitura que precede a spec.
//
//   `node scripts/refactor-comments.js apply <arquivo> <spec.mjs|spec.json>`
//     Reescreve o arquivo: troca o cabeçalho, reconstrói cada JSDoc a partir da
//     spec, converte os avisos escolhidos em `// ATENÇÃO:` e remove o resto.
//
//   `node scripts/refactor-comments.js batch <specs.mjs>`
//     O mesmo, para um lote: o export default é { 'caminho/do/arquivo': spec }.
//
//   A spec (export default de um .mjs, ou um .json):
//     title: o que vem depois do nome do arquivo na linha de título.
//     header: o corpo do cabeçalho, string ou lista de linhas, sem o `// `.
//       Vazio num arquivo trivial: o cabeçalho fica só com a linha de título.
//     jsdoc: { nome: 'resumo' }. Resumo vazio guarda só as tags, ou apaga.
//     typedefs: { NomeDoTipo: 'resumo' }, para os blocos `@typedef`.
//     keep: { linhaOriginal: 'texto' }, que vira `// ATENÇÃO: texto`.
//     relocate: { linhaOriginal: 'nome' }, para um JSDoc órfão.
//     drop: [linhaOriginal], para um JSDoc órfão que não vale mais.
//   As linhas são as do arquivo ORIGINAL, como o `dump` as mostra. Reaplicar é
//   seguro: `git checkout` no arquivo e `apply` de novo.
//
// FUNÇÕES
//   parse(src): a AST do espree com comentários, tokens e posições.
//   topLevelFunctions(ast): as funções declaradas no nível superior.
//   declarationName(ast, comment): o nome declarado logo após um comentário.
//   declaredName(stmt): o nome que uma declaração de nível superior declara.
//   bodyStart(ast): onde termina o cabeçalho antigo (1o token ou 1o bloco `/**`).
//   emptyBlocks(ast): os blocos `{}` sem nenhuma instrução.
//   isTypeCast(ast, comment): `/** @type {X} */ (expr)`, um cast que fica intacto.
//   typedefName(comment): o tipo que um bloco `@typedef`/`@callback` declara.
//   isOrphan(ast, comment): JSDoc seguido de outro JSDoc, sem código entre eles.
//   ownerOf(ast, pos): a declaração de nível superior que contém uma posição.
//   jsxEmptyContainers(ast): os `{/* */}` de JSX, com o trecho inteiro.
//   parseJsdoc(text): resumo e tags de um bloco JSDoc.
//   buildJsdoc(summary, tags, indent): o JSDoc no formato curto.
//   lineSpan(src, start, end): o trecho a apagar, de linha inteira ou parcial.
//   collapseBlanks(lines, removed): limpa as linhas em branco que sobram.
//   dump(file): o subcomando de leitura.
//   loadSpec(specPath): lê uma spec .mjs ou .json.
//   apply(file, spec): reescreve um arquivo a partir da spec.
//
// DECISÕES E ARMADILHAS
//   - Ficam intactas as diretivas (`eslint-...`, `@vite-ignore`). Um comentário
//     ORIGINAL que já começava com "ATENÇÃO:" é tratado como qualquer outro: o
//     aviso novo vem do `keep` (o foundryFeatureUses tinha um, e preservá-lo
//     deixava a frase partida ao meio).
//   - O JSDoc reconstruído guarda só `@tag {tipo} nome`. A descrição de cada
//     parâmetro, quando importa, vai para o resumo ou para o cabeçalho.
//   - `apply` falha se um JSDoc de declaração não tiver resumo na spec: nada
//     some sem decisão explícita. E avisa quando uma função de nível superior não
//     aparece no cabeçalho.
//   - Só apaga linhas em branco ADJACENTES a um comentário removido. Essas nunca
//     estão dentro de um template literal, então nenhuma string muda.
//   - O cabeçalho antigo termina no primeiro token OU no primeiro bloco `/**`:
//     num arquivo sem import, o JSDoc (até um typedef importado por outros
//     arquivos) vem antes do primeiro token e não pode sumir com o cabeçalho.
//   - Comentário que é o único conteúdo de um bloco vazio (o `catch {}` que
//     ignora o erro de propósito) FICA: é ele que satisfaz o `no-empty` do
//     ESLint. A prova de equivalência não vê isso; foi o lint que pegou.
//   - JSDoc antes de uma propriedade ou método de objeto (as ações de um store
//     Zustand) conta como declaração, com o nome da chave.
//   - Bloco `@typedef` FICA: é tipo, importado de outros arquivos
//     (`import('../schema/character').ClassEntry`), não comentário. Sai a
//     descrição de cada propriedade; um tipo de várias linhas mantém as quebras.
//   - Duas tags na mesma linha (`@property {number} pp @property ...`) são
//     separadas, senão a segunda sumiria.
//   - JSDoc ÓRFÃO: um helper inserido entre o bloco e a função faz o editor
//     mostrar a documentação na função errada. O piloto achou 8 em
//     foundryItems.js. `apply` exige uma decisão (relocate ou drop) para cada um.
//   - Depois de `apply`, rode `npm run check:refactor` no arquivo: é a prova.
// -----------------------------------------------------------------------------

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import * as espree from 'espree';

const RULE = '// =============================================================================';
const DIRECTIVE = /^\s*(eslint-|@vite-ignore|global |istanbul )/;

function parse(src) {
  return espree.parse(src, {
    ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true },
    comment: true, tokens: true, range: true, loc: true,
  });
}

function topLevelFunctions(ast) {
  const names = [];
  const isFn = (n) => n && /^(ArrowFunctionExpression|FunctionExpression)$/.test(n.type);
  for (let stmt of ast.body) {
    if (stmt.type === 'ExportNamedDeclaration' || stmt.type === 'ExportDefaultDeclaration') stmt = stmt.declaration ?? stmt;
    if (!stmt) continue;
    if (stmt.type === 'FunctionDeclaration' && stmt.id) names.push(stmt.id.name);
    if (stmt.type === 'VariableDeclaration') {
      for (const d of stmt.declarations) if (d.id.type === 'Identifier' && isFn(d.init)) names.push(d.id.name);
    }
    if (stmt.type === 'ClassDeclaration' && stmt.id) names.push(stmt.id.name);
  }
  return names;
}

function declarationName(ast, comment) {
  const i = ast.tokens.findIndex((t) => t.range[0] >= comment.range[1]);
  if (i < 0) return null;
  let j = i;
  const v = (k) => ast.tokens[k]?.value;
  if (v(j) === 'export') j++;
  if (v(j) === 'default') j++;
  if (v(j) === 'async') j++;
  if (v(j) === 'function') return v(j + 1) === '*' ? v(j + 2) : v(j + 1);
  if (/^(const|let|var|class)$/.test(v(j))) return v(j + 1);
  if (/^[A-Za-z_$][\w$]*$/.test(v(j)) && (v(j + 1) === ':' || v(j + 1) === '(')) return v(j);
  return null;
}

function declaredName(stmt) {
  const d = stmt.declaration ?? stmt;
  return d.id?.name ?? d.declarations?.[0]?.id?.name ?? null;
}

function bodyStart(ast) {
  const token = ast.tokens[0]?.range[0] ?? Infinity;
  const doc = ast.comments.find((c) => c.range[0] < token && c.type === 'Block' && c.value.startsWith('*'));
  return doc ? doc.range[0] : token;
}

function emptyBlocks(ast) {
  const out = [];
  (function walk(n) {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    if (n.type === 'BlockStatement' && n.body.length === 0) out.push(n.range);
    for (const [k, v] of Object.entries(n)) if (k !== 'range' && k !== 'loc') walk(v);
  })(ast.body);
  return out;
}

function isTypeCast(ast, comment) {
  if (comment.type !== 'Block' || !/^\*\s*@type\s/.test(comment.value)) return false;
  return ast.tokens.find((t) => t.range[0] >= comment.range[1])?.value === '(';
}

function typedefName(comment) {
  if (comment.type !== 'Block' || !comment.value.startsWith('*')) return null;
  const tag = parseJsdoc(comment.value).tags.find((t) => /^@(typedef|callback)\b/.test(t));
  return tag ? tag.split(/\s+/).pop() : null;
}

function isOrphan(ast, comment) {
  if (comment.type !== 'Block' || !comment.value.startsWith('*') || typedefName(comment)) return false;
  const next = ast.comments.find((x) => x.range[0] >= comment.range[1]);
  if (!next || next.type !== 'Block' || !next.value.startsWith('*')) return false;
  return !ast.tokens.some((t) => t.range[0] >= comment.range[1] && t.range[0] < next.range[0]);
}

function ownerOf(ast, pos) {
  for (const stmt of ast.body) {
    if (pos >= stmt.range[0] && pos < stmt.range[1]) {
      const d = stmt.declaration ?? stmt;
      return d.id?.name ?? d.declarations?.[0]?.id?.name ?? stmt.type;
    }
  }
  return '(entre declarações)';
}

function jsxEmptyContainers(ast) {
  const out = [];
  (function walk(n) {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    if (n.type === 'JSXExpressionContainer' && n.expression?.type === 'JSXEmptyExpression') out.push(n.range);
    for (const [k, v] of Object.entries(n)) if (k !== 'range' && k !== 'loc') walk(v);
  })(ast.body);
  return out;
}

function parseJsdoc(text) {
  const lines = text.replace(/^\*/, '').split('\n').map((l) => l.replace(/^\s*\* ?/, ''));
  const chunks = [[]];
  for (const l of lines) {
    if (!l.trim().startsWith('@')) { chunks[chunks.length - 1].push(l); continue; }
    for (const part of l.trim().split(/\s(?=@[a-zA-Z]+[\s{])/)) chunks.push([part]);
  }
  const summary = chunks.shift().join(' ').replace(/\s+/g, ' ').trim();
  const tags = [];
  for (const chunk of chunks) {
    const raw = chunk.join('\n').trim();
    const m = raw.match(/^@(\w+)\s*/);
    if (!m) continue;
    let rest = raw.slice(m[0].length);
    let type = '';
    if (rest.startsWith('{')) {
      let depth = 0, k = 0;
      for (; k < rest.length; k++) {
        if (rest[k] === '{') depth++;
        if (rest[k] === '}' && --depth === 0) break;
      }
      type = rest.slice(0, k + 1);
      type = type.includes('\n')
        ? type.split('\n').map((t) => t.trim()).filter(Boolean).join('\n')
        : type.replace(/\s+/g, ' ');
      rest = rest.slice(k + 1).trimStart();
    }
    const named = /^(param|property|prop|arg|argument|typedef|callback|template)$/.test(m[1]);
    const name = named ? (rest.match(/^(\[[^\]]*\]|\S+)/)?.[0] ?? '') : '';
    tags.push([`@${m[1]}`, type, name].filter(Boolean).join(' '));
  }
  return { summary, tags };
}

function buildJsdoc(summary, tags, indent) {
  if (!tags.length) return summary ? `/** ${summary} */` : '';
  if (!summary && tags.length === 1 && !tags[0].includes('\n')) return `/** ${tags[0]} */`;
  const tagLines = tags.flatMap((t) => t.split('\n').map((l, i) => (i ? ` *   ${l}` : ` * ${l}`)));
  const lines = [...(summary ? [` * ${summary}`] : []), ...tagLines, ' */'];
  return '/**' + lines.map((l) => `\n${indent}${l}`).join('');
}

function lineSpan(src, start, end) {
  const ls = src.lastIndexOf('\n', start - 1) + 1;
  let le = src.indexOf('\n', end);
  if (le < 0) le = src.length;
  const before = src.slice(ls, start);
  const after = src.slice(end, le);
  if (!before.trim() && !after.trim()) return { start: ls, end: Math.min(le + 1, src.length), whole: true };
  if (!after.trim()) return { start: start - (before.length - before.trimEnd().length), end, whole: false };
  return { start, end: end + (after.length - after.trimStart().length), whole: false };
}

function collapseBlanks(src, wholeStarts) {
  const lines = src.split('\n');
  let offset = 0;
  const lineAt = new Map();
  lines.forEach((l, i) => { lineAt.set(offset, i); offset += l.length + 1; });
  const removed = new Set();
  for (const s of wholeStarts) if (lineAt.has(s)) removed.add(lineAt.get(s));
  const drop = new Set();
  const blank = (i) => i >= 0 && i < lines.length && !lines[i].trim() && !removed.has(i);
  const sorted = [...removed].sort((a, b) => a - b);
  for (let k = 0; k < sorted.length; k++) {
    const first = sorted[k];
    let last = first;
    while (removed.has(last + 1)) { last++; k++; }
    let before = first - 1;
    while (drop.has(before)) before--;
    const after = last + 1;
    const opener = before >= 0 && /[{[(]\s*$/.test(lines[before]);
    const closer = after < lines.length && /^\s*[}\])]/.test(lines[after]);
    if (blank(after) && (blank(before) || opener || before < 0)) drop.add(after);
    else if (blank(before) && closer) drop.add(before);
  }
  return lines.filter((_, i) => !removed.has(i) && !drop.has(i)).join('\n');
}

function dump(file) {
  const src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const ast = parse(src);
  const first = bodyStart(ast);
  console.log(`# ${file}\n# funções de nível superior: ${topLevelFunctions(ast).join(', ')}\n`);
  let prev = null;
  for (const c of ast.comments) {
    const continues = prev && c.type === 'Line' && prev.type === 'Line'
      && c.loc.start.line === prev.loc.end.line + 1 && (c.range[0] < first) === (prev.range[0] < first)
      && !/\S/.test(src.slice(src.lastIndexOf('\n', c.range[0] - 1) + 1, c.range[0]))
      && !/\S/.test(src.slice(src.lastIndexOf('\n', prev.range[0] - 1) + 1, prev.range[0]));
    prev = c;
    if (continues) { console.log(`//${c.value}`); continue; }
    let kind = c.type === 'Line' ? 'linha' : 'bloco';
    if (c.range[0] < first) kind = 'CABEÇALHO';
    else if (typedefName(c)) kind = `TYPEDEF ${typedefName(c)}`;
    else if (isOrphan(ast, c)) kind =`JSDOC ÓRFÃO (o editor o mostra em ${declarationName(ast, c)})`;
    else if (c.type === 'Block' && c.value.startsWith('*')) {
      const name = declarationName(ast, c);
      kind = name ? `JSDOC ${name}` : 'jsdoc solto';
    }
    const text = c.type === 'Line' ? `//${c.value}` : `/*${c.value}*/`;
    console.log(`[${c.loc.start.line}] ${kind} @${ownerOf(ast, c.range[0])}\n${text}`);
  }
}

async function loadSpec(specPath) {
  return specPath.endsWith('.json')
    ? JSON.parse(readFileSync(specPath, 'utf8'))
    : (await import(pathToFileURL(resolve(specPath)).href)).default;
}

function apply(file, spec) {
  const raw = readFileSync(file, 'utf8');
  const crlf = raw.includes('\r\n');
  const src = raw.replace(/\r\n/g, '\n');
  const headerText = spec.header ?? '';
  const headerLines = Array.isArray(headerText)
    ? headerText
    : headerText.replace(/^\n+|\s+$/g, '').split('\n').map((l) => l.trimEnd()).filter((l, i, a) => a.length > 1 || l);
  const ast = parse(src);
  const first = bodyStart(ast);
  const containers = jsxEmptyContainers(ast);
  const empties = emptyBlocks(ast);
  const edits = [];
  const missing = [];

  for (const c of ast.comments) {
    if (c.range[0] < first && DIRECTIVE.test(c.value)) throw new Error(`diretiva no cabeçalho, linha ${c.loc.start.line}: mova à mão`);
    if (c.range[0] < first) {
      const span = lineSpan(src, c.range[0], c.range[1]);
      edits.push({ start: span.start, end: span.end, text: '', whole: span.whole });
      continue;
    }
    if (DIRECTIVE.test(c.value)) continue;
    const container = containers.find(([a, b]) => c.range[0] >= a && c.range[1] <= b);
    const [s, e] = container ?? c.range;
    const keep = spec.keep?.[String(c.loc.start.line)];
    if (keep) {
      edits.push({ start: s, end: e, text: `${container ? '{/* ' : '// '}ATENÇÃO: ${keep}${container ? ' */}' : ''}` });
      continue;
    }
    if (isTypeCast(ast, c)) continue;
    if (empties.some(([a, b]) => c.range[0] > a && c.range[1] < b)) continue;
    const typedef = typedefName(c);
    if (typedef) {
      const summary = spec.typedefs?.[typedef];
      if (summary == null) { missing.push(`typedef ${typedef} (linha ${c.loc.start.line})`); continue; }
      const indent = src.slice(src.lastIndexOf('\n', s - 1) + 1, s);
      edits.push({ start: s, end: e, text: buildJsdoc(summary, parseJsdoc(c.value).tags, indent) });
      continue;
    }
    if (isOrphan(ast, c)) {
      const line = String(c.loc.start.line);
      const target = spec.relocate?.[line];
      if (!target && !spec.drop?.includes(c.loc.start.line)) { missing.push(`JSDoc órfão na linha ${line}: falta relocate ou drop`); continue; }
      if (target) {
        const stmt = ast.body.find((st) => declaredName(st) === target);
        if (!stmt) { missing.push(`relocate: ${target} não existe`); continue; }
        if (spec.jsdoc?.[target] == null) { missing.push(`${target} (relocado da linha ${line})`); continue; }
        edits.push({ start: stmt.range[0], end: stmt.range[0], text: `${buildJsdoc(spec.jsdoc[target], parseJsdoc(c.value).tags, '')}\n` });
      }
      const span = lineSpan(src, c.range[0], c.range[1]);
      edits.push({ start: span.start, end: span.end, text: '', whole: span.whole });
      continue;
    }
    if (c.type === 'Block' && c.value.startsWith('*')) {
      const name = declarationName(ast, c);
      if (name && Object.values(spec.relocate ?? {}).includes(name)) {
        missing.push(`${name} já tem JSDoc próprio na linha ${c.loc.start.line}; não dá para relocar outro`);
        continue;
      }
      if (name) {
        const summary = spec.jsdoc?.[name];
        if (summary == null) { missing.push(`${name} (linha ${c.loc.start.line})`); continue; }
        const indent = src.slice(src.lastIndexOf('\n', s - 1) + 1, s);
        const doc = buildJsdoc(summary, parseJsdoc(c.value).tags, indent);
        if (doc) { edits.push({ start: s, end: e, text: doc }); continue; }
      }
    }
    const span = lineSpan(src, s, e);
    edits.push({ start: span.start, end: span.end, text: '', whole: span.whole });
  }
  if (missing.length) {
    console.error(`JSDoc sem resumo na spec:\n  ${missing.join('\n  ')}`);
    process.exit(1);
  }

  const seen = new Set();
  const unique = edits.filter((ed) => !seen.has(ed.start) && seen.add(ed.start)).sort((a, b) => b.start - a.start);
  let out = src;
  const marker = '\u0000';
  for (const ed of unique) out = out.slice(0, ed.start) + (ed.whole ? marker : ed.text) + out.slice(ed.end);
  const markerStarts = [];
  out = out.replace(new RegExp(marker, 'g'), (m, idx) => { markerStarts.push(idx); return '\n'; });
  out = collapseBlanks(out, markerStarts);

  const title = `// ${basename(file).replace(/\.[^.]+$/, '')}: ${spec.title}`;
  const header = (headerLines.length
    ? [RULE, title, RULE, ...headerLines.map((l) => (l.trim() ? `// ${l}` : '//')), RULE.replace(/=/g, '-')]
    : [RULE, title, RULE.replace(/=/g, '-')]
  ).join('\n');
  out = `${header}\n\n${out.trimStart()}`;

  const fns = topLevelFunctions(parse(out));
  const absent = fns.filter((n) => !new RegExp(`\\b${n}\\b`).test(header));
  if (absent.length) console.warn(`aviso: funções fora do cabeçalho: ${absent.join(', ')}`);
  writeFileSync(file, crlf ? out.replace(/\n/g, '\r\n') : out);
  console.log(`${file}: ${unique.length} comentário(s) tratados.`);
}

const [cmd, file, spec] = process.argv.slice(2);
if (cmd === 'dump' && file) dump(file);
else if (cmd === 'apply' && file && spec) apply(file, await loadSpec(spec));
else if (cmd === 'batch' && file) {
  for (const [path, s] of Object.entries(await loadSpec(file))) apply(path, s);
} else {
  console.error('uso: refactor-comments.js dump <arquivo> | apply <arquivo> <spec> | batch <specs>');
  process.exit(1);
}
