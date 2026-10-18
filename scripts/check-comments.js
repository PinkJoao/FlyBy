// =============================================================================
// check-comments: npm run check:comments
// =============================================================================
// O QUE FAZ
//   A checagem PERMANENTE do modelo de comentários (DDL-0090): todo arquivo de
//   código tem o cabeçalho no topo e quase nada no corpo. Falha (código 1) quando
//   falta o cabeçalho ou o título não começa pelo nome do arquivo, quando há
//   função de nível superior que o cabeçalho não cita, comentário no corpo fora
//   das exceções, JSDoc com mais de duas linhas de
//   descrição, ou emoji, travessão, seta e hífen usado como travessão em
//   comentário. As regras moram em scripts/lib/commentRules.js.
//
//   Uso: npm run check:comments [-- arquivos...]. Sem arquivos, confere todo JS,
//   JSX, MJS, CSS e Python do projeto, rastreado ou novo (respeitando o
//   .gitignore).
//
// FUNÇÕES
//   problemsOf(file): os problemas de um arquivo, cabeçalho primeiro.
// -----------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { headerProblems, missingFunctions, pyWarnings, ruleWarnings } from './lib/commentRules.js';

/** Os problemas de um arquivo, cabeçalho primeiro. */
function problemsOf(file) {
  const src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const body = file.endsWith('.py') ? pyWarnings(src) : ruleWarnings(src, file);
  const fns = /\.(jsx?|mjs)$/.test(file) ? missingFunctions(src) : [];
  return [...headerProblems(src, file), ...fns, ...body];
}

const args = process.argv.slice(2);
const files = args.length
  ? args
  : execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.js', '*.jsx', '*.mjs', '*.css', '*.py'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);

let bad = 0;
for (const file of files) {
  const problems = problemsOf(file);
  if (!problems.length) continue;
  bad++;
  console.log(file);
  for (const p of problems) console.log(`  linha ${p}`);
}
console.log(`\n${files.length} arquivo(s), ${bad} com problema.`);
process.exit(bad ? 1 : 0);
