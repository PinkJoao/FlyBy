// =============================================================================
// classData: o parser de dados de classe (formato 5etools)
// =============================================================================
// O QUE FAZ
//   Extrai do JSON de classe só o que o engine precisa, normalizado: dado de vida,
//   saves, perícias oferecidas, título e nível de subclasse, progressão de
//   conjuração e as features por nível (refs "Nome|Classe|Fonte|Nível"). Puro:
//   recebe o objeto (db['class-fighter'].class[0]) e devolve dados simples.
//
// FUNÇÕES
//   skillCode(name): nome completo de perícia vira código (acr, ath, prc).
//   parseFeatureRef(ref): uma ref de feature, string ou objeto.
//   parseClass(classObj): a classe normalizada.
//   featuresUpToLevel(classObj, level): as features até um nível.
//   isOriginalEntry(character, cls): a entrada é a classe inicial?
//   classProficiencies(classObj, isOriginal): as proficiências que a entrada de classe dá.
//   multiclassSkillChoice(classObj): a perícia que a classe dá a quem entra nela por multiclasse.
//
// DECISÕES E ARMADILHAS
//   - Perícias iniciais: `{choose:{from,count}}` na maioria, `{any:N}` no Bardo
//     (qualquer perícia; `any: true` sinaliza pool aberto).
//   - Fonte vazia numa ref herda a da classe.
//   - Multiclasse (XPHB p. 44, "you gain only some of the new class's starting proficiencies"):
//     a classe inicial dá o `startingProficiencies` inteiro; as outras, só o
//     `multiclassing.proficienciesGained` (Monk, Sorcerer e Wizard não dão nada). Todo leitor
//     de proficiência de classe passa por classProficiencies: a ficha dava a armadura pesada do
//     guerreiro a um mago que entrou nele (a régua do multiclasse, TC-0217).
//   - isOriginalEntry: a marca `isOriginalClass`; sem nenhuma marcada (ficha antiga), a primeira.
// -----------------------------------------------------------------------------

export const SKILL_NAME_TO_CODE = {
  acrobatics: 'acr',
  'animal handling': 'ani',
  arcana: 'arc',
  athletics: 'ath',
  deception: 'dec',
  history: 'his',
  insight: 'ins',
  intimidation: 'itm',
  investigation: 'inv',
  medicine: 'med',
  nature: 'nat',
  perception: 'prc',
  performance: 'prf',
  persuasion: 'per',
  religion: 'rel',
  'sleight of hand': 'slt',
  stealth: 'ste',
  survival: 'sur',
};

/** Nome de perícia vira código; devolve o original se não mapeado. */
export function skillCode(name) {
  return SKILL_NAME_TO_CODE[String(name).toLowerCase()] ?? name;
}

/**
 * Parse de uma ref "Nome|Classe|Fonte|Nível" (string ou objeto).
 * @param {string|object} ref
 * @returns {{ name: string, className: string, source: string, level: number, gainsSubclass: boolean }}
 */
export function parseFeatureRef(ref) {
  let str = ref;
  let gainsSubclass = false;
  if (ref && typeof ref === 'object') {
    str = ref.classFeature;
    gainsSubclass = !!ref.gainSubclassFeature;
  }
  const [name = '', className = '', source = '', level = '0'] = String(str).split('|');
  return {
    name,
    className,
    source,
    level: Number(level) || 0,
    gainsSubclass,
  };
}

/** A entrada é a classe inicial? (sem nenhuma marcada, a primeira) */
export function isOriginalEntry(character, cls) {
  const list = character?.classes ?? [];
  if (list.some((c) => c.isOriginalClass)) return cls?.isOriginalClass === true;
  return list.length === 0 || list[0] === cls;
}

/** As proficiências que a entrada de classe dá, no formato do `startingProficiencies`. */
export function classProficiencies(classObj, isOriginal = true) {
  if (isOriginal) return classObj?.startingProficiencies ?? {};
  return classObj?.multiclassing?.proficienciesGained ?? {};
}

/** A perícia que a classe dá a quem entra nela por multiclasse ({ from, count, any }). */
export function multiclassSkillChoice(classObj) {
  const s = classObj?.multiclassing?.proficienciesGained?.skills?.[0];
  if (s?.choose) return { from: (s.choose.from ?? []).map(skillCode), count: s.choose.count ?? 0, any: false };
  if (Number(s?.any) > 0) return { from: [], count: Number(s.any), any: true };
  return { from: [], count: 0, any: false };
}

/**
 * Normaliza um objeto de classe do 5etools.
 * @param {object} classObj
 */
export function parseClass(classObj) {
  if (!classObj) return null;

  const skillsField = classObj.startingProficiencies?.skills?.[0];
  const skillChoice = skillsField?.choose
    ? { from: (skillsField.choose.from ?? []).map(skillCode), count: skillsField.choose.count ?? 0, any: false }
    : Number(skillsField?.any) > 0
      ? { from: [], count: Number(skillsField.any), any: true }
      : { from: [], count: 0, any: false };

  const features = (classObj.classFeatures ?? []).map(parseFeatureRef);
  const subclassFeatureLevel =
    features.find((f) => f.gainsSubclass)?.level ?? null;

  return {
    id: (classObj.name ?? '').toLowerCase(),
    name: classObj.name ?? '',
    source: classObj.source ?? '',
    hitDieMax: classObj.hd?.faces ?? 0,
    proficientSaves: classObj.proficiency ?? [],
    skillChoice,
    armor: classObj.startingProficiencies?.armor ?? [],
    weapons: classObj.startingProficiencies?.weapons ?? [],
    subclassTitle: classObj.subclassTitle ?? '',
    nativeSubclassLevel: subclassFeatureLevel,
    features,
    spellcasting: {
      ability: classObj.spellcastingAbility ?? null,
      casterProgression: classObj.casterProgression ?? null,
    },
  };
}

/**
 * As features de uma classe até um nível, inclusive.
 * @param {object} classObj
 * @param {number} level
 */
export function featuresUpToLevel(classObj, level) {
  const parsed = parseClass(classObj);
  if (!parsed) return [];
  return parsed.features.filter((f) => f.level <= level);
}
