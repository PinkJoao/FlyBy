// =============================================================================
// cardShape.test: a forma fixa dos cards e o carrossel sobre o SRD embutido
// =============================================================================
// O QUE FAZ
//   Cobre a forma dos cards (DDL-0286, DDL-0288): os padrões, o orçamento de altura,
//   as etiquetas numa lista só, a peça sem lugar; que toda entity declara a sua e que
//   os cards do SRD cabem nela. E o carrossel sobre o pacote SRD embutido, que não tem
//   arte nenhuma: toda classe, espécie e subclasse tem resumo e ícone.
//
// FUNÇÕES
//   (nenhuma: suíte Vitest).
//
// DECISÕES E ARMADILHAS
//   - Lê o srdBundle.json commitado, o mesmo que o app carrega na fonte SRD.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import bundle from '../data/srdBundle.json';
import { bodyHeight, cardShapeOf, cardTags, cardVars, overflowSlots, DEFAULT_SHAPE } from './cardShape';
import classEntity from './entities/class';
import raceEntity from './entities/race';
import itemEntity from './entities/item';
import spellEntity from './entities/spell';
import skillEntity from './entities/skill';
import toolEntity from './entities/tool';
import languageEntity from './entities/language';
import weaponEntity from './entities/weapon';
import conditionEntity from './entities/condition';
import creatureEntity from './entities/creature';
import effectSourceEntity from './entities/effectSource';
import { makeSubclassEntity } from './entities/subclass';
import { makeFeatEntity } from './entities/feat';

describe('cardShape', () => {
  it('os padrões valem onde a entity não declara', () => {
    expect(cardShapeOf({})).toEqual(DEFAULT_SHAPE);
    expect(cardShapeOf({ cardShape: { meta: 2 } })).toMatchObject({ title: 2, meta: 2, tags: 0 });
  });

  it('o orçamento soma as peças reservadas', () => {
    const small = bodyHeight({ ...DEFAULT_SHAPE, title: 1 });
    const big = bodyHeight({ ...DEFAULT_SHAPE, subtitle: true, meta: 2, tags: 2 });
    expect(small).toBe(20);
    expect(big).toBeGreaterThan(small + 60);
    expect(cardVars({ ...DEFAULT_SHAPE, tags: 1 })['--body-h']).toMatch(/^\d+px$/);
  });

  it('as etiquetas: raridade, pré-requisitos, badges, com o tom de cada', () => {
    const tags = cardTags({
      rarity: { label: 'Rare', color: 'var(--rarity-rare)' },
      prereqs: [{ text: 'Level 4+', status: 'bad' }],
      badges: ['Origin', { text: 'Martial', tone: 'red' }],
    });
    expect(tags.map((t) => t.text)).toEqual(['Rare', 'Level 4+', 'Origin', 'Martial']);
    expect(tags.map((t) => t.tone)).toEqual(['neutral', 'danger', 'accent', 'danger']);
  });

  it('acusa a peça que o card preenche sem lugar na forma', () => {
    expect(overflowSlots({ title: 'X', meta: 'm', badges: ['b'] }, DEFAULT_SHAPE)).toEqual(['meta', 'tags']);
    expect(overflowSlots({ title: 'X', meta: 'm' }, { ...DEFAULT_SHAPE, meta: 1 })).toEqual([]);
  });

  const entities = [
    classEntity, raceEntity, itemEntity, spellEntity, skillEntity, toolEntity, languageEntity, weaponEntity,
    conditionEntity, creatureEntity, effectSourceEntity, makeSubclassEntity('fighter'), makeFeatEntity(['O', 'G', 'FS', 'EB']),
  ];

  it('toda entity declara a forma, e os cards do SRD cabem nela', () => {
    for (const entity of entities) {
      expect(entity.cardShape, entity.type).toBeTruthy();
      const shape = cardShapeOf(entity);
      for (const raw of (entity.list(bundle) ?? []).slice(0, 200)) {
        expect(overflowSlots(entity.card(raw, bundle), shape), `${entity.type}: ${raw.name}`).toEqual([]);
      }
    }
  });
});

describe('carrossel sobre o SRD embutido (sem arte)', () => {
  const subclass = makeSubclassEntity('wizard');
  const cases = [
    ['class', classEntity],
    ['species', raceEntity],
    ['subclass', subclass],
  ];
  for (const [label, entity] of cases) {
    it(`${label}: resumo e ícone em toda entrada`, () => {
      const list = entity.list(bundle);
      expect(list.length).toBeGreaterThan(0);
      for (const raw of list) {
        expect(entity.teaser(raw, bundle).length, raw.name).toBeGreaterThan(0);
        expect(entity.icon(raw), raw.name).toMatch(/^(class|origin)/);
      }
    });
  }

  it('a classe do SRD mostra as features dos níveis 1 a 3 (não há descrição)', () => {
    const fighter = classEntity.list(bundle).find((c) => c.name === 'Fighter');
    const lines = classEntity.teaser(fighter, bundle);
    expect(lines[0]).toMatch(/^\{@b Level 1:\} .*Second Wind/);
    expect(lines.some((l) => l.startsWith('{@b Level 3:}'))).toBe(true);
    expect(classEntity.fluff(fighter, bundle)).toBeNull();
  });
});
