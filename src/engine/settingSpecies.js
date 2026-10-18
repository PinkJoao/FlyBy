// =============================================================================
// settingSpecies: as espécies de cenário: vazias e redundantes saem, variantes vão para um filtro
// =============================================================================
// O QUE FAZ
//   Os seis "Plane Shift" (PSA, PSD, PSI, PSK, PSX, PSZ), PDFs gratuitos de
//   2016-2018 em regras 2014, repetem o nome de espécies que o app já tem, e o
//   seletor respondia "Elf" com seis linhas. Três problemas DIFERENTES (DDL-0064):
//     1. Remoção por vazio: EMPTY_SPECIES e EMPTY_SUBRACES.
//     2. Remoção por redundância: REDUNDANT_SPECIES.
//     3. Filtro (segue no app, fora da visão padrão): SETTING_VARIANTS.
//
// FUNÇÕES
//   idOf(race): o id de catálogo.
//   isEmptySpecies(race), isEmptySubrace(subrace), isRedundantSpecies(race),
//     isRemovedSpecies(race): as remoções.
//   isSettingVariant(race): escondida por padrão no seletor?
//   imageDonorFor(race): o id da espécie removida que doa a arte, ou null.
//
// DECISÕES E ARMADILHAS
//   - O LFL NÃO entra em lista nenhuma: é livro oficial e atual em regras 2024.
//     As reimpressões dele são fundidas (mergedLineages). Confira a DATA e o
//     FORMATO da fonte; não confunda "cenário" com "legado". As espécies de
//     cenário de LIVRO (GGR, EFA, AAG, MOT, FTD) também ficam: o Dragonborn (Gem)
//     FTD é variante legítima com cinco linhagens.
//   - Tratamento de linhagem NÃO se aplica (2026-07-23): o eixo aqui é CENÁRIO,
//     não edição. Pendurar as nações de Zendikar no Elven Lineage ofereceria Joraga
//     ao lado de Drow num personagem de Forgotten Realms; a regra do `as` reprova
//     (o Elf de Zendikar é subconjunto do XPHB), e não há traço absorvido (swap).
//   - Vazias: três humanos 2014 de Magic cujo conteúdo INTEIRO era o +1 em tudo,
//     descartado pela regra 2024 (censo de 2026-07-23: as únicas). A Gavony de
//     Innistrad é o mesmo caso numa linhagem (chave de 4 campos); Kessig, Nephalia
//     e Stensia têm conteúdo e a espécie fica.
//   - Redundante: só o Aven PSD, exatamente o Hawk-Headed do Aven PSA (que fica);
//     a arte do PSD vai para a Hawk-Headed, a única sem imagem própria.
//   - Variantes: o critério é a COLISÃO DE NOME, não a fonte (correção de
//     2026-07-23); filtrar as fontes inteiras levava espécies únicas (Aetherborn,
//     Kor, Naga, Siren). Para acrescentar: o nome sem o parêntese de cenário tem
//     de ser o de outra espécie VISÍVEL. É filtro pré-marcado e removível
//     (liberdade com aviso, DDL-0040).
//   - Remover é só das LISTAS: speciesCatalog e resolveRaceObj seguem resolvendo
//     pelo nome, como o latestOnly.
// -----------------------------------------------------------------------------

/** @type {ReadonlySet<string>} */
export const EMPTY_SPECIES = Object.freeze(
  new Set(['Human (Ixalan)|PSX', 'Human (Kaladesh)|PSK', 'Human (Zendikar)|PSZ']),
);

/** @type {ReadonlySet<string>} */
export const EMPTY_SUBRACES = Object.freeze(new Set(['Gavony|PSI|Human (Innistrad)|PSI']));

/** @type {ReadonlyArray<{species: string, imageFor?: string}>} */
export const REDUNDANT_SPECIES = Object.freeze([
  { species: 'Aven|PSD', imageFor: 'Aven (Hawk-Headed)|PSA' },
]);

/** @type {ReadonlySet<string>} */
export const SETTING_VARIANTS = Object.freeze(
  new Set([
    'Dwarf (Kaladesh)|PSK',
    'Elf (Kaladesh)|PSK',
    'Elf (Zendikar)|PSZ',
    'Goblin|PSZ',
    'Human (Innistrad)|PSI',
    'Human (Keldon)|PSD',
    'Minotaur (Amonkhet)|PSA',
    'Orc (Ixalan)|PSX',
    'Vedalken|PSK',
  ]),
);

/** O id de catálogo de uma espécie ("Nome|FONTE"). */
function idOf(race) {
  return race?.name ? `${race.name}|${race.source}` : '';
}

const redundantIds = new Set(REDUNDANT_SPECIES.map((e) => e.species));
const imageDonorByTarget = new Map(
  REDUNDANT_SPECIES.filter((e) => e.imageFor).map((e) => [e.imageFor, e.species]),
);

/** A espécie não entrega mecânica nenhuma? */
export function isEmptySpecies(race) {
  return EMPTY_SPECIES.has(idOf(race));
}

/** A sub-raça foi removida por não entregar nada? */
export function isEmptySubrace(subrace) {
  if (!subrace?.name) return false;
  return EMPTY_SUBRACES.has(
    `${subrace.name}|${subrace.source}|${subrace.raceName}|${subrace.raceSource}`,
  );
}

/** A espécie foi removida por já existir uma versão melhor? */
export function isRedundantSpecies(race) {
  return redundantIds.has(idOf(race));
}

/** A espécie sai das listas (seletor, glossário, sweep)? */
export function isRemovedSpecies(race) {
  return isEmptySpecies(race) || isRedundantSpecies(race);
}

/** A espécie é uma variante de cenário? */
export function isSettingVariant(race) {
  return SETTING_VARIANTS.has(idOf(race));
}

/**
 * O id da espécie removida que doa a arte, ou null.
 * @param {object|null} race
 * @returns {string|null}
 */
export function imageDonorFor(race) {
  return imageDonorByTarget.get(idOf(race)) ?? null;
}
