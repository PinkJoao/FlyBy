// =============================================================================
// backgrounds.test: os backgrounds prontos aplicados na origem (DDL-0328)
// =============================================================================
// O QUE FAZ
//   Os quatro do SRD pelo pacote embutido, e as formas que o SRD não tem (ferramenta
//   de categoria, Dark Gift, o Genie Touched sem `feats`) por um db mínimo.
//
// FUNÇÕES
//   sage(): o Sage do SRD.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import bundle from '../data/srdBundle.json';
import {
  readyBackgrounds, resolveBackground, backgroundAbilities, backgroundSkills, backgroundFixedTool,
  backgroundFeat, applyBackground, toCustomOrigin, clearOrigin, originChoicesFor, allowedBoostAbilities,
  backgroundSwitchLosses,
} from './backgrounds';

const db = bundle;
const sage = () => resolveBackground(db, { id: 'Sage', source: 'XPHB' });

describe('backgrounds do SRD', () => {
  it('oferece os quatro do SRD', () => {
    expect(readyBackgrounds(db).map((b) => b.name).sort()).toEqual(['Acolyte', 'Criminal', 'Sage', 'Soldier']);
  });

  it('lê atributos, perícias, ferramenta e talento do Sage', () => {
    const bg = sage();
    expect(backgroundAbilities(bg)).toEqual(['con', 'int', 'wis']);
    expect(backgroundSkills(bg)).toEqual(['arc', 'his']);
    expect(backgroundFixedTool(db, bg)).toBe("Calligrapher's Supplies");
    expect(backgroundFeat(db, bg).fixed).toMatchObject({ id: 'Magic Initiate', source: 'XPHB', preset: 'wizard' });
  });

  it('aplica o Sage: perícias, ferramenta, talento com a lista travada, bônus nos três', () => {
    const origin = { abilityBoosts: [{ ability: 'str', amount: 2 }, { ability: 'dex', amount: 1 }], originFeat: null, choices: { language: { kind: 'language', picks: ['Elvish'] } } };
    const next = applyBackground(origin, sage(), db, { classId: 'wizard' });
    expect(next.background).toEqual({ id: 'Sage', source: 'XPHB' });
    expect(next.choices.skill.picks).toEqual(['arc', 'his']);
    expect(next.choices.tool.picks).toEqual(["Calligrapher's Supplies"]);
    expect(next.choices.language.picks).toEqual(['Elvish']);
    expect(next.originFeat.choices['spellSet-0'].picks).toEqual(['Wizard Spells']);
    expect(next.abilityBoosts).toEqual([{ ability: 'int', amount: 2 }, { ability: 'wis', amount: 1 }]);
    expect(allowedBoostAbilities(next, db)).toEqual(['con', 'int', 'wis']);
    expect(originChoicesFor(next, db).map((c) => c.id)).toEqual(['language']);
  });

  it('mantém bônus que já cabem e as sub-escolhas do mesmo talento', () => {
    const origin = {
      abilityBoosts: [{ ability: 'wis', amount: 1 }, { ability: 'int', amount: 1 }, { ability: 'con', amount: 1 }],
      originFeat: {
        id: 'Magic Initiate', source: 'XPHB', subtype: 'origin',
        choices: { 'spellSet-0': { kind: 'spellSet', picks: ['Cleric Spells'] }, x: { kind: 'spellAbility', picks: ['wis'] } },
      },
      choices: {},
    };
    const next = applyBackground(origin, sage(), db);
    expect(next.abilityBoosts).toHaveLength(3);
    expect(next.originFeat.choices.x.picks).toEqual(['wis']);
    expect(next.originFeat.choices['spellSet-0'].picks).toEqual(['Wizard Spells']);
  });

  it('volta ao custom mantendo tudo, e o X limpa', () => {
    const next = applyBackground({ choices: {} }, sage(), db, { classId: 'wizard' });
    const custom = toCustomOrigin(next);
    expect(custom.background).toBeUndefined();
    expect(custom.choices.skill.picks).toEqual(['arc', 'his']);
    expect(originChoicesFor(custom, db).map((c) => c.id)).toEqual(['skill', 'tool', 'language']);
    const cleared = clearOrigin(next, { classId: 'wizard' });
    expect(cleared.background).toBeUndefined();
    expect(cleared.choices).toEqual({});
    expect(cleared.originFeat).toBeNull();
    expect(cleared.abilityBoosts).toHaveLength(2);
    expect(clearOrigin(next).abilityBoosts).toEqual([{ ability: '', amount: 2 }, { ability: '', amount: 1 }]);
  });

  it('avisa o que a troca apaga na origem custom', () => {
    const origin = { originFeat: { id: 'Alert', source: 'XPHB', choices: {} }, choices: { skill: { kind: 'skill', picks: ['ath', 'acr'] } } };
    const next = applyBackground(origin, sage(), db);
    expect(backgroundSwitchLosses(origin, next)).toEqual(['the Alert feat', 'the skills']);
  });

  it('o mesmo talento com outra lista larga as magias e avisa', () => {
    const acolyte = applyBackground({ choices: {} }, resolveBackground(db, { id: 'Acolyte', source: 'XPHB' }), db);
    acolyte.originFeat.choices = {
      ...acolyte.originFeat.choices,
      'spellAbility-0': { kind: 'spellAbility', picks: ['wis'] },
      'spell-0': { kind: 'spell', picks: ['Light|XPHB', 'Guidance|XPHB'] },
    };
    const next = applyBackground(acolyte, sage(), db);
    expect(next.originFeat.choices['spellSet-0'].picks).toEqual(['Wizard Spells']);
    expect(next.originFeat.choices['spell-0']).toBeUndefined();
    expect(next.originFeat.choices['spellAbility-0'].picks).toEqual(['wis']);
    expect(backgroundSwitchLosses(acolyte, next)).toEqual(['the Magic Initiate spells']);
    const again = applyBackground(acolyte, resolveBackground(db, { id: 'Acolyte', source: 'XPHB' }), db);
    expect(again.originFeat.choices['spell-0'].picks).toEqual(['Light|XPHB', 'Guidance|XPHB']);
    expect(backgroundSwitchLosses(acolyte, again)).toEqual([]);
  });
});

describe('formas fora do SRD', () => {
  const mini = {
    feats: { feat: [
      { name: 'Survivor', source: 'RHW', category: 'O' },
      { name: 'Mist Walker', source: 'RHW', category: 'DG' },
      { name: 'Magic Initiate', source: 'XPHB', category: 'O' },
    ] },
    backgrounds: { background: [
      {
        name: 'Haunted One', source: 'RHW', edition: 'one',
        ability: [{ choose: { weighted: { from: ['str', 'con', 'wis'], weights: [2, 1] } } }],
        skillProficiencies: [{ religion: true, insight: true }], toolProficiencies: [{ anyGamingSet: 1 }],
        feats: [{ 'survivor|rhw': true }, { anyFromCategory: { category: ['DG'] } }],
      },
      {
        name: 'Genie Touched', source: 'FRHoF', edition: 'one',
        ability: [{ choose: { weighted: { from: ['dex', 'wis', 'cha'], weights: [2, 1] } } }],
        skillProficiencies: [{ perception: true, persuasion: true }], toolProficiencies: [{ "glassblower's tools": true }],
      },
      { name: 'Acolyte', source: 'PHB', skillProficiencies: [{ religion: true }] },
    ] },
  };

  it('só oferece o formato 2024', () => {
    expect(readyBackgrounds(mini).map((b) => b.name)).toEqual(['Haunted One', 'Genie Touched']);
  });

  it('o Dark Gift é escolha, com a ferramenta de categoria', () => {
    const bg = resolveBackground(mini, { id: 'Haunted One', source: 'RHW' });
    const feat = backgroundFeat(mini, bg);
    expect(feat.fixed).toBeNull();
    expect(feat.options).toEqual([{ id: 'Survivor', source: 'RHW', preset: null }]);
    expect(feat.categories).toEqual(['DG']);
    const next = applyBackground({ originFeat: { id: 'Mist Walker', source: 'RHW', choices: {} }, choices: {} }, bg, mini);
    expect(next.originFeat.id).toBe('Mist Walker');
    expect(next.choices.tool).toBeUndefined();
    expect(originChoicesFor(next, mini)[0]).toMatchObject({ id: 'tool', pool: { category: 'GS' } });
  });

  it('o Genie Touched ganha o Magic Initiate do texto', () => {
    const bg = resolveBackground(mini, { id: 'Genie Touched', source: 'FRHoF' });
    expect(backgroundFeat(mini, bg).fixed).toMatchObject({ id: 'Magic Initiate', preset: 'wizard' });
  });
});
