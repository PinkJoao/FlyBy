// =============================================================================
// startingEquipment: o pacote de equipamento inicial da classe
// =============================================================================
// O QUE FAZ
//   A classe 2024 oferece opções A, B, C em `startingEquipment.defaultData[0]`.
//   Cada entrada é {item:"nome|fonte", quantity?}, {value:<cobre>} (ouro) ou
//   {special:"..."}; a última opção costuma ser só ouro (Fighter C, 155 GP). Este
//   módulo as torna legíveis e, escolhida uma, devolve o inventário e a carteira.
//   É decisão do jogador (o passo do wizard); aqui só a conta.
//
// FUNÇÕES
//   titleCase(s), resolveRef(db, ref): o nome e a fonte canônicos de um item.
//   coinsFromCopper(cp), typeCode(raw): moedas e código de tipo.
//   kitChooseLabel(choose), kitChooseAllows(choose, raw): rótulo e filtro de um
//     item a escolher.
//   kitItemGroup(db, ref): o item group que o uid referencia, ou null.
//   kitChoosesComplete(option, picks): todos os itens a escolher foram escolhidos?
//   parseOptionEntries(db, key, entries): uma opção (A, B...) legível.
//   parseStartingEquipment(db, classObj, background): as opções legíveis; com um
//     background pronto, o kit dele junto (DDL-0328).
//   isGoldOnlyOption(option), optionGoldGp(option): a opção só de ouro.
//   autoEquips(db, it): o item nasce equipado?
//   startingKitInventory(option, db, picks): o inventário da opção.
//   startingKitCurrency(option): o ouro do background (50 GP, ou o da opção A de um
//     pronto) mais o ouro da opção.
//
// DECISÕES E ARMADILHAS
//   - É equipamento OU ouro: a carteira final é o ouro do background (50 GP) mais
//     o da opção.
//   - Background pronto (DDL-0328, resposta B9 do dono): duas escolhas só, não duas etapas.
//     Toda opção de itens da classe leva também os itens e o ouro da opção A do background
//     (`bg: true` nos itens dele, `backgroundCp`); a opção só de ouro fica com os 50 GP (a B).
//     O background escreve o item como texto solto ("lamp|xphb") e as chaves em minúsculas
//     ou maiúsculas; "Artisan's Tools (same as above)" é escolha marcada `sameAsTool`, que
//     o passo preenche com a ferramenta já escolhida.
//   - `{equipmentType}` é um item A ESCOLHER de uma categoria (o instrumento do
//     Bardo, TC-0024); antes era descartado. Uma ref a ITEM GROUP ("druidic
//     focus|xphb") é "um destes", então vira escolha de pool FECHADO; sem isso o
//     kit criava um item "unresolved" (Clérigo, Druida, Paladino; DDL-0041).
//   - Armadura, escudo e armas nascem equipados (TC-0015): sem isso o personagem
//     saía com CA de desarmado e a armadura na mochila.
//   - Ref que não resolve vira item solto com nome em title-case; `special` vira
//     item solto com o texto.
// -----------------------------------------------------------------------------

import { latestOnly } from '../selector/reprints';
import { createInventoryItem } from '../schema/character';
import { BACKGROUND_STARTING_GOLD } from './startingGold';
import { resolveItemObj, itemTypeInfo } from './items';

/** Title-case simples, para item que não resolve. */
function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "chain mail|xphb" vira { name, source } canônicos. */
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
  return { name: titleCase(name), source: source.toUpperCase() };
}

/** Cobre decomposto em { gp, sp, cp }. */
function coinsFromCopper(cp) {
  const gp = Math.floor(cp / 100);
  const rem = cp % 100;
  return { gp, sp: Math.floor(rem / 10), cp: rem % 10 };
}

/** O código de tipo cru de um item resolvido. */
const typeCode = (raw) => String(raw?.type ?? '').split('|')[0];

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

/** O rótulo de um item a escolher do kit. */
export function kitChooseLabel(choose) {
  const base = choose.label ?? KIT_EQUIPMENT_TYPES[choose.type]?.label ?? titleCase(choose.type);
  return choose.quantity > 1 ? `${base} of your choice ×${choose.quantity}` : `${base} of your choice`;
}

/** O item satisfaz a categoria (ou o grupo fechado) do choose? */
export function kitChooseAllows(choose, raw) {
  if (choose.allow) return choose.allow.includes(`${raw?.name ?? ''}|${raw?.source ?? ''}`.toLowerCase());
  return KIT_EQUIPMENT_TYPES[choose.type]?.match(raw) ?? true;
}

/** O item group que o uid do kit referencia, ou null. */
function kitItemGroup(db, ref) {
  const [rawName = '', rawSource = ''] = String(ref).split('|');
  const name = rawName.trim().toLowerCase();
  const source = rawSource.trim().toLowerCase();
  return (
    latestOnly(db?.items?.itemGroup ?? []).find(
      (g) => g.name?.toLowerCase() === name && (!source || g.source?.toLowerCase() === source),
    ) ?? null
  );
}

/** Todos os itens a escolher da opção têm picks? */
export function kitChoosesComplete(option, picks) {
  return (option?.chooses ?? []).every((ch, i) => (picks?.[i]?.length ?? 0) >= ch.quantity);
}

/**
 * As opções de equipamento inicial da classe, legíveis.
 * @param {object} db
 * @param {object|null} classObj
 * @returns {Array<{ key:string, items:Array<{name,source,quantity}>, valueCp:number, special:string[], chooses:Array<{type,quantity}> }>}
 */
/** Uma opção (A, B...) legível. */
function parseOptionEntries(db, key, entries) {
  const items = [];
  let valueCp = 0;
  const special = [];
  const chooses = [];
  for (const raw of Array.isArray(entries) ? entries : []) {
    const e = typeof raw === 'string' ? { item: raw } : raw;
    if (e?.item) {
      const group = kitItemGroup(db, e.item);
      if (group) {
        chooses.push({
          type: 'itemGroup',
          label: group.name,
          allow: (group.items ?? []).map((uid) => {
            const [n = '', s = ''] = String(uid).split('|');
            const r = resolveRef(db, `${n}|${s}`);
            return `${r.name}|${r.source}`.toLowerCase();
          }),
          quantity: e.quantity ?? 1,
        });
      } else {
        const { name, source } = resolveRef(db, e.item);
        items.push({ name, source, quantity: e.quantity ?? 1 });
      }
    } else if (typeof e?.value === 'number') {
      valueCp += e.value;
    } else if (e?.special) {
      special.push(String(e.special));
    } else if (e?.equipmentType) {
      const same = /same as above/i.test(e.displayName ?? '');
      chooses.push({ type: String(e.equipmentType), quantity: e.quantity ?? 1, ...(same ? { sameAsTool: true } : {}) });
    }
  }
  return { key: key.toUpperCase(), items, valueCp, special, chooses };
}

/**
 * As opções de equipamento inicial, com o kit do background pronto junto.
 * @param {object} db
 * @param {object} classObj
 * @param {object} [background]  o background pronto (engine/backgrounds), ou null
 */
export function parseStartingEquipment(db, classObj, background = null) {
  const data = classObj?.startingEquipment?.defaultData?.[0];
  const classOpts = data && typeof data === 'object' ? Object.entries(data).map(([key, entries]) => parseOptionEntries(db, key, entries)) : [];
  const bgData = background?.startingEquipment?.[0];
  if (!bgData || typeof bgData !== 'object') return classOpts;
  const bgOpts = Object.entries(bgData).map(([key, entries]) => parseOptionEntries(db, key, entries));
  const kit = bgOpts.find((o) => !isGoldOnlyOption(o));
  const gold = bgOpts.find((o) => isGoldOnlyOption(o));
  if (!kit) return classOpts;
  const mark = (list) => list.map((x) => ({ ...x, bg: true }));
  const withKit = (o) => ({
    ...o,
    items: [...o.items, ...mark(kit.items)],
    chooses: [...(o.chooses ?? []), ...mark(kit.chooses)],
    special: [...o.special, ...kit.special],
    backgroundCp: kit.valueCp,
    background: background.name,
  });
  if (!classOpts.length) {
    const empty = { key: 'A', items: [], valueCp: 0, special: [], chooses: [] };
    return [withKit(empty), { key: 'B', items: [], valueCp: gold?.valueCp ?? 0, special: [], chooses: [], backgroundCp: 0, background: background.name }];
  }
  return classOpts.map((o) => (isGoldOnlyOption(o) ? { ...o, background: background.name } : withKit(o)));
}

/** A opção é só ouro? */
export function isGoldOnlyOption(option) {
  return option.items.length === 0 && option.special.length === 0 && (option.chooses?.length ?? 0) === 0 && option.valueCp > 0;
}

/** O ouro da opção em GP. */
export function optionGoldGp(option) {
  return option.valueCp / 100;
}

/** O item nasce equipado no kit (armadura, escudo, arma)? */
function autoEquips(db, it) {
  const raw = resolveItemObj(db, it.name, it.source);
  if (!raw) return false;
  const { group } = itemTypeInfo(raw);
  return group === 'armor' || group === 'weapon';
}

/** O inventário resultante de uma opção. */
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
  for (const sp of option.special) items.push(createInventoryItem(sp, ''));
  return items;
}

/** A carteira resultante: 50 GP mais o ouro da opção. */
export function startingKitCurrency(option) {
  const bgCp = option.backgroundCp ?? BACKGROUND_STARTING_GOLD * 100;
  const coins = coinsFromCopper(option.valueCp + bgCp);
  return { pp: 0, gp: coins.gp, ep: 0, sp: coins.sp, cp: coins.cp };
}
