// =============================================================================
// foundryT3.test: magias com activity, itens mágicos e o export future-proof
// =============================================================================
// O QUE FAZ
//   Prova as peças da T3 que o Foundry real cobrou (TC-0106, TC-0107, DDL-0167):
//   a mecânica da magia (SRD, overlay, dado do 5etools), o lançamento grátis no
//   formato dos premades, a identidade do item encantado no import, a mecânica
//   do item pelo SRD, as marcas de procedência e as chaves atuais de effect.
//
// FUNÇÕES
//   fakeDb(): um db mínimo com os itens que o import precisa achar.
//   ench(value, origin, extra): um effect de encantamento com o nome e a origem.
//
// DECISÕES E ARMADILHAS
//   - Os registros grandes vêm pelo loadFoundryMechanics, como no export de
//     verdade; sem ele a magia do SRD cairia no dado do 5etools.
// -----------------------------------------------------------------------------

import { describe, it, expect, beforeAll } from 'vitest';
import { loadFoundryMechanics } from './foundryMechanicsData';
import { spellMechanics, srdSpellMechanics, derivedSpellMechanics, withFreeCasting } from './foundrySpellMechanics';
import { srdItemMechanics } from './foundryItemMechanics';
import { interopFlags, toolsHash } from './foundryInterop';
import { modernizeEffects } from './foundryCompat';
import { inventoryIdentity } from './foundryImport';

function fakeDb() {
  return {
    'items-base': { baseitem: [{ name: 'Shield', source: 'XPHB' }, { name: 'Plate Armor', source: 'XPHB' }] },
    items: {
      item: [
        { name: '+2 Shield', source: 'XDMG' },
        { name: 'Mithral Plate Armor', source: 'XDMG' },
        { name: 'Elven Chain', source: 'XDMG' },
        { name: 'Ring of Fire Resistance', source: 'XDMG' },
        { name: 'Potion of Fire Giant Strength', source: 'XDMG' },
      ],
    },
  };
}

const ench = (value, origin, extra = []) => ({
  type: 'enchantment',
  disabled: false,
  origin,
  changes: [{ key: 'name', mode: 5, value }, ...extra],
});

beforeAll(async () => {
  await loadFoundryMechanics();
});

describe('mecânica das magias (TC-0106)', () => {
  it('a magia de 2024 pega as activities do SRD, pelo nome do SRD', () => {
    const gb = srdSpellMechanics({ name: 'Guiding Bolt', source: 'XPHB' });
    expect(Object.values(gb.activities).map((a) => a.type)).toContain('attack');
    const hl = srdSpellMechanics({ name: "Tasha's Hideous Laughter", source: 'XPHB' });
    expect(Object.values(hl.activities).map((a) => a.type)).toContain('save');
  });

  it('a de 2014 não usa o SRD 2024; spellMechanics devolve CÓPIA', () => {
    expect(srdSpellMechanics({ name: 'Guiding Bolt', source: 'PHB' })).toBeNull();
    const a = spellMechanics({ name: 'Fire Bolt', source: 'XPHB' }, null);
    const b = spellMechanics({ name: 'Fire Bolt', source: 'XPHB' }, null);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    Object.values(a.activities)[0].type = 'mutated';
    expect(Object.values(spellMechanics({ name: 'Fire Bolt', source: 'XPHB' }, null).activities)[0].type).toBe('attack');
  });

  it('sem SRD nem overlay, monta ataque ou save dos campos do 5etools', () => {
    const thunder = derivedSpellMechanics({
      name: 'Thunderclap', level: 0, savingThrow: ['constitution'], damageInflict: ['thunder'],
      entries: ['each creature ... {@damage 1d6} Thunder damage'],
    });
    const act = Object.values(thunder.activities)[0];
    expect(act).toMatchObject({ type: 'save', save: { ability: 'con', dc: { calculation: 'spellcasting' } } });
    expect(act.damage.parts[0]).toMatchObject({ number: 1, denomination: '6', types: ['thunder'], scaling: { mode: 'whole' } });
    const steel = derivedSpellMechanics({
      name: 'Steel Wind Strike', level: 5, spellAttack: ['M'], damageInflict: ['force'],
      entries: ['{@damage 6d10} Force damage'], entriesHigherLevel: [],
    });
    expect(Object.values(steel.activities)[0]).toMatchObject({ type: 'attack', attack: { type: { value: 'melee', classification: 'spell' } } });
    expect(derivedSpellMechanics({ name: 'Feign Death', level: 3, entries: [] })).toBeNull();
  });

  it('lançamento grátis: forward na concedida, uso do item no Mystic Arcanum', () => {
    const granted = withFreeCasting(spellMechanics({ name: 'Command', source: 'XPHB' }, null), { hasUses: true, isArcanum: false });
    const fwd = Object.values(granted.activities).find((a) => a.type === 'forward');
    expect(fwd.consumption.targets).toEqual([{ type: 'itemUses', target: '', value: '1', scaling: {} }]);
    expect(fwd.name).toMatch(/free casting/);
    const arcanum = withFreeCasting(spellMechanics({ name: 'True Polymorph', source: 'XPHB' }, null), { hasUses: true, isArcanum: true });
    for (const a of Object.values(arcanum.activities)) {
      if (a.consumption?.spellSlot !== false) expect(a.consumption.targets.at(-1)).toMatchObject({ type: 'itemUses', target: '' });
    }
  });
});

describe('itens mágicos (TC-0107)', () => {
  it('o import lê o encantamento do item base pelo nome e pela origem', () => {
    const db = fakeDb();
    const shield = { name: 'Shield', effects: [ench('{} +2', 'Compendium.dnd5e.equipment24.Item.dmgShield12or300')] };
    expect(inventoryIdentity(shield, db)).toEqual({ name: '+2 Shield', source: 'XDMG' });
    const mithral = { name: 'Plate Armor', effects: [ench('Mithral {}', 'Compendium.dnd5e.equipment24.Item.dmgMithralArmor0')] };
    expect(inventoryIdentity(mithral, db)?.name).toBe('Mithral Plate Armor');
    const elven = { name: 'Chain Shirt', effects: [ench('Elven {}', 'Compendium.dnd5e.equipment24.Item.dmgElvenChain000')] };
    expect(inventoryIdentity(elven, db)?.name).toBe('Elven Chain');
    const ring = {
      name: 'Ring',
      effects: [
        ench('Ring of Resistance (garnet)', 'Compendium.dnd5e.equipment24.Item.dmgRingOfResista'),
        { type: 'base', changes: [{ key: 'system.traits.dr.value', mode: 2, value: 'fire' }] },
      ],
    };
    expect(inventoryIdentity(ring, db)?.name).toBe('Ring of Fire Resistance');
    expect(inventoryIdentity({ name: 'Potion of Giant Strength (Fire)', effects: [] }, db)?.name).toBe('Potion of Fire Giant Strength');
  });

  it('encantamento de MAGIA não muda a identidade; o que não resolve vira snapshot', () => {
    const db = fakeDb();
    const staff = { name: 'Shield', effects: [ench('{} (Shillelagh)', 'Compendium.dnd5e.actors24.Actor.X.Item.Y')] };
    expect(inventoryIdentity(staff, db)?.name).toBe('Shield');
    expect(inventoryIdentity({ name: 'Homebrew Thing', effects: [] }, db)).toBeNull();
  });

  it('a mecânica do item vem do documento do SRD, em cópia', () => {
    const belt = srdItemMechanics('Belt of Dwarvenkind');
    expect(belt.effects.flatMap((e) => e.changes.map((c) => c.key))).toContain('system.abilities.con.value');
    expect(srdItemMechanics('Potion of Fire Giant Strength').effects[0].changes[0]).toMatchObject({ key: 'system.abilities.str.value', value: '25' });
    expect(srdItemMechanics('Ring of Acid Resistance')).toBeNull();
  });
});

describe('export future-proof e interoperável (DDL-0167)', () => {
  it('marca de procedência no formato do hash do 5etools', () => {
    expect(toolsHash("Healer's Kit", 'XPHB')).toBe("healer's%20kit_xphb");
    expect(toolsHash('Elf; Drow Lineage', 'XPHB')).toBe('elf%3b%20drow%20lineage_xphb');
    expect(interopFlags('subclass', { name: 'Champion', source: 'XPHB', shortName: 'Champion', className: 'Fighter', classSource: 'XPHB' }).plutonium)
      .toEqual({ page: 'classes.html', source: 'XPHB', hash: 'fighter_xphb,state:sub_champion_xphb=b1', propDroppable: 'subclass' });
    expect(interopFlags('subclassFeature', {
      name: 'Improved Critical', source: 'XPHB', level: 3, className: 'Fighter', classSource: 'XPHB', shortName: 'Champion', subclassSource: 'XPHB',
    }).plutonium.hash).toBe('improved%20critical_fighter_xphb_champion_xphb_3_xphb');
    expect(interopFlags('classFeature', { name: 'X', source: 'XPHB' })).toEqual({});
  });

  it('as chaves que o dnd5e moveu saem nas atuais, sem mexer no effect recebido', () => {
    const old = { name: 'Belt', changes: [{ key: 'system.attributes.senses.darkvision', mode: 4, value: '60' }, { key: 'system.abilities.con.value', mode: 2, value: '2' }] };
    const [now] = modernizeEffects([old]);
    expect(now.changes.map((c) => c.key)).toEqual(['system.attributes.senses.ranges.darkvision', 'system.abilities.con.value']);
    expect(old.changes[0].key).toBe('system.attributes.senses.darkvision');
  });
});
