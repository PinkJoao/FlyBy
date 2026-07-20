import { describe, it, expect } from 'vitest';
import { createCharacter, createClassEntry } from '../schema/character';
import {
  resolveClassObj,
  resolveSubclassObj,
  resolveRaceObj,
  buildClassDataById,
  deriveFromDb,
} from './resolve';
import { fighterClassData, warlockClassData } from './fixtures/classData';
import { elfSpecies } from './fixtures/speciesData';

// db mínimo no formato real: chaves `class-X` com {class:[],subclass:[]}, e races.race.
const db = {
  'class-fighter': {
    class: [
      { ...fighterClassData, source: 'PHB' }, // reprint legado
      fighterClassData, // XPHB (mais recente)
    ],
    subclass: [
      { name: 'Champion', shortName: 'Champion', className: 'Fighter', source: 'XPHB' },
    ],
  },
  'class-warlock': { class: [warlockClassData], subclass: [] },
  races: { race: [elfSpecies] },
};

describe('resolveClassObj', () => {
  it('prefere a entrada que casa com a fonte do personagem', () => {
    expect(resolveClassObj(db, 'fighter', 'PHB').source).toBe('PHB');
  });
  it('sem fonte, pega a última (mais recente)', () => {
    expect(resolveClassObj(db, 'fighter').source).toBe('XPHB');
  });
  it('classe inexistente → null', () => {
    expect(resolveClassObj(db, 'bard')).toBeNull();
  });
});

describe('resolveSubclassObj / resolveRaceObj', () => {
  it('acha a subclasse pelo shortName', () => {
    expect(resolveSubclassObj(db, 'fighter', 'Champion')?.name).toBe('Champion');
  });
  it('acha a raça pelo nome em minúsculas', () => {
    expect(resolveRaceObj(db, 'elf', 'XPHB')?.name).toBe('Elf');
  });

  // TC-0027: subclasse legada anexada à classe 2024 é um STUB `_copy` que traz
  // só as subclassFeatures re-apontadas - todo o resto (additionalSpells das
  // domain spells) herda da original e sumia sem resolver a cópia.
  it('resolve o stub _copy herdando additionalSpells e mantendo as features do stub', () => {
    const stubDb = {
      'class-cleric': {
        class: [],
        subclass: [
          {
            name: 'Nature Domain',
            shortName: 'Nature',
            className: 'Cleric',
            source: 'PHB',
            classSource: 'PHB',
            additionalSpells: [{ prepared: { 1: ['animal friendship'] } }],
            subclassFeatures: ['Nature Domain|Cleric|PHB|Nature|PHB|1'],
          },
          {
            name: 'Nature Domain',
            shortName: 'Nature',
            className: 'Cleric',
            source: 'PHB',
            classSource: 'XPHB',
            subclassFeatures: ['Nature Domain|Cleric|XPHB|Nature|PHB|3'],
            _copy: {
              name: 'Nature Domain',
              source: 'PHB',
              shortName: 'Nature',
              className: 'Cleric',
              classSource: 'PHB',
            },
          },
        ],
      },
    };
    const sub = resolveSubclassObj(stubDb, 'cleric', 'Nature', 'PHB');
    // Pega o anexo XPHB (último), mas com a herança resolvida:
    expect(sub.classSource).toBe('XPHB');
    expect(sub.subclassFeatures).toEqual(['Nature Domain|Cleric|XPHB|Nature|PHB|3']);
    expect(sub.additionalSpells).toEqual([{ prepared: { 1: ['animal friendship'] } }]);
  });
});

describe('buildClassDataById', () => {
  it('mapeia todas as classes do personagem para objetos do db', () => {
    const c = createCharacter();
    const fighter = createClassEntry(true);
    fighter.classId = 'fighter';
    fighter.source = 'XPHB';
    const warlock = createClassEntry(false);
    warlock.classId = 'warlock';
    c.classes = [fighter, warlock];
    const map = buildClassDataById(c, db);
    expect(Object.keys(map).sort()).toEqual(['fighter', 'warlock']);
    expect(map.fighter.source).toBe('XPHB');
  });
});

describe('deriveFromDb - ponta a ponta com db ao vivo', () => {
  it('deriva HP e saves usando o dado de vida e os saves da classe', () => {
    const c = createCharacter();
    const fighter = createClassEntry(true);
    fighter.classId = 'fighter';
    fighter.source = 'XPHB';
    fighter.level = 1;
    c.classes = [fighter];
    c.scores = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 };

    const d = deriveFromDb(c, db);
    expect(d.level).toBe(1);
    expect(d.proficiencyBonus).toBe(2);
    expect(d.maxHp).toBe(12); // Fighter d10 nível 1 (max 10) + CON +2
    expect(d.saves.str).toBe(2); // proficiente (mod 0 + PB 2)
    expect(d.saves.con).toBe(4); // proficiente (mod +2 + PB 2)
    expect(d.saves.dex).toBe(0); // não proficiente
  });

  it('degrada com elegância sem db (sem dados de classe)', () => {
    const c = createCharacter();
    c.classes[0].classId = 'fighter';
    const d = deriveFromDb(c, {});
    expect(d.maxHp).toBeNull(); // sem hitDieMax → HP fica nulo
    expect(d.scores.str).toBe(10); // atributos seguem válidos
  });
});
