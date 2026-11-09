// =============================================================================
// foundryItemMechanics: a mecânica de um item de inventário pelo documento do SRD
// =============================================================================
// O QUE FAZ
//   Um item mágico só funciona no Foundry com os effects e as activities dele (o
//   +2 de CON do Belt of Dwarvenkind, a cura da poção, a resistência do anel). O
//   dado do 5etools não os tem; o documento do item no equipment24 do SRD tem.
//   Este módulo acha o documento pelo uuid do item (equipmentUuid) e devolve a
//   mecânica dele, em cópias novas, para o buildInventoryItems.
//
// FUNÇÕES
//   srdItemMechanics(name): { activities, effects, fType, system } do SRD para o
//     item, ou null (`system`: tipo, base, dano, armadura, propriedades, usos).
//   srdVariantEnchantment(raw): o encantamento do modelo do SRD para a variante
//     gerada, pronto para o item base, ou null.
//
// DECISÕES E ARMADILHAS
//   - O registro vem pelo foundryMechanics (sob demanda). Sem ele, null: o item
//     fica com o que o 5etools diz (itemBonusEffect, weaponAttackActivity).
//   - O SRD põe o tipo entre parênteses no fim ("Potion of Giant Strength
//     (Fire)") e o 5etools no meio ("Potion of Fire Giant Strength"): a busca
//     tenta as duas, só para Giant Strength. NÃO vale para o Ring of Resistance: o
//     documento do SRD traz os 10 tipos de dano e daria todas as resistências.
//   - Variante gerada ("Vicious Halberd", "+2 Shield", "Mithral Plate Armor") sai
//     como os premades a guardam: o item BASE com o encantamento do modelo do SRD
//     ("Vicious Weapon", "Shield, +1, +2, or +3" no perfil do bônus), com a origem
//     no modelo. O Foundry calcula nome, bônus mágico, dano extra e crítico; antes
//     a variante saía achatada e perdia o 2d6 do Vicious (Merric L17, T3).
//   - Modelo com VÁRIOS perfis (Ammunition of Slaying: 14 tipos de criatura; Armor
//     of Resistance: 10 tipos de dano; Flame Tongue: 2) usa o perfil cujo nome,
//     aplicado à base, É o nome da variante ("Flame Tongue {}" + "Longsword"); sem
//     perfil igual, a variante sai inteira, sem encantamento: pegar o primeiro
//     impunha um tipo que o jogador não escolheu ("Arrow of Slaying (Aberrations)",
//     visto no Foundry). Modelo de perfil único vale sempre (a marca
//     `flags.builder5e.item` guarda o nome).
//   - Sempre CÓPIA: o registro é compartilhado e o export muda activities depois
//     (DDL-0166).
// -----------------------------------------------------------------------------

import { foundryMechanics } from './foundryMechanicsData';
import { equipmentUuid } from './compendiumUuids';

/** A mecânica do SRD de um item, ou null. */
export function srdItemMechanics(name) {
  const m = String(name ?? '').match(/^(.+?) of ([A-Z][a-z]+) (Giant Strength)$/);
  const uuid = equipmentUuid(name) ?? (m ? equipmentUuid(`${m[1]} of ${m[3]} (${m[2]})`) : null);
  if (!uuid) return null;
  const entry = foundryMechanics()?.items?.[String(uuid).split('.').pop()];
  if (!entry) return null;
  return structuredClone({ activities: entry.activities ?? {}, effects: entry.effects ?? [], fType: entry.fType ?? null, system: entry.system ?? {} });
}

/**
 * O encantamento do modelo do SRD para uma variante gerada ("Vicious Halberd"), ou null.
 * @param {object} raw  a variante, com `_variantName` e `baseItem`
 * @returns {{uuid: string, effect: object}|null}
 */
export function srdVariantEnchantment(raw) {
  const variant = String(raw?._variantName ?? '');
  if (!variant || !raw?.baseItem) return null;
  const plus = variant.match(/^[+]([1-3]) (Weapon|Armor|Shield|Ammunition)/i);
  const template = plus ? `${plus[2]}, +1, +2, or +3` : variant.replace(/ [(][*][)]$/, '');
  const uuid = equipmentUuid(template);
  if (!uuid) return null;
  const list = foundryMechanics()?.items?.[uuid.split('.').pop()]?.enchantments ?? [];
  const baseName = String(raw.baseItem).split('|')[0];
  const shown = (e) => {
    const ch = (e.changes ?? []).find((c) => c.key === 'name');
    if (!ch) return '';
    const v = String(ch.value ?? '');
    return (Number(ch.mode) === 5 ? v.split('{}').join(baseName) : `${baseName}${v}`).toLowerCase();
  };
  const pick = plus
    ? list.find((e) => (e.changes ?? []).some((c) => /magicalBonus$/.test(c.key) && String(c.value) === plus[1]))
    : list.find((e) => shown(e) === String(raw.name).toLowerCase()) ?? (list.length === 1 ? list[0] : null);
  if (!pick) return null;
  const effect = structuredClone({ ...pick, type: 'enchantment', origin: uuid, disabled: false, transfer: true });
  effect._stats = { compendiumSource: `${uuid}.ActiveEffect.${pick._id}` };
  return { uuid, effect };
}
