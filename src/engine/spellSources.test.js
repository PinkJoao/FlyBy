import { describe, it, expect } from 'vitest';
import { spellSources, spellSourceEntries, SPELL_SOURCE_CATEGORIES } from './spellSources';

// Formas reais do 5etools, recortadas. O db é montado por teste: o índice é
// memoizado por objeto `db` (WeakMap), então dois testes nunca se contaminam.
const fireBolt = { name: 'Fire Bolt', source: 'XPHB', level: 0, school: 'V' };
const fireball = { name: 'Fireball', source: 'XPHB', level: 3, school: 'V' };
const faerieFire = { name: 'Faerie Fire', source: 'XPHB', level: 1, school: 'V' };
const findFamiliar = { name: 'Find Familiar', source: 'XPHB', level: 1, school: 'C' };
const chaosBolt = { name: 'Chaos Bolt', source: 'XGE', level: 1, school: 'V' };

/** db mínimo: só o mapa reverso + as chaves que o índice varre. */
function makeDb(over = {}) {
  return {
    'spell-sources': {
      XPHB: {
        'Fire Bolt': { class: [{ name: 'Sorcerer', source: 'XPHB' }, { name: 'Wizard', source: 'XPHB' }] },
        Fireball: { class: [{ name: 'Wizard', source: 'XPHB' }] },
        'Faerie Fire': { class: [{ name: 'Druid', source: 'XPHB' }] },
        'Find Familiar': { class: [{ name: 'Wizard', source: 'XPHB' }] },
      },
      XGE: { 'Chaos Bolt': { classVariant: [{ name: 'Sorcerer', source: 'PHB', definedInSource: 'XGE' }] } },
    },
    races: { race: [], subrace: [] },
    feats: { feat: [] },
    backgrounds: { background: [] },
    optionalfeatures: { optionalfeature: [] },
    ...over,
  };
}

const names = (list) => list.map((e) => e.name);

describe('spellSources - a linha de CLASSES', () => {
  it('sai do mapa reverso, casando a FONTE da magia', () => {
    expect(names(spellSources(makeDb(), fireBolt).classes)).toEqual(['Sorcerer', 'Wizard']);
  });

  it('classVariant é uma categoria à parte', () => {
    const g = spellSources(makeDb(), chaosBolt);
    expect(g.classes).toEqual([]);
    expect(names(g.classesVariant)).toEqual(['Sorcerer']);
  });

  it('classVariant não repete uma classe que já está na lista', () => {
    const db = makeDb();
    db['spell-sources'].XPHB.Fireball.classVariant = [{ name: 'Wizard', source: 'XPHB' }];
    expect(names(spellSources(db, fireball).classesVariant)).toEqual([]);
  });

  it('sem o mapa, nenhuma classe (e nada estoura)', () => {
    expect(spellSources({}, fireBolt).classes).toEqual([]);
    expect(spellSources(null, fireBolt).classes).toEqual([]);
  });
});

describe('spellSources - a NATUREZA da entrada', () => {
  const dbSub = () =>
    makeDb({
      'class-cleric': {
        subclass: [
          {
            name: 'Light Domain', shortName: 'Light', source: 'XPHB', className: 'Cleric', classSource: 'XPHB',
            additionalSpells: [{ prepared: { 3: ['faerie fire|xphb'] } }],
          },
        ],
      },
      'class-fighter': {
        subclass: [
          {
            name: 'Eldritch Knight', shortName: 'Eldritch Knight', source: 'XPHB', className: 'Fighter', classSource: 'XPHB',
            additionalSpells: [{ expanded: { 3: [{ all: 'level=0|class=Wizard' }] } }],
          },
        ],
      },
    });

  it('nome concreto em prepared/known/innate é CONCEDIDO', () => {
    const g = spellSources(dbSub(), faerieFire);
    expect(g.subclasses).toEqual([
      expect.objectContaining({ name: 'Light Domain', className: 'Cleric', nature: 'granted' }),
    ]);
  });

  it('o bucket `expanded` só DISPONIBILIZA (e a expressão de filtro é resolvida)', () => {
    const g = spellSources(dbSub(), fireBolt);
    expect(g.subclasses).toEqual([
      expect.objectContaining({ name: 'Eldritch Knight', nature: 'available' }),
    ]);
    // Faerie Fire não é truque de mago: o filtro não pode alcançá-la.
    expect(names(spellSources(dbSub(), faerieFire).subclasses)).toEqual(['Light Domain']);
  });

  it('lista fechada `{choose:{from}}` é uma ESCOLHA, não uma concessão', () => {
    const db = makeDb({
      feats: {
        feat: [{ name: 'Rune Shaper', source: 'BGG', additionalSpells: [{ known: { 1: { _: [{ choose: { from: ['faerie fire|xphb', 'bless|xphb'] } }] } } }] }],
      },
    });
    expect(spellSources(db, faerieFire).feats).toEqual([
      expect.objectContaining({ name: 'Rune Shaper', nature: 'available' }),
    ]);
  });

  it('conceder vence disponibilizar quando a MESMA entidade faz as duas coisas', () => {
    const db = makeDb({
      feats: {
        feat: [{
          name: 'Duplo', source: 'XPHB',
          additionalSpells: [{ expanded: { 1: ['faerie fire|xphb'] }, prepared: { 1: ['faerie fire|xphb'] } }],
        }],
      },
    });
    expect(spellSources(db, faerieFire).feats[0].nature).toBe('granted');
  });
});

describe('spellSources - espécies, linhagens e sub-raças', () => {
  // O `additionalSpells` da BASE é a união dos grupos, um por linhagem; cada
  // `_versions` traz o seu. Listar os dois duplicaria cada magia.
  const elf = {
    name: 'Elf', source: 'XPHB',
    additionalSpells: [
      { name: 'Drow', innate: { 3: { daily: { 1: ['faerie fire|xphb'] } } } },
      { name: 'High Elf', known: { 1: { _: [{ choose: 'level=0|class=Wizard' }] } } },
    ],
    _versions: [
      { name: 'Elf; Drow Lineage', source: 'XPHB', additionalSpells: [{ innate: { 3: { daily: { 1: ['faerie fire|xphb'] } } } }] },
      { name: 'Elf; High Elf Lineage', source: 'XPHB', additionalSpells: [{ known: { 1: { _: [{ choose: 'level=0|class=Wizard' }] } } }] },
    ],
  };

  it('a LINHAGEM entra e a base sai (uma linha por concessão, não duas)', () => {
    const g = spellSources(makeDb({ races: { race: [elf], subrace: [] } }), faerieFire);
    expect(names(g.races)).toEqual(['Elf (Drow Lineage)']);
    expect(g.races[0]).toMatchObject({ baseName: 'Elf', baseSource: 'XPHB', nature: 'granted' });
  });

  it('a base FICA quando nenhuma versão traz concessão própria', () => {
    const kobold = {
      name: 'Kobold', source: 'MPMM',
      additionalSpells: [{ known: { 1: { _: [{ choose: 'level=0|class=Sorcerer' }] } } }],
      _versions: [{ name: 'Kobold; Defiance', source: 'MPMM', additionalSpells: null }],
    };
    const db = makeDb({ races: { race: [kobold], subrace: [] } });
    db['spell-sources'].XPHB['Fire Bolt'].class.push({ name: 'Sorcerer', source: 'XPHB' });
    expect(names(spellSources(db, fireBolt).races)).toEqual(['Kobold']);
  });

  it('sub-raça vira "Base (Sub-raça)" e linka para a base', () => {
    const db = makeDb({
      races: {
        race: [{ name: 'Dwarf', source: 'PHB' }],
        subrace: [{ name: 'Duergar', raceName: 'Dwarf', raceSource: 'PHB', source: 'MTF', additionalSpells: [{ innate: { 3: { daily: { 1: ['faerie fire|xphb'] } } } }] }],
      },
    });
    expect(spellSources(db, faerieFire).races).toEqual([
      expect.objectContaining({ name: 'Dwarf (Duergar)', baseName: 'Dwarf' }),
    ]);
  });

  it('espécie reimpressa é descartada (o app não a oferece sob aquele nome)', () => {
    const db = makeDb({
      races: {
        race: [{ name: 'Yuan-ti Pureblood', source: 'VGM', reprintedAs: ['Yuan-ti|MPMM'], additionalSpells: [{ innate: { 1: { daily: { 1: ['faerie fire|xphb'] } } } }] }],
        subrace: [],
      },
    });
    expect(spellSources(db, faerieFire).races).toEqual([]);
  });
});

describe('spellSources - as additionalSpells de CLASSE', () => {
  const bard = {
    name: 'Bard', source: 'XPHB',
    // Magical Secrets: alcança meio catálogo. Só ruído na linha de classes.
    additionalSpells: [{ expanded: { 10: [{ all: 'level=0|class=Wizard' }] } }],
  };
  const druid = {
    name: 'Druid', source: 'XPHB',
    additionalSpells: [{ prepared: { 2: ['find familiar|xphb'] } }],
  };

  it('a expressão de filtro é PODADA (a linha de classes vem do mapa reverso)', () => {
    const g = spellSources(makeDb({ 'class-bard': { class: [bard] } }), fireBolt);
    expect(names(g.classes)).toEqual(['Sorcerer', 'Wizard']);
  });

  it('o nome CONCRETO fica: o Druida 2024 tem Find Familiar sem tê-la na lista', () => {
    const g = spellSources(makeDb({ 'class-druid': { class: [druid] } }), findFamiliar);
    expect(names(g.classes)).toEqual(['Druid', 'Wizard']);
    expect(g.classes.find((c) => c.name === 'Druid').nature).toBe('granted');
  });

  it('e não repete a classe que o mapa reverso já nomeou', () => {
    const db = makeDb({ 'class-druid': { class: [{ ...druid, additionalSpells: [{ prepared: { 1: ['faerie fire|xphb'] } }] }] } });
    expect(names(spellSources(db, faerieFire).classes)).toEqual(['Druid']);
  });
});

describe('spellSourceEntries - o bloco pronto para o EntryContent', () => {
  const db = makeDb({
    'class-cleric': {
      subclass: [{
        name: 'Light Domain', shortName: 'Light', source: 'XPHB', className: 'Cleric', classSource: 'XPHB',
        additionalSpells: [{ prepared: { 3: ['faerie fire|xphb'] } }],
      }],
    },
    feats: {
      feat: [{ name: 'Magic Initiate', source: 'XPHB', additionalSpells: [{ known: { 1: { _: [{ choose: 'level=1|class=Druid' }] } } }] }],
    },
  });

  it('uma linha por categoria, com as entradas já como tags de link', () => {
    const lines = spellSourceEntries(db, faerieFire);
    expect(lines[0]).toBe('{@b Classes:} {@class Druid}');
    expect(lines[1]).toBe('{@b Subclasses:} {@subclass Light|Cleric|XPHB|XPHB|Light Domain (Cleric)}');
    expect(lines[2]).toBe('{@b Feats:} {@feat Magic Initiate|XPHB}*');
  });

  it('o rodapé só aparece quando há alguma entrada marcada', () => {
    expect(spellSourceEntries(db, faerieFire).at(-1)).toMatch(/^\{@note \*/);
    const dbFixo = makeDb({ 'class-cleric': db['class-cleric'] });
    expect(dbFixo && spellSourceEntries(dbFixo, faerieFire).some((l) => l.startsWith('{@note'))).toBe(false);
  });

  it('magia sem nenhuma lista devolve bloco vazio', () => {
    expect(spellSourceEntries(makeDb(), { name: 'Inventada', source: 'XPHB', level: 1 })).toEqual([]);
    expect(spellSourceEntries(makeDb(), null)).toEqual([]);
  });

  it('as categorias saem na ordem declarada', () => {
    const keys = SPELL_SOURCE_CATEGORIES.map((c) => c.key);
    expect(keys.indexOf('classes')).toBeLessThan(keys.indexOf('subclasses'));
    expect(keys.indexOf('subclasses')).toBeLessThan(keys.indexOf('races'));
    expect(keys.indexOf('feats')).toBeLessThan(keys.indexOf('optionalfeatures'));
  });
});
