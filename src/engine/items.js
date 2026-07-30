// =============================================================================
// items - resolução e agrupamento de itens do 5e.tools (inventário, Fase B1)
// =============================================================================
// Puro: sem rede/DOM. `character.inventory[]` só guarda a DECISÃO (itemId +
// fonte + quantidade + estado); a mecânica (peso, tipo, raridade…) é resolvida
// ao vivo contra o `db`, no mesmo espírito de `resolveRaceObj`/`findFeat` - o
// item não é duplicado na ficha, só referenciado.
// -----------------------------------------------------------------------------

import { latestOnly } from '../selector/reprints';
import { resolveVariantObj } from './magicVariants';
import { isContainerName, containerProps, weightContext } from './containers';

/** Código de tipo (5etools `type`, ex: "M|XPHB") → { grupo, rótulo }. Cobre
 * todos os tipos de item do 5e.tools (armas, armaduras, ferramentas,
 * instrumentos, munição, tesouro…). Itens "wondrous" não têm `type` - usam a
 * flag booleana `wondrous`. */
const GROUPS = {
  weapon: { label: 'Weapons', codes: ['M', 'R'] },
  armor: { label: 'Armor', codes: ['LA', 'MA', 'HA', 'S'] },
  spellcastingFocus: { label: 'Spellcasting Focus', codes: ['SCF'] },
  tool: { label: 'Tools', codes: ['AT', 'T', 'GS'] },
  instrument: { label: 'Instruments', codes: ['INS'] },
  ammunition: { label: 'Ammunition', codes: ['A', 'AF'] },
  gear: { label: 'Adventuring Gear', codes: ['G', 'TAH', 'MNT', 'VEH', 'SHP', 'SPC'] },
  food: { label: 'Food & Drink', codes: ['FD'] },
  wondrous: { label: 'Wondrous Items', codes: [] }, // via raw.wondrous
  ring: { label: 'Rings', codes: ['RG'] },
  wand: { label: 'Wands', codes: ['WD'] },
  rod: { label: 'Rods', codes: ['RD'] },
  potion: { label: 'Potions', codes: ['P'] },
  scroll: { label: 'Scrolls', codes: ['SC'] },
  treasure: { label: 'Treasure', codes: ['$', '$A', '$C', '$G', 'TB', 'TG'] },
  other: { label: 'Other', codes: ['OTH', 'EXP', 'GV'] },
};

// Mapa reverso: código de tipo → chave de grupo (montado uma vez).
const CODE_TO_GROUP = {};
for (const [key, { codes }] of Object.entries(GROUPS)) {
  for (const code of codes) CODE_TO_GROUP[code] = key;
}

const ARMOR_SLOT_BY_CODE = { LA: 'light', MA: 'medium', HA: 'heavy', S: 'shield' };

/** Código de tipo cru do item (sem o sufixo `|FONTE`), ou `'WONDROUS'` p/ itens
 * sem `type` mas com a flag `wondrous`. */
function baseTypeCode(raw) {
  if (!raw) return null;
  if (raw.type) return String(raw.type).split('|')[0];
  if (raw.wondrous) return 'WONDROUS';
  return null;
}

/**
 * Classifica um item resolvido do 5e.tools em grupo (p/ as sub-abas do
 * inventário) + sub-tipo (arma: corpo-a-corpo/à distância, simples/marcial;
 * armadura: leve/média/pesada/escudo).
 * @param {object|null} raw  objeto cru do item (items-base/items)
 * @returns {{group:string, groupLabel:string, kind:string|null, category:string|null, armorSlot:string|null}}
 */
export function itemTypeInfo(raw) {
  const code = baseTypeCode(raw);
  const group = code === 'WONDROUS' ? 'wondrous' : (CODE_TO_GROUP[code] ?? 'other');
  return {
    group,
    groupLabel: GROUPS[group]?.label ?? 'Other',
    // Arma: melee (M) vs ranged (R); categoria simples/marcial vem do próprio campo.
    kind: group === 'weapon' ? (code === 'R' ? 'ranged' : 'melee') : null,
    category: group === 'weapon' ? (raw?.weaponCategory ?? null) : null,
    armorSlot: group === 'armor' ? (ARMOR_SLOT_BY_CODE[code] ?? null) : null,
  };
}

/** Todos os grupos conhecidos, na ordem de exibição preferida (armas/armadura
 * primeiro, tesouro/outro por último). */
export const GROUP_ORDER = [
  'weapon', 'armor', 'spellcastingFocus', 'ammunition', 'tool', 'instrument',
  'gear', 'food', 'wondrous', 'ring', 'wand', 'rod', 'potion', 'scroll', 'treasure', 'other',
];

/** Requer atunement? `reqAttune` é `true` (sem pré-requisito de prosa) ou uma
 * string ("by a Spellcaster", etc - pré-requisito não verificável automaticamente). */
export function attunementInfo(raw) {
  const req = raw?.reqAttune;
  if (!req) return { required: false, prereqText: null };
  return { required: true, prereqText: typeof req === 'string' ? req : null };
}

/** Código de raridade do Foundry (`veryRare`) → palavra do 5etools (`very rare`),
 * p/ um item CUSTOM entrar na mesma escala de cor/ordenação dos catalogados. */
const RARITY_WORD = {
  common: 'common', uncommon: 'uncommon', rare: 'rare',
  veryRare: 'very rare', legendary: 'legendary', artifact: 'artifact',
};

/** Chave de grupo → o(s) par(es) tipo-Foundry que a produzem, p/ reclassificar um
 * item CUSTOM (sem entrada no catálogo) a partir do snapshot do Item do Foundry. */
const EQUIP_TYPE_GROUP = { ring: 'ring', wand: 'wand', rod: 'rod', wondrous: 'wondrous', trinket: 'gear' };
const CONSUMABLE_TYPE_GROUP = { potion: 'potion', scroll: 'scroll', ammo: 'ammunition', food: 'food' };
const LOOT_TYPE_GROUP = { treasure: 'treasure', gear: 'gear' };
const ARMOR_SLOTS = ['light', 'medium', 'heavy', 'shield'];

/**
 * Classifica um item CUSTOM (importado, sem correspondência no compêndio) em
 * grupo/sub-tipo a partir do seu snapshot Foundry (`fType` + `typeValue`) - o
 * inverso do mapa `GROUP_FOUNDRY` do export. Mesma forma de retorno que
 * `itemTypeInfo`, p/ a UI tratar custom e catalogado igual.
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
 * Resolve um item do compêndio por nome+fonte - primeiro nos itens BASE
 * (armas/armaduras/ferramentas mundanas), depois no catálogo geral (itens
 * mágicos + equipamento genérico/comida), por fim nas variantes específicas
 * GERADAS ("+1 Longsword" - ver engine/magicVariants.js). `latestOnly` esconde
 * reprints.
 * @param {object} db
 * @param {string} itemId  nome do item (ex: "Longsword")
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
  // Nome com CAIXA diferente: um ator de fora escreve o item como quiser (a
  // ficha premade da Quillathe traz "Sprig of mistletoe"), e sem esta rede o
  // item não resolve e perde peso, preço, descrição e tipo de uma vez (TC-0066).
  // Só depois do casamento exato, então o caminho normal não muda.
  const n = String(itemId ?? '').trim().toLowerCase();
  const ci = (list) => list.find((i) => i.source === source && String(i.name).toLowerCase() === n);
  return ci(bases) ?? ci(items) ?? resolveVariantObj(db, itemId, source);
}

/**
 * Resolve o inventário inteiro do personagem contra o compêndio: cada entrada
 * ganha o objeto cru + classificação + peso total, e agrega peso/attunements.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {{entries: object[], totalWeight: number, attunedCount: number}}
 */
export function deriveInventory(character, db) {
  const entries = [];
  let attunedCount = 0;
  for (const entry of character?.inventory ?? []) {
    const raw = resolveItemObj(db, entry.itemId, entry.source);
    // Item não-catalogado (componente de magia, homebrew, scroll nomeado): usa o
    // snapshot Foundry guardado no import p/ derivar peso/tipo/raridade/atunement.
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
      // GUARDADO não está EM USO: um item dentro da mochila não conta para CA
      // nem aparece equipado na ficha. A regra vive aqui, e não só na UI, para
      // valer também para um ator importado que já viesse assim - o campo CRU
      // fica intacto (o export re-emite o que veio).
      equipped: !!entry.equipped && !entry.container,
      unitWeight,
      lineWeight,
      // Contêiner: o que é um sai do SRD (engine/containers), não de curadoria.
      isContainer: isContainerName(name, custom),
      containerProps: containerProps(name),
    });
  }

  // Peso carregado: o conteúdo de um contêiner WEIGHTLESS não conta (RAW). A
  // conta é feita depois de montar todas as entradas porque ela depende da cadeia
  // de pais, que só existe com a lista inteira em mãos.
  const { counts } = weightContext(entries, (e) => e.raw?.name ?? e.itemId);
  let totalWeight = 0;
  for (const e of entries) {
    e.weightCounts = counts(e);
    if (e.weightCounts) totalWeight += e.lineWeight;
  }
  // Peso do conteúdo de cada contêiner (só p/ exibir na tela dele - a barra de
  // carga já usa o `totalWeight` acima).
  for (const e of entries) {
    if (!e.isContainer) continue;
    e.contentsWeight = entries
      .filter((c) => c.container === e.uid)
      .reduce((sum, c) => sum + c.lineWeight, 0);
  }
  return { entries, totalWeight, attunedCount };
}

/** Capacidade de carga padrão (regra núcleo 2024, não a variante em 3 níveis
 * do Foundry): Força × 15 lb. */
export function carryingCapacity(strScore) {
  return (strScore ?? 10) * 15;
}
