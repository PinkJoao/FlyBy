// =============================================================================
// commentRules.test: as regras do modelo de comentários
// =============================================================================
// O QUE FAZ
//   Prova que o check:comments ACHA o que deve achar (o projeto inteiro passa
//   limpo, e um instrumento que nunca acusa nada não prova nada) e que aceita
//   cada exceção do modelo.
//
// FUNÇÕES
//   js(body, title), css(body): um arquivo mínimo com cabeçalho válido.
//
// DECISÕES E ARMADILHAS
//   - O travessão e a seta dos casos são montados por código, para este arquivo
//     não conter o caractere que ele testa.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { headerProblems, missingFunctions, pyWarnings, ruleWarnings } from './commentRules.js';

const RULE = '='.repeat(77);
const CLOSE = '-'.repeat(77);
const DASH = String.fromCharCode(0x2014);
const ARROW = String.fromCharCode(0x2192);

const js = (body, title = 'mod: o módulo') => [`// ${RULE}`, `// ${title}`, `// ${RULE}`, '// O QUE FAZ', '//   algo.', `// ${CLOSE}`, '', body].join('\n');
const css = (body) => ['/* ' + RULE, ' * mod.css: o estilo', ' * ' + '-'.repeat(74) + ' */', '', body].join('\n');

describe('headerProblems', () => {
  it('aceita o cabeçalho completo e o só de título', () => {
    expect(headerProblems(js('export const a = 1;'), 'src/mod.js')).toEqual([]);
    expect(headerProblems([`// ${RULE}`, '// mod: só o título', `// ${CLOSE}`, '', 'x;'].join('\n'), 'mod.jsx')).toEqual([]);
    expect(headerProblems(css('.a {}'), 'mod.css')).toEqual([]);
  });

  it('acusa a falta do cabeçalho, o título errado e a régua que não fecha', () => {
    expect(headerProblems('export const a = 1;', 'mod.js')[0]).toMatch(/falta o cabeçalho/);
    expect(headerProblems(js('x;', 'outro: nome'), 'mod.js')[0]).toMatch(/"mod: "/);
    expect(headerProblems([`// ${RULE}`, '// mod: t', '// sem régua', 'x;'].join('\n'), 'mod.js')[0]).toMatch(/régua de -/);
  });

  it('o título do CSS leva a extensão, o do JS e do Python não', () => {
    expect(headerProblems(css('.a {}'), 'outro.css')).toHaveLength(1);
    expect(headerProblems(['# ' + RULE, '# tool: t', '# ' + CLOSE, 'x = 1'].join('\n'), 'scripts/tool.py')).toEqual([]);
  });
});

describe('ruleWarnings (JS)', () => {
  it('aceita as exceções do modelo', () => {
    const body = [
      '/** Soma. @param {number} a */',
      'export function f(a) {',
      '  // ATENÇÃO: a ordem importa.',
      '  try { g(); } catch {',
      '    /* ignorado de propósito */',
      '  }',
      '  // eslint-disable-next-line no-console',
      '  return /** @type {number} */ (a);',
      '}',
      '/** @typedef {object} T */',
    ].join('\n');
    expect(ruleWarnings(js(body), 'mod.js')).toEqual([]);
  });

  it('acusa comentário no corpo e JSDoc longo', () => {
    expect(ruleWarnings(js('const a = 1; // narra o código'), 'mod.js')).toEqual(['8: comentário no corpo']);
    const long = ['/**', ' * Um.', ' * Dois.', ' * Três.', ' */', 'export function f() {}'].join('\n');
    expect(ruleWarnings(js(long), 'mod.js')[0]).toMatch(/mais de duas linhas/);
  });

  it('acusa travessão, seta e hífen usado como travessão, inclusive no cabeçalho', () => {
    expect(ruleWarnings(js('x;', `mod: um ${DASH} dois`), 'mod.js')).toContain('2: travessão');
    expect(ruleWarnings(js('x;', `mod: a ${ARROW} b`), 'mod.js')).toContain('2: seta (use ->)');
    expect(ruleWarnings(js('x;', 'mod: um - dois'), 'mod.js')).toContain('2: hífen usado como travessão');
    expect(ruleWarnings(js('x;', 'mod: de 1 a 10 - 2'), 'mod.js')).toEqual([]);
  });
});

describe('ruleWarnings (CSS) e pyWarnings', () => {
  it('no CSS só o cabeçalho e o ATENÇÃO', () => {
    expect(ruleWarnings(css('/* ATENÇÃO: não simplificar. */\n.a {}'), 'mod.css')).toEqual([]);
    expect(ruleWarnings(css('.a { color: red; /* nota */ }'), 'mod.css')).toEqual(['5: comentário no corpo']);
  });

  it('no Python o comentário depois do código é corpo', () => {
    expect(pyWarnings(['# cabeçalho', 'x = 1', '# ATENÇÃO: ok', 'y = 2  # nota'].join('\n'))).toEqual(['4: comentário no corpo']);
  });
});

describe('missingFunctions', () => {
  it('acusa a função que o cabeçalho não cita, exportada ou não', () => {
    const body = `export function citada() {}
const escondida = () => 1;
const valor = 2;`;
    expect(missingFunctions(js(body, 'mod: cita citada()'))).toEqual(['1: a função escondida não aparece no cabeçalho']);
  });
});
