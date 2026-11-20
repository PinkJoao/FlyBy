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
//   startingSkillChoice(parsed, isOriginal, classObj): as perícias iniciais (na classe secundária, as
//     do multiclasse).
//   choiceRuleEntry(db, classId, feature): a regra da feature que concede.
//   buildClassChoices(db, cls, character): os descritores, ordenados por nível.
//   isProficiencyChoice(ch), isFeatureChoice(ch): a partição dos passos 4 e 8 do
//     wizard ('mixed' é proficiência; 'save', 'resist' e os novos kinds são
//     feature).
//
// DECISÕES E ARMADILHAS
//   - Classe secundária (XPHB p. 44): a escolha `skill` e as ferramentas são as do
//     `multiclassing.proficienciesGained` (uma perícia do Bard, do Ranger, do Rogue e do Artificer, o
//     instrumento do Bard), com o MESMO id da classe inicial, que o export e o import já levam. Antes
//     a secundária não tinha nenhuma (a régua do multiclasse, TC-0218).
//   - Expertise com menos perícias livres que a contagem (o Scholar de um mago secundário sem
//     perícia de INT; o Bard cujas perícias já viraram Expertise pelo Rogue): a contagem cai para
//     o que dá, com `note`, depois que as perícias da classe foram escolhidas. Antes a escolha
//     ficava pendente para sempre, sem opção na tela (a régua do multiclasse, TC-0219).
//   - O pool de Expertise são as perícias JÁ proficientes, inclusive as
//     automáticas; `newProf` (Blessings of Knowledge) usa a lista fixa do grant.
//   - O fighting style de subclasse é restrito aos nomes do featureType no db.
//   - choiceRuleEntry usa o mesmo alvo de um link {@classFeature} (entityLinks):
//     nível exato, depois só o nome; sem match, título em texto.
//   - Os planos do Artificer (`planChoices`, TC-0128) entram junto das sub-features.
//   - Escolhas de magia moram no MESMO bag, com ids 'class:' e 'sub:' (TC-0011).
// -----------------------------------------------------------------------------

import { parseClass, isOriginalEntry, multiclassSkillChoice } from '../../engine/classData';
import { resolveClassObj, resolveSubclassObj, ownedFromDb } from '../../engine/resolve';
import {
  classLevelChoices,
  classToolChoices,
  subclassFeatureChoices,
  optionalFeatureChoices,
  planChoices,
} from '../../engine/classFeatureChoices';
import { collectSkillProficiencies } from '../../engine/proficiency';
import { subclassConditionalChoices } from '../../engine/subclassGrants';
import { classGrantChoices } from '../../engine/classFeatureGrants';
import { additionalSpellChoices } from '../../engine/grantedSpells';
import { curatedAdditionalSpells } from '../../engine/grantedSpellUses';
import { featureOptionChoices, subclassFeatureOptionChoices } from '../../engine/featureOptions';
import { lookupEntityLink } from '../common/entityLinks';
import { SKILL_LABEL } from './labels';

/** As perícias iniciais da classe (nível 1; na secundária, as do multiclasse). */
function startingSkillChoice(parsed, isOriginal, classObj) {
  const sc = isOriginal ? parsed?.skillChoice : multiclassSkillChoice(classObj);
  if (!(sc?.count > 0)) return [];
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
  const ownedExpertise = ownedFromDb(character, db).expertise ?? new Set();
  const skillsChosen = (cls.choices?.skill?.picks?.length ?? 0) >= (isOriginalEntry(character, cls) ? parsed?.skillChoice?.count ?? 0 : multiclassSkillChoice(classObj).count);
  const resolvePool = (ch) => {
    if (ch.kind === 'expertise') {
      const options = ch.newProf
        ? (ch.from ?? []).map((code) => ({ value: code, label: SKILL_LABEL[code] ?? code }))
        : ch.from
          ? profSkillOptions.filter((o) => ch.from.includes(o.value))
          : profSkillOptions;
      const mine = new Set(cls.choices?.[ch.id]?.picks ?? []);
      const free = options.filter((o) => mine.has(o.value) || !ownedExpertise.has(o.value)).length;
      if (!ch.newProf && skillsChosen && free < (ch.count ?? 1)) {
        const note = free ? `Only ${free} of your skill proficiencies can still take Expertise.` : 'None of your skill proficiencies can take Expertise here.';
        return { ...ch, count: free, note, pool: { type: 'list', options } };
      }
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
  const original = isOriginalEntry(character, cls);
  const toolChoices = classToolChoices(classObj, original);
  const optChoices = optionalFeatureChoices(classObj, subObj, cls.level).map(resolveFsOnly);
  const featOptChoices = [
    ...featureOptionChoices(db, cls.classId, classObj, cls.level),
    ...planChoices(db, cls.classId, classObj, cls.level),
    ...subclassFeatureOptionChoices(db, cls.classId, subObj, cls.level),
  ];
  const subFeatChoices = subObj
    ? subclassFeatureChoices(db, cls.classId, subObj, cls.level, parsed?.skillChoice?.from ?? []).map(resolvePool)
    : [];
  const condChoices = subObj ? subclassConditionalChoices(db, cls, subObj, character).map(resolvePool) : [];
  const grantChoices = classGrantChoices(cls.classId, cls.level);
  const spellChoices = [
    ...additionalSpellChoices(curatedAdditionalSpells(classObj), cls.level, cls.choices, 'class:'),
    ...(subObj ? additionalSpellChoices(curatedAdditionalSpells(subObj), cls.level, cls.choices, 'sub:') : []),
  ];

  return [
    ...startingSkillChoice(parsed, original, classObj),
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
