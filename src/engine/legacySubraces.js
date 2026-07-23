// =============================================================================
// Sub-raças LEGADAS curadas (DDL-0058)
// =============================================================================
// A política `latestOnly` esconde uma raça reprintada (Tiefling PHB → XPHB), e
// com ela somem por COLATERAL as SUB-RAÇAS dessa base: elas não têm
// `reprintedAs` próprio, mas `raceLineages` só roda sobre as bases LISTADAS, e a
// base legada não é listada. Nenhuma delas tem equivalente 2024.
//
// Este registro é a lista FECHADA das que voltam SEM reescrita - fundidas como
// estão, seja na base atual (linhagem) ou na legada (espécie à parte). Registro
// explícito, no mesmo espírito de SUBCLASS_GRANTS / NATURAL_ARMOR: nada de
// heurística de nome - a curadoria foi manual, olho a olho (2026-07-22).
//
// O Tiefling seguiu outro caminho (DDL-0061) e por isso não aparece aqui: suas
// 11 legacies foram REESCRITAS no formato 2024 e vivem em
// `engine/legacyFiendishLegacies.js`.
//
// CRITÉRIO DE DESCARTE (do usuário): existe uma versão moderna AUTÔNOMA mais
// completa e atual. Foram DESCARTADAS, deliberadamente:
//  - Eladrin (Elf|PHB, DMG)            → `Eladrin|MPMM` já é espécie própria.
//  - Asmodeus (Tiefling|PHB, MTF)      → a entrada não tem mecânica NENHUMA no
//    dado; é o tiefling PHB padrão, ou seja, a Infernal Legacy do XPHB.
//  - Variant; Infernal Legacy (SCAG)   → Thaumaturgy/Hellish Rebuke/Darkness,
//    idêntica à Fiendish Legacy (Infernal) do Tiefling XPHB.
//  - As 4 `Variant; … Descent` do Half-Elf (SCAG) → a base atual delas seria o
//    `Khoravar|EFA`, versão moderna autônoma (e de outro cenário).
//  - Draconblood e Ravenite (Dragonborn|PHB, EGW) → o Dragonborn XPHB põe a
//    ancestralidade de dragão nas próprias `_versions` (as 10 cores), então como
//    linhagens IRMÃS elas ficariam sem tipo de dano derivado para o sopro.
//
// REGRA DE ATRIBUTO (DDL-0058, decisão do usuário): o campo `ability` de uma
// sub-raça 2014 (+2/+1 fixos) é IGNORADO. O FlyBy é um builder de regras 2024, e
// nelas os aumentos de atributo vêm SEMPRE da origem. A linhagem legada entra
// pelo que tem de próprio (traços, sentidos, velocidade, proficiências, magias).
// Quem aplica isso é `subraceVersions` (engine/speciesData), que descarta o
// campo antes do merge - ver `stripLegacyAbility` lá.
// -----------------------------------------------------------------------------

/**
 * Seções de PROSA que uma raça 2014 escrevia à mão e o chassi 2024 não tem mais
 * (o dado moderno as expressa em campos estruturados: `size`, `speed`,
 * `languageProficiencies`…). Anexá-las ao traço de uma linhagem encheria a ficha
 * de texto morto - o Keldon (PSD) traz as quatro. Descartadas de TODA sub-raça
 * legada; só o TEXTO cai, nunca o campo estruturado homônimo.
 * @type {ReadonlySet<string>}
 */
export const LEGACY_PROSE_SECTIONS = Object.freeze(
  new Set(['Age', 'Alignment', 'Size', 'Speed', 'Languages']),
);

/**
 * DUAS FORMAS DE VOLTAR (campo `as`). O que decide é BALANCEAMENTO: uma
 * sub-raça 2014 pendurada num chassi 2024 tende a somar as vantagens DOS DOIS,
 * virando a escolha obviamente melhor ao lado das linhagens oficiais.
 *
 *  - `'species'` (a regra na prática) - a sub-raça vira uma ESPÉCIE À PARTE no
 *    seletor de espécies, fundida na base LEGADA (`of`), como o `Eladrin|MPMM`
 *    já é hoje. É o que fazer sempre que a base 2024 dê ALGO A MAIS que a 2014,
 *    porque esse "a mais" é somado de graça:
 *      · absorveu o traço de UMA sub-raça 2014 - o Halfling XPHB é o de 2014 +
 *        **Naturally Stealthy**, que era do *Lightfoot*, e o Ghostwise ganhava
 *        de graça o traço que o Silent Speech dele substituía;
 *      · ganhou um traço NOVO - foi o caso do Tiefling XPHB, com o "Otherworldly
 *        Presence" (o Thaumaturgy que em 2014 vinha DENTRO da Infernal Legacy) e
 *        a resistência em ABERTO. Ele acabou saindo daqui por REESCRITA
 *        (DDL-0061), que é a outra saída: neutralizado o empilhamento, a
 *        sub-raça volta a caber como linhagem;
 *      · foi reescrita de cima a baixo - o Human XPHB dá Resourceful/Skillful/
 *        **Versatile** (um talento de origem), e o Keldon virava upgrade puro
 *        sobre o humano comum.
 *
 *  - `'lineage'` - LINHAGEM da base ATUAL. Só quando o chassi 2024 é o MESMO da
 *    base 2014 mais um traço GUARDA-CHUVA que a sub-raça ocupa via `supersedes`
 *    - aí não há o que empilhar. Hoje o único caso é o **Elf**: os quatro traços
 *    do Elf 2024 (Darkvision/Keen Senses/Fey Ancestry/Trance) são exatamente os
 *    de 2014, e "Elven Lineage" é o guarda-chuva que o Pallid substitui.
 *
 * REGRA para uma entrada nova: liste os traços da base 2024 e os da base 2014.
 * Se sobrar QUALQUER coisa na 2024 além do guarda-chuva de linhagem, use
 * `'species'`. `'lineage'` é a exceção, não o padrão.
 *
 * Lista curada. Cada entrada:
 *  - `race`    raça ATUAL que recebe a linhagem ("Nome|FONTE"). Em `'species'`
 *    é só a procedência (de onde a sub-raça veio); a fusão usa `of`.
 *  - `subrace` entrada de `db.races.subrace` que volta ("Nome|FONTE").
 *  - `of`      raça LEGADA a que a sub-raça pertence no dado ("Nome|FONTE").
 *    Junto com `subrace` forma a chave de 4 campos que o 5etools usa
 *    (name/source/raceName/raceSource) - nome+fonte sozinhos não são únicos.
 *  - `as`      `'lineage'` (padrão) ou `'species'` - ver acima.
 *  - `supersedes` (opcional) traços da BASE ATUAL que esta linhagem SUBSTITUI.
 *    Uma sub-raça 2014 substituía o traço-de-linhagem 2014 (`data.overwrite:
 *    "Infernal Legacy"`), cujo nome mudou no chassi 2024 ("Fiendish Legacy"),
 *    então o merge do 5etools não acha o alvo e ANEXA - a ficha ficaria com o
 *    traço 2024 pedindo para escolher uma legacy AO LADO da legacy escolhida, e
 *    com a mecânica dele já sobrescrita pelo `additionalSpells` da linhagem.
 *    Listar o traço aqui é dizer "esta linhagem ocupa o lugar daquele".
 * @type {ReadonlyArray<{race: string, subrace: string, of: string,
 *   as?: 'lineage'|'species', supersedes?: string[]}>}
 */
export const LEGACY_SUBRACES = Object.freeze([
  // --- Elf ------------------------------------------------------------------
  // Pallid não declara overwrite (o dado 2014 do Elf não tinha traço-guarda-chuva),
  // mas ocupa o mesmo lugar: é a linhagem élfica escolhida.
  { race: 'Elf|XPHB', subrace: 'Pallid|EGW', of: 'Elf|PHB', supersedes: ['Elven Lineage'] },

  // --- Halfling: NÃO estão aqui (DDL-0063) ----------------------------------
  // Ghostwise e Lotusden foram espécies à parte entre 2026-07-22 e 2026-07-23,
  // porque o Halfling XPHB absorveu o Naturally Stealthy do Lightfoot e pendurar
  // uma irmã nele daria esse traço de graça. Hoje elas são LINHAGENS de uma nova
  // forma, `swap`: o guarda-chuva "Halfling Lineage" tira o traço absorvido da
  // base e o transforma em UMA das opções, de modo que cada linhagem TROCA em vez
  // de somar - ver `engine/legacyHalflingLineages.js`.
  //
  // Isso NÃO afrouxa a regra do `as` acima: `'species'` continua sendo a resposta
  // para uma fusão CRUA em que a base 2024 dá algo a mais. O `swap` é uma quarta
  // forma, que só se aplica quando o "algo a mais" é um traço IDENTIFICÁVEL vindo
  // de uma das sub-raças 2014 - e que exige devolvê-lo como opção.

  // --- Human: ESPÉCIE à parte -----------------------------------------------
  // Como linhagem, o Keldon somava os três traços próprios ao Resourceful +
  // Skillful + Versatile (um TALENTO de origem) do Human 2024 - um upgrade puro
  // que tornava o humano comum sem propósito. Sobre o chassi 2014 ele fica só
  // com o que é dele.
  { race: 'Human|XPHB', subrace: 'Keldon|PSD', of: 'Human|PHB', as: 'species' },

  // --- Tiefling: NÃO estão aqui (DDL-0061) ----------------------------------
  // As 11 legacies do Tiefling saíram deste registro em 2026-07-23. Elas foram
  // REESCRITAS no formato 2024 (resistência travada em fogo, atributo de
  // conjuração Int/Wis/Cha, magias remapeadas para XPHB) e voltaram a ser
  // LINHAGENS do Tiefling XPHB - ver `engine/legacyFiendishLegacies.js`.
  //
  // Isso NÃO contradiz a regra do `as` acima: ela julga a fusão CRUA, em que a
  // sub-raça soma as vantagens dos dois chassis. Uma sub-raça REESCRITA neutraliza
  // o empilhamento na fonte e por isso pode ser linhagem. Uma entrada nova sem
  // reescrita continua seguindo a regra: se a base 2024 dá algo a mais, é
  // `'species'`.
]);

/** Quebra "Nome|FONTE" em `[nome, fonte]`. */
function split(id) {
  const i = id.lastIndexOf('|');
  return i < 0 ? [id, ''] : [id.slice(0, i), id.slice(i + 1)];
}

/** Normaliza uma entrada do registro numa referência ao dado: a chave de 4
 * campos que casa `db.races.subrace`, mais a base LEGADA em que fundir. */
function toRef(entry) {
  const [name, source] = split(entry.subrace);
  const [raceName, raceSource] = split(entry.of);
  return { name, source, raceName, raceSource, supersedes: entry.supersedes ?? [] };
}

/** Índice 'Raça ATUAL|FONTE' → referências das que voltam como LINHAGEM. */
const lineagesByRace = (() => {
  const map = new Map();
  for (const entry of LEGACY_SUBRACES) {
    if (entry.as === 'species') continue;
    const list = map.get(entry.race) ?? [];
    list.push(toRef(entry));
    map.set(entry.race, list);
  }
  return map;
})();

/** As que voltam como ESPÉCIE própria (fundidas na base LEGADA `of`). */
const standaloneRefs = Object.freeze(
  LEGACY_SUBRACES.filter((e) => e.as === 'species').map(toRef),
);

/**
 * As sub-raças legadas curadas que viram LINHAGEM de uma raça ATUAL, como
 * referências ao dado.
 * @param {object|null} race  raça base ATUAL (objeto cru)
 * @returns {ReadonlyArray<{name: string, source: string, raceName: string,
 *   raceSource: string, supersedes: string[]}>}
 */
export function legacySubracesFor(race) {
  if (!race?.name) return [];
  return lineagesByRace.get(`${race.name}|${race.source}`) ?? [];
}

/**
 * As sub-raças legadas curadas que viram ESPÉCIE à parte. A `raceName`/
 * `raceSource` de cada uma é a base LEGADA em que ela deve ser fundida.
 * @returns {ReadonlyArray<{name: string, source: string, raceName: string,
 *   raceSource: string, supersedes: string[]}>}
 */
export function legacyStandaloneRefs() {
  return standaloneRefs;
}
