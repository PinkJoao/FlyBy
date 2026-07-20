// =============================================================================
// featureEffects - efeitos MECÂNICOS de features escolhidas
// =============================================================================
// Muitas features concedem benefícios que o 5etools guarda só como TEXTO (ex:
// Protector "você ganha proficiência com armas marciais e armadura pesada").
// Como não há dado estruturado, mantemos um REGISTRO CURADO por nome de feature
// → efeitos, e aplicamos os efeitos das features que o personagem ESCOLHEU
// (opções de sub-feature, optional features e talentos).
//
// Hoje cobre proficiências (armadura/arma/perícia/ferramenta). O formato deixa
// espaço para efeitos futuros (bônus de CA, ataque, resistências…) usados no
// modo de jogo.
// -----------------------------------------------------------------------------

import { collectChoicePicks } from './choices';
import { collectFeatIds, collectOptionalFeatureIds } from './proficiency';

/**
 * Registro curado: nome da feature (minúsculo) → efeitos.
 * @type {Record<string, {armor?:string[], weapons?:string[], grantedSkills?:string[], grantedTools?:string[]}>}
 */
export const FEATURE_EFFECTS = {
  // Divine Order (Cleric) - Primal Order (Druid): opção "marcial"
  protector: { weapons: ['Martial Weapons'], armor: ['Heavy Armor'] },
  warden: { weapons: ['Martial Weapons'], armor: ['Medium Armor'] },
  // Thaumaturge / Magician: o cantrip extra entra em CANTRIP_BONUS_FEATURES;
  // o bônus em checks (Arcana/Religion, Nature) segue só como texto.
};

/**
 * Featureoptions que aumentam o LIMITE de cantrips da própria classe (prosa
 * "you know one extra cantrip from the X spell list" - TC-0028). Curado: o
 * 5etools não estrutura esse "+1". Grants de cantrip de OUTRA lista (Acolyte of
 * Nature, Arcane Initiate…) NÃO entram aqui - são `additionalSpells` {choose}.
 * @type {Record<string, number>}
 */
export const CANTRIP_BONUS_FEATURES = {
  thaumaturge: 1, // Divine Order (Cleric XPHB)
  magician: 1, // Primal Order (Druid XPHB)
};

/**
 * Soma dos cantrips extras concedidos pelas featureoptions ESCOLHIDAS desta
 * classe (os picks vivem no bag da própria classe).
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

/**
 * Talentos/features escolhidos com bônus PLANO de CA em prosa (curado, como os
 * demais registros deste módulo). `requiresArmor` espelha o RAW do Defense
 * ("While you are wearing armor, you gain a +1 bonus to Armor Class").
 * @type {Record<string, {value:number, requiresArmor?:boolean, label:string}>}
 */
export const AC_BONUS_FEATURES = {
  defense: { value: 1, requiresArmor: true, label: 'Defense' },
};

/**
 * Bônus de CA das features/talentos escolhidos (Defense fighting style…).
 * O chamador decide se cada um se aplica (`requiresArmor` vs. `hasArmor`).
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

/** Ids ("Nome|Fonte") de todas as features ESCOLHIDAS que podem ter efeito. */
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
 * Proficiências concedidas pelos EFEITOS das features escolhidas.
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
