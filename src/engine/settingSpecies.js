// =============================================================================
// Espécies de CENÁRIO: as vazias e as redundantes saem, as variantes ficam
// atrás de um filtro
// =============================================================================
// O 5etools traz, além das espécies dos livros, as dos suplementos de CENÁRIO,
// em especial os seis "Plane Shift: <plano>" (PSA/PSD/PSI/PSK/PSX/PSZ), PDFs
// gratuitos de 2016-2018 do crossover com Magic: The Gathering, em regras 2014.
// Várias delas repetem o NOME de uma espécie que o app já tem, e o seletor
// acabava respondendo "Elf" com seis linhas e "Human" com seis.
//
// Este módulo trata as três metades do problema, que são DIFERENTES e por isso
// vivem em listas separadas:
//
//  1. REMOÇÃO por vazio      -> `EMPTY_SPECIES` / `EMPTY_SUBRACES`
//  2. REMOÇÃO por redundância -> `REDUNDANT_SPECIES`
//  3. FILTRO (continua no app, só fora da visão padrão) -> `SETTING_VARIANTS`
//
// O QUE NÃO ESTÁ AQUI, e por quê:
//  - `LFL` ("Lorwyn: First Light", 2025-11-18) é livro OFICIAL e ATUAL, em
//    regras 2024: suas espécies já vêm no formato moderno (entry "Creature
//    Type", sem `ability`, guarda-chuva de linhagem). NÃO entram em NENHUMA lista
//    daqui. As reimpressões que só reflavorizam uma espécie mainstream (`Elf|LFL`
//    é traço a traço o `Elf|XPHB` com Lorwyn/Shadowmoor no lugar de Drow/High/
//    Wood; `Faerie|LFL` é o `Fairy|MPMM` + linhagens de Lorwyn) são FUNDIDAS na
//    base por engine/mergedLineages.js (DDL-0066): as linhagens do LFL viram
//    opções da espécie mainstream e a entrada LFL some do seletor - uma "Elf" só.
//    REGRA: não confundir "cenário" com "legado" porque a fonte parece exótica.
//    Confira a DATA da fonte e o FORMATO da espécie.
//  - As demais espécies de cenário de LIVROS (GGR/Ravnica, EFA/Eberron,
//    AAG/Spelljammer, MOT/Theros, FTD, RHW...) também ficam de fora: são
//    conteúdo publicado em livro. O `Dragonborn (Gem)|FTD` repete o nome do
//    Dragonborn, mas é variante legítima de livro, com cinco linhagens próprias.
//
// TRATAMENTO DE LINHAGEM NÃO SE APLICA AQUI (decidido 2026-07-23). O DDL-0059
// até o 0063 resolveu um problema de EDIÇÃO: conteúdo 2014 que a 2024 absorveu
// ou reescreveu, a MESMA espécie do MESMO mundo em duas edições, e por isso cabe
// como opção de um guarda-chuva. Aqui o eixo é CENÁRIO: `Elf (Zendikar; Joraga
// Nation)` e `Elf; Drow Lineage` são elfos de MUNDOS diferentes, e pendurar as
// nações de Zendikar na "Elven Lineage" ofereceria Joraga ao lado de Drow para
// quem constrói um personagem de Forgotten Realms. A regra do `as` (DDL-0060)
// também reprova: o `Elf (Zendikar)` é subconjunto ESTRITO do `Elf|XPHB` (que
// ainda dá Trance e Keen Senses como escolha de 3 perícias), então a fusão
// somaria tudo isso de graça, a mesma objeção que tirou o Ghostwise do halfling.
// E não há traço absorvido identificável, o que barra o `swap` pela regra 4 do
// DDL-0063.
// -----------------------------------------------------------------------------

/**
 * Espécies que, sob as regras 2024, não entregam mecânica NENHUMA.
 *
 * As três são o humano 2014 de um plano de Magic, e o conteúdo INTEIRO delas era
 * o `ability` de +1 em todos os seis atributos. A regra do DDL-0058/0062
 * descarta o `ability` de espécie (nas regras 2024 o aumento vem SEMPRE da
 * origem), então sobram apenas as seções de PROSA do formato 2014 (Age,
 * Alignment, Size, Speed, Languages): nenhum traço, nenhuma perícia, nenhum
 * sentido, nenhuma magia, velocidade e tamanho padrão. Censo de 2026-07-23: são
 * as ÚNICAS três do catálogo inteiro nessa condição.
 * @type {ReadonlySet<string>}
 */
export const EMPTY_SPECIES = Object.freeze(
  new Set(['Human (Ixalan)|PSX', 'Human (Kaladesh)|PSK', 'Human (Zendikar)|PSZ']),
);

/**
 * O mesmo caso, um nível abaixo: LINHAGEM que não entrega nada.
 *
 * A `Gavony` do `Human (Innistrad)` é, no dado, só `ability: +1 em tudo`, sem
 * `entries`, sem proficiência, sem nada. Descartado o `ability`, ela fica
 * idêntica à base, e a espécie oferecia quatro linhagens das quais uma não fazia
 * diferença alguma. As outras três têm conteúdo real (Kessig, Nephalia,
 * Stensia) e por isso a espécie CONTINUA no app.
 *
 * Chave de 4 campos (`nome|fonte|raçaNome|raçaFonte`), a mesma que o 5etools usa
 * para identificar uma sub-raça: nome+fonte sozinhos não são únicos.
 * @type {ReadonlySet<string>}
 */
export const EMPTY_SUBRACES = Object.freeze(new Set(['Gavony|PSI|Human (Innistrad)|PSI']));

/**
 * Espécies removidas por REDUNDÂNCIA: outra entrada do catálogo já as cobre, e
 * melhor. Diferente do caso "vazio" acima, aqui há mecânica, mas ela é a mesma.
 *
 * `imageFor` (opcional) é o resgate: a espécie sai, mas a ARTE dela não se
 * perde. Vai para a linhagem indicada, que é a que a imagem retrata.
 *
 * Hoje só o Aven. Existiam duas versões, de dois planos:
 *  - `Aven|PSA` (Amonkhet) tem DUAS linhagens, Hawk-Headed e Ibis-Headed;
 *  - `Aven|PSD` (Dominaria) é base + Hawkeyed + perícia de Percepção, ou seja,
 *    exatamente o `Aven (Hawk-Headed)|PSA`, sem a outra linhagem.
 * O PSA é a versão mais completa e fica. A arte do PSD (um aven de cabeça de
 * águia) vai para a Hawk-Headed, que é a única das duas linhagens SEM imagem
 * própria no dado: a Ibis-Headed anexa a dela, a Hawk-Headed não anexa nenhuma.
 * @type {ReadonlyArray<{species: string, imageFor?: string}>}
 */
export const REDUNDANT_SPECIES = Object.freeze([
  { species: 'Aven|PSD', imageFor: 'Aven (Hawk-Headed)|PSA' },
]);

/**
 * As VARIANTES DE CENÁRIO: espécies de cenário que repetem o nome de outra
 * espécie do catálogo. Elas seguem no app, mas FORA da visão padrão do seletor,
 * atrás de um filtro pré-marcado e removível. É o padrão de "liberdade com
 * aviso" do DDL-0026/0040: recorte de conveniência é filtro removível, nunca
 * regra dura.
 *
 * O CRITÉRIO É A COLISÃO DE NOME, não a fonte. Foi essa a correção de
 * 2026-07-23: filtrar as seis fontes Plane Shift inteiras levava junto espécies
 * ÚNICAS, que não confundem ninguém e são o que aqueles suplementos têm de
 * melhor. Continuam visíveis por padrão: Aetherborn, Aven, Khenra, Kor,
 * Merfolk, Naga, Siren e Vampire.
 *
 * Lista curada, derivada do dado e conferida à mão (censo de 2026-07-23). Para
 * ACRESCENTAR uma entrada: o nome dela, sem o parêntese de cenário, tem de ser
 * o nome de outra espécie VISÍVEL do catálogo (ex: "Elf (Zendikar)" -> "Elf"),
 * ou o nome inteiro tem de bater com o de outra (Goblin|PSZ x Goblin|MPMM).
 * `Aven|PSA` NÃO está aqui: com o `Aven|PSD` removido por redundância, ele
 * deixou de colidir com qualquer coisa.
 * @type {ReadonlySet<string>}
 */
export const SETTING_VARIANTS = Object.freeze(
  new Set([
    'Dwarf (Kaladesh)|PSK', // x Dwarf|XPHB
    'Elf (Kaladesh)|PSK', // x Elf|XPHB
    'Elf (Zendikar)|PSZ', // x Elf|XPHB
    'Goblin|PSZ', // x Goblin|MPMM
    'Human (Innistrad)|PSI', // x Human|XPHB
    'Human (Keldon)|PSD', // x Human|XPHB (espécie legada curada, DDL-0060)
    'Minotaur (Amonkhet)|PSA', // x Minotaur|MPMM
    'Orc (Ixalan)|PSX', // x Orc|XPHB
    'Vedalken|PSK', // x Vedalken|GGR
  ]),
);

/** Id de catálogo de uma espécie ("Nome|FONTE"). */
function idOf(race) {
  return race?.name ? `${race.name}|${race.source}` : '';
}

/** Índice das removidas por redundância, e para onde vai a arte de cada uma. */
const redundantIds = new Set(REDUNDANT_SPECIES.map((e) => e.species));
const imageDonorByTarget = new Map(
  REDUNDANT_SPECIES.filter((e) => e.imageFor).map((e) => [e.imageFor, e.species]),
);

/** A espécie não entrega mecânica nenhuma? */
export function isEmptySpecies(race) {
  return EMPTY_SPECIES.has(idOf(race));
}

/** A sub-raça (entrada crua de `db.races.subrace`) foi removida pelo mesmo motivo? */
export function isEmptySubrace(subrace) {
  if (!subrace?.name) return false;
  return EMPTY_SUBRACES.has(
    `${subrace.name}|${subrace.source}|${subrace.raceName}|${subrace.raceSource}`,
  );
}

/** A espécie foi removida por já existir uma versão melhor dela? */
export function isRedundantSpecies(race) {
  return redundantIds.has(idOf(race));
}

/**
 * A espécie sai das LISTAS (seletor, glossário, matriz do sweep)? Junta os dois
 * motivos de remoção.
 *
 * A remoção é só das listas. `speciesCatalog`/`resolveRaceObj` seguem
 * resolvendo-as pelo nome, mesma semântica do `latestOnly` (DDL-0059), para que
 * uma ficha salva com uma delas não perca a espécie ao recarregar.
 */
export function isRemovedSpecies(race) {
  return isEmptySpecies(race) || isRedundantSpecies(race);
}

/** A espécie é uma variante de CENÁRIO (escondida por padrão no seletor)? */
export function isSettingVariant(race) {
  return SETTING_VARIANTS.has(idOf(race));
}

/**
 * A espécie/linhagem HERDA a arte de uma espécie removida por redundância?
 * Devolve o id do doador ("Nome|FONTE") ou null.
 * @param {object|null} race
 * @returns {string|null}
 */
export function imageDonorFor(race) {
  return imageDonorByTarget.get(idOf(race)) ?? null;
}
