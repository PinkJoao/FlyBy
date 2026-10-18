// =============================================================================
// choiceRules: a regra do glossário por kind de escolha
// =============================================================================
// O QUE FAZ
//   O título de um seletor é link para a FEATURE que concede a escolha
//   (`ruleEntry`). As escolhas que não nascem de feature (proficiências da origem,
//   sub-escolhas de espécie, o tamanho) ficavam sem link: aqui cada kind aponta
//   para a regra que o explica (DDL-0032). O ChoiceList usa `choice.ruleEntry ??
//   kindRuleEntry(db, kind)`; sem regra, texto (nunca link morto). Fica na camada
//   de componentes porque precisa do db.
//
// FUNÇÕES
//   kindRuleEntry(db, kind): a regra de um kind, ou null.
//   namedRuleEntry(db, content): uma regra por "Nome|Fonte" (títulos de seção).
//
// DECISÕES E ARMADILHAS
//   - Fora de propósito: language (não há regra); weapon, weaponProf, feat,
//     featureoption e optionalfeature (sempre nascem de uma feature);
//     spellAbility, spellSet e mixed (ambíguos).
// -----------------------------------------------------------------------------

import { glossaryFor, lookupRule } from '../../engine/glossary';

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
 * A regra do glossário de um kind de escolha, ou null.
 * @returns {{type,name,source,entries}|null}
 */
export function kindRuleEntry(db, kind) {
  const spec = KIND_RULES[kind];
  if (!spec || !db) return null;
  return lookupRule(glossaryFor(db), spec[0], spec[1])?.entry ?? null;
}

/** Uma regra do glossário por nome, ou null. */
export function namedRuleEntry(db, content) {
  if (!db) return null;
  return lookupRule(glossaryFor(db), 'variantrule', content)?.entry ?? null;
}
