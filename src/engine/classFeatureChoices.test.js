import { describe, it, expect } from 'vitest';
import {
  classLevelChoices,
  classToolChoices,
  subclassFeatureChoices,
  weaponMasteryCount,
  pruneChoicesAboveLevel,
} from './classFeatureChoices';

// Recorte de um fighter XPHB: features relevantes + tabela com Weapon Mastery.
const fighterObj = {
  classTableGroups: [
    {
      colLabels: ['Second Wind', 'Weapon Mastery'],
      rows: [
        ['2', '3'], ['2', '3'], ['2', '3'], ['3', '4'], ['3', '4'],
      ],
    },
  ],
};

const fighterParsed = {
  id: 'fighter',
  features: [
    { name: 'Fighting Style', level: 1 },
    { name: 'Weapon Mastery', level: 1 },
    { name: 'Second Wind', level: 1 },
    { name: 'Ability Score Improvement', level: 4 },
    { name: 'Epic Boon', level: 19 },
  ],
};

const rogueParsed = {
  id: 'rogue',
  features: [
    { name: 'Expertise', level: 1 },
    { name: 'Weapon Mastery', level: 1 },
    { name: 'Expertise', level: 6 },
    { name: 'Ability Score Improvement', level: 4 },
  ],
};

describe('classLevelChoices', () => {
  it('generates fighting style + weapon mastery at level 1', () => {
    const out = classLevelChoices(fighterParsed, fighterObj, 1);
    const ids = out.map((c) => c.id);
    expect(ids).toContain('feat@1'); // fighting style
    expect(ids).toContain('weaponMastery');
    expect(ids).not.toContain('feat@4'); // ainda não
    const fs = out.find((c) => c.id === 'feat@1');
    expect(fs.pool).toEqual({ type: 'feat', category: ['FS'] });
  });

  it('weapon mastery pool: Barbarian restringe a melee, Fighter não (TC-0021)', () => {
    const fighter = classLevelChoices(fighterParsed, { ...fighterObj, name: 'Fighter' }, 1);
    expect(fighter.find((c) => c.id === 'weaponMastery').pool.weaponFilter).toBeNull();
    const barb = classLevelChoices(fighterParsed, { ...fighterObj, name: 'Barbarian' }, 1);
    expect(barb.find((c) => c.id === 'weaponMastery').pool.weaponFilter).toEqual({ kind: 'melee' });
  });

  it('adds ASI feat choice at level 4 (category G)', () => {
    const out = classLevelChoices(fighterParsed, fighterObj, 4);
    const asi = out.find((c) => c.id === 'feat@4');
    expect(asi.pool.category).toEqual(['G']);
  });

  it('epic boon uses category EB', () => {
    const out = classLevelChoices(fighterParsed, fighterObj, 19);
    const boon = out.find((c) => c.id === 'feat@19');
    expect(boon.pool.category).toEqual(['EB']);
  });

  it('expertise appears per level with count 2', () => {
    const lvl1 = classLevelChoices(rogueParsed, {}, 1);
    expect(lvl1.filter((c) => c.kind === 'expertise')).toHaveLength(1);
    const lvl6 = classLevelChoices(rogueParsed, {}, 6);
    expect(lvl6.filter((c) => c.kind === 'expertise')).toHaveLength(2);
    expect(lvl6.find((c) => c.id === 'expertise@6').count).toBe(2);
  });

  it('paladin/ranger fighting style includes class variant category', () => {
    const paladin = { id: 'paladin', features: [{ name: 'Fighting Style', level: 2 }] };
    const out = classLevelChoices(paladin, {}, 2);
    expect(out[0].pool.category).toEqual(['FS', 'FS:P']);
  });

  it('detects expertise + languages in a prose-named feature (Ranger Deft Explorer)', () => {
    const ranger = { id: 'ranger', features: [{ name: 'Deft Explorer', level: 2 }] };
    const out = classLevelChoices(ranger, {}, 2);
    const exp = out.find((c) => c.id === 'expertise@deft explorer@2');
    const lang = out.find((c) => c.id === 'language@deft explorer@2');
    expect(exp).toMatchObject({ kind: 'expertise', count: 1 });
    expect(lang).toMatchObject({ kind: 'language', count: 2, pool: { type: 'any', of: 'language' } });
    // Não aparece antes do nível.
    expect(classLevelChoices(ranger, {}, 1)).toHaveLength(0);
  });

  it('Wizard Scholar expertise carries a restricted skill list (`from`)', () => {
    const wizard = { id: 'wizard', features: [{ name: 'Scholar', level: 2 }] };
    const exp = classLevelChoices(wizard, {}, 2).find((c) => c.kind === 'expertise');
    expect(exp.count).toBe(1);
    expect(exp.from).toEqual(['arc', 'his', 'inv', 'med', 'nat', 'rel']);
  });

  it('Barbarian Primal Knowledge grants a skill from the class list (`classSkills`)', () => {
    const barb = {
      id: 'barbarian',
      skillChoice: { from: ['ani', 'ath', 'itm', 'nat', 'prc', 'sur'], count: 2 },
      features: [{ name: 'Primal Knowledge', level: 3 }],
    };
    const skill = classLevelChoices(barb, {}, 3).find((c) => c.kind === 'skill');
    expect(skill).toMatchObject({ count: 1, from: ['ani', 'ath', 'itm', 'nat', 'prc', 'sur'] });
  });
});

describe('subclassFeatureChoices', () => {
  // db mínimo com features de subclasse (Bard/Lore + Fighter/Battle Master).
  const db = {
    'class-bard': {
      subclassFeature: [
        { name: 'Bonus Proficiencies', source: 'XPHB', className: 'Bard', classSource: 'XPHB', subclassShortName: 'Lore', subclassSource: 'XPHB', level: 3, entries: ['x'] },
      ],
    },
    'class-fighter': {
      subclassFeature: [
        { name: 'Student of War', source: 'XPHB', className: 'Fighter', classSource: 'XPHB', subclassShortName: 'Battle Master', subclassSource: 'XPHB', level: 3, entries: ['x'] },
      ],
    },
  };
  const bardLore = { shortName: 'Lore', source: 'XPHB', subclassFeatures: ['Bonus Proficiencies|Bard|XPHB|Lore|XPHB|3'] };
  const battleMaster = { shortName: 'Battle Master', source: 'XPHB', subclassFeatures: ['Student of War|Fighter|XPHB|Battle Master|XPHB|3'] };

  it('Bard College of Lore grants 3 skills of any kind', () => {
    const out = subclassFeatureChoices(db, 'bard', bardLore, 3);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'sub:skill@lore|bonus proficiencies@3', kind: 'skill', count: 3, pool: { type: 'any', of: 'skill' } });
    expect(out[0].from).toBeUndefined();
  });

  it('Battle Master Student of War grants an artisan tool + a class skill', () => {
    const out = subclassFeatureChoices(db, 'fighter', battleMaster, 3, ['acr', 'ath', 'his']);
    const tool = out.find((c) => c.kind === 'tool');
    const skill = out.find((c) => c.kind === 'skill');
    expect(tool).toMatchObject({ count: 1, pool: { type: 'any', of: 'tool', category: 'AT' } });
    expect(skill).toMatchObject({ count: 1, from: ['acr', 'ath', 'his'] });
  });

  it('gates by level and prunes below it', () => {
    expect(subclassFeatureChoices(db, 'bard', bardLore, 2)).toHaveLength(0);
    expect(subclassFeatureChoices(null, 'bard', null, 3)).toEqual([]);
  });
});

describe('classToolChoices', () => {
  it('turns tool choice tokens into category-restricted selectors, ignoring fixed grants', () => {
    const artificer = {
      startingProficiencies: { toolProficiencies: [{ "thieves' tools": true, "tinker's tools": true, anyArtisansTool: 1 }] },
    };
    const out = classToolChoices(artificer);
    expect(out).toEqual([
      { id: 'tool@start-0', kind: 'tool', count: 1, level: 1, label: "Artisan's Tools", pool: { type: 'any', of: 'tool', category: 'AT' } },
    ]);
  });

  it('reads the count and instrument category (Bard: three instruments)', () => {
    const bard = { startingProficiencies: { toolProficiencies: [{ anyMusicalInstrument: 3 }] } };
    expect(classToolChoices(bard)[0]).toMatchObject({ count: 3, pool: { category: 'INS' } });
  });

  it('no tool proficiencies → no choices', () => {
    expect(classToolChoices({ startingProficiencies: {} })).toEqual([]);
    expect(classToolChoices(null)).toEqual([]);
  });
});

describe('weaponMasteryCount', () => {
  it('reads the class-table column (fighter scales)', () => {
    expect(weaponMasteryCount(fighterObj, 1)).toBe(3);
    expect(weaponMasteryCount(fighterObj, 4)).toBe(4);
  });

  it('defaults to 2 without a column (rogue/paladin/ranger)', () => {
    expect(weaponMasteryCount({}, 1)).toBe(2);
    expect(weaponMasteryCount(null, 5)).toBe(2);
  });
});

describe('pruneChoicesAboveLevel', () => {
  it('drops entries whose id level exceeds the new level', () => {
    const bag = {
      'skill': { kind: 'skill', picks: ['ath'] },
      'feat@4': { kind: 'feat', picks: ['Ability Score Improvement|XPHB'] },
      'feat@8': { kind: 'feat', picks: ['Grappler|XPHB'] },
      'expertise@6': { kind: 'expertise', picks: ['ste'] },
      'weaponMastery': { kind: 'weapon', picks: ['Longsword|XPHB'] },
    };
    const out = pruneChoicesAboveLevel(bag, 5);
    expect(Object.keys(out).sort()).toEqual(['feat@4', 'skill', 'weaponMastery']);
  });
});

describe('cleanupClassEntry (level-down centralizado)', () => {
  it('poda escolhas acima do nível, apara Weapon Mastery e reverte subclasse abaixo do nível dela', () => {
    return import('./classFeatureChoices').then(({ cleanupClassEntry }) => {
      const classObj = {
        classTableGroups: [
          { colLabels: ['Weapon Mastery'], rows: Array.from({ length: 20 }, (_, i) => [i < 3 ? '2' : '3']) },
        ],
      };
      const cls = {
        uid: 'a',
        classId: 'barbarian',
        level: 2, // desceu p/ 2
        subclassId: 'Berserker',
        subclassSource: 'XPHB',
        choices: {
          weaponMastery: { kind: 'weapon', picks: ['Greataxe', 'Handaxe', 'Maul'] }, // 3 → apara p/ 2
          'feat@4': { kind: 'feat', picks: ['Alert|XPHB'] }, // > 2 → some
          'sub:foo': { kind: 'skill', picks: ['ath'] }, // grant da subclasse → some
          'primal knowledge@3': { kind: 'skill', picks: ['ins'] }, // > 2 → some
        },
      };
      const out = cleanupClassEntry(cls, { classObj, subclassObj: null, subclassLevel: 3 });
      expect(out.subclassId).toBe(null); // nível 2 < 3 → reverte
      expect(out.choices.weaponMastery.picks).toEqual(['Greataxe', 'Handaxe']); // aparado
      expect(out.choices['feat@4']).toBeUndefined();
      expect(out.choices['primal knowledge@3']).toBeUndefined();
      expect(out.choices['sub:foo']).toBeUndefined(); // grant da subclasse revertida
    });
  });

  it('acima do nível de subclasse: mantém subclasse e só poda o que excede', () => {
    return import('./classFeatureChoices').then(({ cleanupClassEntry }) => {
      const cls = {
        uid: 'a', classId: 'rogue', level: 5, subclassId: 'Thief', subclassSource: 'XPHB',
        choices: { 'expertise@1': { kind: 'expertise', picks: ['ste', 'per'] }, 'feat@8': { kind: 'feat', picks: ['Alert|XPHB'] } },
      };
      const out = cleanupClassEntry(cls, { classObj: {}, subclassObj: null, subclassLevel: 3 });
      expect(out.subclassId).toBe('Thief');
      expect(out.choices['expertise@1']).toBeDefined();
      expect(out.choices['feat@8']).toBeUndefined(); // 8 > 5
    });
  });
});

describe('optionalFeatureChoices + optionalFeatureCount', () => {
  it('conta a partir de array (índice=nível-1) e de objeto (maior chave ≤ nível)', () => {
    // import inline p/ não poluir o topo
    return import('./classFeatureChoices').then(({ optionalFeatureCount }) => {
      expect(optionalFeatureCount([1, 3, 3, 3, 5], 1)).toBe(1);
      expect(optionalFeatureCount([1, 3, 3, 3, 5], 5)).toBe(5);
      expect(optionalFeatureCount({ 2: 2, 10: 4, 17: 6 }, 9)).toBe(2);
      expect(optionalFeatureCount({ 2: 2, 10: 4, 17: 6 }, 17)).toBe(6);
      expect(optionalFeatureCount({ 3: 3 }, 1)).toBe(0);
    });
  });

  it('gera choices de classe + subclasse com featureType e count', () => {
    return import('./classFeatureChoices').then(({ optionalFeatureChoices }) => {
      const classObj = {
        optionalfeatureProgression: [{ name: 'Metamagic', featureType: ['MM'], progression: { 2: 2, 10: 4 } }],
      };
      const subclass = {
        shortName: 'Battle Master',
        optionalfeatureProgression: [{ name: 'Maneuvers', featureType: ['MV:B'], progression: { 3: 3, 7: 5 } }],
      };
      const out = optionalFeatureChoices(classObj, subclass, 10);
      expect(out).toEqual([
        { id: 'optfeat@MM', kind: 'optionalfeature', count: 4, level: 2, label: 'Metamagic', feature: { name: 'Metamagic', level: 2 }, pool: { type: 'optionalfeature', featureType: ['MM'] } },
        { id: 'optfeat@MV:B', kind: 'optionalfeature', count: 5, level: 3, label: 'Maneuvers', feature: { name: 'Maneuvers', level: 3, subclass: 'Battle Master' }, pool: { type: 'optionalfeature', featureType: ['MV:B'] } },
      ]);
    });
  });

  it('omite choices com count 0 (abaixo do nível de aquisição)', () => {
    return import('./classFeatureChoices').then(({ optionalFeatureChoices }) => {
      const classObj = { optionalfeatureProgression: [{ name: 'Metamagic', featureType: ['MM'], progression: { 2: 2 } }] };
      expect(optionalFeatureChoices(classObj, null, 1)).toEqual([]);
    });
  });

  it('featureType FS:* vira seletor de FEAT (categoria FS), não optional feature', () => {
    return import('./classFeatureChoices').then(({ optionalFeatureChoices }) => {
      // Bard College of Swords: Fighting Style via optionalfeatureProgression FS:B.
      const subclass = { shortName: 'Swords', optionalfeatureProgression: [{ name: 'Fighting Style', featureType: ['FS:B'], progression: { 3: 1 } }] };
      const out = optionalFeatureChoices({}, subclass, 3);
      expect(out).toEqual([
        { id: 'feat@fs@FS:B', kind: 'feat', count: 1, level: 3, label: 'Fighting Style', feature: { name: 'Fighting Style', level: 3, subclass: 'Swords' }, pool: { type: 'feat', category: ['FS'], fsTypes: ['FS:B'] } },
      ]);
    });
  });
});

describe('weaponProf (Kensei) - proficiência de arma individual', () => {
  const kenseiDb = {
    'class-monk': {
      subclassFeature: [
        { name: 'Path of the Kensei', source: 'XGE', className: 'Monk', classSource: 'PHB', subclassShortName: 'Kensei', subclassSource: 'XGE', level: 3, entries: ['x'] },
      ],
    },
  };
  const kensei = { shortName: 'Kensei', source: 'XGE', subclassFeatures: [] };

  it('nível 3: ferramenta + arma melee + arma ranged (ids desambiguados por tag)', () => {
    const out = subclassFeatureChoices(kenseiDb, 'monk', kensei, 3);
    const wp = out.filter((c) => c.kind === 'weaponProf');
    expect(out.some((c) => c.kind === 'tool')).toBe(true);
    expect(wp.map((c) => c.id)).toEqual([
      'sub:weaponProf@kensei|path of the kensei@3:melee',
      'sub:weaponProf@kensei|path of the kensei@3:ranged',
    ]);
    expect(wp[0].pool.weaponFilter).toMatchObject({ kind: 'melee', noProps: ['H', 'S'] });
    expect(wp[1].pool.weaponFilter.allow).toEqual(['Longbow']);
  });

  it('níveis 6/11/17 destravam mais uma arma cada (level do grant, não da feature)', () => {
    expect(subclassFeatureChoices(kenseiDb, 'monk', kensei, 5).filter((c) => c.kind === 'weaponProf')).toHaveLength(2);
    expect(subclassFeatureChoices(kenseiDb, 'monk', kensei, 6).filter((c) => c.kind === 'weaponProf')).toHaveLength(3);
    const at17 = subclassFeatureChoices(kenseiDb, 'monk', kensei, 17).filter((c) => c.kind === 'weaponProf');
    expect(at17).toHaveLength(5);
    expect(at17.map((c) => c.level)).toEqual([3, 3, 6, 11, 17]);
  });
});
