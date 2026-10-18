// =============================================================================
// grantedSpellUses.test: testes das correções de magias concedidas
// =============================================================================
// O QUE FAZ
//   O overlay não toca no que o 5etools já codifica; as concessões omitidas (o
//   Channeler, fundido no primeiro grupo, nunca um grupo novo), a correção de
//   nível do Forest Gnome, a remoção do Find Familiar do Druida, e o Contact
//   Patron (achado pelo usuário no premade da Sefris), com a outra metade do par.
//
// FUNÇÕES
//   granted(additionalSpells, level, entity): parseia e aplica o overlay.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { applyUsesOverlay, INNATE_USES, curatedAdditionalSpells, tableColumnAt } from './grantedSpellUses';
import { grantedSpells, castTypeLabel } from './grantedSpells';

/** Parseia um `additionalSpells` real e aplica o overlay da entidade. */
function granted(additionalSpells, level, entity) {
  return applyUsesOverlay(grantedSpells(additionalSpells, level).spells, entity);
}

const aarakocra = [{ innate: { 3: ['gust of wind'] }, ability: { choose: ['int', 'wis', 'cha'] } }];
const firbolg = [{ innate: { 1: ['detect magic', 'disguise self'] }, ability: { choose: ['int', 'wis', 'cha'] } }];
const yuanTi = [{ innate: { 1: ['animal friendship'] } }];
const ancestralGuardian = [{ innate: { 10: ['augury', 'clairvoyance'] } }];
const greatOldOne = [{ innate: { 10: ['hex|xphb'] } }];
const glamour = [{ innate: { 6: ['command|xphb'] } }];
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
    expect(castTypeLabel(hex)).toBeNull();
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

describe('applyUsesOverlay - contagem que escala com o nível (TC-0090)', () => {
  const ranger = {
    name: 'Ranger',
    source: 'XPHB',
    classTableGroups: [{ colLabels: ['Favored Enemy'], rows: [[2], [2], [2], [2], [3], [3], [3], [3], [4], [4], [4], [4], [5], [5], [5], [5], [6], [6], [6], [6]] }],
  };
  const hm = [{ name: "hunter's mark", source: 'xphb' }];

  it('lê a coluna da tabela da classe no nível', () => {
    expect([1, 5, 9, 13, 17, 20].map((lv) => applyUsesOverlay(hm, ranger, lv)[0].count)).toEqual([2, 3, 4, 5, 6, 6]);
  });

  it('marca que o pool mora no item da feature', () => {
    const [out] = applyUsesOverlay(hm, ranger, 5);
    expect(out.castType).toBe('restLong');
    expect(out.poolOnFeature).toBe('Favored Enemy');
  });

  it('tableColumnAt aceita célula objeto e devolve null sem a coluna', () => {
    const e = { classTableGroups: [{ colLabels: ['X'], rows: [[{ type: 'bonus', value: 3 }]] }] };
    expect(tableColumnAt(e, 'x', 1)).toBe(3);
    expect(tableColumnAt(e, 'Y', 1)).toBeNull();
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
  const spiritsRhw = {
    name: 'College of Spirits',
    source: 'RHW',
    additionalSpells: [{ prepared: { 6: { daily: { '1e': ['spirit guardians|xphb'] } } } }],
  };

  it('funde o Guidance curado no PRIMEIRO grupo (nunca cria grupo novo)', () => {
    const out = curatedAdditionalSpells(spiritsRhw);
    expect(out).toHaveLength(1);
    expect(out[0].known[3]).toEqual(['guidance|xphb#c']);
    expect(out[0].prepared[6]).toEqual(spiritsRhw.additionalSpells[0].prepared[6]);
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

describe('curatedAdditionalSpells - correção de NÍVEL (TC-0044)', () => {
  const forestGnome = {
    name: 'Gnome; Forest Gnome Lineage',
    source: 'XPHB',
    additionalSpells: [
      {
        innate: { 3: { daily: { pb: ['speak with animals|xphb'] } } },
        ability: { choose: ['int', 'wis', 'cha'] },
        known: { 1: ['minor illusion|xphb#c'] },
      },
    ],
  };

  it('move a magia para o nível 1 preservando a estrutura de frequência', () => {
    const out = curatedAdditionalSpells(forestGnome);
    expect(out[0].innate[3]).toBeUndefined();
    expect(out[0].innate[1]).toEqual({ daily: { pb: ['speak with animals|xphb'] } });
    expect(out[0].known[1]).toEqual(['minor illusion|xphb#c']);
    expect(forestGnome.additionalSpells[0].innate[3]).toBeDefined();
  });

  it('a magia passa a ser concedida já no nível 1, com a frequência certa', () => {
    const spells = grantedSpells(curatedAdditionalSpells(forestGnome), 1).spells;
    const swa = spells.find((s) => s.name === 'speak with animals');
    expect(swa).toBeDefined();
    expect(swa.castType).toBe('daily');
    expect(swa.scale).toBe('pb');
  });

  it('sem a correção, o dado cru só concede a partir do nível 3', () => {
    const raw = forestGnome.additionalSpells;
    expect(grantedSpells(raw, 1).spells.map((s) => s.name)).toEqual(['minor illusion']);
    expect(grantedSpells(raw, 3).spells.map((s) => s.name)).toContain('speak with animals');
  });
});

describe('curatedAdditionalSpells - concessão que a REGRA não dá (TC-0082)', () => {
  const druid = {
    name: 'Druid',
    source: 'XPHB',
    additionalSpells: [{ prepared: { 1: ['speak with animals|xphb'], 2: ['find familiar|xphb'] } }],
  };

  it('tira a magia do balde e poda o nível vazio', () => {
    const out = curatedAdditionalSpells(druid);
    expect(out[0].prepared[2]).toBeUndefined();
    expect(out[0].prepared[1]).toEqual(['speak with animals|xphb']);
    expect(druid.additionalSpells[0].prepared[2]).toBeDefined();
  });

  it('a magia deixa de ser concedida em qualquer nível', () => {
    const names = grantedSpells(curatedAdditionalSpells(druid), 20).spells.map((s) => s.name);
    expect(names).toContain('speak with animals');
    expect(names).not.toContain('find familiar');
  });
});

describe('overlay sobre uma concessão PREPARED (Contact Patron, Warlock @9)', () => {
  const warlock = [{ prepared: { 9: ['contact other plane|xphb'] } }];
  const entity = { name: 'Warlock', source: 'XPHB' };

  it('preenche a frequência que só a prosa declara', () => {
    const out = granted(warlock, 11, entity);
    const cop = out.find((s) => s.name === 'contact other plane');
    expect(cop).toMatchObject({ castType: 'restLong', count: 1 });
  });

  it('abaixo do nível 9 a magia nem é concedida', () => {
    expect(granted(warlock, 5, entity).map((s) => s.name)).not.toContain('contact other plane');
  });

  it('sem a entidade certa, nada é sobreposto', () => {
    const out = granted(warlock, 11, { name: 'Warlock', source: 'PHB' });
    expect(out.find((s) => s.name === 'contact other plane').castType).toBeFalsy();
  });

  it('frequência já declarada pelo dado passa intacta', () => {
    const out = granted(drowLineage, 5, { name: 'Elf', source: 'XPHB' });
    expect(out.find((s) => s.name === 'faerie fire').castType).toBe('daily');
  });
});
