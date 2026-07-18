import { describe, it, expect } from 'vitest';
import { lookupEntityLink, isEntityTag, entityTagDisplay } from './entityLinks';

// db sintético mínimo cobrindo cada tipo de tag resolvível.
const db = {
  'spells-phb': { spell: [{ name: 'Fireball', source: 'PHB', level: 3, school: 'V', reprintedAs: ['Fireball|XPHB'], entries: ['old'] }] },
  'spells-xphb': { spell: [{ name: 'Fireball', source: 'XPHB', level: 3, school: 'V', entries: ['A bright streak…'] }] },
  'items-base': { baseitem: [{ name: 'Longsword', source: 'XPHB', type: 'M|XPHB', weaponCategory: 'martial', entries: [] }] },
  items: {
    item: [{ name: 'Bag of Holding', source: 'XDMG', wondrous: true, rarity: 'uncommon', entries: ['This bag…'] }],
    itemGroup: [{ name: 'Arcane Focus', source: 'XPHB', type: 'SCF|XPHB', rarity: 'none', items: ['Crystal|XPHB', 'Orb|XPHB'] }],
  },
  magicvariants: { magicvariant: [] },
  feats: { feat: [{ name: 'Alert', source: 'XPHB', category: 'O', entries: ['You gain…'] }] },
  optionalfeatures: { optionalfeature: [{ name: 'Agonizing Blast', source: 'XPHB', featureType: ['EI'], entries: ['…'] }] },
  races: { race: [{ name: 'Gnome', source: 'XPHB', size: ['S'], speed: 30, entries: ['…'] }] },
  languages: { language: [{ name: 'Primordial', source: 'XPHB', type: 'standard', entries: ['…'] }] },
  backgrounds: { background: [{ name: 'Giant Foundling', source: 'BGG', entries: ['You were raised…'] }] },
  'class-paladin': {
    class: [{ name: 'Paladin', source: 'XPHB' }],
    classFeature: [
      { name: 'Channel Divinity', className: 'Paladin', source: 'PHB', level: 3, entries: ['old'] },
      { name: 'Channel Divinity', className: 'Paladin', source: 'XPHB', level: 3, entries: ['You can channel…'] },
    ],
    subclassFeature: [
      { name: 'Aura of Warding', className: 'Paladin', subclassShortName: 'Ancients', source: 'XPHB', level: 7, entries: ['Ancient magic…'] },
    ],
  },
};

describe('isEntityTag', () => {
  it('reconhece as tags cobertas e rejeita as demais', () => {
    for (const t of ['spell', 'item', 'feat', 'optfeature', 'race', 'class', 'language', 'background', 'classFeature', 'subclassFeature']) {
      expect(isEntityTag(t)).toBe(true);
    }
    expect(isEntityTag('creature')).toBe(false);
    expect(isEntityTag('table')).toBe(false);
    expect(isEntityTag('quickref')).toBe(false);
  });
});

describe('lookupEntityLink - tags simples', () => {
  it('spell resolve preferindo a versão atual (reprint PHB → XPHB)', () => {
    const hit = lookupEntityLink(db, 'spell', 'Fireball|PHB');
    expect(hit.kind).toBe('entity');
    expect(hit.raw.source).toBe('XPHB'); // latestOnly esconde o PHB
    expect(hit.display).toBe('Fireball');
  });

  it('display usa o 3º segmento quando presente', () => {
    expect(lookupEntityLink(db, 'spell', 'Fireball|XPHB|fireballs').display).toBe('fireballs');
  });

  it('item resolve base e catálogo, case-insensitive', () => {
    expect(lookupEntityLink(db, 'item', 'longsword|xphb').raw.name).toBe('Longsword');
    expect(lookupEntityLink(db, 'item', 'Bag of Holding|XDMG').raw.rarity).toBe('uncommon');
  });

  it('itemGroup ({@item Arcane Focus}) vira popup listando os membros como links', () => {
    const hit = lookupEntityLink(db, 'item', 'Arcane Focus|XPHB');
    expect(hit.kind).toBe('entity');
    const list = hit.raw.entries.find((e) => e?.type === 'list');
    expect(list.items).toContain('{@item Crystal|XPHB}');
  });

  it('feat / optfeature / language viram links de entidade', () => {
    expect(lookupEntityLink(db, 'feat', 'Alert|XPHB').kind).toBe('entity');
    expect(lookupEntityLink(db, 'optfeature', 'Agonizing Blast').kind).toBe('entity');
    expect(lookupEntityLink(db, 'language', 'Primordial||Aquan')).toMatchObject({ kind: 'entity', display: 'Aquan' });
  });

  it('race com linhagem embutida cai na raça base ("gnome (rock)" → Gnome)', () => {
    const hit = lookupEntityLink(db, 'race', 'gnome (rock)||Gnome, rock');
    expect(hit.raw.name).toBe('Gnome');
    expect(hit.display).toBe('Gnome, rock');
  });

  it('background abre popup de regra (sem entity própria)', () => {
    const hit = lookupEntityLink(db, 'background', 'Giant Foundling|BGG');
    expect(hit.kind).toBe('rule');
    expect(hit.entry).toMatchObject({ type: 'background', name: 'Giant Foundling', source: 'BGG' });
  });

  it('sem match → null (o chamador degrada pro span inerte)', () => {
    expect(lookupEntityLink(db, 'spell', 'Nonexistent Spell')).toBeNull();
    expect(lookupEntityLink(db, 'creature', 'Goblin')).toBeNull();
    expect(lookupEntityLink(null, 'spell', 'Fireball')).toBeNull();
  });
});

describe('lookupEntityLink - features de classe/subclasse', () => {
  it('classFeature: Name|Class|ClassSource|Level|FeatureSource', () => {
    const hit = lookupEntityLink(db, 'classFeature', 'Channel Divinity|Paladin|XPHB|3|XPHB');
    expect(hit.kind).toBe('rule');
    expect(hit.entry).toMatchObject({ type: 'classFeature', source: 'XPHB' });
    expect(hit.display).toBe('Channel Divinity');
  });

  it('classFeature sem fonte prefere a versão 2024', () => {
    expect(lookupEntityLink(db, 'classFeature', 'Channel Divinity|Paladin||3').entry.source).toBe('XPHB');
  });

  it('subclassFeature casa por subclasse e nível', () => {
    const hit = lookupEntityLink(db, 'subclassFeature', 'Aura of Warding|Paladin|XPHB|Ancients|XPHB|7|XPHB');
    expect(hit.entry).toMatchObject({ type: 'subclassFeature', name: 'Aura of Warding' });
    expect(lookupEntityLink(db, 'subclassFeature', 'Aura of Warding|Paladin|XPHB|Vengeance|XPHB|7')).toBeNull();
  });
});

describe('entityTagDisplay', () => {
  it('gramáticas próprias: classFeature (6º) e subclassFeature (8º)', () => {
    expect(entityTagDisplay('classFeature', 'Rage|Barbarian||1||fúria')).toBe('fúria');
    expect(entityTagDisplay('classFeature', 'Rage|Barbarian||1')).toBe('Rage');
    expect(entityTagDisplay('subclassFeature', 'A|B|C|D|E|6|F|texto')).toBe('texto');
  });

  it('tags simples: Name|Source|Display', () => {
    expect(entityTagDisplay('spell', 'Fireball|XPHB|bolas de fogo')).toBe('bolas de fogo');
    expect(entityTagDisplay('item', 'Longsword')).toBe('Longsword');
  });
});
