// =============================================================================
// Entity config: Item (para a loja de equipamento - Fase B1, estágio 3)
// =============================================================================
// Catálogo COMPLETO: itens base (armas/armaduras/ferramentas mundanas) + o
// catálogo geral (itens mágicos + engenho/comida genéricos). Reaproveita a
// classificação de engine/items.js (mesma usada pelo InventoryTab) para o
// filtro de Tipo, e reprints são escondidos via latestOnly (mesmo padrão de
// weapon.js).
// -----------------------------------------------------------------------------

import { latestOnly } from '../reprints';
import { itemTypeInfo, attunementInfo } from '../../engine/items';
import { itemValue, isValueDerived } from '../../engine/magicItemPrice';
import { specificVariants } from '../../engine/magicVariants';

const RARITY_OPTIONS = ['None', 'Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];

/** Cores da escala de raridade (mesma convenção da aba de Inventário). */
const RARITY_COLOR = {
  uncommon: '#3fa14b',
  rare: '#4a90d9',
  'very rare': '#a45ee5',
  legendary: '#e08a2e',
  artifact: '#c9a227',
};

/** Só os tiers reais recebem badge - exclui "none"/"unknown"/"varies" (ruído). */
const RARITY_TIERS = new Set(['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact']);

/** Códigos de tipo de dano do 5etools (armas usam S/P/B; mágicos podem variar). */
const DAMAGE_TYPES = {
  A: 'Acid', B: 'Bludgeoning', C: 'Cold', F: 'Fire', O: 'Force', L: 'Lightning',
  N: 'Necrotic', P: 'Piercing', I: 'Poison', Y: 'Psychic', R: 'Radiant', S: 'Slashing', T: 'Thunder',
};

/** Nome legível das propriedades de arma (fallback quando não resolvido do db).
 * Também alimenta o filtro "Weapon Property" (precompute não recebe db). */
const PROPERTY_NAMES = {
  A: 'Ammunition', AF: 'Ammunition', BF: 'Burst Fire', F: 'Finesse', H: 'Heavy',
  L: 'Light', LD: 'Loading', R: 'Reach', RLD: 'Reload', S: 'Special', T: 'Thrown',
  V: 'Versatile', '2H': 'Two-Handed', Vst: 'Vestige of Divergence',
};

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Tira o sufixo de fonte de um uid do 5etools ("V|XPHB" → "V"). */
function stripSrc(s) {
  return typeof s === 'string' ? s.split('|')[0] : s?.uid?.split('|')[0] ?? s;
}

function rarityLabel(raw) {
  return cap(raw?.rarity ?? 'none');
}

/** Definição de uma propriedade de arma no db (`items-base.itemProperty`). */
function findProperty(db, code) {
  const abbr = stripSrc(code);
  return (db?.['items-base']?.itemProperty ?? []).find((p) => p.abbreviation === abbr) ?? null;
}

/** Definição de uma mastery no db (`items-base.itemMastery`). */
function findMastery(db, code) {
  const name = stripSrc(code);
  return (db?.['items-base']?.itemMastery ?? []).find((m) => m.name === name) ?? null;
}

/** Nome legível de uma propriedade (do db, senão do fallback). */
function propertyName(db, code) {
  const def = findProperty(db, code);
  return def?.entries?.[0]?.name ?? PROPERTY_NAMES[stripSrc(code)] ?? stripSrc(code);
}

/** Dano da arma: "1d8 Slashing (1d10 two-handed)". */
function weaponDamage(raw) {
  if (!raw?.dmg1) return null;
  const type = DAMAGE_TYPES[raw.dmgType] ?? '';
  let out = `${raw.dmg1}${type ? ` ${type}` : ''}`;
  if (raw.dmg2) out += ` (${raw.dmg2} two-handed)`;
  return out;
}

/** Formata um valor em cobre no MAIOR denominador sensato (gp/sp/cp). */
function formatCopper(v) {
  if (v >= 100) return `${(v / 100).toLocaleString()}gp`;
  if (v >= 10) return `${v / 10}sp`;
  return `${v}cp`;
}

/** Preço formatado. Usa o preço listado ou, na falta, o DERIVADO de item mágico
 * (crafting + hireling + item base) - prefixado com "~" por ser estimativa. */
export function formatPrice(raw, db) {
  const v = itemValue(raw, db);
  if (v == null) return null;
  return (isValueDerived(raw) ? '~' : '') + formatCopper(v);
}

function weightText(raw) {
  return raw?.weight ? `${raw.weight} lb` : null;
}

/** Rótulo de tipo em texto simples (mesmo estilo da aba de Inventário):
 * arma → "Martial Weapon", armadura → "Light Armor"/"Shield", senão o grupo
 * singularizado ("Potions" → "Potion"). */
function typeLabel(raw) {
  const info = itemTypeInfo(raw);
  if (info.group === 'weapon') return `${cap(info.category ?? '')} Weapon`.trim();
  if (info.group === 'armor') return info.armorSlot === 'shield' ? 'Shield' : `${cap(info.armorSlot ?? '')} Armor`.trim();
  return info.groupLabel?.replace(/ Items$/, ' Item').replace(/([a-rt-z])s$/, '$1') ?? info.groupLabel;
}

const itemEntity = {
  type: 'item',
  title: 'Item',

  // `!i.age` esconde itens de outras eras (modern/futuristic/renaissance -
  // armas de fogo/sci-fi de outros ambientes), mesmo filtro que weapon.js já
  // usa pro Weapon Mastery - a loja padrão é só o equipamento de fantasia.
  // As variantes específicas GERADAS ("+1 Longsword", "Shield of Warning"…)
  // entram junto do catálogo real (engine/magicVariants.js).
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
        // Recortes de arma (vazios p/ não-armas): categoria, corpo-a-corpo/à
        // distância, propriedades (Heavy, Light, Firearm…) e mastery (Vex…).
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

    // Cabeçalho de tipo detalhado para armas/armaduras.
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

  // Corpo do detalhe: descrição própria do item + descrições resolvidas das
  // propriedades de arma e das masteries (prosa vinda do 5etools no db).
  entries: (r, db) => {
    const out = [...(r.entries ?? [])];
    for (const code of r.property ?? []) {
      const def = findProperty(db, code);
      const block = def?.entries?.[0];
      if (block) out.push(block); // { type:'entries', name:'Versatile', entries:[…] }
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
    // Tipo em TEXTO SIMPLES (como a aba de Inventário) + preço; sem peso, sem
    // source (importam pouco e roubam espaço vertical). Raridade vira um badge
    // pequeno e COLORIDO pela raridade (não mais uma tag de tipo).
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
