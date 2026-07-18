import { describe, it, expect } from 'vitest';
import { deriveGrantedProficiencies } from './autoProficiencies';
import { createCharacter } from '../schema/character';

const db = {
  'class-fighter': {
    class: [
      {
        name: 'Fighter',
        source: 'XPHB',
        startingProficiencies: { armor: ['light', 'medium', 'heavy', 'shield'], weapons: ['simple', 'martial'] },
      },
    ],
  },
  'class-rogue': {
    class: [
      {
        name: 'Rogue',
        source: 'XPHB',
        startingProficiencies: {
          armor: ['light'],
          weapons: ['simple', "Martial weapons that have the {@filter Finesse or Light|items|...} property"],
          tools: ["{@item Thieves' Tools|XPHB}"],
        },
      },
    ],
  },
  'class-artificer': {
    class: [
      {
        name: 'Artificer',
        source: 'TCE',
        startingProficiencies: {
          armor: ['light', 'medium', 'shield'],
          tools: ["{@item thieves' tools|PHB}", "one type of {@item artisan's tools|PHB} of your choice"],
          toolProficiencies: [{ "thieves' tools": true, "tinker's tools": true, anyArtisansTool: 1 }],
        },
      },
    ],
  },
  races: {
    race: [
      { name: 'Bugbear', source: 'MPMM', size: ['M'], skillProficiencies: [{ stealth: true }] },
      { name: 'Elf', source: 'XPHB', size: ['M'], skillProficiencies: [{ choose: { from: ['perception'] } }] },
    ],
  },
};

function charWith({ classId, source = 'XPHB', raceName } = {}) {
  const c = createCharacter({ name: 'T' });
  c.classes = [{ classId, source, level: 3, isOriginalClass: true, hitPoints: {}, choices: {} }];
  if (raceName) c.species = { id: raceName.toLowerCase(), source: raceName === 'Elf' ? 'XPHB' : 'MPMM', choices: {} };
  return c;
}

describe('deriveGrantedProficiencies', () => {
  it('mapeia armor/weapons da classe p/ labels legíveis', () => {
    const out = deriveGrantedProficiencies(charWith({ classId: 'fighter' }), db);
    expect(out.armor).toEqual(['Light Armor', 'Medium Armor', 'Heavy Armor', 'Shields']);
    expect(out.weapons).toEqual(['Simple Weapons', 'Martial Weapons']);
  });

  it('limpa tags de ferramenta e texto de arma especial', () => {
    const out = deriveGrantedProficiencies(charWith({ classId: 'rogue' }), db);
    expect(out.grantedTools).toEqual(["Thieves' Tools"]);
    expect(out.weapons[0]).toBe('Simple Weapons');
    expect(out.weapons[1]).toMatch(/Martial weapons that have the Finesse or Light property/);
  });

  it('deriva tools FIXOS do campo estruturado; ignora o token de escolha (Artificer)', () => {
    const out = deriveGrantedProficiencies(charWith({ classId: 'artificer', source: 'TCE' }), db);
    expect(out.grantedTools).toEqual(["Thieves' Tools", "Tinker's Tools"]);
    // A escolha (anyArtisansTool) NÃO vira grant fixo nem vaza a prosa "of your choice".
    expect(out.grantedTools.join(' ')).not.toMatch(/of your choice/i);
  });

  it('coleta perícia FIXA da espécie (Bugbear → Stealth); ignora choose (Elf)', () => {
    expect(deriveGrantedProficiencies(charWith({ classId: 'rogue', raceName: 'Bugbear' }), db).grantedSkills).toEqual(['ste']);
    expect(deriveGrantedProficiencies(charWith({ classId: 'rogue', raceName: 'Elf' }), db).grantedSkills).toEqual([]);
  });

  it('sem classe/espécie → tudo vazio', () => {
    expect(deriveGrantedProficiencies(createCharacter(), db)).toEqual({ armor: [], weapons: [], grantedSkills: [], grantedTools: [] });
  });
});
