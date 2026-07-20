// =============================================================================
// buildClassChoices - descritores de escolha de UMA classe (bag por classe)
// =============================================================================
// Reúne, para uma entrada de classe, TODOS os descritores de escolha que a
// ClassTab renderiza: perícias iniciais, ferramentas iniciais, escolhas por nível
// (feat/ASI, fighting style, expertise, weapon mastery), grants em prosa da
// subclasse, sub-feature options e optional features - cada um com seu `kind`.
//
// Extraído da ClassTab para ser reusado pelo wizard: os passos de PROFICIÊNCIAS e
// de FEATURES fatiam ESTA mesma lista por `kind` (DDL-0013), escrevendo no mesmo
// choice-bag `cls.choices`. A ClassTab e o wizard consomem o mesmo builder - sem
// fork de regras (guard-rail DDL-0013).
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
import { additionalSpellChoices } from '../../engine/grantedSpells';
import { featureOptionChoices, subclassFeatureOptionChoices } from '../../engine/featureOptions';
import { lookupEntityLink } from '../common/entityLinks';
import { SKILL_LABEL } from './labels';

/** Perícias INICIAIS da classe (só a original, nível 1). */
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

/**
 * Resolve o campo `feature` de um descritor ({name, level, subclass?}) para a
 * entrada de regra da feature de classe/subclasse - o MESMO alvo que um link
 * {@classFeature}/{@subclassFeature} inline abriria (fonte única: entityLinks).
 * Tenta com o nível exato e cai para só-nome (nomes de optionalfeature-
 * Progression nem sempre batem o nível da feature). Sem match → null (o título
 * do seletor fica texto puro, nunca um link morto).
 */
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
 * Todos os descritores de escolha de uma classe, ordenados pelo nível em que
 * aparecem (estável dentro do mesmo nível). Descritores com `feature` saem com
 * `ruleEntry` (o texto da feature que concede a escolha) - o ChoiceList torna o
 * título do seletor um link para o popup do glossário.
 * @param {object} db
 * @param {object} cls        entrada de classe (character.classes[i])
 * @param {object} character  personagem (para o pool de expertise = perícias já proficientes)
 * @returns {object[]}
 */
export function buildClassChoices(db, cls, character) {
  const classObj = cls?.classId ? resolveClassObj(db, cls.classId, cls.source) : null;
  if (!classObj) return [];
  const parsed = parseClass(classObj);
  const subObj =
    cls.classId && cls.subclassId ? resolveSubclassObj(db, cls.classId, cls.subclassId, cls.subclassSource) : null;

  // Expertise só pode recair sobre perícias em que o personagem JÁ é proficiente
  // - inclusive as AUTO-concedidas (espécie fixa, grants de subclasse, efeitos
  // de feature), não só as escolhidas (fecha o deferred da DDL-0002; o dedup do
  // TagChoice contra owned.expertise continua excluindo as que já têm expertise).
  const ownedSkills = ownedFromDb(character, db).skills;
  const profSkillOptions = [...new Set([...Object.keys(collectSkillProficiencies(character)), ...ownedSkills])].map((code) => ({
    value: code,
    label: SKILL_LABEL[code] ?? code,
  }));
  const resolvePool = (ch) => {
    if (ch.kind === 'expertise') {
      // `newProf` (Blessings of Knowledge): a expertise vem JUNTO da proficiência
      // nova - o pool é a lista fixa do grant, sem intersectar com as proficientes.
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
  // Restringe o fighting style de subclasse aos NOMES daquele featureType no db.
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
  // Escolhas CONDICIONAIS de grants fixos de subclasse ("if you already have
  // this proficiency…" - TC-0012): dependem do que o personagem tem de outras
  // fontes, então são geradas ao vivo contra ele.
  const condChoices = subObj ? subclassConditionalChoices(db, cls, subObj, character).map(resolvePool) : [];
  // Escolhas de MAGIA concedidas pelo `additionalSpells` da classe/subclasse
  // (TC-0011: Abjurer "escolha uma magia de Abjuração", Arcane Archer
  // prestidigitation OU druidcraft…). Ids prefixados ('class:'/'sub:') moram no
  // MESMO choice-bag da classe; grantedSpells consome os picks ao derivar.
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

// Partição por `kind` - os passos 4 (proficiências) e 8 (features) do wizard.
// 'mixed' (perícia OU idioma, Cavalier/Samurai) é proficiência; 'save'/'resist'
// e os demais novos kinds caem no lado das features (isFeatureChoice).
const PROFICIENCY_KINDS = new Set(['skill', 'tool', 'language', 'mixed']);

/** Escolha de PROFICIÊNCIA (perícia/ferramenta/idioma) - passo 4. */
export const isProficiencyChoice = (ch) => PROFICIENCY_KINDS.has(ch.kind);
/** Escolha de FEATURE (feat/ASI/expertise/mastery/invocação/sub-feature) - passo 8. */
export const isFeatureChoice = (ch) => !PROFICIENCY_KINDS.has(ch.kind);
