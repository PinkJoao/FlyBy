import { describe, it, expect } from 'vitest';
import {
  expandRaceVersions, raceOrVersions, parseSpecies, lineageLabel,
  sizeCodes, speciesSizeChoice, sizePick, effectiveSizeCodes, sizeLabel,
  subraceVersions, raceLineages, filterLineageDeferred, lineageDeferredKinds,
  lineageSelectorLabel, speciesChoices,
} from './speciesData';

// Recorte do Elf XPHB: base + _versions (linhagens) com overrides + _mod replaceArr.
const elf = {
  name: 'Elf',
  source: 'XPHB',
  size: ['M'],
  speed: 30,
  darkvision: 60,
  skillProficiencies: [{ choose: { from: ['insight', 'perception', 'survival'] } }],
  entries: [
    { type: 'entries', name: 'Darkvision', entries: ['You have Darkvision (60 ft).'] },
    { type: 'entries', name: 'Elven Lineage', entries: ['Choose a lineage.'] },
    { type: 'entries', name: 'Fey Ancestry', entries: ['Advantage vs charmed.'] },
  ],
  _versions: [
    {
      name: 'Elf; Drow Lineage', source: 'XPHB', darkvision: 120, additionalSpells: [{ known: {} }],
      _mod: {
        entries: [
          { mode: 'replaceArr', replace: 'Elven Lineage', items: { type: 'entries', name: 'Elven Lineage (Drow)', entries: ['Darkvision 120, Dancing Lights.'] } },
          { mode: 'replaceArr', replace: 'Darkvision', items: { type: 'entries', name: 'Darkvision', entries: ['Darkvision 120 ft.'] } },
        ],
      },
    },
    {
      name: 'Elf; Wood Elf Lineage', source: 'XPHB', speed: 35,
      _mod: { entries: [{ mode: 'replaceArr', replace: 'Elven Lineage', items: { type: 'entries', name: 'Elven Lineage (Wood Elf)', entries: ['Speed 35, Longstrider.'] } }] },
    },
  ],
};

describe('expandRaceVersions (linhagens do Elf)', () => {
  const variants = expandRaceVersions(elf);

  it('gera uma variante por versão, com nome próprio', () => {
    expect(variants.map((v) => v.name)).toEqual(['Elf; Drow Lineage', 'Elf; Wood Elf Lineage']);
  });

  it('aplica overrides no topo (darkvision Drow=120, speed Wood=35)', () => {
    expect(variants[0].darkvision).toBe(120);
    expect(variants[1].speed).toBe(35);
    // herda o que a versão não sobrescreve (skills da base)
    expect(variants[0].skillProficiencies).toBe(elf.skillProficiencies);
  });

  it('_mod replaceArr troca as entries nomeadas (linhagem + darkvision)', () => {
    const names = variants[0].entries.map((e) => e.name);
    expect(names).toContain('Elven Lineage (Drow)');
    expect(names).not.toContain('Elven Lineage'); // substituída
    const dv = variants[0].entries.find((e) => e.name === 'Darkvision');
    expect(dv.entries[0]).toContain('120');
  });

  it('não mexe na base (imutável) e limpa _versions da variante', () => {
    expect(elf.entries.some((e) => e.name === 'Elven Lineage')).toBe(true);
    expect(variants[0]._versions).toBeUndefined();
  });

  it('raça sem _versions → expandRaceVersions vazio; raceOrVersions mantém a base', () => {
    const human = { name: 'Human', source: 'XPHB' };
    expect(expandRaceVersions(human)).toEqual([]);
    expect(raceOrVersions(human)).toEqual([human]);
    expect(raceOrVersions(elf).map((v) => v.name)).toEqual(['Elf; Drow Lineage', 'Elf; Wood Elf Lineage']);
  });

  it('parseSpecies lê a variante (darkvision + linhagem como traço)', () => {
    const p = parseSpecies(variants[0]);
    expect(p.darkvision).toBe(120);
    expect(p.traits.map((t) => t.name)).toContain('Elven Lineage (Drow)');
  });
});

// Recorte do Dragonborn XPHB: _versions na forma ABSTRATA (template + implementações),
// como as ancestralidades de dragão são codificadas (cor + tipo de dano).
const dragonborn = {
  name: 'Dragonborn',
  source: 'XPHB',
  size: ['M'],
  speed: 30,
  resist: [],
  entries: [
    { type: 'entries', name: 'Draconic Ancestry', entries: ['Choose a dragon.'] },
    { type: 'entries', name: 'Breath Weapon', entries: ['Exhale {{damageType}} energy.'] },
    { type: 'entries', name: 'Damage Resistance', entries: ['Resistance to something.'] },
  ],
  _versions: [
    {
      _abstract: {
        name: 'Dragonborn ({{color}})',
        source: 'XPHB',
        _mod: {
          entries: [
            { mode: 'removeArr', names: 'Draconic Ancestry' },
            { mode: 'replaceArr', replace: 'Damage Resistance', items: { type: 'entries', name: 'Damage Resistance', entries: ['You have Resistance to {{damageType}} damage.'] } },
          ],
        },
      },
      _implementations: [
        { _variables: { color: 'Black', damageType: 'Acid' }, resist: ['acid'] },
        { _variables: { color: 'Blue', damageType: 'Lightning' }, resist: ['lightning'] },
      ],
    },
  ],
};

describe('expandRaceVersions (forma abstrata: ancestralidades do Dragonborn)', () => {
  const variants = expandRaceVersions(dragonborn);

  it('gera uma variante por implementação, com o nome do template substituído', () => {
    expect(variants.map((v) => v.name)).toEqual(['Dragonborn (Black)', 'Dragonborn (Blue)']);
  });

  it('substitui as variáveis nas entries e aplica overrides da implementação', () => {
    const dr = variants[0].entries.find((e) => e.name === 'Damage Resistance');
    expect(dr.entries[0]).toContain('Acid'); // {{damageType}} substituído
    expect(variants[0].resist).toEqual(['acid']); // override da implementação
    expect(variants[1].resist).toEqual(['lightning']);
  });

  it('aplica o _mod do abstract (remove Draconic Ancestry)', () => {
    expect(variants[0].entries.some((e) => e.name === 'Draconic Ancestry')).toBe(false);
  });

  it('não vaza placeholders nem muta a base', () => {
    expect(JSON.stringify(variants)).not.toContain('{{');
    expect(dragonborn.entries.some((e) => e.name === 'Draconic Ancestry')).toBe(true);
  });
});

describe('lineageLabel (rótulo curto por forma de nome)', () => {
  it('cobre as três formas de nome de versão', () => {
    expect(lineageLabel('Elf; Drow Lineage')).toBe('Drow Lineage');
    expect(lineageLabel('Dragonborn (Black)')).toBe('Black');
    expect(lineageLabel('Dragonborn (Gem; Amethyst)')).toBe('Amethyst');
    expect(lineageLabel('')).toBe('');
  });
});

// --- Tamanho (regras fixadas com o usuário, 2026-07-14) ------------------------
// Sem campo `size` = Small/Medium à escolha; mais de um código = escolha do
// jogador; um só = fixo; 'V' (Verdan AI) = Small até o nível 4, Medium do 5+.

describe('sizeCodes', () => {
  it('normaliza o campo do 5etools', () => {
    expect(sizeCodes({ size: ['M'] })).toEqual(['M']);
    expect(sizeCodes({ size: ['S', 'M'] })).toEqual(['S', 'M']);
    expect(sizeCodes({ size: 'S' })).toEqual(['S']);
  });

  it('raça sem campo size vira Small/Medium (à escolha)', () => {
    expect(sizeCodes({})).toEqual(['S', 'M']);
    expect(sizeCodes(null)).toEqual(['S', 'M']);
    expect(sizeCodes({ size: [] })).toEqual(['S', 'M']);
  });
});

describe('speciesSizeChoice', () => {
  it('gera a escolha quando há mais de um tamanho possível', () => {
    const c = speciesSizeChoice({ size: ['S', 'M'] });
    expect(c).toMatchObject({ id: 'size-0', kind: 'size', count: 1 });
    expect(c.pool.options).toEqual([
      { value: 'S', label: 'Small' },
      { value: 'M', label: 'Medium' },
    ]);
  });

  it('sem campo size também é escolha (Small/Medium)', () => {
    expect(speciesSizeChoice({})).not.toBeNull();
  });

  it('tamanho único e Verdan (V) NÃO geram escolha', () => {
    expect(speciesSizeChoice({ size: ['M'] })).toBeNull();
    expect(speciesSizeChoice({ size: ['V'] })).toBeNull();
    expect(speciesSizeChoice(null)).toBeNull();
  });
});

describe('sizePick / effectiveSizeCodes / sizeLabel', () => {
  it('sizePick lê o pick kind size do choice-bag da espécie', () => {
    expect(sizePick({ 'size-0': { kind: 'size', picks: ['S'] } })).toBe('S');
    expect(sizePick({ 'skill-0': { kind: 'skill', picks: ['prc'] } })).toBeNull();
    expect(sizePick(undefined)).toBeNull();
  });

  it('aplica a escolha do jogador quando válida para a raça', () => {
    expect(effectiveSizeCodes({ size: ['S', 'M'] }, { chosen: 'S' })).toEqual(['S']);
    // escolha inválida (não é opção da raça) é ignorada
    expect(effectiveSizeCodes({ size: ['M'] }, { chosen: 'S' })).toEqual(['M']);
  });

  it('sem escolha devolve todos os possíveis', () => {
    expect(effectiveSizeCodes({ size: ['S', 'M'] })).toEqual(['S', 'M']);
    expect(effectiveSizeCodes({})).toEqual(['S', 'M']);
  });

  it("Verdan ('V'): Small até o nível 4, Medium do 5 em diante", () => {
    expect(effectiveSizeCodes({ size: ['V'] }, { level: 1 })).toEqual(['S']);
    expect(effectiveSizeCodes({ size: ['V'] }, { level: 4 })).toEqual(['S']);
    expect(effectiveSizeCodes({ size: ['V'] }, { level: 5 })).toEqual(['M']);
    // uma escolha salva não sobrepõe a regra de nível
    expect(effectiveSizeCodes({ size: ['V'] }, { chosen: 'M', level: 1 })).toEqual(['S']);
  });

  it('sizeLabel escreve por extenso, com "/" quando ainda em aberto', () => {
    expect(sizeLabel(['M'])).toBe('Medium');
    expect(sizeLabel(['S', 'M'])).toBe('Small/Medium');
    expect(sizeLabel([])).toBe('');
  });
});

describe('subraceVersions / raceLineages (sub-raças fundidas)', () => {
  // Recorte real: Genasi MPMM (Air) + Human (Innistrad) PSI (Stensia) + uma
  // sub-raça reprintada (deve cair fora) e uma sem nome (idem).
  const genasi = { name: 'Genasi', source: 'MPMM', speed: 30, ability: [{ con: 2 }], entries: [{ type: 'entries', name: 'Darkvision', entries: ['x'] }] };
  const innistrad = { name: 'Human (Innistrad)', source: 'PSI', size: ['M'], entries: [] };
  const db = {
    races: {
      race: [genasi, innistrad],
      subrace: [
        { name: 'Air', source: 'MPMM', raceName: 'Genasi', raceSource: 'MPMM', speed: 35, resist: ['lightning'], entries: [{ type: 'entries', name: 'Unending Breath', entries: ['y'] }] },
        { name: 'Stensia', source: 'PSI', raceName: 'Human (Innistrad)', raceSource: 'PSI', ability: [{ str: 1, con: 1 }], skillProficiencies: [{ intimidation: true }], entries: [{ type: 'entries', name: 'Vampiric Resistance', entries: ['z'] }] },
        { name: 'Reprinted One', source: 'ERLW', raceName: 'Genasi', raceSource: 'MPMM', reprintedAs: ['X|Y'] },
        { source: 'PHB', raceName: 'Genasi', raceSource: 'MPMM' }, // sem nome
      ],
    },
  };

  it('funde a sub-raça na base: nome, overrides e entries anexadas', () => {
    const [air] = subraceVersions(db, genasi);
    expect(air.name).toBe('Genasi (Air)');
    expect(air._baseName).toBe('Genasi');
    expect(air.speed).toBe(35);
    expect(air.resist).toEqual(['lightning']);
    expect(air.entries.map((e) => e.name)).toEqual(['Darkvision', 'Unending Breath']);
  });

  it('base já parentetizada junta com "; " (Stensia) e merge de ability/skills', () => {
    const [stensia] = subraceVersions(db, innistrad);
    expect(stensia.name).toBe('Human (Innistrad; Stensia)');
    expect(stensia.ability).toEqual([{ str: 1, con: 1 }]);
    expect(stensia.skillProficiencies).toEqual([{ intimidation: true }]);
  });

  it('sub-raças reprintadas e sem nome ficam fora; cache não vaza entre raças', () => {
    expect(subraceVersions(db, genasi)).toHaveLength(1);
    expect(subraceVersions(db, innistrad)).toHaveLength(1);
  });

  it('raceLineages junta _versions e sub-raças', () => {
    const withVersions = { ...genasi, _versions: [{ name: 'Genasi; Weird', source: 'MPMM' }] };
    const names = raceLineages(db, withVersions).map((v) => v.name);
    expect(names).toContain('Genasi; Weird');
    expect(names).toContain('Genasi (Air)');
  });

  it('raça sem sub-raças no db: lista vazia (e sem crash sem db)', () => {
    expect(subraceVersions(db, { name: 'Elf', source: 'XPHB' })).toEqual([]);
    expect(subraceVersions(null, genasi)).toEqual([]);
  });
});

describe('filterLineageDeferred (escolhas que a linhagem vai resolver)', () => {
  // Recorte do Tiefling XPHB: a base tem resistência à ESCOLHA e três grupos de
  // magias, mas TODA linhagem sobrescreve os dois campos.
  const base = {
    name: 'Tiefling',
    source: 'XPHB',
    resist: [{ choose: { from: ['poison', 'necrotic', 'fire'] } }],
    additionalSpells: [{ name: 'Abyssal' }, { name: 'Infernal' }],
    skillProficiencies: [{ choose: { from: ['perception'] } }],
    _versions: [
      { name: 'Tiefling; Infernal Legacy', source: 'XPHB', resist: ['fire'], additionalSpells: [{ name: 'Infernal' }] },
    ],
  };
  const db = { races: { race: [base] } };
  const choices = [
    { id: 'size-0', kind: 'size' },
    { id: 'resist-0', kind: 'resist' },
    { id: 'spellAbility-0', kind: 'spellAbility' },
    { id: 'spellSet-0', kind: 'spellSet' },
    { id: 'skill-0', kind: 'skill' },
  ];

  it('sem linhagem escolhida, esconde as que a linhagem resolve', () => {
    const kept = filterLineageDeferred(choices, db, base, null).map((c) => c.kind);
    // Sobram as decisões de verdade: o tamanho e a perícia (skillProficiencies
    // não é sobrescrito por linhagem nenhuma).
    expect(kept).toEqual(['size', 'skill']);
    expect(lineageDeferredKinds(db, base)).toEqual(new Set(['resist', 'spellSet', 'spell', 'spellAbility']));
  });

  it('com linhagem escolhida, não filtra nada (as escolhas já vêm da variante)', () => {
    expect(filterLineageDeferred(choices, db, base, 'Tiefling; Infernal Legacy')).toBe(choices);
  });

  it('um campo que ALGUMA linhagem não sobrescreve continua aparecendo', () => {
    const partial = {
      ...base,
      _versions: [...base._versions, { name: 'Tiefling; Herdada', source: 'XPHB', resist: ['fire'] }],
    };
    // A segunda variante herda `additionalSpells` da base → a escolha de magias
    // ainda é da base e tem de ser oferecida.
    expect(lineageDeferredKinds({ races: { race: [partial] } }, partial)).toEqual(new Set(['resist']));
  });

  it('espécie sem linhagem obrigatória nunca adia nada', () => {
    const solo = { name: 'Aasimar', source: 'XPHB', resist: [{ choose: { from: ['necrotic'] } }] };
    const soloDb = { races: { race: [solo] } };
    expect(lineageDeferredKinds(soloDb, solo)).toEqual(new Set());
    expect(filterLineageDeferred(choices, soloDb, solo, null)).toBe(choices);
  });
});

describe('lineageSelectorLabel (o nome que a ESPÉCIE dá à escolha)', () => {
  it('usa o traço que as versões substituem ("Elven Lineage")', () => {
    expect(lineageSelectorLabel(elf)).toBe('Elven Lineage');
  });

  it('Custom Lineage: é "Variable Trait", não linhagem nenhuma', () => {
    const cl = {
      name: 'Custom Lineage',
      source: 'TCE',
      _versions: [
        { name: 'Custom Lineage; Darkvision', _mod: { entries: { mode: 'replaceArr', replace: 'Variable Trait', items: {} } } },
      ],
    };
    expect(lineageSelectorLabel(cl)).toBe('Variable Trait');
  });

  it('sem `_versions` (linhagens vindas de sub-raças) cai no genérico', () => {
    expect(lineageSelectorLabel({ name: 'Genasi', source: 'MPMM' })).toBe('Lineage');
    expect(lineageSelectorLabel(null)).toBe('Lineage');
  });

  it('ignora `replace` sem letra nenhuma (lixo do dataset: Faerie/Kithkin LFL)', () => {
    const junk = { name: 'Faerie', _versions: [{ name: 'Faerie; Shadowmoor', _mod: { entries: { mode: 'replaceArr', replace: ',' } } }] };
    expect(lineageSelectorLabel(junk)).toBe('Lineage');
  });
});

describe('lineageDeferredKinds - regra de REMOÇÃO (benefício OU-EXCLUSIVO)', () => {
  // Forma do Custom Lineage TCE / Kobold MPMM: a base traz o benefício e CADA
  // versão anula o que ela não dá.
  const base = {
    name: 'Custom Lineage',
    source: 'TCE',
    darkvision: 60,
    skillProficiencies: [{ any: 1 }],
    languageProficiencies: [{ common: true, anyStandard: 1 }],
    _versions: [
      { name: 'Custom Lineage; Darkvision', source: 'TCE', skillProficiencies: null },
      { name: 'Custom Lineage; Skill Proficiency', source: 'TCE', darkvision: null },
    ],
  };
  const db = { races: { race: [base] } };

  it('adia a perícia que só uma das versões concede', () => {
    expect(lineageDeferredKinds(db, base)).toEqual(new Set(['skill']));
  });

  it('não adia o que TODA versão mantém (o idioma continua na base)', () => {
    const kept = filterLineageDeferred(
      [{ id: 'size-0', kind: 'size' }, { id: 'skill-0', kind: 'skill' }, { id: 'language-0', kind: 'language' }],
      db, base, null,
    ).map((c) => c.kind);
    expect(kept).toEqual(['size', 'language']);
  });
});

describe('speciesChoices (fonte única da lista de escolhas da espécie)', () => {
  const race = {
    name: 'Custom Lineage',
    source: 'TCE',
    size: ['S', 'M'],
    skillProficiencies: [{ any: 1 }],
    _versions: [
      { name: 'Custom Lineage; Darkvision', source: 'TCE', skillProficiencies: null },
      { name: 'Custom Lineage; Skill Proficiency', source: 'TCE', darkvision: null },
    ],
  };
  const db = { races: { race: [race] } };

  it('põe o TAMANHO na frente e aplica o filtro da linhagem', () => {
    const ids = speciesChoices({ db, baseRace: race, raceObj: race, lineage: null, level: 1, bag: {} }).map((c) => c.id);
    expect(ids).toEqual(['size-0']); // a perícia fica para a escolha do Variable Trait
  });

  it('com a versão escolhida, a escolha dela aparece', () => {
    const variant = raceLineages(db, race).find((v) => v.name === 'Custom Lineage; Skill Proficiency');
    const ids = speciesChoices({ db, baseRace: race, raceObj: variant, lineage: variant.name, level: 1, bag: {} }).map((c) => c.id);
    expect(ids).toEqual(['size-0', 'skill-0']);
  });

  it('sem raça resolvida, lista vazia', () => {
    expect(speciesChoices({ db, baseRace: null, raceObj: null })).toEqual([]);
  });
});
