import { describe, it, expect } from 'vitest';
import { applyUsesOverlay, INNATE_USES, curatedAdditionalSpells } from './grantedSpellUses';
import { grantedSpells, castTypeLabel } from './grantedSpells';

/** Atalho: parseia um `additionalSpells` real e aplica o overlay da entidade. */
function granted(additionalSpells, level, entity) {
  return applyUsesOverlay(grantedSpells(additionalSpells, level).spells, entity);
}

// Formas cruas reais (5etools).
const aarakocra = [{ innate: { 3: ['gust of wind'] }, ability: { choose: ['int', 'wis', 'cha'] } }];
const firbolg = [{ innate: { 1: ['detect magic', 'disguise self'] }, ability: { choose: ['int', 'wis', 'cha'] } }];
const yuanTi = [{ innate: { 1: ['animal friendship'] } }];
const ancestralGuardian = [{ innate: { 10: ['augury', 'clairvoyance'] } }];
const greatOldOne = [{ innate: { 10: ['hex|xphb'] } }];
const glamour = [{ innate: { 6: ['command|xphb'] } }];
// Já codificada pelo 5etools: o overlay NÃO deve tocar.
const drowLineage = [{ innate: { 3: { daily: { 1: ['faerie fire|xphb'] } } }, known: { 1: ['dancing lights|xphb#c'] } }];

describe('applyUsesOverlay - descanso longo', () => {
  it('Aarakocra: Gust of Wind 1×/descanso longo', () => {
    const [gust] = granted(aarakocra, 3, { name: 'Aarakocra', source: 'MPMM' });
    expect(gust).toMatchObject({ castType: 'restLong', count: 1, scale: null });
    expect(castTypeLabel({ ...gust, uses: 1 })).toBe('1/Long Rest');
  });

  it('Firbolg: CADA magia tem seu próprio 1×/descanso longo', () => {
    const spells = granted(firbolg, 1, { name: 'Firbolg', source: 'MPMM' });
    expect(spells.map((s) => s.name)).toEqual(['detect magic', 'disguise self']);
    expect(spells.every((s) => s.castType === 'restLong' && s.count === 1)).toBe(true);
  });

  it('College of Glamour: Command 1×/descanso longo', () => {
    const [cmd] = granted(glamour, 6, { name: 'College of Glamour', source: 'XPHB' });
    expect(castTypeLabel({ ...cmd, uses: cmd.count })).toBe('1/Long Rest');
  });
});

describe('applyUsesOverlay - à vontade e descanso curto', () => {
  it('Yuan-Ti: Animal Friendship é ilimitada (não 1/dia)', () => {
    const [af] = granted(yuanTi, 1, { name: 'Yuan-Ti', source: 'MPMM' });
    expect(af.castType).toBe('will');
    expect(castTypeLabel(af)).toBe('At Will');
  });

  it('Path of the Ancestral Guardian: 1×/descanso (curto ou longo)', () => {
    const spells = granted(ancestralGuardian, 10, { name: 'Path of the Ancestral Guardian', source: 'XGE' });
    expect(spells.map((s) => s.name)).toEqual(['augury', 'clairvoyance']);
    expect(castTypeLabel({ ...spells[0], uses: 1 })).toBe('1/Rest');
  });
});

describe('applyUsesOverlay - `innate` que NÃO concede conjuração grátis', () => {
  it('Great Old One: Hex é só "sempre preparada" e gasta espaço de magia', () => {
    const [hex] = granted(greatOldOne, 10, { name: 'Great Old One Patron', source: 'XPHB' });
    expect(hex.castType).toBeNull();
    expect(castTypeLabel(hex)).toBeNull(); // nenhum chip de uso
  });
});

describe('applyUsesOverlay - limites do overlay', () => {
  it('não toca no que o 5etools já codifica (Drow: daily 1)', () => {
    const spells = granted(drowLineage, 3, { name: 'Elf; Drow Lineage', source: 'XPHB' });
    const ff = spells.find((s) => s.name === 'faerie fire');
    expect(ff).toMatchObject({ castType: 'daily', count: 1 });
  });

  it('entidade desconhecida passa intacta (fica "No Spell Slot")', () => {
    const [gust] = granted(aarakocra, 3, { name: 'Homebrewfolk', source: 'HB' });
    expect(gust.castType).toBe('innate');
    expect(castTypeLabel(gust)).toBe('No Spell Slot');
  });

  it('sem entidade, ou sem magias, não explode', () => {
    expect(applyUsesOverlay(granted(aarakocra, 3, null), null)).toHaveLength(1);
    expect(applyUsesOverlay(null, { name: 'Aarakocra', source: 'MPMM' })).toEqual([]);
  });

  it('uma magia da entidade fora do overlay fica intacta', () => {
    const extra = [{ innate: { 1: ['gust of wind', 'fly'] } }];
    const spells = granted(extra, 1, { name: 'Aarakocra', source: 'MPMM' });
    expect(spells.find((s) => s.name === 'gust of wind').castType).toBe('restLong');
    expect(spells.find((s) => s.name === 'fly').castType).toBe('innate');
  });
});

describe('INNATE_USES - sanidade da tabela', () => {
  it('toda chave é "Nome|FONTE" e todo valor é um castType conhecido', () => {
    const allowed = new Set(['restLong', 'rest', 'will', null]);
    for (const [key, table] of Object.entries(INNATE_USES)) {
      expect(key).toMatch(/^.+\|[A-Za-z0-9]+$/);
      for (const [spell, override] of Object.entries(table)) {
        expect(spell).toBe(spell.toLowerCase());
        expect(allowed.has(override.castType)).toBe(true);
      }
    }
  });
});

describe('curatedAdditionalSpells - concessões que o dado omite (TC-0026)', () => {
  // Forma real do College of Spirits RHW: só o Spirit Guardians de L6 no dado.
  const spiritsRhw = {
    name: 'College of Spirits',
    source: 'RHW',
    additionalSpells: [{ prepared: { 6: { daily: { '1e': ['spirit guardians|xphb'] } } } }],
  };

  it('funde o Guidance curado no PRIMEIRO grupo (nunca cria grupo novo)', () => {
    const out = curatedAdditionalSpells(spiritsRhw);
    expect(out).toHaveLength(1); // grupo novo = alternativa = spellSet falso
    expect(out[0].known[3]).toEqual(['guidance|xphb#c']);
    expect(out[0].prepared[6]).toEqual(spiritsRhw.additionalSpells[0].prepared[6]);
    // Nunca muta o dado original.
    expect(spiritsRhw.additionalSpells[0].known).toBeUndefined();
  });

  it('a fusão chega às magias concedidas no nível certo', () => {
    const spells = grantedSpells(curatedAdditionalSpells(spiritsRhw), 3).spells;
    expect(spells.map((s) => s.name)).toEqual(['guidance']);
  });

  it('entidade fora do registro devolve o campo original intacto', () => {
    const other = { name: 'College of Lore', source: 'XPHB', additionalSpells: [{ known: { 1: ['x'] } }] };
    expect(curatedAdditionalSpells(other)).toBe(other.additionalSpells);
    expect(curatedAdditionalSpells(null)).toBeUndefined();
  });
});
