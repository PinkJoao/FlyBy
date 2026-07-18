// =============================================================================
// armorClass - Classe de Armadura + bônus planos de itens (efeitos básicos)
// =============================================================================
// Puro: recebe o personagem, o inventário JÁ RESOLVIDO (deriveInventory) e os
// modificadores derivados; devolve a CA total com um breakdown legível e os
// bônus planos (CA / saves) que itens mágicos ATIVOS concedem via os campos
// estruturados do 5etools (`ac`, `bonusAc`, `bonusSavingThrow`).
//
// "Ativo" = em uso: atunado (se o item exige atunamento), senão equipado. Assim
// um Ring of Protection só dá +1 quando atunado; uma armadura +1 só conta quando
// vestida. Cobre o básico (armadura + Dex + escudo + Ring/Cloak of Protection +
// Defesa sem Armadura de Barbarian/Monk); efeitos de features entram depois.
// -----------------------------------------------------------------------------

/** "+1" / "-1" / 1 → número (0 se vazio/ilegível). */
function parseBonus(s) {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  const n = parseInt(String(s).replace(/[^0-9-]/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Item passivo em uso: atunado; se exige atunar e não está, não conta; senão equipado. */
function itemActive(e) {
  if (e.attuned) return true;
  if (e.required) return false;
  return !!e.equipped;
}

// Teto do bônus de Destreza por tipo de armadura (leve: cheio; média: +2; pesada: 0).
const DEX_CAP = { light: Infinity, medium: 2, heavy: 0 };

/**
 * Classe de Armadura + breakdown.
 * @param {import('../schema/character').Character} character
 * @param {object[]} inventory  entradas resolvidas (deriveInventory)
 * @param {Record<string, number>} mods  modificadores derivados (str/dex/con/wis…)
 * @param {import('./naturalArmor').NaturalArmor|null} [naturalArmor]  CA de espécie
 *   (Tortle/Autognome/Warforged), resolvida no resolve.js (precisa do db).
 * @returns {{total:number, breakdown:{label:string,value:number,note?:string}[], hasArmor:boolean, hasShield:boolean}}
 */
export function deriveArmorClass(character, inventory = [], mods = {}, naturalArmor = null) {
  const dex = mods.dex ?? 0;
  const con = mods.con ?? 0;
  const wis = mods.wis ?? 0;

  const armor = inventory.find(
    (e) => e.group === 'armor' && e.armorSlot !== 'shield' && e.equipped && e.raw?.ac != null,
  );
  const shield = inventory.find((e) => e.group === 'armor' && e.armorSlot === 'shield' && e.equipped);

  // Candidatos de CA BASE (antes de escudo/itens/bônus). Vale o MAIOR - só uma
  // fórmula de CA se aplica de cada vez (RAW). Cada candidato traz seu breakdown.
  const candidates = [];

  if (armor) {
    const cap = DEX_CAP[armor.armorSlot] ?? Infinity;
    const dexPart = Math.min(dex, cap);
    candidates.push({
      total: armor.raw.ac + dexPart,
      parts: [
        { label: armor.raw.name, value: armor.raw.ac, note: 'armor' },
        ...(dexPart !== 0 ? [{ label: 'Dex modifier', value: dexPart, note: 'dex' }] : []),
      ],
    });
  } else {
    // Sem armadura de corpo: 10 + Dex, + Defesa sem Armadura de Barbarian (+Con) /
    // Monk (+Wis), + a CA sem-armadura da espécie (Autognome 13 + Dex).
    const classIds = new Set((character?.classes ?? []).map((c) => c.classId));
    candidates.push({ total: 10 + dex, parts: [{ label: 'Unarmored', value: 10 + dex, note: 'base' }] });
    if (classIds.has('barbarian')) {
      candidates.push({ total: 10 + dex + con, parts: [{ label: 'Unarmored Defense', value: 10 + dex + con, note: 'base' }] });
    }
    if (classIds.has('monk') && !shield) {
      candidates.push({ total: 10 + dex + wis, parts: [{ label: 'Unarmored Defense', value: 10 + dex + wis, note: 'base' }] });
    }
    if (naturalArmor?.type === 'unarmored') {
      const mod = mods[naturalArmor.ability] ?? 0;
      candidates.push({ total: naturalArmor.base + mod, parts: [{ label: naturalArmor.label, value: naturalArmor.base + mod, note: 'natural' }] });
    }
  }

  // CA fixa da espécie (Tortle 17, Dex não conta): vale mesmo se houver armadura
  // vestida (pega-se a maior - a espécie RAW nem pode vestir armadura de corpo).
  if (naturalArmor?.type === 'flat') {
    candidates.push({ total: naturalArmor.ac, parts: [{ label: naturalArmor.label, value: naturalArmor.ac, note: 'natural' }] });
  }

  const best = candidates.reduce((a, b) => (b.total > a.total ? b : a));
  let total = best.total;
  const breakdown = [...best.parts];

  if (shield) {
    const shieldAc = (shield.raw?.ac ?? 2) + parseBonus(shield.raw?.bonusAc);
    total += shieldAc;
    breakdown.push({ label: shield.raw?.name ?? 'Shield', value: shieldAc, note: 'shield' });
  }

  // Bônus planos de CA de acessórios ativos (Ring/Cloak of Protection…), fora a
  // armadura/escudo (cujo bônus já está no `ac`/`bonusAc` somado acima).
  for (const e of inventory) {
    if (e === armor || e === shield) continue;
    if (!e.raw?.bonusAc || !itemActive(e)) continue;
    const b = parseBonus(e.raw.bonusAc);
    if (b) {
      total += b;
      breakdown.push({ label: e.raw.name, value: b, note: 'item' });
    }
  }

  // Bônus plano de CA da espécie (Warforged Integrated Protection: +1), aplicado
  // por cima de qualquer base - armadura ou não.
  if (naturalArmor?.type === 'bonus' && naturalArmor.bonus) {
    total += naturalArmor.bonus;
    breakdown.push({ label: naturalArmor.label, value: naturalArmor.bonus, note: 'natural' });
  }

  return { total, breakdown, hasArmor: !!armor, hasShield: !!shield };
}

/**
 * Bônus plano a TODOS os saves de itens ATIVOS (Ring/Cloak of Protection…).
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
