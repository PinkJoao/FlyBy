// =============================================================================
// items: a resolução e o agrupamento de itens (inventário, Fase B1)
// =============================================================================
// O QUE FAZ
//   `character.inventory` guarda só a DECISÃO (itemId, fonte, quantidade,
//   estado); peso, tipo e raridade são resolvidos ao vivo contra o db, como as
//   espécies e os talentos.
//
// FUNÇÕES
//   baseTypeCode(raw): o código de tipo sem a fonte, ou 'WONDROUS'.
//   itemTypeInfo(raw): grupo e sub-tipo (melee ou ranged, simples ou marcial,
//     armadura leve, média, pesada ou escudo).
//   attunementInfo(raw): exige atunamento? (com o pré-requisito em prosa)
//   customTypeInfo(custom): o mesmo para um item custom, pelo snapshot Foundry.
//   resolveItemObj(db, itemId, source): o item, nos itens base, no catálogo e nas
//     variantes geradas.
//   deriveInventory(character, db): as entradas resolvidas, o peso e os atunados.
//   carryingCapacity(strScore): Força x 15 lb (a regra núcleo 2024).
//
// DECISÕES E ARMADILHAS
//   - Itens "wondrous" não têm `type`, só a flag.
//   - resolveItemObj tenta a CAIXA diferente depois do casamento exato: o premade
//     da Quillathe traz "Sprig of mistletoe", e sem isso o item perdia peso,
//     preço e tipo (TC-0066). Por último, o OUTRO nome do mesmo item entre o
//     compêndio completo e o SRD ("Heward's Handy Haversack" x "Handy
//     Haversack", srdNames.js): a ficha feita num modo abre no outro.
//   - Item fora do catálogo (componente de magia, homebrew) deriva do snapshot do
//     import; RARITY_WORD e EQUIP_TYPE_GROUP o põem na mesma escala dos outros.
//   - GUARDADO não é EM USO (DDL-0082): um item dentro da mochila não conta para a
//     CA nem aparece equipado. A regra vive na derivação, não só na UI, para valer
//     num ator importado; o campo cru fica intacto.
//   - O peso total é calculado DEPOIS de montar as entradas, porque depende da
//     cadeia de pais (containers).
// -----------------------------------------------------------------------------

import { latestOnly } from '../selector/reprints';
import { alternateNames } from './srdNames';
import { resolveVariantObj } from './magicVariants';
import { isContainerName, containerProps, weightContext } from './containers';

const GROUPS = {
  weapon: { label: 'Weapons', codes: ['M', 'R'] },
  armor: { label: 'Armor', codes: ['LA', 'MA', 'HA', 'S'] },
  spellcastingFocus: { label: 'Spellcasting Focus', codes: ['SCF'] },
  tool: { label: 'Tools', codes: ['AT', 'T', 'GS'] },
  instrument: { label: 'Instruments', codes: ['INS'] },
  ammunition: { label: 'Ammunition', codes: ['A', 'AF'] },
  gear: { label: 'Adventuring Gear', codes: ['G', 'TAH', 'MNT', 'VEH', 'SHP', 'SPC'] },
  food: { label: 'Food & Drink', codes: ['FD'] },
  wondrous: { label: 'Wondrous Items', codes: [] },
  ring: { label: 'Rings', codes: ['RG'] },
  wand: { label: 'Wands', codes: ['WD'] },
  rod: { label: 'Rods', codes: ['RD'] },
  potion: { label: 'Potions', codes: ['P'] },
  scroll: { label: 'Scrolls', codes: ['SC'] },
  treasure: { label: 'Treasure', codes: ['$', '$A', '$C', '$G', 'TB', 'TG'] },
  other: { label: 'Other', codes: ['OTH', 'EXP', 'GV'] },
};

const CODE_TO_GROUP = {};
for (const [key, { codes }] of Object.entries(GROUPS)) {
  for (const code of codes) CODE_TO_GROUP[code] = key;
}

const ARMOR_SLOT_BY_CODE = { LA: 'light', MA: 'medium', HA: 'heavy', S: 'shield' };

/** O código de tipo cru, ou `WONDROUS` para item sem `type`. */
function baseTypeCode(raw) {
  if (!raw) return null;
  if (raw.type) return String(raw.type).split('|')[0];
  if (raw.wondrous) return 'WONDROUS';
  return null;
}

/**
 * Classifica um item em grupo e sub-tipo.
 * @param {object|null} raw
 * @returns {{group:string, groupLabel:string, kind:string|null, category:string|null, armorSlot:string|null}}
 */
export function itemTypeInfo(raw) {
  const code = baseTypeCode(raw);
  const group = code === 'WONDROUS' ? 'wondrous' : (CODE_TO_GROUP[code] ?? 'other');
  return {
    group,
    groupLabel: GROUPS[group]?.label ?? 'Other',
    kind: group === 'weapon' ? (code === 'R' ? 'ranged' : 'melee') : null,
    category: group === 'weapon' ? (raw?.weaponCategory ?? null) : null,
    armorSlot: group === 'armor' ? (ARMOR_SLOT_BY_CODE[code] ?? null) : null,
  };
}

export const GROUP_ORDER = [
  'weapon', 'armor', 'spellcastingFocus', 'ammunition', 'tool', 'instrument',
  'gear', 'food', 'wondrous', 'ring', 'wand', 'rod', 'potion', 'scroll', 'treasure', 'other',
];

/** O item exige atunamento? */
export function attunementInfo(raw) {
  const req = raw?.reqAttune;
  if (!req) return { required: false, prereqText: null };
  return { required: true, prereqText: typeof req === 'string' ? req : null };
}

const RARITY_WORD = {
  common: 'common', uncommon: 'uncommon', rare: 'rare',
  veryRare: 'very rare', legendary: 'legendary', artifact: 'artifact',
};

const EQUIP_TYPE_GROUP = { ring: 'ring', wand: 'wand', rod: 'rod', wondrous: 'wondrous', trinket: 'gear' };
const CONSUMABLE_TYPE_GROUP = { potion: 'potion', scroll: 'scroll', ammo: 'ammunition', food: 'food' };
const LOOT_TYPE_GROUP = { treasure: 'treasure', gear: 'gear' };
const ARMOR_SLOTS = ['light', 'medium', 'heavy', 'shield'];

/**
 * Classifica um item custom a partir do snapshot Foundry.
 * @param {{fType?: string, typeValue?: string}} custom
 */
export function customTypeInfo(custom) {
  const fType = custom?.fType;
  const tv = custom?.typeValue ?? '';
  let group = 'other';
  if (fType === 'weapon') group = 'weapon';
  else if (fType === 'tool') group = tv === 'music' ? 'instrument' : 'tool';
  else if (fType === 'equipment') group = ARMOR_SLOTS.includes(tv) ? 'armor' : (EQUIP_TYPE_GROUP[tv] ?? 'gear');
  else if (fType === 'consumable') group = CONSUMABLE_TYPE_GROUP[tv] ?? 'other';
  else if (fType === 'loot') group = LOOT_TYPE_GROUP[tv] ?? 'gear';
  return {
    group,
    groupLabel: GROUPS[group]?.label ?? 'Other',
    kind: group === 'weapon' ? (tv.endsWith('R') ? 'ranged' : 'melee') : null,
    category: group === 'weapon' && tv.startsWith('martial') ? 'martial' : group === 'weapon' ? 'simple' : null,
    armorSlot: group === 'armor' ? tv : null,
  };
}

/**
 * Um item por nome e fonte (base, catálogo, variantes geradas).
 * @param {object} db
 * @param {string} itemId
 * @param {string} source
 * @returns {object|null}
 */
export function resolveItemObj(db, itemId, source) {
  const bases = latestOnly(db?.['items-base']?.baseitem ?? []);
  const items = latestOnly(db?.items?.item ?? []);
  const base = bases.find((i) => i.name === itemId && i.source === source);
  if (base) return base;
  const exact = items.find((i) => i.name === itemId && i.source === source);
  if (exact) return exact;
  const n = String(itemId ?? '').trim().toLowerCase();
  const ci = (list, name = n) => list.find((i) => i.source === source && String(i.name).toLowerCase() === name);
  const alt = () => {
    for (const name of alternateNames(n)) {
      const hit = ci(bases, name) ?? ci(items, name);
      if (hit) return hit;
    }
    return null;
  };
  return ci(bases) ?? ci(items) ?? resolveVariantObj(db, itemId, source) ?? alt();
}

/**
 * O inventário resolvido, com peso total e atunados.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {{entries: object[], totalWeight: number, attunedCount: number}}
 */
export function deriveInventory(character, db) {
  const entries = [];
  let attunedCount = 0;
  for (const entry of character?.inventory ?? []) {
    const raw = resolveItemObj(db, entry.itemId, entry.source);
    const custom = !raw ? (entry.custom ?? null) : null;
    const info = raw ? itemTypeInfo(raw) : custom ? customTypeInfo(custom) : itemTypeInfo(null);
    const attune = raw
      ? attunementInfo(raw)
      : { required: custom?.attunement === 'required', prereqText: null };
    const qty = entry.quantity ?? 1;
    const unitWeight = raw?.weight ?? custom?.weight ?? 0;
    const lineWeight = unitWeight * qty;
    if (entry.attuned) attunedCount += 1;
    const rarity = raw
      ? (raw.rarity && raw.rarity !== 'none' ? raw.rarity : null)
      : (custom ? (RARITY_WORD[custom.rarity] ?? null) : null);
    const name = raw?.name ?? entry.itemId;
    entries.push({
      ...entry,
      raw,
      isCustom: !!custom,
      rarity,
      ...info,
      ...attune,
      equipped: !!entry.equipped && !entry.container,
      unitWeight,
      lineWeight,
      isContainer: isContainerName(name, custom),
      containerProps: containerProps(name),
    });
  }

  const { counts } = weightContext(entries, (e) => e.raw?.name ?? e.itemId);
  let totalWeight = 0;
  for (const e of entries) {
    e.weightCounts = counts(e);
    if (e.weightCounts) totalWeight += e.lineWeight;
  }
  for (const e of entries) {
    if (!e.isContainer) continue;
    e.contentsWeight = entries
      .filter((c) => c.container === e.uid)
      .reduce((sum, c) => sum + c.lineWeight, 0);
  }
  return { entries, totalWeight, attunedCount };
}

/** A capacidade de carga: Força x 15 lb. */
export function carryingCapacity(strScore) {
  return (strScore ?? 10) * 15;
}
