// =============================================================================
// foundryBackground.test: o background pronto no Foundry (DDL-0328)
// =============================================================================
// O QUE FAZ
//   O Sage do SRD sai na forma do documento do `origins24` (ASI travado nos três,
//   proficiências, talento, idiomas, compendiumSource e a flag), e o custom continua.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import bundle from '../data/srdBundle.json';
import { buildBackgroundItem } from './foundryItems';
import { applyBackground, resolveBackground } from './backgrounds';

const db = bundle;

describe('buildBackgroundItem com um background pronto', () => {
  const origin = applyBackground(
    { abilityBoosts: [], choices: { language: { kind: 'language', picks: ['Elvish', 'Dwarvish'] } } },
    resolveBackground(db, { id: 'Sage', source: 'XPHB' }),
    db,
    { classId: 'wizard' },
  );
  const item = buildBackgroundItem({ origin, identity: { backstory: 'Mine.' } }, { _id: 'feat0000000000aa' }, db);
  const adv = Object.values(item.system.advancement);

  it('na forma do documento do SRD', () => {
    expect(item.name).toBe('Sage');
    expect(item.system.identifier).toBe('sage');
    expect(item._stats.compendiumSource).toBe('Compendium.dnd5e.origins24.Item.phbbgSage0000000');
    expect(item.flags.builder5e.background).toEqual({ id: 'Sage', source: 'XPHB' });
    expect(adv.map((a) => a.title)).toEqual(['Background Ability Score Improvement', 'Background Proficiencies', 'Background Feat', 'Choose Languages']);
    expect(adv[0].configuration).toMatchObject({ points: 3, cap: 2, locked: ['str', 'dex', 'cha'] });
    expect(adv[0].value.assignments).toEqual({ int: 2, wis: 1 });
    expect(adv[1].value.chosen).toEqual(['tool:art:calligrapher', 'skills:arc', 'skills:his']);
    expect(adv[3].value.chosen).toEqual(['languages:standard:common', 'languages:standard:elvish', 'languages:standard:dwarvish']);
    expect(item.system.wealth).toBe('50');
  });

  it('a história do jogador fica fora do item pronto', () => {
    expect(item.system.description.value).not.toContain('Mine.');
  });

  it('o custom continua o de sempre', () => {
    const custom = buildBackgroundItem({ origin: { abilityBoosts: [], choices: {} }, identity: { backstory: 'Mine.' } }, null, db);
    expect(custom.name).toBe('Custom Background');
    expect(custom.system.description.value).toContain('Mine.');
  });
});
