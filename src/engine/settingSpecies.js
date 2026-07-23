// =============================================================================
// Espécies de CENÁRIO: as vazias saem, as variantes ficam atrás de um filtro
// =============================================================================
// O 5etools traz, além das espécies dos livros, as dos suplementos de CENÁRIO —
// em especial os seis "Plane Shift: <plano>" (PSA/PSD/PSI/PSK/PSX/PSZ), PDFs
// gratuitos de 2016-2018 do crossover com Magic: The Gathering, em regras 2014.
// Várias delas repetem o NOME de uma espécie que o app já tem, e o seletor
// acabava respondendo "Elf" com seis linhas e "Human" com seis.
//
// Este módulo trata as duas metades do problema, que são DIFERENTES:
//
//  1. REMOÇÃO — três dessas espécies não entregam NADA. Ver `EMPTY_SPECIES`.
//  2. FILTRO — o resto tem mecânica de verdade e continua no app, apenas
//     escondido por PADRÃO atrás de um filtro removível. Ver `SETTING_SOURCES`.
//
// O QUE NÃO ESTÁ AQUI, e por quê:
//  - `LFL` ("Lorwyn: First Light", 2025-11-18) é livro OFICIAL e ATUAL, em
//    regras 2024: suas espécies já vêm no formato moderno (entry "Creature
//    Type", sem `ability`, guarda-chuva de linhagem). O `Elf|LFL` é traço a
//    traço o `Elf|XPHB` com linhagens Lorwyn/Shadowmoor no lugar de Drow/High/
//    Wood, e o `Kithkin|LFL` é o Halfling XPHB + darkvision + um guarda-chuva
//    "Kithkin Lineage" — ou seja, o livro faz o mesmo que o DDL-0063. É conteúdo
//    atual como o Astral Elf ou o Sea Elf, e NÃO deve entrar em nenhuma das duas
//    listas abaixo.
//  - As demais espécies de cenário de LIVROS (GGR/Ravnica, EFA/Eberron,
//    AAG/Spelljammer, MOT/Theros, FTD, RHW…) também ficam de fora: são conteúdo
//    publicado em livro, e o `Dragonborn (Gem)|FTD` é uma variante legítima com
//    cinco linhagens próprias.
//
// TRATAMENTO DE LINHAGEM NÃO SE APLICA AQUI (decidido 2026-07-23). O DDL-0059…
// 0063 resolveu um problema de EDIÇÃO — conteúdo 2014 que a 2024 absorveu ou
// reescreveu, a MESMA espécie do MESMO mundo em duas edições, e por isso cabe
// como opção de um guarda-chuva. Aqui o eixo é CENÁRIO: `Elf (Zendikar; Joraga
// Nation)` e `Elf; Drow Lineage` são elfos de MUNDOS diferentes, e pendurar as
// nações de Zendikar na "Elven Lineage" ofereceria Joraga ao lado de Drow para
// quem constrói um personagem de Forgotten Realms. A regra do `as` (DDL-0060)
// também reprova: o `Elf (Zendikar)` é subconjunto ESTRITO do `Elf|XPHB` (que
// ainda dá Trance e Keen Senses como escolha de 3 perícias), então a fusão
// somaria tudo isso de graça — a mesma objeção que tirou o Ghostwise do
// halfling. E não há traço absorvido identificável, o que barra o `swap` pela
// regra 4 do DDL-0063.
// -----------------------------------------------------------------------------

/**
 * Espécies que, sob as regras 2024, não entregam mecânica NENHUMA — removidas
 * das listas (seletor, glossário, matriz do sweep).
 *
 * As três são o humano 2014 de um plano de Magic, e o conteúdo INTEIRO delas era
 * o `ability` de +1 em todos os seis atributos. A regra do DDL-0058/0062
 * descarta o `ability` de espécie (nas regras 2024 o aumento vem SEMPRE da
 * origem), então sobram apenas as seções de PROSA do formato 2014 (Age,
 * Alignment, Size, Speed, Languages): nenhum traço, nenhuma perícia, nenhum
 * sentido, nenhuma magia, velocidade e tamanho padrão. Censo de 2026-07-23: são
 * as ÚNICAS três do catálogo inteiro nessa condição.
 *
 * A remoção é só das LISTAS. `speciesCatalog`/`resolveRaceObj` seguem
 * resolvendo-as pelo nome — mesma semântica do `latestOnly` (DDL-0059), para
 * que uma ficha salva com uma delas não perca a espécie ao recarregar.
 * @type {ReadonlySet<string>}
 */
export const EMPTY_SPECIES = Object.freeze(
  new Set(['Human (Ixalan)|PSX', 'Human (Kaladesh)|PSK', 'Human (Zendikar)|PSZ']),
);

/**
 * O mesmo caso, um nível abaixo: LINHAGEM que não entrega nada.
 *
 * A `Gavony` do `Human (Innistrad)` é, no dado, só `ability: +1 em tudo` — sem
 * `entries`, sem proficiência, sem nada. Descartado o `ability`, ela fica
 * idêntica à base (que também é vazia), e a espécie oferecia quatro linhagens
 * das quais uma não fazia diferença alguma. As outras três têm conteúdo real
 * (Kessig, Nephalia, Stensia) e por isso a espécie CONTINUA no app.
 *
 * Chave de 4 campos (`nome|fonte|raçaNome|raçaFonte`), a mesma que o 5etools usa
 * para identificar uma sub-raça — nome+fonte sozinhos não são únicos.
 * @type {ReadonlySet<string>}
 */
export const EMPTY_SUBRACES = Object.freeze(
  new Set(['Gavony|PSI|Human (Innistrad)|PSI']),
);

/**
 * As fontes cujas espécies são VARIANTES DE CENÁRIO: os seis "Plane Shift".
 * O próprio 5etools as agrupa por prefixo (`Parser.SRC_PS_PREFIX = "PS"`), então
 * o conjunto é uma família do dado, não uma heurística de nome.
 *
 * Elas seguem no app — várias são conteúdo único sem colisão nenhuma
 * (Aetherborn, Khenra, Kor, Naga, Siren, e as tribos de Merfolk/Vampire/Goblin)
 * — mas ficam FORA da visão padrão do seletor, atrás de um filtro pré-marcado e
 * removível. É o padrão de "liberdade com aviso" do DDL-0026/0040: recorte de
 * conveniência é filtro removível, nunca regra dura.
 *
 * Inclui o `Human (Keldon)|PSD`, a espécie legada curada no DDL-0060: ela também
 * é um humano de um plano de Magic, e é exatamente uma das linhas que poluíam a
 * busca por "Human". Continua construível a um clique de distância.
 * @type {ReadonlySet<string>}
 */
export const SETTING_SOURCES = Object.freeze(
  new Set(['PSA', 'PSD', 'PSI', 'PSK', 'PSX', 'PSZ']),
);

/** A espécie foi removida por não entregar mecânica nenhuma? */
export function isEmptySpecies(race) {
  return !!race?.name && EMPTY_SPECIES.has(`${race.name}|${race.source}`);
}

/** A sub-raça (entrada crua de `db.races.subrace`) foi removida pelo mesmo motivo? */
export function isEmptySubrace(subrace) {
  if (!subrace?.name) return false;
  return EMPTY_SUBRACES.has(
    `${subrace.name}|${subrace.source}|${subrace.raceName}|${subrace.raceSource}`,
  );
}

/** A espécie é uma variante de CENÁRIO (escondida por padrão no seletor)? */
export function isSettingVariant(race) {
  return !!race?.source && SETTING_SOURCES.has(race.source);
}
