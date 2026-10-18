// =============================================================================
// gen-source-names: gera src/engine/sourceNamesData.js (npm run gen:sources)
// =============================================================================
// O QUE FAZ
//   Extrai o mapa `Parser.SOURCE_JSON_TO_FULL` do 5etools (abreviação de fonte ->
//   nome por extenso: "XPHB" -> "Player's Handbook (2024)"), lendo o
//   `js/parser.js` do snapshot in-repo (`DnD Source Material/5etools Source Code`,
//   MIT, git-ignored, DDL-0037). Só NOMES de fonte são copiados, nenhum conteúdo de
//   jogo, no mesmo espírito do gen:uuids. Rodar só quando o 5etools atualizar; a
//   SAÍDA é commitada, o material de referência não.
//
// DECISÕES E ARMADILHAS
//   - Executa o parser num sandbox em vez de parsear por regex: as atribuições
//     usam constantes (`Parser.SRC_XPHB`), template-literals e prefixos
//     (`${Parser.PS_PREFIX}Amonkhet`). O sandbox dá os globais que ele espera e
//     ignora qualquer erro posterior, porque o mapa é montado cedo.
//   - A chave é guardada como o dado a escreve (o app usa sempre maiúsculas), e a
//     saída é ordenada por chave para um diff estável entre regerações.
//   - O cabeçalho do arquivo gerado já segue o modelo de comentários (DDL-0090).
// -----------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import process from 'node:process';

const ROOT = join(import.meta.dirname, '..');
const PARSER = join(ROOT, 'DnD Source Material', '5etools Source Code', 'js', 'parser.js');
const OUT = join(ROOT, 'src', 'engine', 'sourceNamesData.js');

if (!existsSync(PARSER)) {
  console.error(`parser.js do 5etools não encontrado em ${PARSER}\nColoque o "DnD Source Material" na raiz do projeto (DDL-0037).`);
  process.exit(1);
}

const sandbox = { module: { exports: {} }, exports: {}, window: {}, require: () => ({}) };
sandbox.globalThis = sandbox;
createContext(sandbox);
try {
  runInContext(readFileSync(PARSER, 'utf8'), sandbox, { timeout: 10000 });
} catch {
  /* o parser referencia coisas que não temos; o SOURCE_JSON_TO_FULL já foi montado */
}

const Parser = sandbox.Parser ?? sandbox.globalThis.Parser;
const map = Parser?.SOURCE_JSON_TO_FULL;
if (!map || !Object.keys(map).length) {
  console.error('SOURCE_JSON_TO_FULL vazio - o formato do parser.js mudou?');
  process.exit(1);
}

const entries = Object.entries(map)
  .filter(([k, v]) => typeof v === 'string' && k)
  .sort((a, b) => a[0].localeCompare(b[0]));

const literal = `{\n${entries.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n')}\n}`;

const out = `// =============================================================================
// sourceNamesData: GERADO por npm run gen:sources; não edite à mão
// =============================================================================
// O QUE FAZ
//   SOURCE_NAMES: abreviação de fonte -> nome por extenso, extraído de
//   Parser.SOURCE_JSON_TO_FULL (5etools, MIT). Só rótulos de fonte; nenhum
//   conteúdo de jogo é redistribuído. Consumido por engine/sourceNames.js.
//   ${entries.length} fontes.
// -----------------------------------------------------------------------------

/** @type {Readonly<Record<string, string>>} */
export const SOURCE_NAMES = ${literal};
`;

writeFileSync(OUT, out);
console.log(`sourceNamesData.js gerado: ${entries.length} fontes.`);
