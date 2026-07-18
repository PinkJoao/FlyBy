// =============================================================================
// Parser de dados de classe (formato 5etools)
// =============================================================================
// Extrai do JSON de classe do 5etools só o que o engine precisa, normalizado:
// dado de vida, saves, perícias oferecidas, título de subclasse, e a lista de
// features por nível (refs do tipo "Nome|Classe|Fonte|Nível").
//
// Mantém-se puro: recebe o objeto de classe (db['class-fighter'].class[0]) e
// devolve dados simples, sem tocar em rede ou cache.
// -----------------------------------------------------------------------------

/** Nome completo de perícia (5etools) → código (convenção Foundry). */
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

/** Converte um nome de perícia para código; devolve o original se não mapeado. */
export function skillCode(name) {
  return SKILL_NAME_TO_CODE[String(name).toLowerCase()] ?? name;
}

/**
 * Faz parse de uma referência de feature "Nome|Classe|Fonte|Nível".
 * Aceita tanto string quanto o formato objeto { classFeature, gainSubclassFeature }.
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
    source, // vazio = herda a fonte da classe
    level: Number(level) || 0,
    gainsSubclass,
  };
}

/**
 * Normaliza um objeto de classe do 5etools.
 * @param {object} classObj  ex: db['class-fighter'].class[0]
 */
export function parseClass(classObj) {
  if (!classObj) return null;

  // Perícias iniciais: `{choose:{from,count}}` (maioria) OU `{any:N}` (Bard →
  // qualquer perícia). `any:true` sinaliza pool aberto (a UI resolve).
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
    nativeSubclassLevel: subclassFeatureLevel, // nível em que a subclasse entra (RAW)
    features,
    spellcasting: {
      ability: classObj.spellcastingAbility ?? null,
      casterProgression: classObj.casterProgression ?? null, // 'full'|'half'|'pact'|...
    },
  };
}

/**
 * Features concedidas por uma classe até um certo nível (inclusive).
 * @param {object} classObj
 * @param {number} level
 */
export function featuresUpToLevel(classObj, level) {
  const parsed = parseClass(classObj);
  if (!parsed) return [];
  return parsed.features.filter((f) => f.level <= level);
}
