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

// -----------------------------------------------------------------------------
// Fórmulas de CA-base do tipo "Defesa sem Armadura", concedidas por CLASSE ou
// SUBCLASSE. Cada uma vale SÓ sem armadura de corpo e concede `10 + Σ(mods)`.
// `allowsShield` espelha o RAW: o Monk PERDE a fórmula ao empunhar escudo; o
// Barbarian e a Draconic Resilience, não. Elas NÃO se combinam entre si nem com a
// armadura natural de espécie - escolhe-se a MAIOR CA respeitando a regra de cada
// (ver deriveArmorClass). Registro curado e edition-strict pela subclasse quando
// aplicável; `minLevel` gera a fórmula só a partir do nível que a feature concede.
// -----------------------------------------------------------------------------
const UNARMORED_DEFENSE = [
  { classId: 'barbarian', abilities: ['dex', 'con'], allowsShield: true, label: 'Unarmored Defense' },
  { classId: 'monk', abilities: ['dex', 'wis'], allowsShield: false, label: 'Unarmored Defense' },
  // Draconic Sorcery XPHB (Draconic Resilience, nv3): 10 + Dex + Cha, escudo OK.
  // (A versão PHB 2014 era 13 + Dex, fora do escopo latestOnly do app.)
  { classId: 'sorcerer', subclassId: 'Draconic', minLevel: 3, abilities: ['dex', 'cha'], allowsShield: true, label: 'Draconic Resilience' },
];

/** Fórmulas de Defesa sem Armadura ativas (classe/subclasse + nível). */
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

  const armor = inventory.find(
    (e) => e.group === 'armor' && e.armorSlot !== 'shield' && e.equipped && e.raw?.ac != null,
  );
  const shield = inventory.find((e) => e.group === 'armor' && e.armorSlot === 'shield' && e.equipped);

  // Candidatos de CA BASE (antes de escudo/itens/bônus). Vale o MAIOR - só uma
  // fórmula de CA se aplica de cada vez (RAW). Cada candidato traz seu breakdown e
  // um `allowsShield`: com escudo equipado, os candidatos que o proíbem (Monk) são
  // descartados ANTES do max, então somar o escudo por cima do melhor é sempre RAW.
  const candidates = [];

  if (armor) {
    const cap = DEX_CAP[armor.armorSlot] ?? Infinity;
    const dexPart = Math.min(dex, cap);
    candidates.push({
      total: armor.raw.ac + dexPart,
      allowsShield: true,
      parts: [
        { label: armor.raw.name, value: armor.raw.ac, note: 'armor' },
        ...(dexPart !== 0 ? [{ label: 'Dex modifier', value: dexPart, note: 'dex' }] : []),
      ],
    });
  } else {
    // Sem armadura de corpo: 10 + Dex, + cada Defesa sem Armadura de classe/subclasse
    // (Barbarian +Con, Monk +Wis, Draconic +Cha), + a CA sem-armadura da espécie
    // (Autognome 13 + Dex). Todas concorrem pelo MAIOR, respeitando o escudo.
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

  // CA fixa da espécie (Tortle 17, Dex não conta): vale mesmo se houver armadura
  // vestida (pega-se a maior - a espécie RAW nem pode vestir armadura de corpo).
  if (naturalArmor?.type === 'flat') {
    candidates.push({ total: naturalArmor.ac, allowsShield: true, parts: [{ label: naturalArmor.label, value: naturalArmor.ac, note: 'natural' }] });
  }

  // Com escudo, descarta as fórmulas que o proíbem (Monk). A base 10 + Dex sempre
  // permite escudo, então a lista nunca fica vazia.
  const pool = shield ? candidates.filter((c) => c.allowsShield) : candidates;
  const best = pool.reduce((a, b) => (b.total > a.total ? b : a));
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
