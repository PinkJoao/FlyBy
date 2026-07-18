// =============================================================================
// choiceRules - regra de glossário por KIND de escolha (fallback dos títulos)
// =============================================================================
// A DDL-0027 tornou o título de um seletor de escolha um link para a FEATURE que
// o concede (buildClassChoices anexa `ruleEntry` via {@classFeature}). Mas as
// escolhas que não nascem de uma feature (proficiências da origem, sub-escolhas
// de espécie, o Size da raça) ficavam sem link. Este módulo dá o FALLBACK: cada
// `kind` de escolha aponta para a regra do glossário que explica aquele tipo de
// decisão (Size/Skill/Expertise XPHB, Tool Proficiencies XGE…). O ChoiceList usa
// `choice.ruleEntry ?? kindRuleEntry(db, kind)` - a feature específica sempre
// vence; sem regra correspondente o título degrada para texto puro (nunca um
// link morto). Ver DDL-0032.
//
// Camada de componentes (precisa do db), como classChoices - nunca no engine.
// -----------------------------------------------------------------------------

import { glossaryFor, lookupRule } from '../../engine/glossary';

/** kind de escolha → [tag, conteúdo Name|Source] da regra que o explica.
 * Kinds deliberadamente FORA: language (não há regra no glossário), weapon/
 * weaponProf/feat/featureoption/optionalfeature (sempre nascem de uma feature,
 * que já anexa o ruleEntry específico), spellAbility/spellSet/mixed (ambíguos). */
const KIND_RULES = {
  size: ['variantrule', 'Size|XPHB'],
  skill: ['variantrule', 'Skill|XPHB'],
  expertise: ['variantrule', 'Expertise|XPHB'],
  tool: ['variantrule', 'Tool Proficiencies|XGE'],
  save: ['variantrule', 'Saving Throw|XPHB'],
  resist: ['variantrule', 'Resistance|XPHB'],
  immune: ['variantrule', 'Immunity|XPHB'],
  vulnerable: ['variantrule', 'Vulnerability|XPHB'],
};

/**
 * A entrada de regra do glossário para um kind de escolha, ou null (sem regra
 * mapeada / termo ausente do db → o título fica texto puro).
 * @returns {{type,name,source,entries}|null}
 */
export function kindRuleEntry(db, kind) {
  const spec = KIND_RULES[kind];
  if (!spec || !db) return null;
  return lookupRule(glossaryFor(db), spec[0], spec[1])?.entry ?? null;
}

/**
 * Uma regra do glossário por nome (`Name|Source`), para títulos de seção que
 * não são descritores de escolha (ex: "Ability Score Boosts" da BackgroundTab →
 * regra "Ability Score and Modifier|XPHB"). Null quando ausente.
 */
export function namedRuleEntry(db, content) {
  if (!db) return null;
  return lookupRule(glossaryFor(db), 'variantrule', content)?.entry ?? null;
}
