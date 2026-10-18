// =============================================================================
// classChoices: os descritores de escolha de uma classe
// =============================================================================
// O QUE FAZ
//   Reúne TODOS os descritores de escolha de uma entrada de classe: perícias e
//   ferramentas iniciais, escolhas por nível, grants de subclasse, sub-features,
//   optional features, condicionais, grants em prosa de classe e escolhas de
//   magia. A ClassTab e o wizard consomem o MESMO builder (o wizard fatia por kind,
//   DDL-0013): sem fork de regras.
//
// FUNÇÕES
//   startingSkillChoice(parsed, isOriginal): as perícias iniciais (só na original).
//   choiceRuleEntry(db, classId, feature): a regra da feature que concede.
//   buildClassChoices(db, cls, character): os descritores, ordenados por nível.
//   isProficiencyChoice(ch), isFeatureChoice(ch): a partição dos passos 4 e 8 do
//     wizard ('mixed' é proficiência; 'save', 'resist' e os novos kinds são
//     feature).
//
// DECISÕES E ARMADILHAS
//   - O pool de Expertise são as perícias JÁ proficientes, inclusive as
//     automáticas; `newProf` (Blessings of Knowledge) usa a lista fixa do grant.
//   - O fighting style de subclasse é restrito aos nomes do featureType no db.
//   - choiceRuleEntry usa o mesmo alvo de um link {@classFeature} (entityLinks):
//     nível exato, depois só o nome; sem match, título em texto.
//   - Escolhas de magia moram no MESMO bag, com ids 'class:' e 'sub:' (TC-0011).
// -----------------------------------------------------------------------------

import { parseClass } from '../../engine/classData';
import { resolveClassObj, resolveSubclassObj, ownedFromDb } from '../../engine/resolve';
import {
  classLevelChoices,
  classToolChoices,
  subclassFeatureChoices,
  optionalFeatureChoices,
} from '../../engine/classFeatureChoices';
import { collectSkillProficiencies } from '../../engine/proficiency';
import { subclassConditionalChoices } from '../../engine/subclassGrants';
import { classGrantChoices } from '../../engine/classFeatureGrants';
import { additionalSpellChoices } from '../../engine/grantedSpells';
import { featureOptionChoices, subclassFeatureOptionChoices } from '../../engine/featureOptions';
import { lookupEntityLink } from '../common/entityLinks';
import { SKILL_LABEL } from './labels';

/** As perícias iniciais da classe (só a original, nível 1). */
function startingSkillChoice(parsed, isOriginal) {
  const sc = parsed?.skillChoice;
  if (!isOriginal || !(sc?.count > 0)) return [];
  return [
    {
      id: 'skill',
      kind: 'skill',
      count: sc.count,
      level: 1,
      label: 'Skill Proficiencies',
      pool: sc.any
        ? { type: 'any', of: 'skill' }
        : { type: 'list', options: sc.from.map((c) => ({ value: c, label: SKILL_LABEL[c] ?? c })) },
    },
  ];
}

/** A regra da feature que concede uma escolha, ou null. */
function choiceRuleEntry(db, classId, feature) {
  if (!feature?.name) return null;
  const content = feature.subclass
    ? (lvl) => `${feature.name}|${classId}||${feature.subclass}||${lvl}`
    : (lvl) => `${feature.name}|${classId}||${lvl}`;
  const tag = feature.subclass ? 'subclassFeature' : 'classFeature';
  const hit = lookupEntityLink(db, tag, content(feature.level ?? '')) ?? lookupEntityLink(db, tag, content(''));
  return hit?.entry ?? null;
}

/**
 * Todos os descritores de escolha de uma classe, por nível.
 * @param {object} db
 * @param {object} cls
 * @param {object} character
 * @returns {object[]}
 */
export function buildClassChoices(db, cls, character) {
  const classObj = cls?.classId ? resolveClassObj(db, cls.classId, cls.source) : null;
  if (!classObj) return [];
  const parsed = parseClass(classObj);
  const subObj =
    cls.classId && cls.subclassId ? resolveSubclassObj(db, cls.classId, cls.subclassId, cls.subclassSource) : null;

  const ownedSkills = ownedFromDb(character, db).skills;
  const profSkillOptions = [...new Set([...Object.keys(collectSkillProficiencies(character)), ...ownedSkills])].map((code) => ({
    value: code,
    label: SKILL_LABEL[code] ?? code,
  }));
  const resolvePool = (ch) => {
    if (ch.kind === 'expertise') {
      const options = ch.newProf
        ? (ch.from ?? []).map((code) => ({ value: code, label: SKILL_LABEL[code] ?? code }))
        : ch.from
          ? profSkillOptions.filter((o) => ch.from.includes(o.value))
          : profSkillOptions;
      return { ...ch, pool: { type: 'list', options } };
    }
    if (ch.kind === 'skill' && ch.from) {
      return { ...ch, pool: { type: 'list', options: ch.from.map((code) => ({ value: code, label: SKILL_LABEL[code] ?? code })) } };
    }
    return ch;
  };
  const resolveFsOnly = (ch) => {
    if (ch.kind !== 'feat' || !ch.pool?.fsTypes) return ch;
    const only = new Set(
      (db?.optionalfeatures?.optionalfeature ?? [])
        .filter((o) => (o.featureType ?? []).some((t) => ch.pool.fsTypes.includes(t)))
        .map((o) => o.name),
    );
    return { ...ch, pool: { ...ch.pool, only } };
  };

  const levelChoices = classLevelChoices(parsed, classObj, cls.level).map(resolvePool);
  const toolChoices = cls.isOriginalClass ? classToolChoices(classObj) : [];
  const optChoices = optionalFeatureChoices(classObj, subObj, cls.level).map(resolveFsOnly);
  const featOptChoices = [
    ...featureOptionChoices(db, cls.classId, classObj, cls.level),
    ...subclassFeatureOptionChoices(db, cls.classId, subObj, cls.level),
  ];
  const subFeatChoices = subObj
    ? subclassFeatureChoices(db, cls.classId, subObj, cls.level, parsed?.skillChoice?.from ?? []).map(resolvePool)
    : [];
  const condChoices = subObj ? subclassConditionalChoices(db, cls, subObj, character).map(resolvePool) : [];
  const grantChoices = classGrantChoices(cls.classId, cls.level);
  const spellChoices = [
    ...additionalSpellChoices(classObj.additionalSpells, cls.level, cls.choices, 'class:'),
    ...(subObj ? additionalSpellChoices(subObj.additionalSpells, cls.level, cls.choices, 'sub:') : []),
  ];

  return [
    ...startingSkillChoice(parsed, cls.isOriginalClass),
    ...toolChoices,
    ...levelChoices,
    ...subFeatChoices,
    ...condChoices,
    ...grantChoices,
    ...spellChoices,
    ...featOptChoices,
    ...optChoices,
  ]
    .map((ch) => {
      const ruleEntry = choiceRuleEntry(db, cls.classId, ch.feature);
      return ruleEntry ? { ...ch, ruleEntry } : ch;
    })
    .map((ch, i) => [ch, i])
    .sort((a, b) => (a[0].level ?? 99) - (b[0].level ?? 99) || a[1] - b[1])
    .map(([ch]) => ch);
}

const PROFICIENCY_KINDS = new Set(['skill', 'tool', 'language', 'mixed']);

/** Escolha de proficiência (passo 4)? */
export const isProficiencyChoice = (ch) => PROFICIENCY_KINDS.has(ch.kind);
/** Escolha de feature (passo 8)? */
export const isFeatureChoice = (ch) => !PROFICIENCY_KINDS.has(ch.kind);
