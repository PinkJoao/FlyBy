// =============================================================================
// startingEquipment - o pacote de equipamento inicial da classe (PURO)
// =============================================================================
// A classe 2024 oferece opções A/B/C de equipamento inicial em
// `startingEquipment.defaultData[0]` (`{ A:[...], B:[...], C:[...] }`). Cada
// entrada é `{item:"nome|fonte", quantity?}`, `{value:<cobre>}` (ouro) ou
// `{special:"..."}`. A última opção costuma ser só ouro (ex.: Fighter C = 155 GP).
//
// Este módulo transforma isso em opções legíveis e, escolhida uma, no inventário
// + carteira resultantes. Continua sendo DECISÃO do jogador (o passo do wizard):
// aqui só a aritmética/parse, sem rede/DOM. A carteira final = ouro do background
// (50 GP) + o ouro da opção - pois é equipamento OU ouro.
// -----------------------------------------------------------------------------

import { latestOnly } from '../selector/reprints';
import { createInventoryItem } from '../schema/character';
import { BACKGROUND_STARTING_GOLD } from './startingGold';
import { resolveItemObj, itemTypeInfo } from './items';

/** Title-case simples p/ o fallback quando o item não resolve no compêndio. */
function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Resolve "chain mail|xphb" → { name, source } canônicos (case-insensitive). */
function resolveRef(db, ref) {
  const [rawName = '', rawSource = ''] = String(ref).split('|');
  const name = rawName.trim();
  const source = rawSource.trim();
  const lists = [db?.['items-base']?.baseitem ?? [], db?.items?.item ?? []];
  for (const list of lists) {
    const hit = latestOnly(list).find(
      (i) => i.name?.toLowerCase() === name.toLowerCase() && (!source || i.source?.toLowerCase() === source.toLowerCase()),
    );
    if (hit) return { name: hit.name, source: hit.source };
  }
  // Não resolveu: usa o nome título-cased e a fonte em maiúsculas (item "solto").
  return { name: titleCase(name), source: source.toUpperCase() };
}

/** Decompõe cobre em { gp, sp, cp } (5e: 1 gp = 10 sp = 100 cp). */
function coinsFromCopper(cp) {
  const gp = Math.floor(cp / 100);
  const rem = cp % 100;
  return { gp, sp: Math.floor(rem / 10), cp: rem % 10 };
}

/** Código de tipo cru ("INS", "M", "SCF"…) de um item resolvido. */
const typeCode = (raw) => String(raw?.type ?? '').split('|')[0];

// Entradas `{equipmentType: "..."}` do kit: um item A ESCOLHER de uma categoria
// (Bard XPHB: "Musical Instrument of your choice" - TC-0024; antes a entrada era
// descartada e o instrumento sumia do kit). Só instrumentMusical é alcançável
// hoje (kits correntes); os demais tipos cobrem os kits legacy/futuros.
const KIT_EQUIPMENT_TYPES = {
  instrumentMusical: { label: 'Musical Instrument', match: (raw) => typeCode(raw) === 'INS' },
  weaponSimple: { label: 'Simple weapon', match: (raw) => raw?.weaponCategory === 'simple' },
  weaponSimpleMelee: {
    label: 'Simple melee weapon',
    match: (raw) => raw?.weaponCategory === 'simple' && typeCode(raw) === 'M',
  },
  weaponMartial: { label: 'Martial weapon', match: (raw) => raw?.weaponCategory === 'martial' },
  weaponMartialMelee: {
    label: 'Martial melee weapon',
    match: (raw) => raw?.weaponCategory === 'martial' && typeCode(raw) === 'M',
  },
  focusSpellcastingArcane: {
    label: 'Arcane focus',
    match: (raw) => typeCode(raw) === 'SCF' && raw?.scfType === 'arcane',
  },
  focusSpellcastingHoly: {
    label: 'Holy symbol',
    match: (raw) => typeCode(raw) === 'SCF' && raw?.scfType === 'holy',
  },
  focusSpellcastingDruidic: {
    label: 'Druidic focus',
    match: (raw) => typeCode(raw) === 'SCF' && raw?.scfType === 'druid',
  },
};

/** Rótulo de exibição de um choose do kit ("Musical Instrument of your choice"). */
export function kitChooseLabel(choose) {
  const base = KIT_EQUIPMENT_TYPES[choose.type]?.label ?? titleCase(choose.type);
  return choose.quantity > 1 ? `${base} of your choice ×${choose.quantity}` : `${base} of your choice`;
}

/** O item cru satisfaz a categoria do choose? (filtro do seletor do kit.) */
export function kitChooseAllows(choose, raw) {
  return KIT_EQUIPMENT_TYPES[choose.type]?.match(raw) ?? true;
}

/** Todos os chooses da opção têm picks completos? picks = meta.startingKitPicks
 * ({ [índice do choose]: ["Nome|Fonte", ...] }). Opção sem chooses → true. */
export function kitChoosesComplete(option, picks) {
  return (option?.chooses ?? []).every((ch, i) => (picks?.[i]?.length ?? 0) >= ch.quantity);
}

/**
 * As opções de equipamento inicial da classe, legíveis.
 * @param {object} db
 * @param {object|null} classObj  objeto cru da classe (5etools)
 * @returns {Array<{ key:string, items:Array<{name,source,quantity}>, valueCp:number, special:string[], chooses:Array<{type,quantity}> }>}
 */
export function parseStartingEquipment(db, classObj) {
  const data = classObj?.startingEquipment?.defaultData?.[0];
  if (!data || typeof data !== 'object') return [];
  return Object.entries(data).map(([key, entries]) => {
    const items = [];
    let valueCp = 0;
    const special = [];
    const chooses = [];
    for (const e of Array.isArray(entries) ? entries : []) {
      if (e?.item) {
        const { name, source } = resolveRef(db, e.item);
        items.push({ name, source, quantity: e.quantity ?? 1 });
      } else if (typeof e?.value === 'number') {
        valueCp += e.value;
      } else if (e?.special) {
        special.push(String(e.special));
      } else if (e?.equipmentType) {
        // Item a escolher de uma categoria (TC-0024) - vira um choose do kit.
        chooses.push({ type: String(e.equipmentType), quantity: e.quantity ?? 1 });
      }
    }
    return { key, items, valueCp, special, chooses };
  });
}

/** Só ouro? (opção sem itens nem specials - ex.: Fighter C = 155 GP). */
export function isGoldOnlyOption(option) {
  return option.items.length === 0 && option.special.length === 0 && (option.chooses?.length ?? 0) === 0 && option.valueCp > 0;
}

/** Ouro da opção em GP (para exibição). */
export function optionGoldGp(option) {
  return option.valueCp / 100;
}

/** O item deve nascer EQUIPADO no kit guiado? Armadura/escudo e armas sim (a
 * AC e os ataques da ficha leem `equipped` - TC-0015: sem isso o recém-criado
 * sai com AC de desarmado e a Studded Leather na mochila). */
function autoEquips(db, it) {
  const raw = resolveItemObj(db, it.name, it.source);
  if (!raw) return false;
  const { group } = itemTypeInfo(raw);
  return group === 'armor' || group === 'weapon';
}

/** Inventário resultante de escolher uma opção (itens + specials como itens
 * soltos). Com `db`, armadura/escudo/armas do kit já vêm equipados (TC-0015).
 * `picks` = meta.startingKitPicks: os itens escolhidos dos chooses do kit
 * (TC-0024), como "Nome|Fonte" por índice de choose. */
export function startingKitInventory(option, db = null, picks = null) {
  const items = option.items.map((it) => ({
    ...createInventoryItem(it.name, it.source),
    quantity: it.quantity,
    equipped: db ? autoEquips(db, it) : false,
  }));
  for (const [i] of (option.chooses ?? []).entries()) {
    for (const id of picks?.[i] ?? []) {
      const [name = '', source = ''] = String(id).split('|');
      items.push({
        ...createInventoryItem(name, source),
        equipped: db ? autoEquips(db, { name, source }) : false,
      });
    }
  }
  // `special` entra minimamente como um item solto (não resolvido) com o texto.
  for (const sp of option.special) items.push(createInventoryItem(sp, ''));
  return items;
}

/** Carteira resultante: 50 GP do background + o ouro da opção (decomposto). */
export function startingKitCurrency(option) {
  const coins = coinsFromCopper(option.valueCp);
  return { pp: 0, gp: BACKGROUND_STARTING_GOLD + coins.gp, ep: 0, sp: coins.sp, cp: coins.cp };
}
