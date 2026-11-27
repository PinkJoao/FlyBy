// =============================================================================
// inventoryDisplay: como uma entrada de inventário é apresentada
// =============================================================================
// O QUE FAZ
//   O nome, a meta ("Martial Weapon • Heavy"), o badge de raridade e o thumbnail
//   de uma entrada, numa fonte só para o inventário e o painel de contêiner (a
//   linha dentro da mochila nunca diverge da solta).
//
// FUNÇÕES
//   cap(s), rarityRank(rarity), nameOf(entry): utilitários.
//   metaParts(entry): as partes da linha de tipo (o grupo singularizado; sem objeto
//     nem snapshot, sem meta); a armadura leva a Força que pede ("Str 15", DDL-0345).
//   thumbOf(entry, db): a imagem custom, senão a arte que o item tem ou herda
//     (itemThumb: a própria, a do modelo, a do base), senão null (o ícone do grupo).
//   GROUP_ICONS: o ícone de cada grupo (ITEM_GROUP_ICONS da entity de item).
// -----------------------------------------------------------------------------

import { ITEM_GROUP_ICONS, itemThumb } from '../../selector/entities/item';

export const RARITY_ORDER = ['artifact', 'legendary', 'very rare', 'rare', 'uncommon', 'common', 'none'];

export const RARITY_COLOR = {
  uncommon: 'var(--rarity-uncommon)',
  rare: 'var(--rarity-rare)',
  'very rare': 'var(--rarity-very-rare)',
  legendary: 'var(--rarity-legendary)',
  artifact: 'var(--rarity-artifact)',
};

export const GROUP_ICONS = ITEM_GROUP_ICONS;

const WEAPON_PROPS = {
  A: 'Ammunition',
  AF: 'Ammunition',
  BF: 'Burst Fire',
  F: 'Finesse',
  H: 'Heavy',
  L: 'Light',
  LD: 'Loading',
  R: 'Reach',
  RLD: 'Reload',
  S: 'Special',
  T: 'Thrown',
  V: 'Versatile',
  '2H': 'Two-Handed',
};

export function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function rarityRank(rarity) {
  const i = RARITY_ORDER.indexOf(rarity ?? 'none');
  return i === -1 ? RARITY_ORDER.length : i;
}

export function nameOf(entry) {
  return entry.customName || entry.raw?.name || entry.itemId;
}

/** As partes da linha de tipo de uma entrada. */
export function metaParts(entry) {
  if (entry.raw && entry.group === 'weapon') {
    const parts = [`${cap(entry.category ?? '')} Weapon`.trim()];
    for (const p of entry.raw.property ?? []) {
      const code = typeof p === 'string' ? p.split('|')[0] : p?.uid?.split('|')[0];
      if (WEAPON_PROPS[code]) parts.push(WEAPON_PROPS[code]);
    }
    return parts;
  }
  if (entry.raw && entry.group === 'armor' && entry.armorSlot) {
    const kind = entry.armorSlot === 'shield' ? 'Shield' : `${cap(entry.armorSlot)} Armor`;
    return entry.raw.strength ? [kind, `Str ${entry.raw.strength}`] : [kind];
  }
  if (!entry.raw && !entry.isCustom) return [];
  const label = entry.groupLabel?.replace(/ Items$/, ' Item').replace(/([a-rt-z])s$/, '$1');
  return label ? [label] : [];
}

/** A URL do thumbnail, ou null. */
export function thumbOf(entry, db) {
  if (entry.customImg) return entry.customImg;
  if (!entry.raw) return null;
  return itemThumb(entry.raw, db)?.src ?? null;
}
