import { describe, it, expect } from 'vitest';
import { parseYaml } from './yamlLite';

// Formas REAIS dos packs do dnd5e (recortes dos .yml de packs/_source).
describe('parseYaml - o subconjunto que os packs do dnd5e usam', () => {
  it('mapas aninhados, escalares tipados e listas de escalares', () => {
    const out = parseYaml(`
name: Countercharm
type: feat
system:
  identifier: countercharm
  uses:
    max: '@prof'
    spent: 0
  properties: []
  level: 7
  hidden: false
  nada: null
`);
    expect(out.name).toBe('Countercharm');
    expect(out.system.uses).toEqual({ max: '@prof', spent: 0 });
    expect(out.system.properties).toEqual([]);
    expect(out.system.level).toBe(7);
    expect(out.system.hidden).toBe(false);
    expect(out.system.nada).toBeNull();
  });

  it('lista de MAPAS (a forma de `consumption.targets` e de `recovery`)', () => {
    const out = parseYaml(`
recovery:
  - period: lr
    type: recoverAll
  - period: sr
    type: formula
    formula: '1'
`);
    expect(out.recovery).toEqual([
      { period: 'lr', type: 'recoverAll' },
      { period: 'sr', type: 'formula', formula: '1' },
    ]);
  });

  it('escalar de bloco dobrado (`>-`) vira uma linha só', () => {
    const out = parseYaml(`
activation:
  type: reaction
  condition: >-
    You or a creature within 30 feet of you fails a saving throw against
    an effect that applies the Charmed condition
  override: false
`);
    expect(out.activation.condition).toBe(
      'You or a creature within 30 feet of you fails a saving throw against an effect that applies the Charmed condition',
    );
    expect(out.activation.override).toBe(false);
  });

  it('escalar de bloco literal (`|-`) preserva as quebras', () => {
    const out = parseYaml(`
description:
  value: |-
    <p>linha um</p>
    <p>linha dois</p>
  chat: ''
`);
    expect(out.description.value).toBe('<p>linha um</p>\n<p>linha dois</p>');
    expect(out.description.chat).toBe('');
  });

  it('activity real: mapa indexado por _id, com lista de effects', () => {
    const out = parseYaml(`
system:
  activities:
    dnd5eactivity000:
      _id: dnd5eactivity000
      type: save
      effects:
        - _id: dnd5eeffect0000
          onSave: false
      damage:
        parts:
          - custom:
              enabled: true
              formula: '@scale.dragonborn.breath'
            types:
              - cold
`);
    const act = out.system.activities.dnd5eactivity000;
    expect(act.type).toBe('save');
    expect(act.effects).toEqual([{ _id: 'dnd5eeffect0000', onSave: false }]);
    expect(act.damage.parts[0].custom.formula).toBe('@scale.dragonborn.breath');
    expect(act.damage.parts[0].types).toEqual(['cold']);
  });

  it('aspas simples com apóstrofo escapado, e documento vazio', () => {
    expect(parseYaml("name: 'Cloud''s Jaunt'").name).toBe("Cloud's Jaunt");
    expect(parseYaml('')).toEqual({});
  });
});
