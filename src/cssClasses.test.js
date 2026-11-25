// =============================================================================
// cssClasses.test: toda classe usada no código existe no CSS Module
// =============================================================================
// O QUE FAZ
//   Uma classe de CSS Module que não existe não dá erro: vira `undefined` e o
//   elemento sai sem estilo. Foi assim que a faixa de círculos das magias do jogo e o
//   "Buy" do carrinho da loja ficaram botões nativos quando o CSS deles saiu numa
//   limpeza (DDL-0317). Aqui cada `styles.x` de cada arquivo é procurado no
//   `.module.css` importado.
//
// FUNÇÕES
//   walk(dir, ends): os arquivos de uma pasta com uma das terminações.
//   missingClasses(file): as classes usadas no arquivo que o CSS não tem.
//
// DECISÕES E ARMADILHAS
//   - Só o acesso direto (`styles.nome`) é conferido; o dinâmico (`styles[x]`) não dá
//     para ler do texto.
//   - O nome do import no próprio caminho ('./econ.module.css') não é uso.
// -----------------------------------------------------------------------------

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = import.meta.dirname;

/** Os arquivos de uma pasta com uma das terminações. */
function walk(dir, ends) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full, ends);
    return ends.some((end) => e.name.endsWith(end)) ? [full] : [];
  });
}

/** As classes usadas no arquivo que o CSS importado não tem. */
function missingClasses(file) {
  const src = readFileSync(file, 'utf8');
  const code = src.replace(/^import .*$/gm, '').replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');
  const out = [];
  for (const [, name, rel] of src.matchAll(/^import (\w+) from '(\.[^']+\.module\.css)'/gm)) {
    const css = readFileSync(path.join(path.dirname(file), rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const have = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
    for (const [, cls] of code.matchAll(new RegExp(`(?<![\\w.])${name}\\.(\\w+)`, 'g'))) {
      if (!have.has(cls)) out.push(`${name}.${cls} (${rel})`);
    }
  }
  return [...new Set(out)];
}

describe('classes de CSS Module', () => {
  it('toda classe usada existe no CSS', () => {
    const problems = walk(ROOT, ['.jsx', '.js'])
      .filter((f) => !f.endsWith('.test.js'))
      .map((f) => [path.relative(ROOT, f), missingClasses(f)])
      .filter(([, list]) => list.length);
    expect(problems).toEqual([]);
  });
});
