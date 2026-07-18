import { describe, it, expect } from 'vitest';
import { createCharacter, createClassEntry } from '../schema/character';
import { buildCreateSteps, pendingSubclassClass } from './wizardSteps';

const noCaster = { spellcasting: { origins: [] } };
// Conjurador COM cantrips (Wizard/Cleric…): tem a tela de cantrips e a de magias.
const caster = { spellcasting: { origins: [{ key: 'class:wizard', kind: 'class', cantripLimit: 3, prepareLimit: 4, cantrips: [], prepared: [] }] } };
// Conjurador SEM cantrips (Ranger/Paladin): só a tela de magias, sem cantrips.
const casterNoCantrips = { spellcasting: { origins: [{ key: 'class:ranger', kind: 'class', cantripLimit: 0, prepareLimit: 2, cantrips: [], prepared: [] }] } };
// Só magia RACIAL (Aasimar Barbarian com o cantrip Light): nada de classe a escolher.
const racialOnly = { spellcasting: { origins: [{ key: 'race', kind: 'race', cantripLimit: 0, prepareLimit: 0 }] } };

function withClass(level = 1, extra = {}) {
  const ch = createCharacter();
  ch.classes = [{ ...createClassEntry(true), classId: 'fighter', source: 'XPHB', level, ...extra }];
  return ch;
}

describe('buildCreateSteps - quais passos aparecem', () => {
  it('personagem em branco: sem classe → sem features nem spells', () => {
    const ids = buildCreateSteps(createCharacter(), noCaster).map((s) => s.id);
    expect(ids).toEqual(['intro', 'class', 'species', 'originFeat', 'proficiencies', 'abilities', 'boosts', 'equipment', 'story', 'alignment', 'identity']);
    expect(ids).not.toContain('spells');
    expect(ids).not.toContain('features');
    expect(ids).not.toContain('featuresIntro'); // sem classe → sem features
  });

  it('a ordem do nível 1 é a combinada (cantrips antes de spells)', () => {
    const ids = buildCreateSteps(withClass(1), caster, { hasFeatureChoices: true }).map((s) => s.id);
    expect(ids).toEqual(['intro', 'class', 'species', 'originFeat', 'proficiencies', 'abilities', 'boosts', 'equipment', 'story', 'alignment', 'identity', 'featuresIntro', 'features', 'cantrips', 'spells']);
  });

  it('conjurador ganha cantrips + magias; features só com classe E escolhas', () => {
    expect(buildCreateSteps(withClass(1), caster, { hasFeatureChoices: true }).map((s) => s.id)).toContain('spells');
    expect(buildCreateSteps(withClass(1), caster, { hasFeatureChoices: true }).map((s) => s.id)).toContain('cantrips');
    expect(buildCreateSteps(createCharacter(), noCaster).map((s) => s.id)).not.toContain('features');
    expect(buildCreateSteps(withClass(1), noCaster, { hasFeatureChoices: true }).map((s) => s.id)).toContain('features');
  });

  it('conjurador SEM cantrips (Ranger/Paladin) → passo de magias, mas SEM cantrips', () => {
    const ids = buildCreateSteps(withClass(1), casterNoCantrips, { hasFeatureChoices: false }).map((s) => s.id);
    expect(ids).toContain('spells');
    expect(ids).not.toContain('cantrips');
  });

  it('classe SEM escolhas de feature → sem passo de features nem featuresIntro (martial)', () => {
    const ids = buildCreateSteps(withClass(1), noCaster, { hasFeatureChoices: false }).map((s) => s.id);
    expect(ids).not.toContain('features');
    expect(ids).not.toContain('featuresIntro');
  });

  it('conjurador sem escolhas de feature → sem features, MAS featuresIntro + spells (Artificer 1)', () => {
    const ids = buildCreateSteps(withClass(1), caster, { hasFeatureChoices: false }).map((s) => s.id);
    expect(ids).not.toContain('features');
    expect(ids).toContain('featuresIntro'); // ainda há magias a escolher
    expect(ids).toContain('spells');
  });

  it('magia só RACIAL (Aasimar Barbarian) → SEM passo de cantrips/spells/featuresIntro', () => {
    const ids = buildCreateSteps(withClass(1), racialOnly, { hasFeatureChoices: false }).map((s) => s.id);
    expect(ids).not.toContain('cantrips');
    expect(ids).not.toContain('spells');
    expect(ids).not.toContain('featuresIntro'); // nada de classe a escolher
  });
});

describe('buildCreateSteps - status reflete o estado', () => {
  const step = (steps, id) => steps.find((s) => s.id === id);

  it('em branco: obrigatórios incompletos; só biografia/nome/alinhamento opcionais', () => {
    const ch = createCharacter();
    const steps = buildCreateSteps(ch, noCaster);
    // Obrigatórios (apontam pendência se vazios):
    for (const id of ['class', 'species', 'originFeat', 'proficiencies', 'abilities', 'boosts', 'equipment']) {
      expect(step(steps, id).status(ch, noCaster), id).toBe('incomplete');
    }
    // Opcionais (não pendem):
    for (const id of ['story', 'alignment', 'identity']) {
      expect(step(steps, id).status(ch, noCaster), id).toBe('optional');
    }
  });

  it('alignment completa quando há um código escolhido', () => {
    const ch = createCharacter();
    ch.identity.alignment = 'CG';
    const steps = buildCreateSteps(ch, noCaster);
    expect(step(steps, 'alignment').status(ch, noCaster)).toBe('complete');
  });

  it('com classe, espécie, feat e nome → completos', () => {
    const ch = withClass(1);
    ch.meta.name = 'Aria';
    ch.species = { id: 'elf', source: 'XPHB' };
    ch.origin.originFeat = { id: 'Alert', source: 'XPHB' };
    const steps = buildCreateSteps(ch, noCaster);
    expect(step(steps, 'class').status(ch, noCaster)).toBe('complete');
    expect(step(steps, 'species').status(ch, noCaster)).toBe('complete');
    expect(step(steps, 'originFeat').status(ch, noCaster)).toBe('complete');
    expect(step(steps, 'identity').status(ch, noCaster)).toBe('complete');
  });
});

describe('subclasse pendente (passo do guia de criação)', () => {
  it('nível < subclasse → sem pendência nem passo', () => {
    const ch = withClass(1);
    ch.species = { id: 'elf', source: 'XPHB' };
    expect(pendingSubclassClass(ch)).toBe(null);
    expect(buildCreateSteps(ch, noCaster).map((s) => s.id)).not.toContain('subclass');
  });

  it('nível ≥ subclasse SEM subclasse → pendente + passo aparece (incomplete)', () => {
    const ch = withClass(3);
    expect(pendingSubclassClass(ch)?.classId).toBe('fighter');
    const sub = buildCreateSteps(ch, noCaster).find((s) => s.id === 'subclass');
    expect(sub).toBeDefined();
    expect(sub.status(ch, noCaster)).toBe('incomplete');
  });

  it('COM subclasse → não pendente, passo completo', () => {
    const ch = withClass(3, { subclassId: 'Champion', subclassSource: 'XPHB' });
    expect(pendingSubclassClass(ch)).toBe(null);
    const sub = buildCreateSteps(ch, noCaster).find((s) => s.id === 'subclass');
    expect(sub.status(ch, noCaster)).toBe('complete');
  });
});
