import { describe, it, expect } from 'vitest';
import { deriveSubclassGrants, subclassConditionalChoices, subclassGrantGroups } from './subclassGrants';

// db mínimo: artificer (Armorer TCE), ranger (Gloom Stalker XPHB), monk (Mercy XPHB).
const db = {
  'class-artificer': {
    class: [{ name: 'Artificer', source: 'TCE', proficiency: ['con', 'int'], startingProficiencies: {} }],
    subclass: [{ name: 'Armorer', shortName: 'Armorer', source: 'TCE', subclassFeatures: [] }],
  },
  'class-ranger': {
    class: [{ name: 'Ranger', source: 'XPHB', proficiency: ['str', 'dex'], startingProficiencies: {} }],
    subclass: [{ name: 'Gloom Stalker', shortName: 'Gloom Stalker', source: 'XPHB', subclassFeatures: [] }],
  },
  'class-monk': {
    class: [{ name: 'Monk', source: 'XPHB', proficiency: ['str', 'dex'], startingProficiencies: {} }],
    subclass: [{ name: 'Warrior of Mercy', shortName: 'Mercy', source: 'XPHB', subclassFeatures: [] }],
  },
  'class-druid': {
    class: [{ name: 'Druid', source: 'XPHB', proficiency: ['int', 'wis'], startingProficiencies: {} }],
    subclass: [{ name: 'Circle of the Shepherd', shortName: 'Shepherd', source: 'XGE', subclassFeatures: [] }],
  },
  races: { race: [] },
  feats: { feat: [] },
};

const mk = (classId, subclassId, level, extra = {}) => ({
  classes: [{ classId, source: db[`class-${classId}`].class[0].source, subclassId, level, isOriginalClass: true, choices: {}, ...extra }],
  origin: {},
  species: null,
});

describe('deriveSubclassGrants (TC-0012)', () => {
  it('Armorer TCE: Heavy Armor + Smith\'s Tools no nível 3+', () => {
    const out = deriveSubclassGrants(mk('artificer', 'Armorer', 3), db);
    expect(out.armor).toEqual(['Heavy Armor']);
    expect(out.grantedTools).toEqual(["Smith's Tools"]);
  });

  it('abaixo do nível da feature, nada é concedido', () => {
    const out = deriveSubclassGrants(mk('artificer', 'Armorer', 2), db);
    expect(out.armor).toEqual([]);
    expect(out.grantedTools).toEqual([]);
  });

  it('Gloom Stalker: save de Wis fixo no nível 7', () => {
    expect(deriveSubclassGrants(mk('ranger', 'Gloom Stalker', 7), db).saves).toEqual(['wis']);
    expect(deriveSubclassGrants(mk('ranger', 'Gloom Stalker', 6), db).saves).toEqual([]);
  });

  it('Mercy: Insight + Medicine + Herbalism Kit', () => {
    const out = deriveSubclassGrants(mk('monk', 'Mercy', 3), db);
    expect(out.grantedSkills).toEqual(['ins', 'med']);
    expect(out.grantedTools).toEqual(['Herbalism Kit']);
  });

  it('Shepherd: Sylvan (Speech of the Woods) no nível 3+', () => {
    expect(deriveSubclassGrants(mk('druid', 'Shepherd', 3), db).languages).toEqual(['Sylvan']);
  });

  it('filtro por fonte: grupos EFA não se aplicam à subclasse TCE', () => {
    const subObj = db['class-artificer'].subclass[0];
    const groups = subclassGrantGroups('artificer', subObj, 3);
    expect(groups.every((g) => !g.source || g.source === 'TCE')).toBe(true);
    expect(groups.some((g) => (g.tools ?? []).includes('Herbalism Kit'))).toBe(false);
  });
});

describe('subclassConditionalChoices ("if you already have…")', () => {
  const armorerObj = db['class-artificer'].subclass[0];

  it('sem conflito de ferramenta, nenhuma escolha condicional', () => {
    const c = mk('artificer', 'Armorer', 3);
    expect(subclassConditionalChoices(db, c.classes[0], armorerObj, c)).toEqual([]);
  });

  it('Smith\'s Tools já de outra fonte → escolha de artisan tool substituta', () => {
    const c = mk('artificer', 'Armorer', 3);
    c.origin = { toolProficiencies: ["Smith's Tools"] };
    const out = subclassConditionalChoices(db, c.classes[0], armorerObj, c);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'sub:cond-tool@3', kind: 'tool', count: 1 });
    expect(out[0].pool.category).toBe('AT');
  });

  it('Gloom Stalker num monge multiclasse (Wis já proficiente) → escolha Int/Cha', () => {
    const gloomObj = db['class-ranger'].subclass[0];
    const c = {
      classes: [
        { classId: 'monk', source: 'XPHB', level: 1, isOriginalClass: true, choices: {} },
        { classId: 'ranger', source: 'XPHB', subclassId: 'Gloom Stalker', level: 7, choices: {} },
      ],
      origin: {},
      species: null,
    };
    // Monk XPHB salva str/dex no mock - troca para incluir wis p/ disparar a condição.
    db['class-monk'].class[0].proficiency = ['str', 'wis'];
    const out = subclassConditionalChoices(db, c.classes[1], gloomObj, c);
    db['class-monk'].class[0].proficiency = ['str', 'dex'];
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'sub:cond-save@7', kind: 'save' });
    expect(out[0].pool.options.map((o) => o.value)).toEqual(['int', 'cha']);
  });

  it('Gloom Stalker como ranger puro (Wis NÃO proficiente) → sem escolha', () => {
    const gloomObj = db['class-ranger'].subclass[0];
    const c = mk('ranger', 'Gloom Stalker', 7);
    expect(subclassConditionalChoices(db, c.classes[0], gloomObj, c)).toEqual([]);
  });
});
