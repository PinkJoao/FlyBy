// =============================================================================
// Parser de subclasse (formato 5etools)
// =============================================================================
// Refs de feature de subclasse têm a forma:
//   "Nome|Classe|FonteClasse|SubclasseShortName|FonteSubclasse|Nível"
// ex: "Misty Escape|Warlock||Archfey||6"
// -----------------------------------------------------------------------------

/**
 * @param {string} ref
 * @returns {{ name: string, className: string, classSource: string,
 *             subclassShortName: string, subclassSource: string, level: number }}
 */
export function parseSubclassFeatureRef(ref) {
  const [
    name = '',
    className = '',
    classSource = '',
    subclassShortName = '',
    subclassSource = '',
    level = '0',
  ] = String(ref).split('|');
  return {
    name,
    className,
    classSource,
    subclassShortName,
    subclassSource,
    level: Number(level) || 0,
  };
}

/**
 * Normaliza um objeto de subclasse do 5etools.
 * @param {object} subclassObj  ex: db['class-warlock'].subclass[i]
 */
export function parseSubclass(subclassObj) {
  if (!subclassObj) return null;
  return {
    name: subclassObj.name ?? '',
    shortName: subclassObj.shortName ?? '',
    source: subclassObj.source ?? '',
    className: subclassObj.className ?? '',
    features: (subclassObj.subclassFeatures ?? []).map(parseSubclassFeatureRef),
  };
}

/**
 * Features de subclasse concedidas até um certo nível (inclusive).
 * @param {object} subclassObj
 * @param {number} level  nível NA CLASSE dona da subclasse
 */
export function subclassFeaturesUpToLevel(subclassObj, level) {
  const parsed = parseSubclass(subclassObj);
  if (!parsed) return [];
  return parsed.features.filter((f) => f.level <= level);
}
