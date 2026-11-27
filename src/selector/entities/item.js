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
//   rarityLabel(raw), rarityRank(raw): o rótulo e a posição na escala de raridade
//     (mundano antes de comum).
//   findProperty(db, code), findMastery(db, code), propertyName(db, code): as
//     propriedades e maestrias de arma, do db.
//   weaponDamage(raw): "1d8 Slashing (1d10 two-handed)".
//   formatCopper(v), formatPrice(raw, db): o preço (derivado com "~").
//   weightText(raw), typeLabel(raw): peso e tipo em texto simples.
//   artIndex(db): as artes do fluff por "nome|fonte" e por nome, memoizado.
//   itemThumb(raw, db): a miniatura do item ({ src, icon, tint }): a arte própria,
//     a do item base, senão o ícone do grupo.
//   itemCardExtra(raw, db): as linhas extras do card (dano, propriedades, maestria,
//     alcance; CA com a Força numa linha só, Furtividade; peso; sintonia), na ordem de importância.
//   Exporta ITEM_GROUP_ICONS (o ícone de cada grupo, o mesmo do inventário).
//   Exporta itemEntity.
//
// DECISÕES E ARMADILHAS
//   - A Força da armadura vai NA linha da CA ("AC 18 · Strength 15", DDL-0345): o card só mostra as
//     linhas que cabem, e na armadura mágica a etiqueta de raridade empurrava a Força para fora.
//   - typeLabel põe o tipo no singular (Potions, Potion), mas nunca em "us" e "ss":
//     a regra antiga cortava "Spellcasting Focus" em "Focu" (T1 da T3, DDL-0185).
//   - `naturalSort` é Rarity (do mundano ao artefato, e alfabético dentro de cada
//     raridade pelo `sortList`): sem isso os ~4000 itens mágicos abrem a loja na
//     frente do equipamento básico. `sorts` traz Price (o derivado também,
//     `itemValue`) e Weight; item sem preço, sem peso ou de raridade desconhecida/
//     variável fica no fim nos dois sentidos (src/sorting.js).
//   - RARITY_LABEL existe porque o `cap` genérico fazia "very rare" virar "Very
//     rare", que não casava com o chip "Very Rare": 732 itens inalcançáveis. Os três
//     valores que não são tier (unknown, unknown (magic), varies) também têm opção,
//     senão 301 itens ficavam fora do filtro. Só os tiers ganham badge colorido.
//   - A miniatura (itemThumb, DDL-0285) herda a arte do ITEM BASE (o Battleaxe no
//     "Adamantine Battleaxe"): só 14% dos itens da loja têm arte própria. A arte do
//     MODELO da variante saiu (DDL-0287, pedido do dono): o mesmo desenho de espada em
//     todo "Adamantine ..." escondia que um era machado e outro flecha. Sem arte, o ícone
//     do grupo tingido pela raridade. O card a pede em `cardShape.thumb` (o SelectorPanel só a desenha no
//     celular).
//   - O card mostra tipo e preço, sem peso nem fonte (ocupam espaço e importam
//     pouco); a raridade é um badge pequeno e colorido. O detalhe traz as
//     descrições resolvidas das propriedades e maestrias.
// -----------------------------------------------------------------------------

import { latestOnly } from '../reprints';
import { itemTypeInfo, attunementInfo } from '../../engine/items';
import { itemValue, isValueDerived } from '../../engine/magicItemPrice';
import { specificVariants } from '../../engine/magicVariants';
import { imgUrl } from '../../components/common/media';

// ATENÇÃO: cada opção é IDÊNTICA ao que rarityLabel emite; o que casa é o valor, não o rótulo (DDL-0078).
const RARITY_OPTIONS = [
  'None', 'Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact',
  'Unknown', 'Unknown (Magic)', 'Varies',
];

const RARITY_COLOR = {
  uncommon: 'var(--rarity-uncommon)',
  rare: 'var(--rarity-rare)',
  'very rare': 'var(--rarity-very-rare)',
  legendary: 'var(--rarity-legendary)',
  artifact: 'var(--rarity-artifact)',
};

const RARITY_TIERS = new Set(['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact']);
const RARITY_RANK = ['none', 'common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'];

const DAMAGE_TYPES = {
  A: 'Acid', B: 'Bludgeoning', C: 'Cold', F: 'Fire', O: 'Force', L: 'Lightning',
  N: 'Necrotic', P: 'Piercing', I: 'Poison', Y: 'Psychic', R: 'Radiant', S: 'Slashing', T: 'Thunder',
};

const PROPERTY_NAMES = {
  A: 'Ammunition', AF: 'Ammunition', BF: 'Burst Fire', F: 'Finesse', H: 'Heavy',
  L: 'Light', LD: 'Loading', R: 'Reach', RLD: 'Reload', S: 'Special', T: 'Thrown',
  V: 'Versatile', '2H': 'Two-Handed', Vst: 'Vestige of Divergence',
};

export const ITEM_GROUP_ICONS = {
  all: 'itemAll',
  weapon: 'itemWeapon',
  armor: 'itemArmor',
  spellcastingFocus: 'itemFocus',
  ammunition: 'itemAmmo',
  tool: 'itemTool',
  instrument: 'itemInstrument',
  gear: 'itemGear',
  food: 'itemFood',
  wondrous: 'itemWondrous',
  ring: 'itemRing',
  wand: 'itemWand',
  rod: 'itemRod',
  potion: 'itemPotion',
  scroll: 'itemScroll',
  treasure: 'itemTreasure',
  other: 'itemOther',
};

const artCache = new WeakMap();
/** As artes do fluff de item por "nome|fonte" e por nome (a primeira), memoizado. */
function artIndex(db) {
  const list = db?.['fluff-items']?.itemFluff ?? [];
  let ix = artCache.get(list);
  if (!ix) {
    ix = { exact: new Map(), byName: new Map() };
    for (const f of list) {
      const href = f.images?.find((i) => i.href)?.href;
      if (!href || !f.name) continue;
      ix.exact.set(`${f.name}|${f.source}`.toLowerCase(), href);
      const n = f.name.toLowerCase();
      if (!ix.byName.has(n)) ix.byName.set(n, href);
    }
    artCache.set(list, ix);
  }
  return ix;
}

/** As linhas extras do card, da mais à menos importante (o que cabe no espaço livre, DDL-0288). */
export function itemCardExtra(raw, db) {
  const info = itemTypeInfo(raw);
  const out = [];
  if (info.group === 'weapon') {
    const dmg = weaponDamage(raw);
    if (dmg) out.push(dmg);
    if (raw.property?.length) out.push(raw.property.map((p) => propertyName(db, p)).join(', '));
    if (raw.mastery?.length) out.push(`Mastery: ${raw.mastery.map((m) => stripSrc(m)).join(', ')}`);
    if (raw.range) out.push(`Range ${raw.range} ft`);
  } else if (info.group === 'armor') {
    const ac = raw.ac != null ? (info.armorSlot === 'shield' ? `AC +${raw.ac}` : `AC ${raw.ac}`) : null;
    const str = raw.strength ? `Strength ${raw.strength}` : null;
    if (ac || str) out.push([ac, str].filter(Boolean).join(' · '));
    if (raw.stealth) out.push('Stealth disadvantage');
  }
  const weight = weightText(raw);
  if (weight) out.push(weight);
  if (attunementInfo(raw).required) out.push('Requires attunement');
  return out;
}

/** A miniatura do item: a arte própria, a do item base, senão o ícone do grupo. */
export function itemThumb(raw, db) {
  if (!raw) return null;
  const ix = artIndex(db);
  const own = ix.exact.get(`${raw.name}|${raw.source}`.toLowerCase());
  const [baseName, baseSource] = String(raw.baseItem ?? '').split('|');
  const base = baseName
    ? ix.exact.get(`${baseName}|${baseSource || 'phb'}`.toLowerCase()) ?? ix.byName.get(baseName.toLowerCase())
    : null;
  const tier = RARITY_TIERS.has(raw.rarity) ? raw.rarity : null;
  return {
    src: imgUrl(own ?? base ?? null),
    icon: ITEM_GROUP_ICONS[itemTypeInfo(raw).group] ?? ITEM_GROUP_ICONS.other,
    tint: tier ? RARITY_COLOR[tier] ?? null : null,
  };
}

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

/** A posição na escala de raridade (mundano antes de comum; desconhecido/variável = null). */
function rarityRank(raw) {
  const i = RARITY_RANK.indexOf(raw?.rarity ?? 'none');
  return i === -1 ? null : i;
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
  return info.groupLabel?.replace(/ Items$/, ' Item').replace(/([^su])s$/, '$1') ?? info.groupLabel;
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
    const isArmor = info.group === 'armor';
    return {
      searchText: `${r.name} ${r.source} ${info.groupLabel}`.toLowerCase(),
      filterValues: {
        type: [info.groupLabel],
        rarity: [rarityLabel(r)],
        attunement: attune.required ? ['Requires Attunement'] : [],
        armorCategory: isArmor && info.armorSlot ? [cap(info.armorSlot)] : [],
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

  naturalSort: {
    value: 'rarity',
    label: 'Rarity',
    defaultDir: 'asc',
    dirLabels: ['Most common first', 'Rarest first'],
    keyOf: rarityRank,
  },

  sorts: [
    { value: 'price', label: 'Price', defaultDir: 'asc', keyOf: (r, db) => itemValue(r, db) ?? null },
    { value: 'weight', label: 'Weight', defaultDir: 'asc', dirLabels: ['Lightest first', 'Heaviest first'], keyOf: (r) => r.weight ?? null },
  ],

  filters: [
    { id: 'type', header: 'Type', derive: true },
    { id: 'rarity', header: 'Rarity', options: RARITY_OPTIONS },
    { id: 'attunement', header: 'Attunement', options: ['Requires Attunement'] },
    { id: 'armorCategory', header: 'Armor Category', options: ['Light', 'Medium', 'Heavy', 'Shield'] },
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

  cardShape: { meta: 2, tags: 1, thumb: true },

  thumb: itemThumb,

  cardExtra: itemCardExtra,
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
