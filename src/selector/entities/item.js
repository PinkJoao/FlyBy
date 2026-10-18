// =============================================================================
// item: a entity de item (a loja de equipamento, Fase B1)
// =============================================================================
// O QUE FAZ
//   Catálogo COMPLETO: itens base, o catálogo geral (mágicos, engenho, comida) e as
//   variantes mágicas GERADAS. Reusa a classificação do engine/items (a mesma do
//   InventoryTab) no filtro de Tipo; reprints saem por latestOnly, e itens de
//   outras eras (`age`: armas de fogo, sci-fi) ficam fora da loja padrão.
//
// FUNÇÕES
//   cap(s), stripSrc(s): texto ("V|XPHB" vira "V").
//   rarityLabel(raw): o rótulo da raridade.
//   findProperty(db, code), findMastery(db, code), propertyName(db, code): as
//     propriedades e maestrias de arma, do db.
//   weaponDamage(raw): "1d8 Slashing (1d10 two-handed)".
//   formatCopper(v), formatPrice(raw, db): o preço (derivado com "~").
//   weightText(raw), typeLabel(raw): peso e tipo em texto simples.
//   Exporta itemEntity.
//
// DECISÕES E ARMADILHAS
//   - RARITY_LABEL existe porque o `cap` genérico fazia "very rare" virar "Very
//     rare", que não casava com o chip "Very Rare": 732 itens inalcançáveis. Os três
//     valores que não são tier (unknown, unknown (magic), varies) também têm opção,
//     senão 301 itens ficavam fora do filtro. Só os tiers ganham badge colorido.
//   - O card mostra tipo e preço, sem peso nem fonte (ocupam espaço e importam
//     pouco); a raridade é um badge pequeno e colorido. O detalhe traz as
//     descrições resolvidas das propriedades e maestrias.
// -----------------------------------------------------------------------------

import { latestOnly } from '../reprints';
import { itemTypeInfo, attunementInfo } from '../../engine/items';
import { itemValue, isValueDerived } from '../../engine/magicItemPrice';
import { specificVariants } from '../../engine/magicVariants';

// ATENÇÃO: cada opção é IDÊNTICA ao que rarityLabel emite; o que casa é o valor, não o rótulo (DDL-0078).
const RARITY_OPTIONS = [
  'None', 'Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact',
  'Unknown', 'Unknown (Magic)', 'Varies',
];

const RARITY_COLOR = {
  uncommon: '#3fa14b',
  rare: '#4a90d9',
  'very rare': '#a45ee5',
  legendary: '#e08a2e',
  artifact: '#c9a227',
};

const RARITY_TIERS = new Set(['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact']);

const DAMAGE_TYPES = {
  A: 'Acid', B: 'Bludgeoning', C: 'Cold', F: 'Fire', O: 'Force', L: 'Lightning',
  N: 'Necrotic', P: 'Piercing', I: 'Poison', Y: 'Psychic', R: 'Radiant', S: 'Slashing', T: 'Thunder',
};

const PROPERTY_NAMES = {
  A: 'Ammunition', AF: 'Ammunition', BF: 'Burst Fire', F: 'Finesse', H: 'Heavy',
  L: 'Light', LD: 'Loading', R: 'Reach', RLD: 'Reload', S: 'Special', T: 'Thrown',
  V: 'Versatile', '2H': 'Two-Handed', Vst: 'Vestige of Divergence',
};

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Tira o sufixo de fonte de um uid. */
function stripSrc(s) {
  return typeof s === 'string' ? s.split('|')[0] : s?.uid?.split('|')[0] ?? s;
}

const RARITY_LABEL = {
  none: 'None',
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  'very rare': 'Very Rare',
  legendary: 'Legendary',
  artifact: 'Artifact',
  unknown: 'Unknown',
  'unknown (magic)': 'Unknown (Magic)',
  varies: 'Varies',
};

function rarityLabel(raw) {
  const r = raw?.rarity ?? 'none';
  return RARITY_LABEL[r] ?? cap(r);
}

/** A definição de uma propriedade de arma no db. */
function findProperty(db, code) {
  const abbr = stripSrc(code);
  return (db?.['items-base']?.itemProperty ?? []).find((p) => p.abbreviation === abbr) ?? null;
}

/** A definição de uma maestria no db. */
function findMastery(db, code) {
  const name = stripSrc(code);
  return (db?.['items-base']?.itemMastery ?? []).find((m) => m.name === name) ?? null;
}

/** O nome legível de uma propriedade. */
function propertyName(db, code) {
  const def = findProperty(db, code);
  return def?.entries?.[0]?.name ?? PROPERTY_NAMES[stripSrc(code)] ?? stripSrc(code);
}

/** O dano da arma em texto. */
function weaponDamage(raw) {
  if (!raw?.dmg1) return null;
  const type = DAMAGE_TYPES[raw.dmgType] ?? '';
  let out = `${raw.dmg1}${type ? ` ${type}` : ''}`;
  if (raw.dmg2) out += ` (${raw.dmg2} two-handed)`;
  return out;
}

/** Um valor em cobre na maior denominação sensata. */
function formatCopper(v) {
  if (v >= 100) return `${(v / 100).toLocaleString()}gp`;
  if (v >= 10) return `${v / 10}sp`;
  return `${v}cp`;
}

/** O preço formatado (o derivado com "~"). */
export function formatPrice(raw, db) {
  const v = itemValue(raw, db);
  if (v == null) return null;
  return (isValueDerived(raw) ? '~' : '') + formatCopper(v);
}

function weightText(raw) {
  return raw?.weight ? `${raw.weight} lb` : null;
}

/** O tipo em texto simples ("Martial Weapon", "Potion"). */
function typeLabel(raw) {
  const info = itemTypeInfo(raw);
  if (info.group === 'weapon') return `${cap(info.category ?? '')} Weapon`.trim();
  if (info.group === 'armor') return info.armorSlot === 'shield' ? 'Shield' : `${cap(info.armorSlot ?? '')} Armor`.trim();
  return info.groupLabel?.replace(/ Items$/, ' Item').replace(/([a-rt-z])s$/, '$1') ?? info.groupLabel;
}

const itemEntity = {
  type: 'item',
  title: 'Item',

  list: (db) => [
    ...latestOnly(db?.['items-base']?.baseitem ?? []).filter((i) => !i.age),
    ...latestOnly(db?.items?.item ?? []).filter((i) => !i.age),
    ...specificVariants(db).filter((i) => !i.age),
  ],

  idOf: (r) => `${r.name}|${r.source}`,

  precompute: (r) => {
    const info = itemTypeInfo(r);
    const attune = attunementInfo(r);
    const isWeapon = info.group === 'weapon';
    return {
      searchText: `${r.name} ${r.source} ${info.groupLabel}`.toLowerCase(),
      filterValues: {
        type: [info.groupLabel],
        rarity: [rarityLabel(r)],
        attunement: attune.required ? ['Requires Attunement'] : [],
        category: isWeapon && r.weaponCategory ? [cap(r.weaponCategory)] : [],
        kind: isWeapon ? [info.kind === 'ranged' ? 'Ranged' : 'Melee'] : [],
        property: isWeapon
          ? [
              ...(r.property ?? []).map((p) => PROPERTY_NAMES[stripSrc(p)] ?? stripSrc(p)),
              ...(r.firearm ? ['Firearm'] : []),
            ]
          : [],
        mastery: isWeapon ? (r.mastery ?? []).map((m) => stripSrc(m)) : [],
        source: [r.source],
      },
    };
  },

  filters: [
    { id: 'type', header: 'Type', derive: true },
    { id: 'rarity', header: 'Rarity', options: RARITY_OPTIONS },
    { id: 'attunement', header: 'Attunement', options: ['Requires Attunement'] },
    { id: 'category', header: 'Weapon Category', options: ['Simple', 'Martial'] },
    { id: 'kind', header: 'Melee / Ranged', options: ['Melee', 'Ranged'] },
    { id: 'property', header: 'Weapon Property', derive: true },
    { id: 'mastery', header: 'Weapon Mastery', derive: true },
    { id: 'source', header: 'Source', derive: true },
  ],

  meta: (r, db) => {
    const info = itemTypeInfo(r);
    const attune = attunementInfo(r);
    const out = [];

    if (info.group === 'weapon') {
      const label = [cap(info.category), info.kind === 'ranged' ? 'Ranged' : 'Melee', 'Weapon'].filter(Boolean).join(' ');
      out.push({ label: 'Type', value: label });
      const dmg = weaponDamage(r);
      if (dmg) out.push({ label: 'Damage', value: dmg, highlight: true });
      if (r.range) out.push({ label: 'Range', value: `${r.range} ft` });
      if (r.property?.length) out.push({ label: 'Properties', value: r.property.map((p) => propertyName(db, p)).join(', ') });
      if (r.mastery?.length) out.push({ label: 'Mastery', value: r.mastery.map((m) => stripSrc(m)).join(', ') });
    } else if (info.group === 'armor') {
      out.push({ label: 'Type', value: info.armorSlot === 'shield' ? 'Shield' : `${cap(info.armorSlot)} Armor` });
      if (r.ac != null) out.push({ label: 'Armor Class', value: info.armorSlot === 'shield' ? `+${r.ac}` : String(r.ac), highlight: true });
      if (r.strength) out.push({ label: 'Strength', value: `Str ${r.strength}` });
      if (r.stealth) out.push({ label: 'Stealth', value: 'Disadvantage' });
    } else {
      out.push({ label: 'Type', value: info.groupLabel });
    }

    if (r.rarity && r.rarity !== 'none') out.push({ label: 'Rarity', value: rarityLabel(r), highlight: true });
    const weight = weightText(r);
    if (weight) out.push({ label: 'Weight', value: weight });
    const price = formatPrice(r, db);
    if (price) out.push({ label: 'Price', value: price });
    if (attune.required) out.push({ label: 'Attunement', value: attune.prereqText ? `Required, ${attune.prereqText}` : 'Required' });
    return out;
  },

  entries: (r, db) => {
    const out = [...(r.entries ?? [])];
    for (const code of r.property ?? []) {
      const def = findProperty(db, code);
      const block = def?.entries?.[0];
      if (block) out.push(block);
    }
    for (const code of r.mastery ?? []) {
      const def = findMastery(db, code);
      if (def?.entries) out.push({ type: 'entries', name: `Mastery: ${def.name}`, entries: def.entries });
    }
    return out.length ? out : undefined;
  },

  fluff: (r, db) => {
    const list = db?.['fluff-items']?.itemFluff ?? [];
    return list.find((f) => f.name === r.name && f.source === r.source) ?? null;
  },

  card: (r, db) => {
    const rarity = RARITY_TIERS.has(r.rarity) ? r.rarity : null;
    const bits = [typeLabel(r), formatPrice(r, db)].filter(Boolean);
    return {
      title: r.name,
      meta: bits.join(' · '),
      rarity: rarity ? { label: rarityLabel(r), color: RARITY_COLOR[rarity] ?? null } : null,
    };
  },
};

export default itemEntity;
