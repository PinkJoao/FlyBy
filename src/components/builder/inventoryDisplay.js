// =============================================================================
// inventoryDisplay - como uma entrada de inventário é APRESENTADA
// =============================================================================
// Extraído da InventoryTab quando o painel de contêiner passou a precisar das
// mesmas linhas (nome, meta "Martial Weapon • Heavy", badge de raridade,
// thumbnail). Uma fonte só para os dois, para uma linha dentro de uma mochila
// nunca divergir da mesma linha solta no inventário.
// -----------------------------------------------------------------------------

import itemEntity from '../../selector/entities/item';
import { imgUrl } from '../common/media';

/** Ordem de raridade (da mais alta para a mais baixa) - ordenação e ranking. */
export const RARITY_ORDER = ['artifact', 'legendary', 'very rare', 'rare', 'uncommon', 'common', 'none'];

/** Cores da escala de raridade (convenção D&D: verde/azul/roxo/laranja/dourado). */
export const RARITY_COLOR = {
  uncommon: '#3fa14b',
  rare: '#4a90d9',
  'very rare': '#a45ee5',
  legendary: '#e08a2e',
  artifact: '#c9a227',
};

/** Ícone (emoji) por grupo - usado nas sub-abas e como fallback do thumbnail. */
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

/** Rótulos das propriedades de arma do 5e.tools (`property: ["H", "2H|XPHB"…]`). */
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

/** Partes da linha de tipo: "Martial Weapon • Heavy • Two-Handed",
 * "Light Armor", "Wondrous Item"… */
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
  // Sem objeto do 5etools E sem snapshot custom (entrada legada): sem meta.
  if (!entry.raw && !entry.isCustom) return [];
  // groupLabel é plural (nome da aba) - singulariza pro rótulo do item.
  const label = entry.groupLabel?.replace(/ Items$/, ' Item').replace(/([a-rt-z])s$/, '$1');
  return label ? [label] : [];
}

/** URL do thumbnail (arte do fluff do 5e.tools), ou null → glyph do grupo. */
export function thumbOf(entry, db) {
  // Imagem custom do usuário (data-URL ou URL) tem prioridade - vale até p/
  // itens não-resolvidos (sem arte do 5etools).
  if (entry.customImg) return entry.customImg;
  if (!entry.raw) return null;
  const fluff = itemEntity.fluff(entry.raw, db);
  return imgUrl(fluff?.images?.[0]?.href);
}
