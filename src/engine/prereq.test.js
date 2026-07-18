import { describe, it, expect } from 'vitest';
import { prereqContext, prereqStatus, prereqText, evalPrereq } from './prereq';
import { createCharacter } from '../schema/character';

function ctxOf({ scores = {}, level = 1, raceId = null, classes = null, granted = [], db = null } = {}) {
  const c = createCharacter({ name: 'T' });
  Object.assign(c.scores, scores);
  if (classes) c.classes = classes;
  else c.classes[0].level = level;
  if (raceId) c.species = { id: raceId, source: 'XPHB', choices: {} };
  return prereqContext(c, { db, grantedFeatures: granted });
}

// Grappler XPHB: nível 4 E (Str 13 OU Dex 13) - duas alternativas.
const grappler = {
  prerequisite: [
    { level: 4, ability: [{ str: 13 }] },
    { level: 4, ability: [{ dex: 13 }] },
  ],
};

describe('prereqStatus - checáveis (nível/atributo/raça)', () => {
  it('ok quando alguma alternativa é satisfeita', () => {
    expect(prereqStatus(grappler, ctxOf({ level: 4, scores: { str: 14 } }))).toBe('ok');
    expect(prereqStatus(grappler, ctxOf({ level: 4, scores: { dex: 13 } }))).toBe('ok');
  });

  it('bad quando nenhuma alternativa é satisfeita', () => {
    expect(prereqStatus(grappler, ctxOf({ level: 4 }))).toBe('bad'); // scores 10
    expect(prereqStatus(grappler, ctxOf({ level: 3, scores: { str: 14 } }))).toBe('bad');
  });

  it('raça: casa pelo id da espécie', () => {
    const feat = { prerequisite: [{ race: [{ name: 'halfling' }] }] };
    expect(prereqStatus(feat, ctxOf({ raceId: 'halfling' }))).toBe('ok');
    expect(prereqStatus(feat, ctxOf({ raceId: 'elf' }))).toBe('bad');
    expect(prereqStatus(feat, ctxOf({}))).toBe('bad'); // sem raça
  });

  it('nível de classe específica (formato objeto)', () => {
    const feat = { prerequisite: [{ level: { level: 2, class: { name: 'Sorcerer' } } }] };
    const withSorc = ctxOf({ classes: [{ classId: 'sorcerer', level: 3, isOriginalClass: true, hitPoints: {}, choices: {} }] });
    expect(prereqStatus(feat, withSorc)).toBe('ok');
    expect(prereqStatus(feat, ctxOf({ level: 5 }))).toBe('bad'); // sem a classe
  });

  it('sem pré-requisitos → null', () => {
    expect(prereqStatus({}, ctxOf({}))).toBe(null);
    expect(prereqStatus({ prerequisite: [] }, ctxOf({}))).toBe(null);
  });
});

describe('prereqStatus - não-checáveis e features concedidas', () => {
  it('campanha/background → unknown', () => {
    expect(prereqStatus({ prerequisite: [{ campaign: ['Ravenloft'] }] }, ctxOf({}))).toBe('unknown');
    expect(prereqStatus({ prerequisite: [{ background: [{ name: 'Sage' }] }] }, ctxOf({}))).toBe('unknown');
  });

  it('feature: ok quando concedida pelo contexto (pool de Fighting Style)', () => {
    const fs = { prerequisite: [{ feature: ['Fighting Style'] }] };
    expect(prereqStatus(fs, ctxOf({ granted: ['Fighting Style'] }))).toBe('ok');
    expect(prereqStatus(fs, ctxOf({}))).toBe('unknown');
  });

  it('critério checável FALHO domina o unknown na mesma alternativa', () => {
    const feat = { prerequisite: [{ level: 19, campaign: ['X'] }] };
    expect(prereqStatus(feat, ctxOf({ level: 1 }))).toBe('bad');
    expect(prereqStatus(feat, ctxOf({ level: 20 }))).toBe('unknown'); // nível ok, campanha incerta
  });
});

describe('prereqText / evalPrereq - exibição', () => {
  it('gera texto curto legível', () => {
    expect(prereqText(grappler, ctxOf({}))).toBe('Level 4+, Str 13+ or Level 4+, Dex 13+');
    expect(prereqText({ prerequisite: [{ race: [{ name: 'halfling' }] }] }, ctxOf({}))).toBe('Halfling');
  });

  it('expõe status por alternativa', () => {
    const r = evalPrereq(grappler, ctxOf({ level: 4, scores: { dex: 13 } }));
    expect(r.entries.map((e) => e.status)).toEqual(['bad', 'ok']);
    expect(r.status).toBe('ok');
  });
});

// --- Novos checáveis (feat / spellcasting / proficiência / grupos raciais) ----

// Compêndio mínimo p/ as checagens que precisam de db.
const DB = {
  'class-wizard': { class: [{ name: 'Wizard', source: 'XPHB', spellcastingAbility: 'int', casterProgression: 'full' }] },
  'class-fighter': {
    class: [
      {
        name: 'Fighter',
        source: 'XPHB',
        startingProficiencies: { armor: ['light', 'medium', 'heavy', '{@item shield|xphb|shields}'], weapons: ['simple', 'martial'] },
      },
    ],
    subclass: [],
  },
  'class-rogue': {
    class: [
      { name: 'Rogue', source: 'XPHB', startingProficiencies: { armor: ['light'], weapons: ['simple'] } },
    ],
  },
  races: {
    race: [
      { name: 'Halfling', source: 'XPHB', size: ['S'] },
      { name: 'Eladrin', source: 'MPMM', size: ['M'] },
    ],
    subrace: [
      { name: 'Eladrin', raceName: 'Elf', source: 'MTF' },
      { name: 'Shadar-kai', raceName: 'Elf', source: 'MTF' },
    ],
  },
};

function fighterChar({ raceId = null, extraFeat = null } = {}) {
  const c = createCharacter({ name: 'T' });
  c.classes = [{ classId: 'fighter', source: 'XPHB', level: 4, isOriginalClass: true, hitPoints: {}, choices: {} }];
  if (raceId) c.species = { id: raceId, source: 'XPHB', choices: {} };
  if (extraFeat) c.origin.originFeat = { id: extraFeat.split('|')[0], source: extraFeat.split('|')[1], subtype: 'origin', choices: {} };
  return c;
}

describe('checkFeat - depende de outro feat', () => {
  const needsAlert = { prerequisite: [{ feat: ['alert|xphb'] }] };
  it('ok quando o personagem possui o feat', () => {
    const ctx = prereqContext(fighterChar({ extraFeat: 'Alert|XPHB' }), { db: DB });
    expect(prereqStatus(needsAlert, ctx)).toBe('ok');
  });
  it('bad quando não possui', () => {
    expect(prereqStatus(needsAlert, prereqContext(fighterChar(), { db: DB }))).toBe('bad');
  });
  it('variante específica de feat repetível → unknown se possui o feat base', () => {
    const needsVariant = { prerequisite: [{ feat: ['strike of the giants|bgg|strike of the giants (fire strike)'] }] };
    const ctx = prereqContext(fighterChar({ extraFeat: 'Strike of the Giants|BGG' }), { db: DB });
    expect(prereqStatus(needsVariant, ctx)).toBe('unknown');
    expect(prereqStatus(needsVariant, prereqContext(fighterChar(), { db: DB }))).toBe('bad');
  });
});

describe('checkSpellcasting', () => {
  const needsCasting = { prerequisite: [{ spellcasting2020: true }] };
  it('ok com classe conjuradora; bad sem; unknown sem db', () => {
    const wiz = createCharacter({ name: 'W' });
    wiz.classes = [{ classId: 'wizard', source: 'XPHB', level: 1, isOriginalClass: true, hitPoints: {}, choices: {} }];
    expect(prereqStatus(needsCasting, prereqContext(wiz, { db: DB }))).toBe('ok');
    expect(prereqStatus(needsCasting, prereqContext(fighterChar(), { db: DB }))).toBe('bad');
    expect(prereqStatus(needsCasting, prereqContext(fighterChar(), {}))).toBe('unknown');
  });
});

describe('checkProficiency - armadura e arma marcial', () => {
  const needsMedium = { prerequisite: [{ proficiency: [{ armor: 'medium' }] }] };
  const needsMartial = { prerequisite: [{ proficiency: [{ weapon: 'martial' }] }] };
  it('fighter tem tudo; rogue não', () => {
    expect(prereqStatus(needsMedium, prereqContext(fighterChar(), { db: DB }))).toBe('ok');
    expect(prereqStatus(needsMartial, prereqContext(fighterChar(), { db: DB }))).toBe('ok');
    const rogue = createCharacter({ name: 'R' });
    rogue.classes = [{ classId: 'rogue', source: 'XPHB', level: 1, isOriginalClass: true, hitPoints: {}, choices: {} }];
    expect(prereqStatus(needsMedium, prereqContext(rogue, { db: DB }))).toBe('bad');
    expect(prereqStatus(needsMartial, prereqContext(rogue, { db: DB }))).toBe('bad');
  });
  it('shield extraído de token {@item}', () => {
    const needsShield = { prerequisite: [{ proficiency: [{ armor: 'shield' }] }] };
    expect(prereqStatus(needsShield, prereqContext(fighterChar(), { db: DB }))).toBe('ok');
  });
});

describe('checkRace - grupos raciais', () => {
  const needsElf = { prerequisite: [{ race: [{ name: 'elf' }] }] };
  it('eladrin/shadar-kai contam como elf (tabela de subraces)', () => {
    expect(prereqStatus(needsElf, prereqContext(fighterChar({ raceId: 'eladrin' }), { db: DB }))).toBe('ok');
    expect(prereqStatus(needsElf, prereqContext(fighterChar({ raceId: 'shadar-kai' }), { db: DB }))).toBe('ok');
  });
  it('nome composto casa por sufixo: sea elf → elf; half-elf NÃO', () => {
    expect(prereqStatus(needsElf, prereqContext(fighterChar({ raceId: 'sea elf' }), { db: DB }))).toBe('ok');
    expect(prereqStatus(needsElf, prereqContext(fighterChar({ raceId: 'half-elf' }), { db: DB }))).toBe('bad');
  });
  it('sub-raça pedida: elf (high) exige a linhagem no id', () => {
    const needsHigh = { prerequisite: [{ race: [{ name: 'elf', subrace: 'high' }] }] };
    expect(prereqStatus(needsHigh, prereqContext(fighterChar({ raceId: 'high elf' }), { db: DB }))).toBe('ok');
    expect(prereqStatus(needsHigh, prereqContext(fighterChar({ raceId: 'eladrin' }), { db: DB }))).toBe('bad');
  });
  it('"small race" checa o TAMANHO da espécie', () => {
    const small = { prerequisite: [{ race: [{ name: 'small race', displayEntry: 'a Small race' }] }] };
    expect(prereqStatus(small, prereqContext(fighterChar({ raceId: 'halfling' }), { db: DB }))).toBe('ok');
    expect(prereqStatus(small, prereqContext(fighterChar({ raceId: 'eladrin' }), { db: DB }))).toBe('bad');
  });
});
