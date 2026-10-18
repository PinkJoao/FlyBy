// =============================================================================
// featureEffects: os efeitos mecânicos de features escolhidas (registro curado)
// =============================================================================
// O QUE FAZ
//   Muitas features concedem benefícios que o 5etools guarda só como TEXTO
//   (Protector: armas marciais e armadura pesada). Sem dado estruturado, um
//   REGISTRO CURADO por nome de feature diz os efeitos, aplicados às features que
//   o personagem ESCOLHEU (opções de sub-feature, optional features, talentos).
//
// FUNÇÕES
//   cantripLimitBonus(classEntry): cantrips extras das featureoptions escolhidas.
//   acFeatureBonuses(character): os bônus de CA de features e talentos.
//   chosenFeatureIds(character): os ids de toda feature escolhida.
//   deriveFeatureGrants(character): as proficiências concedidas.
//
// DECISÕES E ARMADILHAS
//   - FEATURE_EFFECTS: proficiências (Divine Order e Primal Order, a opção
//     marcial). Thaumaturge e Magician entram só pelo cantrip; o bônus em testes
//     fica como texto.
//   - CANTRIP_BONUS_FEATURES (TC-0028): "you know one extra cantrip from the X
//     spell list" soma no LIMITE da própria classe; o 5etools não estrutura esse
//     +1. Cantrip de OUTRA lista (Acolyte of Nature) é `additionalSpells`, não
//     entra aqui.
//   - AC_BONUS_FEATURES (DDL-0043): bônus plano de CA em prosa. `requiresArmor`
//     espelha o RAW do Defense ("While you are wearing armor"), e o chamador decide
//     se aplica.
// -----------------------------------------------------------------------------

import { collectChoicePicks } from './choices';
import { collectFeatIds, collectOptionalFeatureIds } from './proficiency';

/** @type {Record<string, {armor?:string[], weapons?:string[], grantedSkills?:string[], grantedTools?:string[]}>} */
export const FEATURE_EFFECTS = {
  protector: { weapons: ['Martial Weapons'], armor: ['Heavy Armor'] },
  warden: { weapons: ['Martial Weapons'], armor: ['Medium Armor'] },
};

/** @type {Record<string, number>} */
export const CANTRIP_BONUS_FEATURES = {
  thaumaturge: 1,
  magician: 1,
};

/**
 * Cantrips extras das featureoptions escolhidas desta classe.
 * @param {import('../schema/character').ClassEntry} classEntry
 * @returns {number}
 */
export function cantripLimitBonus(classEntry) {
  let out = 0;
  for (const id of collectChoicePicks(classEntry?.choices, 'featureoption')) {
    out += CANTRIP_BONUS_FEATURES[String(id).split('|')[0].toLowerCase()] ?? 0;
  }
  return out;
}

/** @type {Record<string, {value:number, requiresArmor?:boolean, label:string}>} */
export const AC_BONUS_FEATURES = {
  defense: { value: 1, requiresArmor: true, label: 'Defense' },
};

/**
 * Os bônus de CA das features e talentos escolhidos.
 * @param {import('../schema/character').Character} character
 * @returns {{value:number, requiresArmor?:boolean, label:string}[]}
 */
export function acFeatureBonuses(character) {
  const out = [];
  for (const id of chosenFeatureIds(character)) {
    const eff = AC_BONUS_FEATURES[String(id).split('|')[0].toLowerCase()];
    if (eff) out.push(eff);
  }
  return out;
}

const PROF_KEYS = ['armor', 'weapons', 'grantedSkills', 'grantedTools'];

/** Ids "Nome|Fonte" de toda feature escolhida que pode ter efeito. */
function chosenFeatureIds(character) {
  const out = [];
  for (const cls of character?.classes ?? []) {
    out.push(...collectChoicePicks(cls.choices, 'featureoption'));
  }
  out.push(...collectOptionalFeatureIds(character ?? {}));
  out.push(...collectFeatIds(character ?? {}));
  return out;
}

/**
 * As proficiências concedidas pelas features escolhidas.
 * @param {import('../schema/character').Character} character
 * @returns {{armor:string[], weapons:string[], grantedSkills:string[], grantedTools:string[]}}
 */
export function deriveFeatureGrants(character) {
  const out = { armor: [], weapons: [], grantedSkills: [], grantedTools: [] };
  for (const id of chosenFeatureIds(character)) {
    const eff = FEATURE_EFFECTS[String(id).split('|')[0].toLowerCase()];
    if (!eff) continue;
    for (const k of PROF_KEYS) if (eff[k]) out[k].push(...eff[k]);
  }
  return out;
}
