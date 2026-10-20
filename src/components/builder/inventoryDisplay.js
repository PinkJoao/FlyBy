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
//     nem snapshot, sem meta).
//   thumbOf(entry, db): a imagem custom, senão a arte do fluff, senão null (glyph).
// -----------------------------------------------------------------------------

import itemEntity from '../../selector/entities/item';
import { imgUrl } from '../common/media';

export const RARITY_ORDER = ['artifact', 'legendary', 'very rare', 'rare', 'uncommon', 'common', 'none'];

export const RARITY_COLOR = {
  uncommon: 'var(--rarity-uncommon)',
  rare: 'var(--rarity-rare)',
  'very rare': 'var(--rarity-very-rare)',
  legendary: 'var(--rarity-legendary)',
  artifact: 'var(--rarity-artifact)',
};

export const GROUP_ICONS = {
  all: '📦',
  weapon: '⚔️',
  armor: '🛡️',
  spellcastingFocus: '🔮',
  ammunition: '🏹',
  tool: '🛠️',
  instrument: '🎵',
  gear: '🎒',
  food: '🍖',
  wondrous: '✨',
  ring: '💍',
  wand: '🪄',
  rod: '🔱',
  potion: '🧪',
  scroll: '📜',
  treasure: '💎',
  other: '❔',
};

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
    return [entry.armorSlot === 'shield' ? 'Shield' : `${cap(entry.armorSlot)} Armor`];
  }
  if (!entry.raw && !entry.isCustom) return [];
  const label = entry.groupLabel?.replace(/ Items$/, ' Item').replace(/([a-rt-z])s$/, '$1');
  return label ? [label] : [];
}

/** A URL do thumbnail, ou null. */
export function thumbOf(entry, db) {
  if (entry.customImg) return entry.customImg;
  if (!entry.raw) return null;
  const fluff = itemEntity.fluff(entry.raw, db);
  return imgUrl(fluff?.images?.[0]?.href);
}
