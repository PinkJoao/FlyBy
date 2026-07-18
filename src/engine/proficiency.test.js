import { describe, it, expect } from 'vitest';
import { createCharacter } from '../schema/character';
import { collectToolProficiencies, collectLanguages, collectOwned, collectFeatIds, collectSkillProficiencies } from './proficiency';

describe('collectToolProficiencies / collectLanguages - agrega origem + escolhas', () => {
  it('junta ferramentas da origem e de uma escolha de espécie aninhada (recursivo)', () => {
    const c = createCharacter();
    c.origin.toolProficiencies = ['game:dice'];
    // Espécie Human → talento Crafter → escolha de 3 ferramentas (aninhada).
    c.species = {
      id: 'human',
      source: 'XPHB',
      choices: {
        'feat-0': {
          kind: 'feat',
          picks: ['Crafter|XPHB'],
          sub: { 'Crafter|XPHB': { 'tool-0': { kind: 'tool', picks: ["smith's tools"] } } },
        },
      },
    };
    expect(collectToolProficiencies(c).sort()).toEqual(['game:dice', "smith's tools"]);
  });

  it('origin.choices (Background padronizado) entra em skills E tools', () => {
    const c = createCharacter();
    c.origin.choices = {
      skill: { kind: 'skill', picks: ['ath', 'prc'] },
      tool: { kind: 'tool', picks: ["Alchemist's Supplies"] },
      language: { kind: 'language', picks: ['Draconic'] },
    };
    expect(collectToolProficiencies(c)).toEqual(["Alchemist's Supplies"]);
    expect(collectLanguages(c).sort()).toEqual(['Common', 'Draconic']);
  });

  it('pool MISTO (Skilled): só a parte tool entra em tools', () => {
    const c = createCharacter();
    c.origin.originFeat = {
      id: 'Skilled',
      source: 'XPHB',
      subtype: 'origin',
      choices: {
        'mixed-0': {
          kind: 'mixed',
          picks: [
            { kind: 'skill', value: 'acr' },
            { kind: 'tool', value: "Alchemist's Supplies" },
          ],
        },
      },
    };
    expect(collectToolProficiencies(c)).toEqual(["Alchemist's Supplies"]);
  });

  it('idiomas: origem + escolha de espécie, com dedup', () => {
    const c = createCharacter();
    c.origin.languages = ['Common', 'Elvish'];
    c.species = {
      id: 'x',
      source: 'X',
      choices: { 'language-0': { kind: 'language', picks: ['Elvish', 'Draconic'] } },
    };
    expect(collectLanguages(c).sort()).toEqual(['Common', 'Draconic', 'Elvish']);
  });

  it('TODO personagem sabe Common, mesmo sem nada', () => {
    expect(collectLanguages(createCharacter())).toEqual(['Common']);
  });

  it('idiomas FIXOS da raça entram (normalizados), tokens são descartados', () => {
    const c = createCharacter();
    // Goblin legado: { common: true, goblin: true } → fixed ['common','goblin'];
    // mais um token "other" que deve ser ignorado.
    const granted = ['common', 'goblin', 'other'];
    expect(collectLanguages(c, granted).sort()).toEqual(['Common', 'Goblin']);
  });
});

describe('collectOwned / collectFeatIds - dedup pela ficha', () => {
  it('reúne feats da origem e de escolhas aninhadas', () => {
    const c = createCharacter();
    c.origin.originFeat = {
      id: 'Magic Initiate',
      source: 'XPHB',
      subtype: 'origin',
      choices: { 'feat-0': { kind: 'feat', picks: ['Lucky|XPHB'] } },
    };
    expect(collectFeatIds(c).sort()).toEqual(['Lucky|XPHB', 'Magic Initiate|XPHB']);
  });

  it('owned agrega skills/tools/languages/feats (case-insensitive em tool/lang)', () => {
    const c = createCharacter();
    c.origin.skillProficiencies = ['ath'];
    c.origin.toolProficiencies = ["Smith's Tools"];
    c.origin.languages = ['Elvish'];
    const owned = collectOwned(c);
    expect(owned.skills.has('ath')).toBe(true);
    expect(owned.tools.has("smith's tools")).toBe(true);
    expect(owned.languages.has('elvish')).toBe(true);
    expect(owned.languages.has('common')).toBe(true); // sempre
  });
});

describe('Expertise (Fase 6) - escolhas de classe', () => {
  it('marca perícias de expertise como nível 2 e expõe owned.expertise', () => {
    const c = createCharacter();
    c.origin.skillProficiencies = ['ste', 'slt'];
    c.classes[0].choices = {
      'expertise@1': { kind: 'expertise', picks: ['ste'] },
    };
    const profs = collectSkillProficiencies(c);
    expect(profs.ste).toBe(2);
    expect(profs.slt).toBe(1);
    const owned = collectOwned(c);
    expect(owned.expertise.has('ste')).toBe(true);
    expect(owned.expertise.has('slt')).toBe(false);
  });
});
