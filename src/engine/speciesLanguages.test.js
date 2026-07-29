import { describe, it, expect } from 'vitest';
import { OTHER_LANGUAGE, resolveOtherLanguage } from './speciesLanguages';
import { parseSpecies } from './speciesData';
import { parseChoices } from './choices';

describe('resolveOtherLanguage - o pseudo-idioma `other` (A5 / TC-0050)', () => {
  it('traduz pelo par Nome|FONTE', () => {
    expect(resolveOtherLanguage({ name: 'Loxodon', source: 'GGR' }, 'other')).toBe('Loxodon');
    expect(resolveOtherLanguage({ name: 'Kalashtar', source: 'ERLW' }, 'other')).toBe('Quori');
  });

  it('uma LINHAGEM cai na base (o merge troca o nome da espécie)', () => {
    const lineage = { name: 'Loxodon (Alguma)', source: 'GGR', _baseName: 'Loxodon', _baseSource: 'GGR' };
    expect(resolveOtherLanguage(lineage, 'other')).toBe('Loxodon');
  });

  it('só mexe em `other`, e degrada para ele quando não há resposta', () => {
    expect(resolveOtherLanguage({ name: 'Loxodon', source: 'GGR' }, 'elvish')).toBe('elvish');
    // O Human (Ixalan) fica DE FORA de propósito: lá o idioma depende da origem
    // nacional do personagem, então não há um nome só.
    expect(resolveOtherLanguage({ name: 'Human (Ixalan)', source: 'PSX' }, 'other')).toBe('other');
    expect(resolveOtherLanguage(null, 'other')).toBe('other');
  });

  it('o grant FIXO chega traduzido na derivação da espécie', () => {
    const race = { name: 'Loxodon', source: 'GGR', languageProficiencies: [{ common: true, other: true }] };
    expect(parseSpecies(race).languages.fixed).toEqual(['common', 'Loxodon']);
  });

  it('e a OPÇÃO do seletor também (o único caso é o Simic Hybrid)', () => {
    const race = {
      name: 'Simic Hybrid',
      source: 'GGR',
      languageProficiencies: [{ common: true, choose: { from: ['elvish', 'other'], count: 1 } }],
    };
    const opts = parseChoices(race).find((c) => c.kind === 'language').pool.options;
    expect(opts.map((o) => o.label)).toEqual(['Elvish', 'Vedalken']);
  });

  it('o registro não tem entrada vazia (uma linha sem idioma seria pior que não ter)', () => {
    for (const [key, lang] of Object.entries(OTHER_LANGUAGE)) {
      expect(key, `chave ${key}`).toMatch(/^.+\|.+$/);
      expect(lang.length, `idioma de ${key}`).toBeGreaterThan(0);
    }
  });
});
