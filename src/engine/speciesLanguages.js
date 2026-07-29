// =============================================================================
// speciesLanguages - o pseudo-idioma `other` do 5etools
// =============================================================================
// PURO (sem rede/DOM).
//
// O 5etools usa a chave `other` no `languageProficiencies` quando o idioma é o
// PRÓPRIO do cenário/espécie e não está na lista padrão do PHB. Sem tradução, a
// ficha mostrava literalmente "Other" - no card de Idiomas de 21 espécies, e como
// OPÇÃO de um seletor no Simic Hybrid, que é a única escolha do app inteiro que
// não dizia o que era (TC-0050).
//
// O nome está na PROSA de cada espécie ("You can speak, read, and write Common
// and Loxodon"), mas em fraseados irregulares demais para uma regra - o Kor
// "communicates in the silent speech of the Kor", a Siren fala "Common Trade
// Pidgin (if it exists in your campaign) and Siren". Então é CURADORIA, e ela é
// legítima porque o conjunto é FECHADO: `other` só existe nestas 22 entradas, e
// o formato 2024 não usa mais a chave (nenhum talento ou origem a tem).
//
// COMO REFAZER a varredura antes de acrescentar uma entrada: NÃO basta procurar
// `"other"` em `races.race` - a primeira passada fez isso e ficou incompleta em
// três entradas. A varredura correta é sobre o CATÁLOGO RESOLVIDO (`speciesCatalog`
// + `raceLineages`), passando cada entrada por `parseSpecies` e conferindo se
// algum idioma ainda sai como `other`; é o único jeito de pegar as sub-raças
// (`races.subrace`, ex: o Keldon) e as reimpressões por `_copy` (Minotaur|MOT
// herda o campo do Minotaur|GGR). O nome do idioma está na seção "Languages" das
// entries da própria entrada.
// -----------------------------------------------------------------------------

/**
 * `Nome|FONTE` da espécie → o idioma que o `other` dela representa.
 * Todos existem em `languages.json` menos Kor, então quase todos passam a
 * exportar como Trait nativo em vez de virar resíduo de flag.
 * @type {Readonly<Record<string, string>>}
 */
export const OTHER_LANGUAGE = Object.freeze({
  'Aarakocra|EEPC': 'Aarakocra',
  'Aven|PSA': 'Aven',
  'Aven|PSD': 'Aven',
  'Bullywug|DMG': 'Bullywug',
  'Gith|MTF': 'Gith',
  'Grung|OGA': 'Grung',
  'Human (Keldon)|PSD': 'Keldon', // espécie legada curada (DDL-0060); vem da sub-raça
  'Minotaur|MOT': 'Minotaur', // `_copy` do Minotaur|GGR, herda o campo
  // 'Human (Ixalan)|PSX' fica DE FORA de propósito: ali o `other` não tem um
  // idioma só - a prosa diz que ele depende da origem nacional do personagem
  // (Itzocan, Coalition pidgin ou Vampire). Sem resposta única, "Other" é a
  // degradação honesta; inventar um nome seria pior que não traduzir.
  'Kalashtar|ERLW': 'Quori',
  'Khenra|PSA': 'Khenra',
  'Kor|PSZ': 'Kor',
  'Leonin|MOT': 'Leonin',
  'Loxodon|GGR': 'Loxodon',
  'Merfolk|PSZ': 'Merfolk',
  'Minotaur|GGR': 'Minotaur',
  'Minotaur (Amonkhet)|PSA': 'Minotaur',
  'Naga|PSA': 'Naga',
  'Simic Hybrid|GGR': 'Vedalken', // "your choice of Elvish or Vedalken"
  'Siren|PSX': 'Siren',
  'Troglodyte|DMG': 'Troglodyte',
  'Vampire|PSZ': 'Vampire',
  'Vedalken|GGR': 'Vedalken',
  'Vedalken|PSK': 'Vedalken',
});

/**
 * Traduz o pseudo-idioma `other` no idioma real da espécie. Qualquer outro valor
 * (e uma espécie sem entrada no registro) passa intacto - o rótulo genérico
 * "Other" continua sendo a degradação honesta quando não sabemos o nome.
 *
 * O merge de linhagem pode trocar o nome da espécie ("Human (Ixalan; Nação X)"),
 * então a busca também tenta o nome BASE.
 * @param {object|null} raceObj  espécie 5etools (resolvida ou crua)
 * @param {string} value  valor cru do `languageProficiencies`
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
