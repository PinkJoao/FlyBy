// =============================================================================
// naturalArmor: a armadura natural de espécie (registro curado)
// =============================================================================
// O QUE FAZ
//   Algumas espécies definem a própria CA em PROSA, em três padrões distintos
//   (por isso um registro curado, não uma heurística):
//     flat: CA base FIXA, Destreza não conta (Tortle 17). Não veste armadura, mas
//       escudo soma.
//     unarmored: sem armadura, CA = base + atributo (Autognome 13 + Dex); concorre
//       com a Defesa sem Armadura de classe.
//     bonus: +N na CA, vestido ou não (Warforged).
//
// FUNÇÕES
//   naturalArmorFor(raceObj): o padrão de uma raça resolvida, ou null.
//   naturalArmorChanges(nat): os changes de Active Effect para o Foundry.
//
// DECISÕES E ARMADILHAS
//   - Conjunto FECHADO e edition-strict, chave `Nome|FONTE` da raça RESOLVIDA:
//     só as versões que o app oferece. Fora de propósito: as antigas que o
//     latestOnly esconde (Tortle TTP, Warforged ERLW, Lizardfolk VGM) e o Simic
//     Hybrid, cuja CA vem de uma OPÇÃO do Animal Enhancement (caminho de
//     AC_BONUS_FEATURES).
//   - 2026-07-25 (T1b/S-C): varrer toda espécie com o traço "Natural Armor" achou
//     cinco que derivavam 10 + Dex; o Loxodon é o único que soma CON. O goblin de
//     Ixalan é sub-raça fundida do de Zendikar mas tem fonte PSX, e o fallback
//     procura `<baseName>|<fonte da variante>`: precisa da linha própria.
//   - A codificação do export (`ac.calc`, `ac.formula`, `ac.bonus`, modes 5 e 2)
//     é a do overlay foundry-races (verificada 2026-07-17), reproduzida para as
//     edições que o overlay não cobre. Este módulo é a fonte ÚNICA da ficha e do
//     export, e o efeito de CA do overlay é suprimido no item de raça.
// -----------------------------------------------------------------------------

/**
 * @typedef {Object} NaturalArmor
 * @property {'flat'|'unarmored'|'bonus'} type
 * @property {string} label
 * @property {number} [ac]
 * @property {number} [base]
 * @property {import('../schema/character').Ability} [ability]
 * @property {number} [bonus]
 */

export const NATURAL_ARMOR = {
  'Tortle|MPMM': { type: 'flat', ac: 17, label: 'Natural Armor' },
  'Autognome|AAG': { type: 'unarmored', base: 13, ability: 'dex', label: 'Armored Casing' },
  'Warforged|EFA': { type: 'bonus', bonus: 1, label: 'Integrated Protection' },
  'Lizardfolk|MPMM': { type: 'unarmored', base: 13, ability: 'dex', label: 'Natural Armor' },
  'Thri-kreen|AAG': { type: 'unarmored', base: 13, ability: 'dex', label: 'Chameleon Carapace' },
  'Locathah|LR': { type: 'unarmored', base: 12, ability: 'dex', label: 'Natural Armor' },
  'Loxodon|GGR': { type: 'unarmored', base: 12, ability: 'con', label: 'Natural Armor' },
  'Goblin|PSZ': { type: 'unarmored', base: 11, ability: 'dex', label: 'Grit' },
  'Goblin|PSX': { type: 'unarmored', base: 11, ability: 'dex', label: 'Grit' },
};

/**
 * O padrão de armadura natural de uma raça resolvida, ou null.
 * @param {object|null} raceObj
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

const AC = 'system.attributes.ac';

/**
 * Os changes de Active Effect da armadura natural.
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
  return [{ key: `${AC}.bonus`, mode: 2, value: `+ ${nat.bonus}` }];
}
