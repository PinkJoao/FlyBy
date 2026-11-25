// =============================================================================
// theme.test: a resolução da escolha de tema
// =============================================================================
// O QUE FAZ
//   resolveTheme: os três temas valem como estão; 'system' e qualquer valor
//   desconhecido (uma preferência gravada por outra versão) seguem o aparelho.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { resolveTheme, THEME_CHOICES } from './theme';

describe('resolveTheme', () => {
  it('um tema explícito vale como está', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('paper', true)).toBe('paper');
  });

  it("'system' e o desconhecido seguem o aparelho", () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme(undefined, true)).toBe('dark');
    expect(resolveTheme('sepia', false)).toBe('light');
  });

  it('toda escolha oferecida resolve', () => {
    for (const { value } of THEME_CHOICES) expect(['dark', 'light', 'paper']).toContain(resolveTheme(value, true));
  });
});
