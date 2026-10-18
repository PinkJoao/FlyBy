// =============================================================================
// setupLink.test: o link de configuração e a decisão do boot (R1 e R2)
// =============================================================================
// O QUE FAZ
//   A leitura do `?fonte=`, o campo que aceita endereço ou link colado, o link a
//   copiar e, principalmente, decideBoot: link com a mesma fonte não pergunta
//   nada (R2); fonte nova pergunta sempre; sem fonte, a primeira visita (R1).
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { parseSetupParam, sourceFromInput, buildSetupLink, decideBoot } from './setupLink';

const BASE = 'https://raw.example.com/owner/repo/main/data/';

describe('parseSetupParam e buildSetupLink', () => {
  it('ida e volta: o link gerado devolve a mesma base', () => {
    const link = buildSetupLink('https://flyby.example/', BASE);
    expect(link).toBe(`https://flyby.example/?fonte=${encodeURIComponent(BASE)}`);
    expect(parseSetupParam(new URL(link).search)).toBe(BASE);
  });

  it('parâmetro ausente, vazio ou não-https vira null', () => {
    expect(parseSetupParam('')).toBeNull();
    expect(parseSetupParam('?fonte=')).toBeNull();
    expect(parseSetupParam('?fonte=http%3A%2F%2Fx.com%2Fdata%2F')).toBeNull();
  });
});

describe('sourceFromInput', () => {
  it('aceita o endereço direto ou o link de configuração colado', () => {
    expect(sourceFromInput(BASE)).toBe(BASE);
    expect(sourceFromInput(buildSetupLink('https://flyby.example', BASE))).toBe(BASE);
    expect(sourceFromInput('  https://raw.example.com/owner/repo/main/data  ')).toBe(BASE);
  });

  it('recusa texto que não é endereço https', () => {
    expect(sourceFromInput('hello')).toBeNull();
    expect(sourceFromInput('')).toBeNull();
  });
});

describe('decideBoot', () => {
  const url = { kind: 'url', base: BASE };
  const other = { kind: 'url', base: 'https://other.example/data/' };
  const srd = { kind: 'srd' };

  it('R2: link com a MESMA fonte gravada segue direto, sem pergunta', () => {
    expect(decideBoot({ stored: url, link: { kind: 'url', base: BASE } })).toEqual({ action: 'boot', source: url });
  });

  it('link de fonte nova pergunta, com ou sem fonte gravada', () => {
    expect(decideBoot({ stored: null, link: url }).action).toBe('confirm');
    expect(decideBoot({ stored: other, link: url }).action).toBe('confirm');
    expect(decideBoot({ stored: srd, link: url }).action).toBe('confirm');
  });

  it('R1: sem fonte e sem link, a primeira visita', () => {
    expect(decideBoot({ stored: null, link: null })).toEqual({ action: 'first' });
  });

  it('link inválido é ignorado', () => {
    expect(decideBoot({ stored: srd, link: { kind: 'invalid' } })).toEqual({ action: 'boot', source: srd });
    expect(decideBoot({ stored: null, link: { kind: 'invalid' } })).toEqual({ action: 'first' });
  });
});
