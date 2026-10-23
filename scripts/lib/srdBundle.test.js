// =============================================================================
// srdBundle.test: a lógica pura do pacote SRD embutido
// =============================================================================
// O QUE FAZ
//   Cobre o filtro por `srd52`, a troca de nome (no nome e no texto, com a caixa
//   das concessões), a tag que aponta para fora do pacote, as correções curadas,
//   o overlay pela chave completa e a varredura de nomes protegidos: que ela
//   PEGA o que não está no SRD (a prova de que o instrumento enxerga) e solta o
//   que o SRD escreve igual. E os extras do SRD 5.1: lista fechada com a flag,
//   marca srd51, o que falta na lista e a varredura contra o texto do 5.1.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  buildRenames,
  renameText,
  stripTags,
  untagOutside,
  applyTextFixes,
  pruneMeta,
  filterOverlay,
  filterSpellSources,
  normalizeCorpus,
  scanProtected,
  buildSrdBundle,
} from './srdBundle';

const FULL = {
  'spells-xphb': {
    spell: [
      { name: "Tasha's Hideous Laughter", source: 'XPHB', srd52: 'Hideous Laughter', entries: ['Laugh.'] },
      { name: 'Fire Bolt', source: 'XPHB', srd52: true, entries: ['See {@spell Tasha\'s Hideous Laughter|XPHB}.'] },
      { name: 'Booming Blade', source: 'TCE', entries: ['Not SRD.'] },
    ],
  },
  items: {
    item: [
      { name: 'Bedroll', source: 'XPHB', srd52: true, page: 12, otherSources: [{ source: 'PHB' }], entries: ['Warm (see the {@book Dungeon Master\'s Guide|XDMG}).'] },
    ],
  },
  'fluff-items': { itemFluff: [{ name: 'Bedroll', source: 'XPHB', entries: ['Lore.'] }] },
  'class-wizard': {
    class: [{ name: 'Wizard', source: 'XPHB', srd52: true }],
    subclassFeature: [
      { name: 'Bonus Proficiency', source: 'XPHB', className: 'Wizard', classSource: 'XPHB', subclassShortName: 'Evoker', subclassSource: 'XPHB', level: 3, srd52: true },
    ],
  },
  'foundry-class': {
    subclassFeature: [
      { name: 'Bonus Proficiency', source: 'XPHB', className: 'Wizard', classSource: 'XPHB', subclassShortName: 'Evoker', subclassSource: 'XPHB', level: 3 },
      { name: 'Bonus Proficiency', source: 'XPHB', className: 'Wizard', classSource: 'XPHB', subclassShortName: 'Bladesinger', subclassSource: 'XPHB', level: 3 },
    ],
  },
  'spell-sources': {
    XPHB: {
      'Fire Bolt': { class: [{ name: 'Wizard', source: 'XPHB' }, { name: 'Artificer', source: 'EFA' }] },
      'Booming Blade': { class: [{ name: 'Wizard', source: 'XPHB' }] },
    },
  },
};

describe('renomeação para o nome do SRD', () => {
  it('troca o nome antigo no texto e respeita a caixa das concessões', () => {
    const r = buildRenames(FULL);
    expect(renameText("cast Tasha's Hideous Laughter", r)).toBe('cast Hideous Laughter');
    expect(renameText("tasha's hideous laughter|xphb", r)).toBe('hideous laughter|xphb');
    expect(renameText('cast Tasha’s Hideous Laughter', r)).toBe('cast Hideous Laughter');
  });

  it('aceita trocas curadas além das marcadas no dado', () => {
    const r = buildRenames({}, { "Lolth's Sting": "Spider's Sting" });
    expect(renameText("subjected to Lolth's Sting", r)).toBe("subjected to Spider's Sting");
  });
});

describe('tags', () => {
  it('stripTags mostra o texto exibido', () => {
    expect(stripTags('a {@spell Fire Bolt|XPHB} b {@variantrule Encounter|XPHB|encounters}')).toBe('a Fire Bolt b encounters');
    expect(stripTags('see the {@book Monster Manual|XMM}')).toBe('see the Monster Manual');
  });

  it('untagOutside solta só a tag cujo alvo ficou fora do pacote', () => {
    const kept = new Set(['fire bolt']);
    expect(untagOutside('{@spell Fire Bolt|XPHB}', kept)).toBe('{@spell Fire Bolt|XPHB}');
    expect(untagOutside('{@spell Booming Blade|TCE}', kept)).toBe('Booming Blade');
    expect(untagOutside('{@b bold}', kept)).toBe('{@b bold}');
  });
});

describe('correções e poda', () => {
  it('replace e dropString', () => {
    const e = { name: 'X', entries: ['keep (see the book).', 'Long ago, lore.'] };
    const out = applyTextFixes(e, [{ replace: [' (see the book)', ''] }, { dropString: 'Long ago' }]);
    expect(out.entries).toEqual(['keep.']);
  });

  it('pruneMeta tira metadado e reprint para fora', () => {
    const out = pruneMeta({ name: 'A', srd52: 'B', page: 3, otherSources: [], reprintedAs: ['A|XPHB'] }, new Set());
    expect(out).toEqual({ name: 'A', srd52: true });
  });
});

describe('overlay e mapa de magias', () => {
  it('o overlay casa pela chave completa, não só pelo nome', () => {
    const { bundle } = buildSrdBundle(FULL);
    const feats = bundle['foundry-class'].subclassFeature;
    expect(feats).toHaveLength(1);
    expect(feats[0].subclassShortName).toBe('Evoker');
  });

  it('filterSpellSources tira magia e classe de fora', () => {
    const out = filterSpellSources(FULL['spell-sources'], new Set(['fire bolt|xphb']), new Set(['wizard|xphb']));
    expect(out).toEqual({ XPHB: { 'Fire Bolt': { class: [{ name: 'Wizard', source: 'XPHB' }] } } });
  });

  it('filterOverlay de raça segue a raça base', () => {
    const kept = { keys: new Set(), nameSource: new Set(), races: new Set(['dragonborn|xphb']) };
    const out = filterOverlay({ race: [{ name: 'Dragonborn (Black)', source: 'XPHB' }, { name: 'Aarakocra', source: 'MPMM' }] }, kept);
    expect(out.race.map((r) => r.name)).toEqual(['Dragonborn (Black)']);
  });
});

describe('buildSrdBundle', () => {
  const { bundle } = buildSrdBundle(FULL, {
    textFixes: { 'Bedroll|XPHB': [{ replace: [" (see the {@book Dungeon Master's Guide|XDMG})", ''] }] },
  });

  it('mantém só o SRD, com o nome do SRD, e esvazia o fluff', () => {
    expect(bundle['spells-xphb'].spell.map((s) => s.name)).toEqual(['Hideous Laughter', 'Fire Bolt']);
    expect(bundle['spells-xphb'].spell[1].entries[0]).toBe('See {@spell Hideous Laughter|XPHB}.');
    expect(bundle['fluff-items'].itemFluff).toEqual([]);
    expect(bundle.items.item[0].entries[0]).toBe('Warm.');
  });
});

describe('varredura de nomes protegidos', () => {
  const corpus = normalizeCorpus('<p>you may look in the <em>Monster Manual</em> or elsewhere for eligible Beasts</p>');
  const terms = ['Monster Manual', "Dungeon Master's Guide", 'Lolth'];

  it('PEGA o trecho que o SRD não escreve', () => {
    const hits = scanProtected({ f: { a: [{ name: 'Bedroll', source: 'XPHB', entries: ["Warm (see the {@book Dungeon Master's Guide|XDMG})."] }] } }, terms, corpus);
    expect(hits).toHaveLength(1);
    expect(hits[0].term.toLowerCase()).toBe("dungeon master's guide");
  });

  it('solta o trecho que o SRD escreve igual', () => {
    const hits = scanProtected({ f: { a: [{ name: 'Wild Shape', source: 'XPHB', entries: ['you may look in the {@book Monster Manual|XMM} or elsewhere for eligible Beasts'] }] } }, terms, corpus);
    expect(hits).toEqual([]);
  });

  it('o nome da entrada precisa ser nome de documento do SRD', () => {
    const c = normalizeCorpus("a creature subjected to Lolth's Sting must succeed");
    const hits = scanProtected({ f: { a: [{ name: "Lolth's Sting", source: 'XDMG' }] } }, terms, c, { docNames: new Set(["spider's sting"]) });
    expect(hits).toHaveLength(1);
  });
});

describe('extras do SRD 5.1 (DDL-0107)', () => {
  const full = {
    races: {
      race: [
        { name: 'Half-Orc', source: 'PHB', srd: true, entries: ['Relentless.'] },
        { name: 'Half-Elf', source: 'PHB', srd: true, reprintedAs: ['Khoravar|EFA'], entries: ['Fey.'] },
        { name: 'Elf', source: 'XPHB', srd52: true },
        { name: 'Elf', source: 'PHB', srd: true },
      ],
      subrace: [
        { source: 'PHB', raceName: 'Half-Orc', raceSource: 'PHB', srd: true },
        { name: 'Variant; Mark of Finding', source: 'ERLW', raceName: 'Half-Orc', raceSource: 'PHB' },
      ],
    },
    items: { item: [{ name: 'Whetstone', source: 'PHB', srd: true }, { name: 'Abacus', source: 'PHB' }] },
  };
  const legacy = {
    'races.race': ['Half-Elf|PHB', 'Half-Orc|PHB'],
    'races.subrace': ['|PHB|Half-Orc'],
    'items.item': ['Whetstone|PHB', 'Abacus|PHB'],
  };
  const { bundle, report } = buildSrdBundle(full, { legacy });

  it('só entra o que está na lista E tem a flag srd, marcado srd51', () => {
    expect(bundle.races.race.map((r) => [r.name, r.source, !!r.srd51])).toEqual([
      ['Half-Orc', 'PHB', true], ['Half-Elf', 'PHB', true], ['Elf', 'XPHB', false],
    ]);
    expect(bundle.races.subrace).toHaveLength(1);
    expect(bundle.items.item.map((i) => i.name)).toEqual(['Whetstone']);
  });

  it('a reimpressão de fora do pacote some, para a espécie aparecer no seletor', () => {
    expect(bundle.races.race.find((r) => r.name === 'Half-Elf').reprintedAs).toBeUndefined();
  });

  it('extra pedido sem a flag srd sai em legacyMissing (o gerador falha)', () => {
    expect(report.legacy).toBe(4);
    expect(report.legacyMissing).toEqual(['items.item:Abacus|PHB']);
  });

  it('a varredura confere o extra contra o texto do SRD 5.1, e o resto contra o 5.2', () => {
    const terms = ['Lolth'];
    const entry = (old) => ({ f: { a: [{ name: 'X', source: 'PHB', srd51: old, entries: ['the drow of Lolth rule'] }] } });
    const c52 = normalizeCorpus('nothing here');
    const c51 = normalizeCorpus('it is said the drow of Lolth rule the dark');
    expect(scanProtected(entry(true), terms, c52, { legacyCorpus: c51 })).toHaveLength(0);
    expect(scanProtected(entry(false), terms, c52, { legacyCorpus: c51 })).toHaveLength(1);
  });
});
