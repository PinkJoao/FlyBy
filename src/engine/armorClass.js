// =============================================================================
// armorClass: a Classe de Armadura e os bônus planos de itens
// =============================================================================
// O QUE FAZ
//   Recebe o personagem, o inventário JÁ RESOLVIDO (deriveInventory) e os
//   modificadores; devolve a CA total com um breakdown legível, e os bônus planos
//   (CA, saves) que itens mágicos ATIVOS concedem pelos campos estruturados do
//   5etools (`ac`, `bonusAc`, `bonusSavingThrow`).
//
//   "Ativo" é em uso: atunado quando o item exige, senão equipado. Um Ring of
//   Protection só dá +1 atunado; uma armadura +1 só conta vestida.
//
// FUNÇÕES
//   parseBonus(s): "+1", "-1" ou 1 vira número.
//   flatBonusAc(raw): o bônus plano de CA de um item, ou 0 quando é condicional.
//   itemActive(e): o item está em uso?
//   unarmoredFormulas(character): as Defesas sem Armadura ativas.
//   deriveArmorClass(character, inventory, mods, naturalArmor): a CA e o
//     breakdown.
//   deriveSaveBonusFromItems(inventory): o bônus plano a todos os saves.
//
// DECISÕES E ARMADILHAS
//   - UNARMORED_DEFENSE (DDL-0045) é o registro curado das fórmulas de classe e
//     subclasse, cada uma 10 + soma de mods, valendo SÓ sem armadura de corpo, com
//     `minLevel` quando a feature chega depois. `allowsShield` espelha o RAW: o
//     Monge perde a fórmula com escudo; Bárbaro e Draconic Resilience não. A
//     Draconic é a XPHB (10 + Dex + Cha, nível 3); a PHB 2014 (13 + Dex) está fora
//     do latestOnly.
//   - Só uma fórmula de CA vale por vez (RAW): todos os candidatos de BASE
//     concorrem (10 + Dex, cada Defesa sem Armadura, a CA sem armadura da espécie,
//     a armadura vestida) e vence o MAIOR. Com escudo, os que o proíbem saem ANTES
//     do máximo, então somar o escudo por cima é sempre RAW. A base 10 + Dex aceita
//     escudo, então a lista nunca fica vazia.
//   - CA fixa da espécie (Tortle 17) concorre mesmo com armadura vestida. O bônus
//     plano da espécie (Warforged +1) vale por cima de qualquer base. O `bonusAc` da
//     ARMADURA e do ESCUDO soma ao `ac` deles: o 5etools guarda no `ac` o da base
//     (medido: 156 de 156 armaduras mágicas, T1 da T3, DDL-0185), e o +1 Chain Mail
//     dava CA 16 em vez de 17 na ficha, no jogo e no PDF; o acessório soma à parte.
//   - CONDITIONAL_BONUS_AC: o 5etools marca `bonusAc` em itens cujo bônus a PRÓPRIA
//     prosa condiciona (o +5 do Quarterstaff of the Acrobat é uma reação contra um
//     ataque; o Arrow-Catching Shield só contra ataques à distância; o Pariah's
//     Shield conta aliados). Somado sempre, o Perrin L17 chegava ao Foundry com CA
//     26 e não 21 (T3, medido; varredura dos 84 itens com `bonusAc` do items.json). Vale para a
//     ficha do app e para o export (foundryItems).
//   - O teto de Destreza por armadura: leve cheio, média +2, pesada 0.
// -----------------------------------------------------------------------------

// ATENÇÃO: só com a PROVA na prosa do próprio item (o bônus vale numa reação, contra um tipo de ataque, por aliado).
const CONDITIONAL_BONUS_AC = new Set([
  'quarterstaff of the acrobat|xdmg',
  'arrow-catching shield|dmg',
  'arrow-catching shield|xdmg',
  "pariah's shield|ggr",
]);

/** O bônus PLANO de CA de um item (`bonusAc`), ou 0 quando a prosa o condiciona. */
export function flatBonusAc(raw) {
  if (!raw?.bonusAc) return 0;
  if (CONDITIONAL_BONUS_AC.has(`${String(raw.name ?? '').toLowerCase()}|${String(raw.source ?? '').toLowerCase()}`)) return 0;
  return parseBonus(raw.bonusAc);
}

/** "+1", "-1" ou 1 vira número (0 se vazio ou ilegível). */
function parseBonus(s) {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  const n = parseInt(String(s).replace(/[^0-9-]/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** O item está em uso: atunado se exige, senão equipado. */
function itemActive(e) {
  if (e.attuned) return true;
  if (e.required) return false;
  return !!e.equipped;
}

const DEX_CAP = { light: Infinity, medium: 2, heavy: 0 };

const UNARMORED_DEFENSE = [
  { classId: 'barbarian', abilities: ['dex', 'con'], allowsShield: true, label: 'Unarmored Defense' },
  { classId: 'monk', abilities: ['dex', 'wis'], allowsShield: false, label: 'Unarmored Defense' },
  { classId: 'sorcerer', subclassId: 'Draconic', minLevel: 3, abilities: ['dex', 'cha'], allowsShield: true, label: 'Draconic Resilience' },
];

/** As fórmulas de Defesa sem Armadura ativas (classe, subclasse e nível). */
function unarmoredFormulas(character) {
  const classes = character?.classes ?? [];
  return UNARMORED_DEFENSE.filter((f) =>
    classes.some(
      (c) =>
        c.classId === f.classId &&
        (f.subclassId == null || c.subclassId === f.subclassId) &&
        (c.level ?? 0) >= (f.minLevel ?? 1),
    ),
  );
}

/**
 * A Classe de Armadura e o breakdown dela.
 * @param {import('../schema/character').Character} character
 * @param {object[]} inventory
 * @param {Record<string, number>} mods
 * @param {import('./naturalArmor').NaturalArmor|null} [naturalArmor]
 * @returns {{total:number, breakdown:{label:string,value:number,note?:string}[], hasArmor:boolean, hasShield:boolean}}
 */
export function deriveArmorClass(character, inventory = [], mods = {}, naturalArmor = null) {
  const dex = mods.dex ?? 0;

  const armor = inventory.find(
    (e) => e.group === 'armor' && e.armorSlot !== 'shield' && e.equipped && e.raw?.ac != null,
  );
  const shield = inventory.find((e) => e.group === 'armor' && e.armorSlot === 'shield' && e.equipped);

  const candidates = [];

  if (armor) {
    const cap = DEX_CAP[armor.armorSlot] ?? Infinity;
    const dexPart = Math.min(dex, cap);
    const armorAc = armor.raw.ac + flatBonusAc(armor.raw);
    candidates.push({
      total: armorAc + dexPart,
      allowsShield: true,
      parts: [
        { label: armor.raw.name, value: armorAc, note: 'armor' },
        ...(dexPart !== 0 ? [{ label: 'Dex modifier', value: dexPart, note: 'dex' }] : []),
      ],
    });
  } else {
    candidates.push({ total: 10 + dex, allowsShield: true, parts: [{ label: 'Unarmored', value: 10 + dex, note: 'base' }] });
    for (const f of unarmoredFormulas(character)) {
      const total = 10 + f.abilities.reduce((s, a) => s + (mods[a] ?? 0), 0);
      candidates.push({ total, allowsShield: f.allowsShield, parts: [{ label: f.label, value: total, note: 'base' }] });
    }
    if (naturalArmor?.type === 'unarmored') {
      const mod = mods[naturalArmor.ability] ?? 0;
      candidates.push({ total: naturalArmor.base + mod, allowsShield: true, parts: [{ label: naturalArmor.label, value: naturalArmor.base + mod, note: 'natural' }] });
    }
  }

  if (naturalArmor?.type === 'flat') {
    candidates.push({ total: naturalArmor.ac, allowsShield: true, parts: [{ label: naturalArmor.label, value: naturalArmor.ac, note: 'natural' }] });
  }

  const pool = shield ? candidates.filter((c) => c.allowsShield) : candidates;
  const best = pool.reduce((a, b) => (b.total > a.total ? b : a));
  let total = best.total;
  const breakdown = [...best.parts];

  if (shield) {
    const shieldAc = (shield.raw?.ac ?? 2) + flatBonusAc(shield.raw);
    total += shieldAc;
    breakdown.push({ label: shield.raw?.name ?? 'Shield', value: shieldAc, note: 'shield' });
  }

  for (const e of inventory) {
    if (e === armor || e === shield) continue;
    if (!flatBonusAc(e.raw) || !itemActive(e)) continue;
    const b = flatBonusAc(e.raw);
    if (b) {
      total += b;
      breakdown.push({ label: e.raw.name, value: b, note: 'item' });
    }
  }

  if (naturalArmor?.type === 'bonus' && naturalArmor.bonus) {
    total += naturalArmor.bonus;
    breakdown.push({ label: naturalArmor.label, value: naturalArmor.bonus, note: 'natural' });
  }

  return { total, breakdown, hasArmor: !!armor, hasShield: !!shield };
}

/**
 * O bônus plano a todos os saves, dos itens ativos.
 * @param {object[]} inventory
 * @returns {{bonus:number, sources:{name:string,value:number}[]}}
 */
export function deriveSaveBonusFromItems(inventory = []) {
  let bonus = 0;
  const sources = [];
  for (const e of inventory) {
    if (!e.raw?.bonusSavingThrow || !itemActive(e)) continue;
    const b = parseBonus(e.raw.bonusSavingThrow);
    if (b) {
      bonus += b;
      sources.push({ name: e.raw.name, value: b });
    }
  }
  return { bonus, sources };
}
