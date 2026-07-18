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
  // Thaumaturge / Magician concedem cantrip + bônus em checks (não são
  // proficiências - entram nos efeitos de magia/checks depois).
};

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
