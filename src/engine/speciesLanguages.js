// =============================================================================
// speciesLanguages: o pseudo-idioma "other" do 5etools
// =============================================================================
// O QUE FAZ
//   O 5etools usa a chave `other` em `languageProficiencies` quando o idioma é o
//   PRÓPRIO do cenário. Sem tradução a ficha mostrava "Other" em 21 espécies, e
//   como OPÇÃO de seletor no Simic Hybrid (TC-0050). O nome está na prosa, em
//   fraseados irregulares demais para regra (o Kor "communicates in the silent
//   speech"), então é CURADORIA, legítima porque o conjunto é FECHADO: `other` só
//   existe nestas 22 entradas, e o formato 2024 não usa mais a chave.
//
// FUNÇÕES
//   resolveOtherLanguage(raceObj, value): o idioma real, ou o valor intacto.
//
// DECISÕES E ARMADILHAS
//   - Para refazer a varredura: procurar `"other"` em races.race NÃO basta (a
//     primeira passada perdeu três). Passe o CATÁLOGO RESOLVIDO (speciesCatalog e
//     raceLineages) por parseSpecies e veja o que ainda sai `other`; só assim
//     entram as sub-raças (Keldon) e os `_copy` (Minotaur MOT herda do GGR).
//   - Todos existem em languages.json menos Kor: quase todos exportam como Trait
//     nativo, não como resíduo de flag.
//   - Human (Ixalan) fica FORA de propósito: o idioma depende da nação de origem
//     do personagem, e "Other" é a degradação honesta. O Simic Hybrid é "Elvish
//     ou Vedalken".
//   - O merge de linhagem muda o nome ("Human (Ixalan; Nação)"), então a busca
//     tenta também o nome BASE.
// -----------------------------------------------------------------------------

/** @type {Readonly<Record<string, string>>} */
export const OTHER_LANGUAGE = Object.freeze({
  'Aarakocra|EEPC': 'Aarakocra',
  'Aven|PSA': 'Aven',
  'Aven|PSD': 'Aven',
  'Bullywug|DMG': 'Bullywug',
  'Gith|MTF': 'Gith',
  'Grung|OGA': 'Grung',
  'Human (Keldon)|PSD': 'Keldon',
  'Minotaur|MOT': 'Minotaur',
  'Kalashtar|ERLW': 'Quori',
  'Khenra|PSA': 'Khenra',
  'Kor|PSZ': 'Kor',
  'Leonin|MOT': 'Leonin',
  'Loxodon|GGR': 'Loxodon',
  'Merfolk|PSZ': 'Merfolk',
  'Minotaur|GGR': 'Minotaur',
  'Minotaur (Amonkhet)|PSA': 'Minotaur',
  'Naga|PSA': 'Naga',
  'Simic Hybrid|GGR': 'Vedalken',
  'Siren|PSX': 'Siren',
  'Troglodyte|DMG': 'Troglodyte',
  'Vampire|PSZ': 'Vampire',
  'Vedalken|GGR': 'Vedalken',
  'Vedalken|PSK': 'Vedalken',
});

/**
 * Traduz o pseudo-idioma `other` no idioma real da espécie.
 * @param {object|null} raceObj
 * @param {string} value
 * @returns {string}
 */
export function resolveOtherLanguage(raceObj, value) {
  if (value !== 'other' || !raceObj) return value;
  const src = raceObj.source ?? '';
  return (
    OTHER_LANGUAGE[`${raceObj.name}|${src}`]
    ?? OTHER_LANGUAGE[`${raceObj._baseName ?? raceObj.name}|${raceObj._baseSource ?? src}`]
    ?? value
  );
}
