// =============================================================================
// naturalArmor - armadura natural / CA especial de espécie (registro curado)
// =============================================================================
// Algumas espécies definem a própria Classe de Armadura em PROSA, em três padrões
// mecânicos DISTINTOS (por isso um registro curado, não uma heurística):
//
//   flat       Tortle "Natural Armor": CA base FIXA (17), a Destreza não conta;
//              não pode vestir armadura leve/média/pesada, mas escudo soma normal.
//   unarmored  Autognome "Armored Casing": SEM armadura, CA base = 13 + Dex
//              (mesma forma da Defesa sem Armadura de classe - escolhe-se a maior).
//   bonus      Warforged "Integrated Protection": +N na CA (vestido ou não).
//
// O conjunto é FECHADO e edition-strict (chave `Nome|FONTE` da raça RESOLVIDA):
// só as versões ATUAIS que o app oferece (latestOnly) entram - Tortle MPMM,
// Warforged EFA, Autognome AAG. As versões antigas (Tortle TTP +1 AC calc,
// Warforged ERLW) ficam de fora porque o app não as expõe.
//
// A codificação do EXPORT Foundry (ac.calc/ac.formula/ac.bonus) é a MESMA do
// overlay foundry-races.json (raceFeature), reproduzida aqui para as edições que
// o overlay não cobre (Tortle MPMM / Warforged EFA só existem lá como TTP/ERLW).
// Este módulo é a fonte ÚNICA dos dois lados; o efeito de CA do overlay para a
// raça é suprimido no buildSpeciesItem para não somar em dobro.
// -----------------------------------------------------------------------------

/**
 * @typedef {Object} NaturalArmor
 * @property {'flat'|'unarmored'|'bonus'} type
 * @property {string} label      rótulo do traço (ex: 'Natural Armor')
 * @property {number} [ac]       type 'flat': CA base fixa
 * @property {number} [base]     type 'unarmored': CA base antes do modificador
 * @property {import('../schema/character').Ability} [ability]  type 'unarmored': atributo somado
 * @property {number} [bonus]    type 'bonus': bônus plano de CA
 */

/** `Nome|FONTE` da raça RESOLVIDA → padrão de armadura natural. */
const NATURAL_ARMOR = {
  'Tortle|MPMM': { type: 'flat', ac: 17, label: 'Natural Armor' },
  'Autognome|AAG': { type: 'unarmored', base: 13, ability: 'dex', label: 'Armored Casing' },
  'Warforged|EFA': { type: 'bonus', bonus: 1, label: 'Integrated Protection' },
  // Acrescentadas 2026-07-25 (T1b/S-C): a varredura de TODA espécie alcançável
  // com o traço `Natural Armor` mostrou que só Tortle/Autognome/Warforged
  // estavam no registro - as cinco abaixo declaram a própria CA em prosa e
  // derivavam 10+Dex. O Loxodon é o único que soma CONSTITUIÇÃO.
  'Lizardfolk|MPMM': { type: 'unarmored', base: 13, ability: 'dex', label: 'Natural Armor' },
  'Thri-kreen|AAG': { type: 'unarmored', base: 13, ability: 'dex', label: 'Chameleon Carapace' },
  'Locathah|LR': { type: 'unarmored', base: 12, ability: 'dex', label: 'Natural Armor' },
  'Loxodon|GGR': { type: 'unarmored', base: 12, ability: 'con', label: 'Natural Armor' },
  'Goblin|PSZ': { type: 'unarmored', base: 11, ability: 'dex', label: 'Grit' },
  // O goblin de Ixalan é sub-raça FUNDIDA do de Zendikar (herda o Grit nas
  // entries), mas carrega a fonte PSX - e o fallback deste módulo procura
  // `<baseName>|<fonte da variante>`. Sem esta linha ele derivaria 10+Dex.
  'Goblin|PSX': { type: 'unarmored', base: 11, ability: 'dex', label: 'Grit' },
};

// FORA do registro, de propósito:
//  - Simic Hybrid (GGR): a CA vem de uma OPÇÃO escolhível do "Animal
//    Enhancement" (Carapace), não de um traço fixo - é caso do caminho de
//    featureoption/AC_BONUS_FEATURES, não deste registro.
//  - As versões antigas que o `latestOnly` esconde (Lizardfolk VGM/DMG, Tortle
//    TTP, Warforged ERLW, Troglodyte DMG): o app não as oferece.

/**
 * Padrão de armadura natural de uma raça resolvida (ou null).
 * @param {object|null} raceObj  raça 5etools RESOLVIDA
 * @returns {NaturalArmor|null}
 */
export function naturalArmorFor(raceObj) {
  if (!raceObj?.name) return null;
  const base = raceObj._baseName ?? raceObj.name;
  return (
    NATURAL_ARMOR[`${raceObj.name}|${raceObj.source}`] ??
    NATURAL_ARMOR[`${base}|${raceObj.source}`] ??
    null
  );
}

// mode numérico do dnd5e (CONST.ACTIVE_EFFECT_MODES): ADD=2, OVERRIDE=5.
const AC = 'system.attributes.ac';

/**
 * O(s) change(s) de Active Effect que expressam a armadura natural no Foundry -
 * a MESMA codificação do overlay foundry-races (verificada 2026-07-17).
 * @param {NaturalArmor} nat
 * @returns {Array<{key:string, mode:number, value:string}>}
 */
export function naturalArmorChanges(nat) {
  if (!nat) return [];
  if (nat.type === 'flat') {
    return [
      { key: `${AC}.calc`, mode: 5, value: 'custom' },
      { key: `${AC}.formula`, mode: 5, value: String(nat.ac) },
    ];
  }
  if (nat.type === 'unarmored') {
    return [
      { key: `${AC}.calc`, mode: 5, value: 'custom' },
      { key: `${AC}.formula`, mode: 5, value: `${nat.base} + @abilities.${nat.ability}.mod` },
    ];
  }
  // bonus
  return [{ key: `${AC}.bonus`, mode: 2, value: `+ ${nat.bonus}` }];
}
